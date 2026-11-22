CREATE TABLE accounting_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES accounting_entities(id),
  parent_product_id uuid,
  product_type text NOT NULL CHECK (product_type IN ('division','offering')),
  code varchar(40) NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  name varchar(160) NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 2 AND 1000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id,code),
  UNIQUE (id,entity_id),
  FOREIGN KEY (parent_product_id,entity_id)
    REFERENCES accounting_products(id,entity_id),
  CHECK (
    (product_type='division' AND parent_product_id IS NULL)
    OR (product_type='offering' AND parent_product_id IS NOT NULL)
  )
);
CREATE INDEX accounting_products_entity_parent_idx
  ON accounting_products(entity_id,parent_product_id,code);

CREATE FUNCTION accounting_guard_product_hierarchy() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE parent_type text;
BEGIN
  IF NEW.product_type='offering' THEN
    SELECT product_type INTO parent_type
    FROM accounting_products
    WHERE id=NEW.parent_product_id AND entity_id=NEW.entity_id;
    IF parent_type IS DISTINCT FROM 'division' THEN
      RAISE EXCEPTION 'Accounting offerings must belong to a division in the same entity';
    END IF;
  END IF;
  IF TG_OP='UPDATE' AND (
    NEW.entity_id IS DISTINCT FROM OLD.entity_id
    OR NEW.parent_product_id IS DISTINCT FROM OLD.parent_product_id
    OR NEW.product_type IS DISTINCT FROM OLD.product_type
    OR NEW.code IS DISTINCT FROM OLD.code
  ) THEN
    RAISE EXCEPTION 'Accounting product identity and hierarchy are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER accounting_product_hierarchy_guard
  BEFORE INSERT OR UPDATE ON accounting_products
  FOR EACH ROW EXECUTE FUNCTION accounting_guard_product_hierarchy();

CREATE TABLE accounting_product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL,
  product_id uuid NOT NULL,
  price_unit text NOT NULL CHECK (price_unit IN (
    'hour','visit','week','month','sqm','day','course',
    'percentage_of_gross_monthly_rent','quote'
  )),
  pricing_model text NOT NULL CHECK (pricing_model IN ('fixed','range','percentage','quote')),
  minimum_rate numeric(18,4),
  maximum_rate numeric(18,4),
  currency char(3),
  source_note text NOT NULL CHECK (length(trim(source_note)) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected','retired')),
  requested_by uuid NOT NULL,
  reviewed_by uuid,
  review_reason text,
  effective_from date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  FOREIGN KEY (product_id,entity_id) REFERENCES accounting_products(id,entity_id),
  UNIQUE (id,entity_id),
  CHECK (minimum_rate IS NULL OR minimum_rate>=0),
  CHECK (maximum_rate IS NULL OR maximum_rate>=0),
  CHECK (
    (pricing_model='quote' AND price_unit='quote' AND minimum_rate IS NULL AND maximum_rate IS NULL)
    OR (pricing_model='fixed' AND price_unit<>'quote' AND minimum_rate IS NOT NULL AND maximum_rate=minimum_rate)
    OR (pricing_model='range' AND price_unit<>'quote' AND minimum_rate IS NOT NULL AND maximum_rate>=minimum_rate)
    OR (pricing_model='percentage' AND price_unit='percentage_of_gross_monthly_rent'
        AND minimum_rate IS NOT NULL AND maximum_rate>=minimum_rate AND maximum_rate<=100)
  ),
  CHECK (
    (price_unit='percentage_of_gross_monthly_rent' AND currency IS NULL)
    OR (price_unit<>'percentage_of_gross_monthly_rent'
        AND (currency IS NULL OR currency ~ '^[A-Z]{3}$'))
  ),
  CHECK (
    (status='draft' AND reviewed_by IS NULL AND reviewed_at IS NULL
      AND review_reason IS NULL AND effective_from IS NULL AND effective_to IS NULL)
    OR (status IN ('approved','retired') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
      AND length(trim(coalesce(review_reason,'')))>=10 AND effective_from IS NOT NULL
      AND (effective_to IS NULL OR effective_to>=effective_from))
    OR (status='rejected' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
      AND length(trim(coalesce(review_reason,'')))>=10 AND effective_from IS NULL AND effective_to IS NULL)
  )
);
CREATE INDEX accounting_product_prices_entity_product_status_idx
  ON accounting_product_prices(entity_id,product_id,status,effective_from);

