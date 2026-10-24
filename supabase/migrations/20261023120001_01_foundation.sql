-- =============================================================================
-- MIGRATION 01/05 -- FOUNDATION
-- Helpers, admin allow-list, payment_attempts ledger, rate limits, audit tables,
-- new columns/constraints, write-guard triggers.
--
-- Run order: 01 -> 02 -> 03 -> 04 -> 05  (05 is the lock-down, run it LAST).
-- Prerequisite: supabase/schema.sql already applied. Safe to re-run (idempotent).
-- Run as the `postgres` role (Supabase SQL Editor does this).
-- =============================================================================
BEGIN;

-- Every function created from now on is private by default (05 re-asserts this explicitly).
DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter default privileges (%). Migration 05 still revokes explicitly.', SQLERRM;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Small helpers
-- -----------------------------------------------------------------------------

-- Domain/validation error: SQLSTATE 'SB001'. The edge layer shows these messages to users;
-- every other error is masked.
CREATE OR REPLACE FUNCTION public.sb_fail(p_msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '%', p_msg USING ERRCODE = 'SB001';
END;
$$;

-- Role claimed by the current PostgREST request ('anon' | 'authenticated' | 'service_role');
-- NULL for direct database connections (SQL editor, migrations).
CREATE OR REPLACE FUNCTION public.request_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )
$$;

