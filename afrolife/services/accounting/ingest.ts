import { createHash,createHmac,timingSafeEqual } from 'node:crypto';
import type { Request,Response,RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../../src/http-error.js';
import type { AuthUser } from '../../src/auth-types.js';
import type { WithUser } from './router-types.js';
import { validateBalancedJournal } from './journal-validation.js';

let secrets=new Map<string,string>();
if(process.env.ACCOUNTING_INGEST_SECRETS){const parsed=JSON.parse(process.env.ACCOUNTING_INGEST_SECRETS) as Record<string,string>;secrets=new Map(Object.entries(parsed));}
else if(process.env.ACCOUNTING_INGEST_SECRET)secrets.set('*',process.env.ACCOUNTING_INGEST_SECRET);
if(!secrets.size||[...secrets.values()].some(value=>value.length<32))throw new Error('Configure ACCOUNTING_INGEST_SECRETS or ACCOUNTING_INGEST_SECRET with key(s) of at least 32 characters');
const serviceActor='00000000-0000-4000-8000-000000000099';
const lineSchema=z.array(z.object({source_account_code:z.string().trim().min(1).max(80),debit:z.string().regex(/^\d{1,16}(?:\.\d{1,2})?$/),credit:z.string().regex(/^\d{1,16}(?:\.\d{1,2})?$/),description:z.string().max(255).optional(),product_code:z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/).optional()}).strict()).min(2).max(100);
const eventSchema=z.object({source_event_id:z.string().uuid(),source_entity_id:z.string().trim().min(1).max(160),entry_date:z.string().date(),source_reference:z.string().trim().min(1).max(160),description:z.string().trim().min(10).max(1000),lines:lineSchema,maker_id:z.string().uuid(),checker_id:z.string().uuid(),checker_reason:z.string().trim().min(10).max(1000)}).strict();
const centsDecimal=(value:bigint)=>`${value/100n}.${String(value%100n).padStart(2,'0')}`;

export const authenticateIngest:RequestHandler=(req,res,next)=>{
  const source=req.get('x-accounting-source')??'';const timestamp=req.get('x-accounting-timestamp')??'';const supplied=req.get('x-accounting-signature')??'';
  if(!/^[a-z][a-z0-9_-]{1,39}$/.test(source)||!/^\d{13}$/.test(timestamp)||!(/^[\da-f]{64}$/i.test(supplied))||Math.abs(Date.now()-Number(timestamp))>60_000){res.status(401).json({error:'Invalid accounting source signature'});return;}
  const bodyHash=createHash('sha256').update(JSON.stringify(req.body??null)).digest('hex');
  const key=secrets.get(source)??secrets.get('*');if(!key){res.status(401).json({error:'Unknown accounting source'});return;}
  const expected=createHmac('sha256',key).update(`${source}\n${timestamp}\n${req.method}\n${req.originalUrl}\n${bodyHash}`).digest('hex');
  const a=Buffer.from(supplied,'hex'),b=Buffer.from(expected,'hex');if(a.length!==b.length||!timingSafeEqual(a,b)){res.status(401).json({error:'Invalid accounting source signature'});return;}
  res.locals.accountingSource=source;next();
};