CREATE FUNCTION accounting_guard_product_price() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'draft' OR NEW.requested_by IS DISTINCT FROM nullif(current_setting('app.user_id',true),'')::uuid THEN
      RAISE EXCEPTION 'Product prices must be submitted as drafts by the authenticated requester';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status='approved' AND NEW.status='retired' THEN
    IF NEW.entity_id IS DISTINCT FROM OLD.entity_id
       OR NEW.product_id IS DISTINCT FROM OLD.product_id
       OR NEW.price_unit IS DISTINCT FROM OLD.price_unit
       OR NEW.pricing_model IS DISTINCT FROM OLD.pricing_model
       OR NEW.minimum_rate IS DISTINCT FROM OLD.minimum_rate
       OR NEW.maximum_rate IS DISTINCT FROM OLD.maximum_rate
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.source_note IS DISTINCT FROM OLD.source_note
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
       OR NEW.reviewed_by IS DISTINCT FROM nullif(current_setting('app.user_id',true),'')::uuid
       OR NEW.reviewed_by=OLD.requested_by
       OR NEW.effective_to IS NULL OR NEW.effective_to<OLD.effective_from
       OR length(trim(coalesce(NEW.review_reason,'')))<10
       OR NEW.reviewed_at IS NULL THEN
      RAISE EXCEPTION 'Retiring a price requires an independent reviewer, effective end date, and reason';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status<>'draft' THEN
    RAISE EXCEPTION 'Reviewed product prices are immutable; submit a new version instead';
  END IF;
  IF NEW.status NOT IN ('approved','rejected')
     OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.price_unit IS DISTINCT FROM OLD.price_unit
     OR NEW.pricing_model IS DISTINCT FROM OLD.pricing_model
     OR NEW.minimum_rate IS DISTINCT FROM OLD.minimum_rate
     OR NEW.maximum_rate IS DISTINCT FROM OLD.maximum_rate
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.source_note IS DISTINCT FROM OLD.source_note
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.reviewed_by IS DISTINCT FROM nullif(current_setting('app.user_id',true),'')::uuid
     OR NEW.reviewed_by=OLD.requested_by
     OR length(trim(coalesce(NEW.review_reason,'')))<10
     OR NEW.reviewed_at IS NULL THEN
    RAISE EXCEPTION 'Product price review requires an independent reviewer and reason';
  END IF;
  IF NEW.status='approved' THEN
    IF NEW.effective_from IS NULL OR (NEW.effective_to IS NOT NULL AND NEW.effective_to<NEW.effective_from) THEN
      RAISE EXCEPTION 'An approved product price requires a valid effective date range';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(
      NEW.entity_id::text||':'||NEW.product_id::text||':'||NEW.price_unit||':'||coalesce(NEW.currency,''),
      0
    ));
    IF EXISTS (
      SELECT 1 FROM accounting_product_prices p
      WHERE p.entity_id=NEW.entity_id AND p.product_id=NEW.product_id
        AND p.price_unit=NEW.price_unit AND p.currency IS NOT DISTINCT FROM NEW.currency
        AND p.status='approved'
        AND daterange(p.effective_from,coalesce(p.effective_to,'infinity'::date),'[]')
          && daterange(NEW.effective_from,coalesce(NEW.effective_to,'infinity'::date),'[]')
    ) THEN
      RAISE EXCEPTION 'Approved prices for the same product and unit cannot have overlapping effective dates';
    END IF;
  ELSIF NEW.effective_from IS NOT NULL OR NEW.effective_to IS NOT NULL THEN
    RAISE EXCEPTION 'Rejected product prices cannot have effective dates';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER accounting_product_price_guard
  BEFORE INSERT OR UPDATE ON accounting_product_prices
  FOR EACH ROW EXECUTE FUNCTION accounting_guard_product_price();

