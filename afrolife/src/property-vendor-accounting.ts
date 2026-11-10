import { Router, type Request, type Response, type RequestHandler } from 'express';
import { z } from 'zod';
import { pool, withUser, requireRole, HttpError } from './core.js';
import { audit, post } from './domain.js';
import { enqueueAccountingEvent } from './accounting-outbox.js';
import { canReconcileVendorPayment, isVendorInvoiceEligible } from './property-accounting.js';

const h=(fn:(req:Request,res:Response)=>Promise<unknown>):RequestHandler=>(req,res,next)=>{fn(req,res).catch(next);};
const cents=(amount:number)=>{
  const value=Math.round(amount*100);
  if(!Number.isSafeInteger(value)||value<=0||Math.abs(amount*100-value)>1e-7)throw new HttpError(422,'Enter a positive amount with at most two decimal places');
  return (value/100).toFixed(2);
};
const finance=['finance','finance_manager','super_admin','global_admin'] as const;
const reviewers=['finance_manager','super_admin','global_admin'] as const;

export const propertyVendorAccounting=Router();

propertyVendorAccounting.post('/property-vendors',requireRole(...finance),h(async(req,res)=>{
  const b=z.object({name:z.string().trim().min(2).max(200),tax_id:z.string().trim().min(3).max(40).optional(),phone:z.string().trim().min(7).max(30).optional(),email:z.string().trim().email().max(320).optional()}).strict().parse(req.body);
  const row=await withUser(req.user!,async c=>{
    const vendor=(await c.query(`INSERT INTO property_vendors(name,tax_id,phone,email,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [b.name,b.tax_id??null,b.phone??null,b.email?.toLowerCase()??null,req.user!.id])).rows[0];
    await audit(c,req.user!.id,'property_vendor_created','property_vendor',vendor.id,null,{name:vendor.name,tax_id:vendor.tax_id});
    return vendor;
  });res.status(201).json(row);
}));
propertyVendorAccounting.get('/property-vendors',requireRole(...finance),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT vendor.id,vendor.name,vendor.tax_id,vendor.phone,vendor.email,vendor.active,vendor.created_at,
    coalesce(sum(bill.amount) FILTER(WHERE bill.status IN ('approved','payment_pending')),0)::numeric(14,2)::text AS accounts_payable
    FROM property_vendors vendor LEFT JOIN property_vendor_bills bill ON bill.vendor_id=vendor.id
    WHERE vendor.active GROUP BY vendor.id ORDER BY vendor.name LIMIT 500`)).rows));
}));

