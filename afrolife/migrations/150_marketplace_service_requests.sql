CREATE TABLE marketplace_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES marketplace_listings(id),
  buyer_user_id uuid NOT NULL REFERENCES users(id),
  seller_user_id uuid NOT NULL REFERENCES users(id),
  preferred_date date,
  request_details text NOT NULL CHECK (length(trim(request_details)) BETWEEN 20 AND 2000),
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','quoted','accepted','declined','scheduled','in_progress',
      'awaiting_customer_confirmation','completed','cancelled')),
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  quote_amount numeric(14,2),
  quote_currency char(3),
  quote_expires_on date,
  quote_terms text,
  quoted_by uuid REFERENCES users(id),
  quoted_at timestamptz,
  customer_decision_by uuid REFERENCES users(id),
  customer_decision_at timestamptz,
  scheduled_for date,
  scheduled_by uuid REFERENCES users(id),
  scheduled_at timestamptz,
  work_started_by uuid REFERENCES users(id),
  work_started_at timestamptz,
  completion_note text,
  provider_completed_by uuid REFERENCES users(id),
  provider_completed_at timestamptz,
  customer_confirmed_by uuid REFERENCES users(id),
  customer_confirmed_at timestamptz,
  cancelled_by uuid REFERENCES users(id),
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_user_id,idempotency_key),
  CHECK (quote_amount IS NULL OR quote_amount > 0),
  CHECK (quote_currency IS NULL OR quote_currency ~ '^[A-Z]{3}$'),
  CHECK ((status = 'requested' AND quote_amount IS NULL AND quote_currency IS NULL
          AND quote_expires_on IS NULL AND quote_terms IS NULL AND quoted_by IS NULL AND quoted_at IS NULL)
      OR (status <> 'requested' AND status <> 'cancelled'
          AND quote_amount IS NOT NULL AND quote_currency IS NOT NULL
          AND quote_expires_on IS NOT NULL AND quote_terms IS NOT NULL
          AND quoted_by IS NOT NULL AND quoted_at IS NOT NULL)
      OR (status = 'cancelled' AND
          ((quote_amount IS NULL AND quote_currency IS NULL AND quote_expires_on IS NULL
            AND quote_terms IS NULL AND quoted_by IS NULL AND quoted_at IS NULL)
           OR (quote_amount IS NOT NULL AND quote_currency IS NOT NULL AND quote_expires_on IS NOT NULL
            AND quote_terms IS NOT NULL AND quoted_by IS NOT NULL AND quoted_at IS NOT NULL))),
  CHECK (status NOT IN ('accepted','declined','scheduled','in_progress','awaiting_customer_confirmation','completed')
      OR (customer_decision_by = buyer_user_id AND customer_decision_at IS NOT NULL)),
  CHECK (status NOT IN ('scheduled','in_progress','awaiting_customer_confirmation','completed')
      OR (scheduled_for IS NOT NULL AND scheduled_by = seller_user_id AND scheduled_at IS NOT NULL)),
  CHECK (status NOT IN ('in_progress','awaiting_customer_confirmation','completed')
      OR (work_started_by = seller_user_id AND work_started_at IS NOT NULL)),
  CHECK (status NOT IN ('awaiting_customer_confirmation','completed')
      OR (length(trim(coalesce(completion_note,''))) >= 10
          AND provider_completed_by = seller_user_id AND provider_completed_at IS NOT NULL)),
  CHECK (status <> 'completed'
      OR (customer_confirmed_by = buyer_user_id AND customer_confirmed_at IS NOT NULL)),
  CHECK (status <> 'cancelled'
      OR (cancelled_by IS NOT NULL AND length(trim(coalesce(cancellation_reason,''))) >= 10
          AND cancelled_at IS NOT NULL)),
  CHECK (preferred_date IS NULL OR preferred_date >= (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date),
  CHECK (quote_expires_on IS NULL OR quote_expires_on >= (quoted_at AT TIME ZONE 'Africa/Addis_Ababa')::date),
  CHECK (scheduled_for IS NULL OR scheduled_for >= (scheduled_at AT TIME ZONE 'Africa/Addis_Ababa')::date)
);

CREATE INDEX marketplace_service_requests_buyer_idx
  ON marketplace_service_requests(buyer_user_id,created_at DESC);
CREATE INDEX marketplace_service_requests_seller_status_idx
  ON marketplace_service_requests(seller_user_id,status,created_at);
CREATE INDEX marketplace_service_requests_listing_idx
  ON marketplace_service_requests(listing_id,created_at DESC);

CREATE FUNCTION marketplace_guard_service_request() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE actor uuid := app_user_id();
role_name text := app_role();
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'requested' OR NEW.buyer_user_id IS DISTINCT FROM actor
       OR role_name<>'customer'
       OR NEW.seller_user_id IS NOT DISTINCT FROM actor
       OR NEW.quoted_by IS NOT NULL OR NEW.quoted_at IS NOT NULL
       OR NEW.customer_decision_by IS NOT NULL OR NEW.customer_decision_at IS NOT NULL
       OR NEW.scheduled_by IS NOT NULL OR NEW.scheduled_at IS NOT NULL
       OR NEW.scheduled_for IS NOT NULL
       OR NEW.work_started_by IS NOT NULL OR NEW.work_started_at IS NOT NULL
       OR NEW.provider_completed_by IS NOT NULL OR NEW.provider_completed_at IS NOT NULL
       OR NEW.completion_note IS NOT NULL
       OR NEW.customer_confirmed_by IS NOT NULL OR NEW.customer_confirmed_at IS NOT NULL
       OR NEW.cancelled_by IS NOT NULL OR NEW.cancelled_at IS NOT NULL
       OR NEW.cancellation_reason IS NOT NULL
       OR NOT EXISTS (
         SELECT 1 FROM marketplace_listings listing
         WHERE listing.id=NEW.listing_id AND listing.seller_user_id=NEW.seller_user_id
           AND listing.status='published' AND listing.domain='services'
           AND listing.transaction_mode='service'
       ) THEN
      RAISE EXCEPTION 'A customer can request a quote only for a published service listing';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.listing_id IS DISTINCT FROM OLD.listing_id
     OR NEW.buyer_user_id IS DISTINCT FROM OLD.buyer_user_id
     OR NEW.seller_user_id IS DISTINCT FROM OLD.seller_user_id
     OR NEW.preferred_date IS DISTINCT FROM OLD.preferred_date
     OR NEW.request_details IS DISTINCT FROM OLD.request_details
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Service request identity and inquiry details are immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status<>'quoted' AND (
      NEW.quote_amount IS DISTINCT FROM OLD.quote_amount
      OR NEW.quote_currency IS DISTINCT FROM OLD.quote_currency
      OR NEW.quote_expires_on IS DISTINCT FROM OLD.quote_expires_on
      OR NEW.quote_terms IS DISTINCT FROM OLD.quote_terms
      OR NEW.quoted_by IS DISTINCT FROM OLD.quoted_by
      OR NEW.quoted_at IS DISTINCT FROM OLD.quoted_at
    ) THEN
      RAISE EXCEPTION 'A quote can only be created during the quote-offered transition';
    END IF;
    IF NEW.status NOT IN ('accepted','declined') AND (
      NEW.customer_decision_by IS DISTINCT FROM OLD.customer_decision_by
      OR NEW.customer_decision_at IS DISTINCT FROM OLD.customer_decision_at
    ) THEN
      RAISE EXCEPTION 'Customer decision evidence can only change while deciding an open quote';
    END IF;
    IF NEW.status<>'scheduled' AND (
      NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
      OR NEW.scheduled_by IS DISTINCT FROM OLD.scheduled_by
      OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
    ) THEN
      RAISE EXCEPTION 'A service schedule can only be created during scheduling';
    END IF;
    IF NEW.status<>'in_progress' AND (
      NEW.work_started_by IS DISTINCT FROM OLD.work_started_by
      OR NEW.work_started_at IS DISTINCT FROM OLD.work_started_at
    ) THEN
      RAISE EXCEPTION 'Work start evidence can only be recorded during service start';
    END IF;
    IF NEW.status<>'awaiting_customer_confirmation' AND (
      NEW.completion_note IS DISTINCT FROM OLD.completion_note
      OR NEW.provider_completed_by IS DISTINCT FROM OLD.provider_completed_by
      OR NEW.provider_completed_at IS DISTINCT FROM OLD.provider_completed_at
    ) THEN
      RAISE EXCEPTION 'Completion evidence can only be recorded when submitting work for confirmation';
    END IF;
    IF NEW.status<>'completed' AND (
      NEW.customer_confirmed_by IS DISTINCT FROM OLD.customer_confirmed_by
      OR NEW.customer_confirmed_at IS DISTINCT FROM OLD.customer_confirmed_at
    ) THEN
      RAISE EXCEPTION 'Customer confirmation can only change while confirming completion';
    END IF;
    IF NEW.status<>'cancelled' AND (
      NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
      OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
      OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
    ) THEN
      RAISE EXCEPTION 'Cancellation evidence can only be recorded when cancelling a request';
    END IF;
    IF OLD.status='requested' AND NEW.status IN ('quoted','cancelled') THEN
      IF NEW.status='quoted' THEN
        IF (actor IS DISTINCT FROM OLD.seller_user_id
            AND role_name NOT IN ('global_admin','super_admin','corporate_business_manager'))
           OR NEW.quoted_by IS DISTINCT FROM actor OR NEW.quoted_at IS NULL
           OR NEW.quote_amount IS NULL OR NEW.quote_currency IS NULL
           OR NEW.quote_expires_on IS NULL
           OR NEW.quote_expires_on < (now() AT TIME ZONE 'Africa/Addis_Ababa')::date
           OR length(trim(coalesce(NEW.quote_terms,'')))<10 THEN
          RAISE EXCEPTION 'A service quote requires the listing seller, a valid amount, expiry, and terms';
        END IF;
      END IF;
    ELSIF OLD.status='quoted' AND NEW.status IN ('accepted','declined','cancelled') THEN
      IF NEW.status IN ('accepted','declined') AND (
        actor IS DISTINCT FROM OLD.buyer_user_id OR NEW.customer_decision_by IS DISTINCT FROM actor
        OR NEW.customer_decision_at IS NULL
        OR OLD.quote_expires_on < (now() AT TIME ZONE 'Africa/Addis_Ababa')::date
      ) THEN
        RAISE EXCEPTION 'Only the customer can decide an unexpired service quote';
      END IF;
    ELSIF OLD.status='accepted' AND NEW.status IN ('scheduled','cancelled') THEN
      IF NEW.status='scheduled' AND (
        (actor IS DISTINCT FROM OLD.seller_user_id
         AND role_name NOT IN ('global_admin','super_admin','corporate_business_manager'))
        OR NEW.scheduled_by IS DISTINCT FROM actor OR NEW.scheduled_at IS NULL
        OR NEW.scheduled_for IS NULL
        OR NEW.scheduled_for < (now() AT TIME ZONE 'Africa/Addis_Ababa')::date
      ) THEN
        RAISE EXCEPTION 'The listing seller must schedule an accepted service for a current or future date';
      END IF;
    ELSIF OLD.status='scheduled' AND NEW.status IN ('in_progress','cancelled') THEN
      IF NEW.status='in_progress' AND (
        (actor IS DISTINCT FROM OLD.seller_user_id
         AND role_name NOT IN ('global_admin','super_admin','corporate_business_manager'))
        OR NEW.work_started_by IS DISTINCT FROM actor OR NEW.work_started_at IS NULL
      ) THEN
        RAISE EXCEPTION 'The listing seller must record service start';
      END IF;
    ELSIF OLD.status='in_progress' AND NEW.status='awaiting_customer_confirmation' THEN
      IF (actor IS DISTINCT FROM OLD.seller_user_id AND NOT app_is_staff()
          AND role_name NOT IN ('global_admin','corporate_business_manager'))
         OR NEW.provider_completed_by IS DISTINCT FROM actor
         OR NEW.provider_completed_at IS NULL
         OR length(trim(coalesce(NEW.completion_note,'')))<10 THEN
        RAISE EXCEPTION 'The listing seller must provide a completion note before customer confirmation';
      END IF;
    ELSIF OLD.status='awaiting_customer_confirmation' AND NEW.status='completed' THEN
      IF actor IS DISTINCT FROM OLD.buyer_user_id
         OR NEW.customer_confirmed_by IS DISTINCT FROM actor
         OR NEW.customer_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Only the requesting customer can confirm service completion';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid service request state transition';
    END IF;
    IF NEW.status='cancelled'
       AND ((actor IS DISTINCT FROM OLD.buyer_user_id AND actor IS DISTINCT FROM OLD.seller_user_id
             AND role_name NOT IN ('global_admin','super_admin','corporate_business_manager'))
         OR NEW.cancelled_by IS DISTINCT FROM actor
         OR NEW.cancelled_at IS NULL
         OR length(trim(coalesce(NEW.cancellation_reason,'')))<10) THEN
      RAISE EXCEPTION 'A service request can only be cancelled before work begins with an authorized actor and reason';
    END IF;
  ELSIF (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN
    RAISE EXCEPTION 'Service request records are immutable except through an audited state transition';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER marketplace_service_request_guard
  BEFORE INSERT OR UPDATE ON marketplace_service_requests
  FOR EACH ROW EXECUTE FUNCTION marketplace_guard_service_request();

ALTER TABLE marketplace_service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_service_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY marketplace_service_requests_read ON marketplace_service_requests FOR SELECT
  USING (buyer_user_id=app_user_id() OR seller_user_id=app_user_id()
    OR app_role() IN ('global_admin','super_admin','corporate_business_manager'));
CREATE POLICY marketplace_service_requests_create ON marketplace_service_requests FOR INSERT
  WITH CHECK (buyer_user_id=app_user_id() AND app_role()='customer');
CREATE POLICY marketplace_service_requests_update ON marketplace_service_requests FOR UPDATE
  USING (buyer_user_id=app_user_id() OR seller_user_id=app_user_id()
    OR app_role() IN ('global_admin','super_admin','corporate_business_manager'))
  WITH CHECK (buyer_user_id=app_user_id() OR seller_user_id=app_user_id()
    OR app_role() IN ('global_admin','super_admin','corporate_business_manager'));
GRANT SELECT,INSERT,UPDATE ON marketplace_service_requests TO "{{role}}";

UPDATE marketplace_configuration configuration
SET config_value = configuration.config_value || COALESCE((
  SELECT jsonb_agg(proposed.category)
  FROM jsonb_array_elements(
    '[{"key":"ethiocare","label":"EthioCare","enabled":true},
      {"key":"bright_spaces","label":"Bright Spaces","enabled":true},
      {"key":"dls","label":"Domestic and Lifestyle Support","enabled":true},
      {"key":"rpm","label":"Rental and Property Management","enabled":true},
      {"key":"sks","label":"Shared Kitchen Service","enabled":true},
      {"key":"training","label":"Training Center","enabled":true}]'::jsonb
  ) AS proposed(category)
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(configuration.config_value) AS existing(value)
    WHERE existing.value->>'key'=proposed.category->>'key'
  )
), '[]'::jsonb)
WHERE configuration.scope='services' AND configuration.config_key='categories';