CREATE TABLE accounting_product_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL,
  product_id uuid NOT NULL,
  scenario_code varchar(80) NOT NULL,
  scenario_name varchar(200) NOT NULL,
  plan_year_index smallint NOT NULL CHECK (plan_year_index BETWEEN 1 AND 20),
  revenue_target numeric(18,2) NOT NULL CHECK (revenue_target>=0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  source_note text NOT NULL CHECK (length(trim(source_note)) BETWEEN 10 AND 1000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id,entity_id) REFERENCES accounting_products(id,entity_id),
  UNIQUE(entity_id,product_id,scenario_code,plan_year_index)
);
CREATE INDEX accounting_product_targets_entity_scenario_idx
  ON accounting_product_targets(entity_id,scenario_code,plan_year_index);

ALTER TABLE accounting_journal_lines
  ADD COLUMN product_id uuid;
ALTER TABLE accounting_journal_lines
  ADD CONSTRAINT accounting_journal_lines_product_entity_fk
  FOREIGN KEY (product_id,entity_id) REFERENCES accounting_products(id,entity_id);
ALTER TABLE accounting_document_lines
  ADD COLUMN product_id uuid;
ALTER TABLE accounting_document_lines
  ADD CONSTRAINT accounting_document_lines_product_entity_fk
  FOREIGN KEY (product_id,entity_id) REFERENCES accounting_products(id,entity_id);
CREATE INDEX accounting_journal_lines_entity_product_idx
  ON accounting_journal_lines(entity_id,product_id) WHERE product_id IS NOT NULL;
CREATE INDEX accounting_document_lines_entity_product_idx
  ON accounting_document_lines(entity_id,product_id) WHERE product_id IS NOT NULL;

ALTER TABLE accounting_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_products FORCE ROW LEVEL SECURITY;
CREATE POLICY accounting_products_read ON accounting_products FOR SELECT
  USING(accounting_can_access(entity_id,ARRAY['entity_admin','finance_manager','accountant','reviewer','auditor','viewer']));
CREATE POLICY accounting_products_insert ON accounting_products FOR INSERT
  WITH CHECK(accounting_can_access(entity_id,ARRAY['entity_admin','finance_manager','accountant']));
CREATE POLICY accounting_products_update ON accounting_products FOR UPDATE
  USING(accounting_can_access(entity_id,ARRAY['entity_admin','finance_manager']))
  WITH CHECK(accounting_can_access(entity_id,ARRAY['entity_admin','finance_manager']));
GRANT SELECT,INSERT,UPDATE ON accounting_products TO "{{role}}";

ALTER TABLE accounting_product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_product_prices FORCE ROW LEVEL SECURITY;
CREATE POLICY accounting_product_prices_read ON accounting_product_prices FOR SELECT
  USING(accounting_can_access(entity_id,ARRAY['entity_admin','finance_manager','accountant','reviewer','auditor','viewer']));
CREATE POLICY accounting_product_prices_insert ON accounting_product_prices FOR INSERT
  WITH CHECK(accounting_can_access(entity_id,ARRAY['entity_admin','finance_manager','accountant']));
CREATE POLICY accounting_product_prices_review ON accounting_product_prices FOR UPDATE
  USING(accounting_can_access(entity_id,ARRAY['entity_admin','finance_manager','reviewer']))
  WITH CHECK(accounting_can_access(entity_id,ARRAY['entity_admin','finance_manager','reviewer']));
GRANT SELECT,INSERT,UPDATE ON accounting_product_prices TO "{{role}}";

ALTER TABLE accounting_product_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_product_targets FORCE ROW LEVEL SECURITY;
CREATE POLICY accounting_product_targets_read ON accounting_product_targets FOR SELECT
  USING(accounting_can_access(entity_id,ARRAY['entity_admin','finance_manager','accountant','reviewer','auditor','viewer']));
CREATE POLICY accounting_product_targets_insert ON accounting_product_targets FOR INSERT
  WITH CHECK(accounting_can_access(entity_id,ARRAY['entity_admin','finance_manager','accountant']));
GRANT SELECT,INSERT ON accounting_product_targets TO "{{role}}";