propertyVendorAccounting.get('/property-vendor-bills',requireRole(...finance),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT bill.*,vendor.name AS vendor_name,maintenance.property_id,property.address
    FROM property_vendor_bills bill JOIN property_vendors vendor ON vendor.id=bill.vendor_id
    JOIN maintenance_requests maintenance ON maintenance.id=bill.maintenance_request_id
    JOIN properties property ON property.id=maintenance.property_id ORDER BY bill.created_at DESC LIMIT 500`)).rows));
}));

propertyVendorAccounting.post('/maintenance/:id/vendor-bills',requireRole(...finance),h(async(req,res)=>{
  const b=z.object({vendor_id:z.string().uuid(),invoice_reference:z.string().trim().min(1).max(160),amount:z.number().positive().finite(),invoice_date:z.string().date(),due_date:z.string().date()}).strict().parse(req.body);
  const amount=cents(b.amount);if(b.due_date<b.invoice_date)throw new HttpError(422,'Bill due date must be on or after invoice date');
  const row=await withUser(req.user!,async c=>{
    const maintenance=(await c.query(`SELECT id,status,COALESCE(cost,0)::numeric(14,2)::text AS approved_amount
      FROM maintenance_requests WHERE id=$1 FOR UPDATE`,[req.params.id])).rows[0];
    if(!maintenance)throw new HttpError(404,'Maintenance request not found');
    if(!isVendorInvoiceEligible(maintenance.status))throw new HttpError(409,'Vendor invoices can only be recorded for completed work orders');
    const amountCents=Math.round(Number(amount)*100);
    const expectedCents=Math.round(Number(maintenance.approved_amount)*100);
    const matchStatus=amountCents===expectedCents?'matched':'mismatch';
    const bill=(await c.query(`INSERT INTO property_vendor_bills
      (maintenance_request_id,vendor_id,invoice_reference,amount,invoice_date,due_date,recorded_by,
       expected_amount,match_status,match_variance)
      SELECT $1,vendor.id,$3,$4,$5,$6,$7,$8,$9,$10
      FROM property_vendors vendor WHERE vendor.id=$2 AND vendor.active RETURNING *`,
      [maintenance.id,b.vendor_id,b.invoice_reference,amount,b.invoice_date,b.due_date,req.user!.id,
        maintenance.approved_amount,matchStatus,((amountCents-expectedCents)/100).toFixed(2)])).rows[0];
    if(!bill)throw new HttpError(404,'Active vendor not found');
    await audit(c,req.user!.id,'property_vendor_bill_recorded','property_vendor_bill',bill.id,null,{vendor_id:bill.vendor_id,invoice_reference:bill.invoice_reference,amount:bill.amount});
    return bill;
  });res.status(201).json(row);
}));

propertyVendorAccounting.get('/property-vendor-bills/pending',requireRole(...reviewers),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT bill.*,vendor.name AS vendor_name,maintenance.property_id FROM property_vendor_bills bill
    JOIN property_vendors vendor ON vendor.id=bill.vendor_id JOIN maintenance_requests maintenance ON maintenance.id=bill.maintenance_request_id
    WHERE bill.status='pending_approval' AND bill.match_status IN ('matched','accepted_exception')
    ORDER BY bill.created_at LIMIT 200`)).rows));
}));