export function createIngestHandler(withUser:WithUser){
  return async(req:Request,res:Response)=>{
    const source=String(res.locals.accountingSource??'');const body=eventSchema.parse(req.body);
    if(body.maker_id===body.checker_id)throw new HttpError(409,'Distinct maker and checker identities are required for each source journal');
    const debit=validateBalancedJournal(body.lines,'Source event');
    const hash=createHash('sha256').update(JSON.stringify({source,...body})).digest('hex');
    const user:AuthUser={id:body.maker_id,role:'global_admin'};
    const result=await withUser(user,async(client)=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${source}:${body.source_event_id}`]);
      const prior=(await client.query('SELECT entity_id,journal_id,payload_hash FROM accounting_source_events WHERE source_system=$1 AND source_event_id=$2',[source,body.source_event_id])).rows[0];
      if(prior){if(prior.payload_hash!==hash)throw new HttpError(409,'Source event ID was reused with a different payload');return {entity_id:prior.entity_id,journal_id:prior.journal_id,replayed:true};}
      const mapping=(await client.query(`SELECT m.entity_id FROM accounting_source_mappings m JOIN accounting_entities e ON e.id=m.entity_id
        WHERE m.source_system=$1 AND m.source_entity_id=$2 AND m.active AND e.status='active'`,[source,body.source_entity_id])).rows[0];
      if(!mapping)throw new HttpError(409,'No active Accounting entity mapping exists for this source entity');
      const entityId=mapping.entity_id;
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`accounting-reference:${entityId}:${body.source_reference}`]);
      const referenceOwner=(await client.query('SELECT id FROM accounting_journals WHERE entity_id=$1 AND source_reference=$2',[entityId,body.source_reference])).rows[0];
      if(referenceOwner)throw new HttpError(409,'Accounting transaction reference is already in use');
      const period=(await client.query(`SELECT id FROM accounting_periods WHERE entity_id=$1 AND status='open' AND $2::date BETWEEN period_start AND period_end ORDER BY period_start LIMIT 1`,[entityId,body.entry_date])).rows[0];
      if(!period)throw new HttpError(409,'No open Accounting period covers this source transaction date');
      const codes=body.lines.map(x=>x.source_account_code);
      const mapped=(await client.query(`SELECT source_account_code,account_id FROM accounting_source_account_maps
        WHERE entity_id=$1 AND source_system=$2 AND active AND source_account_code=ANY($3::text[])`,[entityId,source,codes])).rows;
      const accountIds=new Map(mapped.map(x=>[x.source_account_code,x.account_id]));
      if(accountIds.size!==new Set(codes).size)throw new HttpError(409,'A source account has no approved mapping in the Accounting entity');
      const productCodes=[...new Set(body.lines.flatMap(line=>line.product_code?[line.product_code]:[]))];
      const products=productCodes.length?(await client.query(`SELECT id,code FROM accounting_products WHERE entity_id=$1
        AND product_type='offering' AND status='active' AND code=ANY($2::text[])`,[entityId,productCodes])).rows:[];
      const productIds=new Map(products.map(product=>[product.code,product.id]));
      if(productIds.size!==productCodes.length)throw new HttpError(409,'A source product has no active offering in the mapped Accounting entity');
      const journal=(await client.query(`INSERT INTO accounting_journals(entity_id,period_id,idempotency_key,payload_hash,entry_date,source_reference,description,amount,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[entityId,period.id,body.source_event_id,hash,body.entry_date,body.source_reference,body.description,centsDecimal(debit),body.maker_id])).rows[0];
      for(const [i,line] of body.lines.entries())await client.query(`INSERT INTO accounting_journal_lines(journal_id,entity_id,line_no,account_id,description,debit,credit,product_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[journal.id,entityId,i+1,accountIds.get(line.source_account_code),line.description??null,line.debit,line.credit,line.product_code?productIds.get(line.product_code):null]);
      await client.query("UPDATE accounting_journals SET status='pending_approval' WHERE id=$1",[journal.id]);
      await client.query("UPDATE accounting_journals SET status='posted',approved_by=$2,approval_reason=$3 WHERE id=$1",[journal.id,body.checker_id,`Source ${source} finalized transaction ${body.source_event_id}: ${body.checker_reason}`]);
      await client.query(`INSERT INTO accounting_source_events(entity_id,source_system,source_event_id,payload_hash,journal_id) VALUES($1,$2,$3,$4,$5)`,[entityId,source,body.source_event_id,hash,journal.id]);
      await client.query(`INSERT INTO accounting_audit(entity_id,actor_id,action,record_type,record_id,details) VALUES($1,$2,'source_event_posted','accounting_journal',$3,$4)`,[entityId,serviceActor,journal.id,JSON.stringify({source_system:source,source_event_id:body.source_event_id,source_entity_id:body.source_entity_id,maker_id:body.maker_id,checker_id:body.checker_id})]);
      return {entity_id:entityId,journal_id:journal.id,replayed:false};
    });res.status(result.replayed?200:201).json(result);
  };
}