-- Strip HTML angle brackets / control characters, collapse newlines, trim.
CREATE OR REPLACE FUNCTION public.sb_clean_text(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[\r\n\t]+', ' ', 'g'), '[<>[:cntrl:]]', '', 'g'))
$$;

-- Cryptographically random code from a 32-char unambiguous alphabet (no 0/O/1/I).
-- Source: gen_random_uuid() (pg_strong_random). Bytes holding the fixed UUID version/variant
-- bits (offsets 6 and 8) are skipped so every used byte is fully random. 32 divides 256 => no modulo bias.
CREATE OR REPLACE FUNCTION public._sb_random_code(
  p_len integer,
  p_alphabet text DEFAULT '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
) RETURNS text LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_u1 bytea; v_u2 bytea; v_pool bytea; v_out text := ''; i integer;
BEGIN
  IF p_len < 1 OR p_len > 28 OR length(p_alphabet) <> 32 THEN
    RAISE EXCEPTION '_sb_random_code: bad arguments';
  END IF;
  v_u1 := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_u2 := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_pool := substring(v_u1 FROM 1 FOR 6) || substring(v_u1 FROM 8 FOR 1) || substring(v_u1 FROM 10 FOR 7)
         || substring(v_u2 FROM 1 FOR 6) || substring(v_u2 FROM 8 FOR 1) || substring(v_u2 FROM 10 FOR 7);
  FOR i IN 0 .. p_len - 1 LOOP
    v_out := v_out || substr(p_alphabet, (get_byte(v_pool, i) % 32) + 1, 1);
  END LOOP;
  RETURN v_out;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Admin allow-list (Supabase Auth users who may use the admin console)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
$$;

-- -----------------------------------------------------------------------------
-- 3. Audit / security / rate-limit tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       text NOT NULL,
  severity   text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor      uuid,
  action     text NOT NULL,
  target     text,
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket       text NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

CREATE OR REPLACE FUNCTION public._sb_security_event(p_kind text, p_severity text, p_detail jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO public.security_events (kind, severity, detail) VALUES (p_kind, p_severity, coalesce(p_detail, '{}'::jsonb))
$$;

CREATE OR REPLACE FUNCTION public._sb_audit(p_actor uuid, p_action text, p_target text, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO public.admin_audit_log (actor, action, target, detail) VALUES (p_actor, p_action, p_target, coalesce(p_detail, '{}'::jsonb))
$$;

-- Fixed-window counter shared by all edge isolates. service_role only (see 05).
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_bucket text, p_window_seconds integer, p_max integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start timestamptz;
  v_hits  integer;
BEGIN
  IF p_window_seconds < 1 OR p_max < 1 OR p_bucket IS NULL OR length(p_bucket) > 200 THEN
    PERFORM public.sb_fail('Invalid rate limit parameters');
  END IF;
  v_start := to_timestamp(floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.api_rate_limits AS r (bucket, window_start, hits)
  VALUES (p_bucket, v_start, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING r.hits INTO v_hits;

  IF random() < 0.01 THEN  -- opportunistic cleanup
    DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN jsonb_build_object(
    'allowed',    v_hits <= p_max,
    'hits',       v_hits,
    'remaining',  greatest(0, p_max - v_hits),
    'retryAfter', greatest(1, ceil(extract(epoch FROM (v_start + make_interval(secs => p_window_seconds) - clock_timestamp())))::integer)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Tables the payment flow depends on (no-ops when schema.sql already created them)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id             serial PRIMARY KEY,
  gateway        text NOT NULL,
  transaction_id text NOT NULL,
  order_code     text NOT NULL,
  amount         numeric(10, 2) NOT NULL,
  currency       text NOT NULL DEFAULT 'BDT',
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_gateway_tokens (
  gateway       text PRIMARY KEY,
  token         text NOT NULL,
  refresh_token text,
  expires_at    timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Global replay guard: a gateway transaction id can be recorded exactly once, ever.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pwe_gateway_trx
  ON public.processed_webhook_events (gateway, transaction_id);

-- Rewrite gateway CHECKs (drop any existing ones that mention `gateway`, then add the canonical one).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('public.processed_webhook_events'::regclass, 'public.payment_transactions'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%gateway%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
  ALTER TABLE public.processed_webhook_events
    ADD CONSTRAINT pwe_gateway_chk CHECK (gateway IN ('bkash', 'nagad', 'sslcommerz', 'manual_verify'));
  ALTER TABLE public.payment_transactions
    ADD CONSTRAINT pt_gateway_chk CHECK (gateway IN ('bkash', 'nagad', 'sslcommerz', 'manual_verify'));
END $$;

-- A transaction id may be `validated` only once per gateway (fails loudly if duplicates already exist).
CREATE UNIQUE INDEX IF NOT EXISTS uq_pt_validated_trx
  ON public.payment_transactions (gateway, transaction_id) WHERE status = 'validated';

-- -----------------------------------------------------------------------------
-- 5. Orders / coupons: new columns and integrity constraints
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payable_now    numeric(10, 2) NOT NULL DEFAULT 0 CHECK (payable_now >= 0);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at        timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_ip_hash text;

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS max_uses   integer CHECK (max_uses IS NULL OR max_uses > 0);
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- total must always equal subtotal - discount + delivery (+ admin weight adjustment).
-- NOT VALID: enforced for every new/updated row without rewriting legacy rows
-- (list violators with the audit script, then optionally VALIDATE CONSTRAINT).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_consistent') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_total_consistent
      CHECK (total_amount = greatest(0, subtotal - discount_amount + delivery_charge + weight_adjustment_amount)) NOT VALID;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. payment_attempts: the server-side binding between a gateway session and ONE order.
--    Written BEFORE the customer is redirected; callbacks resolve the order from here,
--    never from query-string input.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           text NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  order_code         text NOT NULL,
  gateway            text NOT NULL CHECK (gateway IN ('bkash', 'nagad')),
  purpose            text NOT NULL CHECK (purpose IN ('initial', 'due')),
  expected_amount    numeric(10, 2) NOT NULL CHECK (expected_amount > 0),
  currency           text NOT NULL DEFAULT 'BDT' CHECK (currency = 'BDT'),
  gateway_order_ref  text NOT NULL UNIQUE,   -- bKash merchantInvoiceNumber / Nagad orderId we send
  gateway_payment_id text,                   -- bKash paymentID / Nagad paymentReferenceId
  gateway_trx_id     text,                   -- bKash trxID / Nagad issuerPaymentRefNo (on success)
  status             text NOT NULL DEFAULT 'created'
                     CHECK (status IN ('created', 'redirected', 'executing', 'succeeded', 'failed',
                                       'cancelled', 'expired', 'needs_review')),
  failure_reason     text,
  raw_payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_ip_hash     text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pa_gateway_payment
  ON public.payment_attempts (gateway, gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pa_order   ON public.payment_attempts (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pa_status  ON public.payment_attempts (status, created_at);
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

-- Other useful indexes / uniqueness
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders (created_at DESC);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.product_reviews GROUP BY order_code, product_id HAVING count(*) > 1) THEN
    RAISE NOTICE 'product_reviews has duplicate (order_code, product_id) rows: unique index NOT created. Clean them up and re-run.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_order_product ON public.product_reviews (order_code, product_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. Defense in depth: even if a GRANT/policy is ever loosened by mistake, API roles
--    (anon / authenticated) can never write the money tables. Direct DB sessions and
--    service_role (our server) pass; so do SECURITY DEFINER functions called by service_role.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.forbid_api_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.request_role() IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Direct writes to % are not permitted', TG_TABLE_NAME USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_immutable_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.order_code IS DISTINCT FROM OLD.order_code
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'orders.id / order_code / created_at are immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders', 'order_items', 'payment_transactions', 'payment_attempts',
                           'processed_webhook_events', 'admin_audit_log', 'security_events']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_forbid_api_writes ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_forbid_api_writes BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
                   'FOR EACH ROW EXECUTE FUNCTION public.forbid_api_writes()', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_orders_immutable ON public.orders;
CREATE TRIGGER trg_orders_immutable BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_immutable_columns();

COMMIT;