propertyVendorAccounting.post('/property-vendor-bills/:id/decision',requireRole(...reviewers),h(async(req,res)=>{
  const b=z.object({decision:z.enum(['approve','reject']),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const row=await withUser(req.user!,async c=>{
    const bill=(await c.query(`SELECT bill.*,vendor.name AS vendor_name,maintenance.property_id FROM property_vendor_bills bill
      JOIN property_vendors vendor ON vendor.id=bill.vendor_id JOIN maintenance_requests maintenance ON maintenance.id=bill.maintenance_request_id
      WHERE bill.id=$1 FOR UPDATE OF bill`,[req.params.id])).rows[0];
    if(!bill)throw new HttpError(404,'Vendor bill not found');
    if(bill.status!=='pending_approval')throw new HttpError(409,'Vendor bill is not awaiting approval');
    if(!['matched','accepted_exception'].includes(bill.match_status))throw new HttpError(409,'Resolve the invoice-to-work mismatch before invoice approval');
    if(bill.recorded_by===req.user!.id)throw new HttpError(403,'A different Finance Manager must approve or reject this vendor bill');
    const status=b.decision==='approve'?'approved':'rejected';
    if(status==='approved'){
      await post(c,'property_vendor_bill',bill.id,[['Maintenance Expense',Number(bill.amount),0],['Accounts Payable',0,Number(bill.amount)]]);
      await enqueueAccountingEvent(c,{source_entity_id:bill.property_id,entry_date:String(bill.invoice_date).slice(0,10),
        source_reference:`property-vendor-invoice:${bill.vendor_id}:${bill.invoice_reference}`,
        description:`Approved maintenance invoice ${bill.invoice_reference} from ${bill.vendor_name}`,
        lines:[{source_account_code:'maintenance_expense',debit:String(bill.amount),credit:'0.00'},
          {source_account_code:'accounts_payable',debit:'0.00',credit:String(bill.amount)}],
        maker_id:bill.recorded_by,checker_id:req.user!.id,checker_reason:b.reason});
    }
    const updated=(await c.query(`UPDATE property_vendor_bills SET status=$2,approved_by=$3,approval_reason=$4,approved_at=now() WHERE id=$1 RETURNING *`,
      [bill.id,status,req.user!.id,b.reason])).rows[0];
    await audit(c,req.user!.id,'property_vendor_bill_'+status,'property_vendor_bill',bill.id,{status:'pending_approval'},{status,reason:b.reason});return updated;
  });res.json(row);
}));

propertyVendorAccounting.post('/property-vendor-bills/:id/payments',requireRole(...finance),h(async(req,res)=>{
  const b=z.object({payment_reference:z.string().trim().min(3).max(160),payment_channel:z.string().trim().min(2).max(40),payment_date:z.string().date()}).strict().parse(req.body);
  const row=await withUser(req.user!,async c=>{
    const bill=(await c.query('SELECT * FROM property_vendor_bills WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];
    if(!bill)throw new HttpError(404,'Vendor bill not found');if(bill.status!=='approved')throw new HttpError(409,'Only an approved, unpaid vendor bill can have payment recorded');
    return (await c.query(`UPDATE property_vendor_bills SET status='payment_pending',payment_reference=$2,payment_channel=$3,payment_date=$4,payment_recorded_by=$5
      WHERE id=$1 AND status='approved' RETURNING *`,[bill.id,b.payment_reference,b.payment_channel,b.payment_date,req.user!.id])).rows[0];
  });res.status(201).json(row);
}));

propertyVendorAccounting.get('/property-vendor-payments/pending',requireRole(...reviewers),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT bill.*,vendor.name AS vendor_name,maintenance.property_id FROM property_vendor_bills bill
    JOIN property_vendors vendor ON vendor.id=bill.vendor_id JOIN maintenance_requests maintenance ON maintenance.id=bill.maintenance_request_id
    WHERE bill.status='payment_pending' ORDER BY bill.created_at LIMIT 200`)).rows));
}));

propertyVendorAccounting.post('/property-vendor-payments/:id/reconcile',requireRole(...reviewers),h(async(req,res)=>{
  const b=z.object({reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const row=await withUser(req.user!,async c=>{
    const bill=(await c.query(`SELECT bill.*,vendor.name AS vendor_name,maintenance.property_id FROM property_vendor_bills bill
      JOIN property_vendors vendor ON vendor.id=bill.vendor_id JOIN maintenance_requests maintenance ON maintenance.id=bill.maintenance_request_id
      WHERE bill.id=$1 FOR UPDATE OF bill`,[req.params.id])).rows[0];
    if(!bill)throw new HttpError(404,'Vendor bill not found');if(bill.status!=='payment_pending')throw new HttpError(409,'Vendor bill payment is not awaiting reconciliation');
    if(!canReconcileVendorPayment({
      invoiceApproverId: bill.approved_by,
      paymentRecorderId: bill.payment_recorded_by,
      reconcilerId: req.user!.id,
    }))throw new HttpError(403,'Payment reconciliation requires a different Finance Manager from the invoice approver and payment recorder');
    await post(c,'property_vendor_payment',bill.id,[['Accounts Payable',Number(bill.amount),0],['Cash',0,Number(bill.amount)]]);
    await enqueueAccountingEvent(c,{source_entity_id:bill.property_id,entry_date:String(bill.payment_date).slice(0,10),
      source_reference:`property-vendor-payment:${bill.payment_reference}`,
      description:`Paid vendor invoice ${bill.invoice_reference} to ${bill.vendor_name}`,
      lines:[{source_account_code:'accounts_payable',debit:String(bill.amount),credit:'0.00'},
        {source_account_code:'cash',debit:'0.00',credit:String(bill.amount)}],
      maker_id:bill.payment_recorded_by,checker_id:req.user!.id,checker_reason:b.reason});
    const updated=(await c.query(`UPDATE property_vendor_bills SET status='paid',payment_reconciled_by=$2,payment_reason=$3,payment_reconciled_at=now()
      WHERE id=$1 AND status='payment_pending' RETURNING *`,[bill.id,req.user!.id,b.reason])).rows[0];
    await audit(c,req.user!.id,'property_vendor_payment_reconciled','property_vendor_bill',bill.id,{status:'payment_pending'},{status:'paid',payment_reference:bill.payment_reference});return updated;
  });res.json(row);
}));
