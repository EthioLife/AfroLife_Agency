CREATE OR REPLACE FUNCTION enforce_property_vendor_bill_completed_work_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  work_status text;
BEGIN
  SELECT status
    INTO work_status
    FROM maintenance_requests
   WHERE id=NEW.maintenance_request_id
   FOR SHARE;

  IF work_status IS NULL THEN
    RAISE EXCEPTION 'Maintenance work order is unavailable for invoice matching'
      USING ERRCODE='23503';
  END IF;

  IF work_status NOT IN ('completed','done') THEN
    RAISE EXCEPTION 'Vendor invoices require a completed work order'
      USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER property_vendor_bill_completed_work_order_guard
  BEFORE INSERT OR UPDATE OF maintenance_request_id ON property_vendor_bills
  FOR EACH ROW
  EXECUTE FUNCTION enforce_property_vendor_bill_completed_work_order();
