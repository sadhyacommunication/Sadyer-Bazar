-- SADYER BAZAR — ONE-CLICK MASTER PRODUCTION SQL MIGRATION

-- ============================================================================
-- SADYER BAZAR (à¦¸à¦¾à¦§à§à¦¯à§‡à¦° à¦¬à¦¾à¦œà¦¾à¦°) â€” SUPABASE POSTGRESQL SCHEMA & RLS SECURITY
-- Project: sadhyarbazar (https://uqyjtlndgnvfqjcdwbop.supabase.co)
-- Instructions: Copy & Paste this entire file into Supabase SQL Editor and click RUN.
--
-- NOTE (security hardening): this file is the BASELINE (tables) only. Its legacy policies and
-- functions below are insecure and are REMOVED by supabase/migrations/..._05_rls_lockdown.sql.
-- After running this file you MUST run migrations 01 -> 05 (see supabase/README.md).
-- ============================================================================

-- 1. SITE SETTINGS TABLE (Admin Configurable Delivery Charges & Business Rules)
CREATE TABLE IF NOT EXISTS public.site_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    inside_dhaka_fee NUMERIC(10, 2) NOT NULL DEFAULT 70.00,
    outside_dhaka_fee NUMERIC(10, 2) NOT NULL DEFAULT 130.00,
    free_delivery_threshold NUMERIC(10, 2) NOT NULL DEFAULT 3000.00,
    enable_free_delivery BOOLEAN NOT NULL DEFAULT true,
    preorder_advance_percent INT NOT NULL DEFAULT 25 CHECK (preorder_advance_percent BETWEEN 0 AND 100),
    support_phone TEXT NOT NULL DEFAULT '01713477780-81',
    whatsapp_number TEXT NOT NULL DEFAULT '8801713477780',
    bkash_merchant_number TEXT NOT NULL DEFAULT '01713-477780',
    bkash_account_type TEXT NOT NULL DEFAULT 'merchant',
    nagad_number TEXT NOT NULL DEFAULT '01713-477780',
    nagad_account_type TEXT NOT NULL DEFAULT 'personal',
    nagad_enabled BOOLEAN NOT NULL DEFAULT true,
    announcement_en TEXT NOT NULL DEFAULT 'Pre-Order Live: Fresh Jamuna River Fish & Authentic Bogura Shahi Doi â€” Nationwide Home Delivery!',
    announcement_bn TEXT NOT NULL DEFAULT 'à¦¯à¦®à§à¦¨à¦¾ à¦¨à¦¦à§€à¦° à¦¤à¦¾à¦œà¦¾ à¦®à¦¾à¦› à¦“ à¦¬à¦—à§à§œà¦¾à¦° à¦¶à¦¾à¦¹à§€ à¦¦à¦‡à§Ÿà§‡à¦° à¦ªà§à¦°à¦¿-à¦…à¦°à§à¦¡à¦¾à¦° à¦šà¦²à¦›à§‡!',
    sslcommerz_enabled BOOLEAN NOT NULL DEFAULT true,
    sslcommerz_store_id TEXT DEFAULT '',
    sslcommerz_is_live BOOLEAN NOT NULL DEFAULT false,
    bkash_enabled BOOLEAN NOT NULL DEFAULT true,
    bkash_app_key TEXT DEFAULT '',
    cod_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safely purge secret columns if they exist from prior schema versions
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS sslcommerz_store_password;
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS bkash_app_secret;

-- 2. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_bn TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    badge_text TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name TEXT NOT NULL DEFAULT 'Jamuna River Fish',
    category_slug TEXT NOT NULL DEFAULT 'jamuna-river-fish',
    title TEXT NOT NULL,
    title_bn TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    short_description TEXT NOT NULL,
    description TEXT NOT NULL,
    origin_source TEXT NOT NULL DEFAULT 'Sirajganj / Jamuna River Basin',
    primary_image TEXT NOT NULL,
    gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_preorder BOOLEAN NOT NULL DEFAULT false,
    preorder_cutoff_at TIMESTAMPTZ,
    expected_delivery_date TEXT,
    batch_target_qty INT NOT NULL DEFAULT 50,
    batch_booked_qty INT NOT NULL DEFAULT 0,
    unit_type TEXT NOT NULL DEFAULT 'kg',
    cutting_options JSONB NOT NULL DEFAULT '[]'::jsonb,
    nutrition_highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
    seo_title TEXT,
    seo_description TEXT,
    search_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_featured BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 4.95,
    review_count INT NOT NULL DEFAULT 28,
    variants JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PRODUCT VARIANTS TABLE
CREATE TABLE IF NOT EXISTS public.product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    weight_grams INT NOT NULL DEFAULT 1000,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(10, 2),
    stock_qty INT NOT NULL DEFAULT 100,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. COUPONS / PROMO CODES TABLE
CREATE TABLE IF NOT EXISTS public.coupons (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    title_bn TEXT,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('flat', 'percentage')),
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
    min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_discount_amount NUMERIC(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ORDERS TABLE (with Scale Weight Adjustment & Cold-Chain Courier Tracking)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_code TEXT NOT NULL UNIQUE, -- Format: SB-YYMM-XXXXX
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_zone TEXT NOT NULL CHECK (delivery_zone IN ('inside_dhaka', 'outside_dhaka')),
    customer_district TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    customer_note TEXT,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    delivery_charge NUMERIC(10, 2) NOT NULL CHECK (delivery_charge >= 0),
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    coupon_code TEXT,
    weight_adjustment_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    weight_adjustment_note TEXT,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    advance_paid NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (advance_paid >= 0),
    due_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (due_amount >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('bkash', 'nagad', 'sslcommerz', 'cod')),
    payment_plan TEXT NOT NULL CHECK (payment_plan IN ('full', 'advance', 'cod')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'advance_paid', 'paid', 'failed', 'refunded')),
    order_status TEXT NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    has_preorder_items BOOLEAN NOT NULL DEFAULT false,
    transaction_id TEXT,
    courier_name TEXT,
    tracking_reference TEXT,
    rider_name TEXT,
    rider_phone TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    fraud_risk_score INT NOT NULL DEFAULT 0,
    is_suspicious BOOLEAN NOT NULL DEFAULT false,
    review_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_phone_verified BOOLEAN NOT NULL DEFAULT false,
    verification_method TEXT DEFAULT 'unverified',
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe migration for existing orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fraud_risk_score INT NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS review_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'unverified';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- 7. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT,
    variant_id TEXT,
    product_title TEXT NOT NULL,
    product_title_bn TEXT NOT NULL,
    product_image TEXT NOT NULL,
    variant_label TEXT NOT NULL,
    cutting_preference TEXT,
    is_preorder BOOLEAN NOT NULL DEFAULT false,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0)
);

-- 8. PAYMENT TRANSACTIONS TABLE (Audit Trail for bKash, Nagad & SSLCommerz)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_code TEXT NOT NULL,
    gateway TEXT NOT NULL CHECK (gateway IN ('bkash', 'nagad', 'sslcommerz', 'manual_verify')),
    transaction_id TEXT NOT NULL,
    validation_id TEXT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'BDT',
    status TEXT NOT NULL CHECK (status IN ('initiated', 'validated', 'failed')),
    sender_phone TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. PROCESSED WEBHOOK EVENTS TABLE (Idempotency Key & Anti-Replay Engine)
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
    id SERIAL PRIMARY KEY,
    gateway TEXT NOT NULL CHECK (gateway IN ('bkash', 'nagad', 'sslcommerz')),
    transaction_id TEXT NOT NULL,
    order_code TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BDT',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gateway_trx UNIQUE (gateway, transaction_id)
);

-- 9. VERIFIED PRODUCT REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    order_code TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_district TEXT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. CONTACT INQUIRIES & HELPDESK MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON public.orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status);

INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

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


-- =============================================================================
-- MIGRATION 02/05 -- ORDERS: server-side pricing, creation, tracking, cancellation
--
-- ALL prices, delivery fees, coupons and payable amounts are computed here, in SQL NUMERIC,
-- from database rows. Nothing price-related is ever read from the client request.
-- Every function below is EXECUTE-granted to service_role ONLY (migration 05); the browser
-- reaches them exclusively through our rate-limited /api/* Pages Functions.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- Internal: compact, client-safe order summary
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sb_order_summary(p_order public.orders)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'orderId',          p_order.id,
    'orderCode',        p_order.order_code,
    'subtotal',         p_order.subtotal,
    'deliveryCharge',   p_order.delivery_charge,
    'discountAmount',   p_order.discount_amount,
    'totalAmount',      p_order.total_amount,
    'payableNow',       p_order.payable_now,
    'advancePaid',      p_order.advance_paid,
    'dueAmount',        p_order.due_amount,
    'paymentMethod',    p_order.payment_method,
    'paymentPlan',      p_order.payment_plan,
    'paymentStatus',    p_order.payment_status,
    'orderStatus',      p_order.order_status,
    'hasPreorderItems', p_order.has_preorder_items,
    'isSuspicious',     p_order.is_suspicious,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'productId',         i.product_id,
               'variantId',         i.variant_id,
               'productTitle',      i.product_title,
               'productTitleBn',    i.product_title_bn,
               'productImage',      i.product_image,
               'variantLabel',      i.variant_label,
               'cuttingPreference', i.cutting_preference,
               'isPreorder',        i.is_preorder,
               'quantity',          i.quantity,
               'unitPrice',         i.unit_price,
               'lineTotal',         i.line_total) ORDER BY i.id)
      FROM public.order_items i WHERE i.order_id = p_order.id), '[]'::jsonb)
  )
$$;

-- -----------------------------------------------------------------------------
-- Internal: the single pricing engine. Read-only. Used by quote_order_server (preview)
-- and create_order_server (real order) so both always agree.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sb_quote_order(
  p_items  jsonb,
  p_zone   text,
  p_coupon text,
  p_method text,
  p_plan   text
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings     public.site_settings;
  v_item         jsonb;
  v_row          record;
  v_qty          integer;
  v_cut          text;
  v_line         numeric(12, 2);
  v_subtotal     numeric(12, 2) := 0;
  v_fee          numeric(12, 2);
  v_discount     numeric(12, 2) := 0;
  v_total        numeric(12, 2);
  v_payable      numeric(12, 2);
  v_has_preorder boolean := false;
  v_items        jsonb := '[]'::jsonb;
  v_coupon       public.coupons;
  v_coupon_code  text := nullif(btrim(coalesce(p_coupon, '')), '');
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    PERFORM public.sb_fail('Your basket is invalid');
  END IF;
  IF jsonb_array_length(p_items) < 1 THEN PERFORM public.sb_fail('Your basket is empty'); END IF;
  IF jsonb_array_length(p_items) > 30 THEN PERFORM public.sb_fail('Too many line items in your basket'); END IF;
  IF p_zone IS NULL OR p_zone NOT IN ('inside_dhaka', 'outside_dhaka') THEN
    PERFORM public.sb_fail('Please choose a valid delivery area');
  END IF;
  IF p_method IS NULL OR p_method NOT IN ('bkash', 'nagad', 'cod') THEN
    PERFORM public.sb_fail('Unsupported payment method');
  END IF;
  IF p_plan IS NULL OR p_plan NOT IN ('full', 'advance', 'cod') THEN
    PERFORM public.sb_fail('Unsupported payment plan');
  END IF;
  IF (p_method = 'cod') <> (p_plan = 'cod') THEN
    PERFORM public.sb_fail('Payment plan does not match the payment method');
  END IF;

  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1;
  IF NOT FOUND THEN PERFORM public.sb_fail('Store settings are not initialised'); END IF;
  IF (p_method = 'bkash' AND NOT coalesce(v_settings.bkash_enabled, false))
     OR (p_method = 'nagad' AND NOT coalesce(v_settings.nagad_enabled, false))
     OR (p_method = 'cod' AND NOT coalesce(v_settings.cod_enabled, false)) THEN
    PERFORM public.sb_fail('This payment method is currently unavailable');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN PERFORM public.sb_fail('Your basket is invalid'); END IF;
    IF coalesce(v_item ->> 'quantity', '') !~ '^[0-9]{1,2}$' THEN PERFORM public.sb_fail('Invalid item quantity'); END IF;
    v_qty := (v_item ->> 'quantity')::integer;
    IF v_qty < 1 OR v_qty > 50 THEN PERFORM public.sb_fail('Quantity must be between 1 and 50'); END IF;

    SELECT pv.id AS variant_id, pv.product_id, pv.label, pv.price, pv.stock_qty,
           p.title, p.title_bn, p.primary_image, p.is_preorder, p.is_active,
           p.preorder_cutoff_at, p.batch_target_qty, p.batch_booked_qty, p.cutting_options
      INTO v_row
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
     WHERE pv.id = (v_item ->> 'variantId')
       AND pv.product_id = (v_item ->> 'productId');

    IF NOT FOUND THEN PERFORM public.sb_fail('An item in your basket is no longer available'); END IF;
    IF NOT v_row.is_active THEN
      PERFORM public.sb_fail(format('%s is currently unavailable', v_row.title));
    END IF;

    IF v_row.is_preorder THEN
      IF v_row.preorder_cutoff_at IS NOT NULL AND v_row.preorder_cutoff_at <= now() THEN
        PERFORM public.sb_fail(format('Pre-orders for %s have closed', v_row.title));
      END IF;
      IF v_row.batch_booked_qty + v_qty > v_row.batch_target_qty THEN
        PERFORM public.sb_fail(format('%s: this batch is fully booked', v_row.title));
      END IF;
      v_has_preorder := true;
    ELSIF v_row.stock_qty < v_qty THEN
      PERFORM public.sb_fail(format('Insufficient stock for %s', v_row.title));
    END IF;

    v_cut := public.sb_clean_text(v_item ->> 'cuttingPreference');
    IF v_cut <> '' THEN
      IF jsonb_typeof(v_row.cutting_options) = 'array' AND jsonb_array_length(v_row.cutting_options) > 0 THEN
        IF NOT (v_row.cutting_options @> to_jsonb(v_cut)) THEN
          PERFORM public.sb_fail(format('Invalid preparation option for %s', v_row.title));
        END IF;
      ELSE
        v_cut := '';
      END IF;
    END IF;

    v_line := v_row.price * v_qty;
    v_subtotal := v_subtotal + v_line;
    v_items := v_items || jsonb_build_object(
      'productId',         v_row.product_id,
      'variantId',         v_row.variant_id,
      'productTitle',      v_row.title,
      'productTitleBn',    v_row.title_bn,
      'productImage',      v_row.primary_image,
      'variantLabel',      v_row.label,
      'cuttingPreference', v_cut,
      'isPreorder',        v_row.is_preorder,
      'quantity',          v_qty,
      'unitPrice',         v_row.price,
      'lineTotal',         v_line);
  END LOOP;

  -- Delivery fee (admin-configurable), free above threshold on the pre-discount subtotal
  IF p_zone = 'inside_dhaka' THEN v_fee := v_settings.inside_dhaka_fee; ELSE v_fee := v_settings.outside_dhaka_fee; END IF;
  IF v_settings.enable_free_delivery AND v_subtotal >= v_settings.free_delivery_threshold THEN v_fee := 0; END IF;

  -- Coupon (validated against the database, never the client)
  IF v_coupon_code IS NOT NULL THEN
    IF length(v_coupon_code) > 40 THEN PERFORM public.sb_fail('This coupon code is invalid or has expired'); END IF;
    SELECT * INTO v_coupon
      FROM public.coupons c
     WHERE upper(c.code) = upper(v_coupon_code)
       AND c.is_active
       AND (c.expires_at IS NULL OR c.expires_at > now())
       AND (c.max_uses IS NULL OR c.usage_count < c.max_uses)
     LIMIT 1;
    IF NOT FOUND THEN PERFORM public.sb_fail('This coupon code is invalid or has expired'); END IF;
    IF v_subtotal < v_coupon.min_order_amount THEN
      PERFORM public.sb_fail(format('A minimum order of BDT %s is required for this coupon', v_coupon.min_order_amount));
    END IF;
    IF v_coupon.discount_type = 'percentage' THEN
      v_discount := round(v_subtotal * v_coupon.discount_value / 100.0, 0);
      IF v_coupon.max_discount_amount IS NOT NULL THEN v_discount := least(v_discount, v_coupon.max_discount_amount); END IF;
    ELSE
      v_discount := v_coupon.discount_value;
    END IF;
    v_discount := least(v_discount, v_subtotal);
  END IF;

  v_total := greatest(0, v_subtotal - v_discount + v_fee);
  IF v_total <= 0 THEN PERFORM public.sb_fail('Order total must be greater than zero'); END IF;

  IF p_plan = 'cod' THEN
    v_payable := 0;
  ELSIF p_plan = 'full' THEN
    v_payable := v_total;
  ELSE
    v_payable := least(v_total, greatest(v_fee, round(greatest(0, v_subtotal - v_discount) * v_settings.preorder_advance_percent / 100.0, 0)));
  END IF;

  RETURN jsonb_build_object(
    'items',          v_items,
    'subtotal',       v_subtotal,
    'deliveryCharge', v_fee,
    'discountAmount', v_discount,
    'couponId',       v_coupon.id,
    'couponCode',     v_coupon.code,
    'totalAmount',    v_total,
    'payableNow',     v_payable,
    'dueAfterPayable', v_total - v_payable,
    'hasPreorder',    v_has_preorder
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Public-facing (via edge only): price preview for the checkout page
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quote_order_server(
  p_items jsonb, p_delivery_zone text, p_coupon_code text, p_payment_method text, p_payment_plan text
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_q jsonb;
BEGIN
  v_q := public._sb_quote_order(p_items, p_delivery_zone, p_coupon_code, p_payment_method, p_payment_plan);
  RETURN v_q - 'couponId';
END;
$$;

-- -----------------------------------------------------------------------------
-- Create an order. Inventory, coupon usage and the order row are written atomically.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_server(
  p_customer_name     text,
  p_customer_phone    text,
  p_delivery_zone     text,
  p_customer_district text,
  p_customer_address  text,
  p_customer_note     text,
  p_coupon_code       text,
  p_payment_method    text,
  p_payment_plan      text,
  p_items             jsonb,
  p_idempotency_key   text,
  p_client_ip_hash    text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now         timestamptz := now();
  v_phone       text;
  v_name        text := public.sb_clean_text(p_customer_name);
  v_district    text := public.sb_clean_text(p_customer_district);
  v_address     text := public.sb_clean_text(p_customer_address);
  v_note        text := nullif(public.sb_clean_text(p_customer_note), '');
  v_idem        text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_quote       jsonb;
  v_existing    public.orders;
  v_order       public.orders;
  v_order_id    text;
  v_code        text;
  v_item        jsonb;
  v_qty         integer;
  v_recent_phone integer;
  v_recent_ip   integer;
  v_score       integer := 0;
  v_reasons     text[] := ARRAY[]::text[];
  v_suspicious  boolean := false;
  v_total       numeric(12, 2);
  v_attempt     integer;
BEGIN
  -- 1. Input validation (lengths mirror the client Zod schema; the DB is the last line of defence)
  v_phone := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  IF v_phone LIKE '8801%' AND length(v_phone) = 13 THEN v_phone := substr(v_phone, 3); END IF;
  IF v_phone !~ '^01[3-9][0-9]{8}$' THEN PERFORM public.sb_fail('Please enter a valid Bangladeshi mobile number'); END IF;
  IF length(v_name) < 2 OR length(v_name) > 80 THEN PERFORM public.sb_fail('Please enter your full name'); END IF;
  IF length(v_district) < 2 OR length(v_district) > 80 THEN PERFORM public.sb_fail('Please enter your district / area'); END IF;
  IF length(v_address) < 8 OR length(v_address) > 350 THEN PERFORM public.sb_fail('Please provide a complete delivery address'); END IF;
  IF v_note IS NOT NULL AND length(v_note) > 300 THEN PERFORM public.sb_fail('Order note is too long'); END IF;
  IF v_idem IS NOT NULL AND (length(v_idem) < 8 OR length(v_idem) > 100) THEN PERFORM public.sb_fail('Invalid request key'); END IF;
  IF p_client_ip_hash IS NOT NULL AND length(p_client_ip_hash) > 64 THEN PERFORM public.sb_fail('Invalid client reference'); END IF;

  -- 2. Idempotent replay: same key + same phone returns the original order summary
  IF v_idem IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.orders WHERE idempotency_key = v_idem;
    IF FOUND THEN
      IF v_existing.customer_phone <> v_phone THEN PERFORM public.sb_fail('Invalid request key'); END IF;
      RETURN public._sb_order_summary(v_existing) || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  -- 3. Velocity limits (per phone and per client)
  SELECT count(*) INTO v_recent_phone FROM public.orders
   WHERE customer_phone = v_phone AND created_at >= v_now - interval '3 hours';
  IF v_recent_phone >= 5 THEN
    PERFORM public.sb_fail('Too many orders from this number. Please wait before placing another order.');
  END IF;
  IF p_client_ip_hash IS NOT NULL THEN
    SELECT count(*) INTO v_recent_ip FROM public.orders
     WHERE client_ip_hash = p_client_ip_hash AND created_at >= v_now - interval '1 hour';
    IF v_recent_ip >= 10 THEN
      PERFORM public.sb_fail('Too many orders from your connection. Please try again later.');
    END IF;
  END IF;

  -- 4. Authoritative pricing
  v_quote := public._sb_quote_order(p_items, p_delivery_zone, p_coupon_code, p_payment_method, p_payment_plan);
  v_total := (v_quote ->> 'totalAmount')::numeric;

  -- 5. Reserve inventory atomically (conditional UPDATEs are race-safe)
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_quote -> 'items') LOOP
    v_qty := (v_item ->> 'quantity')::integer;
    IF (v_item ->> 'isPreorder')::boolean THEN
      UPDATE public.products
         SET batch_booked_qty = batch_booked_qty + v_qty, updated_at = now()
       WHERE id = (v_item ->> 'productId') AND batch_booked_qty + v_qty <= batch_target_qty;
      IF NOT FOUND THEN PERFORM public.sb_fail(format('%s: this batch is fully booked', v_item ->> 'productTitle')); END IF;
    ELSE
      UPDATE public.product_variants
         SET stock_qty = stock_qty - v_qty
       WHERE id = (v_item ->> 'variantId') AND stock_qty >= v_qty;
      IF NOT FOUND THEN PERFORM public.sb_fail(format('Insufficient stock for %s', v_item ->> 'productTitle')); END IF;
    END IF;
  END LOOP;

  IF (v_quote ->> 'couponId') IS NOT NULL THEN
    UPDATE public.coupons SET usage_count = usage_count + 1
     WHERE id = (v_quote ->> 'couponId') AND (max_uses IS NULL OR usage_count < max_uses);
    IF NOT FOUND THEN PERFORM public.sb_fail('This coupon code is invalid or has expired'); END IF;
  END IF;

  -- 6. Anti-fraud scoring
  IF p_payment_method = 'cod' AND v_total > 5000 THEN
    v_score := v_score + 35; v_reasons := array_append(v_reasons, 'High-value COD order (> BDT 5,000)');
  END IF;
  IF v_recent_phone >= 2 THEN
    v_score := v_score + 25; v_reasons := array_append(v_reasons, 'Multiple orders from same phone within 3 hours');
  END IF;
  IF p_delivery_zone = 'inside_dhaka' AND v_district !~* 'dhaka' THEN
    v_score := v_score + 20; v_reasons := array_append(v_reasons, 'Inside-Dhaka zone selected for non-Dhaka district');
  END IF;
  v_suspicious := v_score >= 35;

  -- 7. Insert order (non-guessable code: 32^10 ~ 2^50 combinations; retry on the astronomically rare collision)
  v_order_id := 'ord-' || replace(gen_random_uuid()::text, '-', '');
  FOR v_attempt IN 1 .. 5 LOOP
    v_code := 'SB-' || to_char(v_now, 'YYMM') || '-' || public._sb_random_code(10);
    BEGIN
      INSERT INTO public.orders (
        id, order_code, customer_name, customer_phone, delivery_zone, customer_district,
        customer_address, customer_note, subtotal, delivery_charge, discount_amount, coupon_code,
        weight_adjustment_amount, total_amount, advance_paid, due_amount, payable_now,
        payment_method, payment_plan, payment_status, order_status, has_preorder_items, items,
        fraud_risk_score, is_suspicious, review_reasons, is_phone_verified, verification_method,
        idempotency_key, client_ip_hash, created_at, updated_at
      ) VALUES (
        v_order_id, v_code, v_name, v_phone, p_delivery_zone, v_district,
        v_address, v_note, (v_quote ->> 'subtotal')::numeric, (v_quote ->> 'deliveryCharge')::numeric,
        (v_quote ->> 'discountAmount')::numeric, v_quote ->> 'couponCode',
        0, v_total, 0, v_total, (v_quote ->> 'payableNow')::numeric,
        p_payment_method, p_payment_plan, 'pending', 'pending', (v_quote ->> 'hasPreorder')::boolean, v_quote -> 'items',
        v_score, v_suspicious, to_jsonb(v_reasons), false, 'unverified',
        v_idem, p_client_ip_hash, v_now, v_now
      );
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;

  INSERT INTO public.order_items (
    id, order_id, product_id, variant_id, product_title, product_title_bn, product_image,
    variant_label, cutting_preference, is_preorder, quantity, unit_price, line_total
  )
  SELECT 'item-' || replace(gen_random_uuid()::text, '-', ''), v_order_id,
         e ->> 'productId', e ->> 'variantId', e ->> 'productTitle', e ->> 'productTitleBn',
         e ->> 'productImage', e ->> 'variantLabel', nullif(e ->> 'cuttingPreference', ''),
         (e ->> 'isPreorder')::boolean, (e ->> 'quantity')::integer,
         (e ->> 'unitPrice')::numeric, (e ->> 'lineTotal')::numeric
    FROM jsonb_array_elements(v_quote -> 'items') AS e;

  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  RETURN public._sb_order_summary(v_order) || jsonb_build_object(
    'idempotent', false,
    'reviewReasons', to_jsonb(v_reasons),
    'fraudRiskScore', v_score
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Order tracking. Requires BOTH the (unguessable) order code AND the last 4 phone digits;
-- a wrong guess is indistinguishable from "not found". Returns masked, minimal data.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_order_server(p_order_code text, p_phone_last4 text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order   public.orders;
  v_attempt text;
BEGIN
  IF p_order_code IS NULL OR length(p_order_code) > 40 OR coalesce(p_phone_last4, '') !~ '^[0-9]{4}$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_order FROM public.orders
   WHERE upper(order_code) = upper(btrim(p_order_code))
     AND right(customer_phone, 4) = p_phone_last4;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT a.status INTO v_attempt FROM public.payment_attempts a
   WHERE a.order_id = v_order.id ORDER BY a.created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'orderCode',        v_order.order_code,
    'createdAt',        v_order.created_at,
    'updatedAt',        v_order.updated_at,
    'orderStatus',      v_order.order_status,
    'paymentStatus',    v_order.payment_status,
    'paymentMethod',    v_order.payment_method,
    'paymentPlan',      v_order.payment_plan,
    'latestPaymentAttempt', v_attempt,
    'deliveryZone',     v_order.delivery_zone,
    'customerDistrict', v_order.customer_district,
    'customerName',     split_part(v_order.customer_name, ' ', 1),
    'maskedPhone',      left(v_order.customer_phone, 5) || '-****' || right(v_order.customer_phone, 2),
    'maskedAddress',    split_part(v_order.customer_address, ' ', 1) || ' ***, ' || v_order.customer_district,
    'subtotal',         v_order.subtotal,
    'deliveryCharge',   v_order.delivery_charge,
    'discountAmount',   v_order.discount_amount,
    'weightAdjustmentAmount', v_order.weight_adjustment_amount,
    'weightAdjustmentNote',   v_order.weight_adjustment_note,
    'totalAmount',      v_order.total_amount,
    'advancePaid',      v_order.advance_paid,
    'dueAmount',        v_order.due_amount,
    'hasPreorderItems', v_order.has_preorder_items,
    'courierName',      v_order.courier_name,
    'trackingReference', v_order.tracking_reference,
    'riderName',        v_order.rider_name,
    'riderPhone',       v_order.rider_phone,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'productId', i.product_id, 'variantId', i.variant_id,
               'productTitle', i.product_title, 'productTitleBn', i.product_title_bn,
               'productImage', i.product_image, 'variantLabel', i.variant_label,
               'cuttingPreference', i.cutting_preference, 'isPreorder', i.is_preorder,
               'quantity', i.quantity, 'unitPrice', i.unit_price, 'lineTotal', i.line_total) ORDER BY i.id)
      FROM public.order_items i WHERE i.order_id = v_order.id), '[]'::jsonb)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Cancellation (restores inventory + coupon usage). Refuses paid / shipped orders.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sb_cancel_order(p_order_id text, p_reason text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  r       record;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  IF v_order.order_status = 'cancelled' THEN RETURN jsonb_build_object('ok', true, 'idempotent', true); END IF;
  IF v_order.order_status IN ('shipped', 'delivered') THEN
    PERFORM public.sb_fail('Shipped or delivered orders cannot be cancelled');
  END IF;
  IF v_order.advance_paid > 0 THEN
    PERFORM public.sb_fail('This order has received payment. Refund it first, then cancel it.');
  END IF;

  FOR r IN SELECT i.variant_id, i.product_id, i.quantity, i.is_preorder
             FROM public.order_items i WHERE i.order_id = p_order_id LOOP
    IF r.is_preorder THEN
      UPDATE public.products SET batch_booked_qty = greatest(0, batch_booked_qty - r.quantity), updated_at = now()
       WHERE id = r.product_id;
    ELSE
      UPDATE public.product_variants SET stock_qty = stock_qty + r.quantity WHERE id = r.variant_id;
    END IF;
  END LOOP;

  IF v_order.coupon_code IS NOT NULL THEN
    UPDATE public.coupons SET usage_count = greatest(0, usage_count - 1) WHERE upper(code) = upper(v_order.coupon_code);
  END IF;

  UPDATE public.payment_attempts
     SET status = 'cancelled', failure_reason = coalesce(p_reason, 'order cancelled'), updated_at = now()
   WHERE order_id = p_order_id AND status IN ('created', 'redirected');

  UPDATE public.orders SET order_status = 'cancelled', updated_at = now() WHERE id = p_order_id;
  PERFORM public._sb_audit(p_actor, 'order.cancel', p_order_id, jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('ok', true, 'orderCode', v_order.order_code);
END;
$$;

-- Sweeper: cancels online orders whose payment was never completed, releasing stock.
-- Schedule with pg_cron, e.g.:  select cron.schedule('expire-unpaid', '*/15 * * * *', $$select public.expire_unpaid_online_orders(120)$$);
CREATE OR REPLACE FUNCTION public.expire_unpaid_online_orders(p_minutes integer DEFAULT 120)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  IF p_minutes < 30 THEN PERFORM public.sb_fail('p_minutes must be at least 30'); END IF;
  FOR r IN
    SELECT o.id FROM public.orders o
     WHERE o.payment_method IN ('bkash', 'nagad')
       AND o.payment_status = 'pending' AND o.order_status = 'pending' AND o.advance_paid = 0
       AND o.created_at < now() - make_interval(mins => p_minutes)
       AND NOT EXISTS (
         SELECT 1 FROM public.payment_attempts a
          WHERE a.order_id = o.id
            AND (a.status IN ('executing', 'needs_review')
                 OR (a.status IN ('created', 'redirected') AND a.created_at > now() - interval '45 minutes')))
  LOOP
    PERFORM public._sb_cancel_order(r.id, 'Expired: online payment was not completed', NULL);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- -----------------------------------------------------------------------------
-- Verified-purchase review (replaces the anonymous INSERT policy)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_review_server(
  p_order_code text, p_phone_last4 text, p_product_id text, p_rating integer, p_comment text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order   public.orders;
  v_comment text := public.sb_clean_text(p_comment);
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN PERFORM public.sb_fail('Rating must be between 1 and 5'); END IF;
  IF length(v_comment) < 5 OR length(v_comment) > 1000 THEN PERFORM public.sb_fail('Review must be 5 to 1000 characters'); END IF;
  IF coalesce(p_phone_last4, '') !~ '^[0-9]{4}$' THEN PERFORM public.sb_fail('Order not found'); END IF;

  SELECT * INTO v_order FROM public.orders
   WHERE upper(order_code) = upper(btrim(coalesce(p_order_code, ''))) AND right(customer_phone, 4) = p_phone_last4;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  IF v_order.order_status <> 'delivered' THEN PERFORM public.sb_fail('You can review a product after your order is delivered'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order.id AND product_id = p_product_id) THEN
    PERFORM public.sb_fail('This product is not part of that order');
  END IF;

  BEGIN
    INSERT INTO public.product_reviews (id, product_id, order_code, customer_name, customer_district, rating, comment, is_verified_purchase)
    VALUES ('rev-' || replace(gen_random_uuid()::text, '-', ''), p_product_id, v_order.order_code,
            split_part(v_order.customer_name, ' ', 1), v_order.customer_district, p_rating, v_comment, true);
  EXCEPTION WHEN unique_violation THEN
    PERFORM public.sb_fail('You have already reviewed this product for this order');
  END;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMIT;


-- =============================================================================
-- MIGRATION 03/05 -- PAYMENTS: attempt lifecycle + verified settlement
--
-- Money can only reach an order through finalize_payment_attempt(), which requires an attempt
-- that THIS SERVER created (so the order, amount and merchant reference are fixed server-side)
-- and a gateway-verified result. Replaying a trxID, paying the wrong amount, or paying for a
-- different order cannot credit an order: the attempt is parked as `needs_review` and a
-- security event is recorded.
-- All functions: service_role only (migration 05).
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- Internal helpers
-- -----------------------------------------------------------------------------

-- Why this payment may NOT be applied to this order (NULL = ok).
CREATE OR REPLACE FUNCTION public._sb_payment_blocker(p_order public.orders, p_amount numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_order.order_status = 'cancelled'                         THEN 'order_cancelled'
    WHEN p_order.payment_status = 'paid' OR p_order.due_amount <= 0 THEN 'already_paid'
    WHEN p_amount <= 0                                              THEN 'invalid_amount'
    WHEN p_order.advance_paid + p_amount > p_order.total_amount + 0.001 THEN 'overpayment'
    ELSE NULL
  END
$$;

-- Applies a (pre-validated) payment to an order and returns the updated row.
CREATE OR REPLACE FUNCTION public._sb_apply_payment(p_order_id text, p_amount numeric, p_trx text)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_blocker text;
  v_paid numeric(10, 2);
  v_due  numeric(10, 2);
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  v_blocker := public._sb_payment_blocker(v_order, p_amount);
  IF v_blocker IS NOT NULL THEN PERFORM public.sb_fail('Payment cannot be applied: ' || v_blocker); END IF;

  v_paid := v_order.advance_paid + p_amount;
  v_due  := greatest(0, v_order.total_amount - v_paid);

  UPDATE public.orders
     SET advance_paid   = v_paid,
         due_amount     = v_due,
         payment_status = CASE WHEN v_due = 0 THEN 'paid' ELSE 'advance_paid' END,
         order_status   = CASE WHEN order_status = 'pending' THEN 'confirmed' ELSE order_status END,
         transaction_id = CASE
                            WHEN transaction_id IS NULL OR transaction_id = '' THEN p_trx
                            WHEN position(p_trx IN transaction_id) > 0 THEN transaction_id
                            ELSE transaction_id || ', ' || p_trx
                          END,
         paid_at        = CASE WHEN v_due = 0 THEN now() ELSE paid_at END,
         updated_at     = now()
   WHERE id = p_order_id
   RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- Parks an attempt for human review (money moved but something does not add up). Never credits the order.
CREATE OR REPLACE FUNCTION public._sb_attempt_needs_review(p_attempt_id uuid, p_reason text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE a public.payment_attempts;
BEGIN
  UPDATE public.payment_attempts
     SET status = 'needs_review', failure_reason = p_reason,
         raw_payload = raw_payload || jsonb_build_object('review', coalesce(p_payload, '{}'::jsonb)),
         updated_at = now()
   WHERE id = p_attempt_id RETURNING * INTO a;
  PERFORM public._sb_security_event('payment_needs_review', 'critical',
    jsonb_build_object('attemptId', p_attempt_id, 'orderCode', a.order_code, 'gateway', a.gateway,
                       'reason', p_reason, 'expected', a.expected_amount));
  RETURN jsonb_build_object('ok', false, 'reason', p_reason, 'orderCode', a.order_code);
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. begin_payment_attempt: server decides purpose + amount from the ORDER ROW.
--    The client supplies nothing but an order code (and the edge supplies the gateway).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_payment_attempt(
  p_order_code     text,
  p_gateway        text,
  p_client_ip_hash text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order    public.orders;
  v_settings public.site_settings;
  v_purpose  text;
  v_amount   numeric(10, 2);
  v_ref      text;
  v_id       uuid;
  v_recent   integer;
BEGIN
  IF p_gateway IS NULL OR p_gateway NOT IN ('bkash', 'nagad') THEN PERFORM public.sb_fail('Unsupported payment gateway'); END IF;

  SELECT * INTO v_order FROM public.orders
   WHERE upper(order_code) = upper(btrim(coalesce(p_order_code, ''))) FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  IF v_order.order_status IN ('cancelled', 'delivered') THEN PERFORM public.sb_fail('This order can no longer be paid online'); END IF;
  IF v_order.payment_method = 'cod' OR v_order.payment_plan = 'cod' THEN PERFORM public.sb_fail('This is a cash-on-delivery order'); END IF;
  IF v_order.payment_status = 'paid' OR v_order.due_amount <= 0 THEN PERFORM public.sb_fail('This order is already fully paid'); END IF;

  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1;
  IF (p_gateway = 'bkash' AND NOT coalesce(v_settings.bkash_enabled, false))
     OR (p_gateway = 'nagad' AND NOT coalesce(v_settings.nagad_enabled, false)) THEN
    PERFORM public.sb_fail('This payment method is currently unavailable');
  END IF;

  IF v_order.advance_paid = 0 THEN
    v_purpose := 'initial';
    IF v_order.payment_method <> p_gateway THEN
      PERFORM public.sb_fail(format('This order must be paid with %s', v_order.payment_method));
    END IF;
    v_amount := v_order.payable_now;
  ELSE
    v_purpose := 'due';           -- advance already received: customer settles the remainder
    v_amount := v_order.due_amount;
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN PERFORM public.sb_fail('Nothing is payable for this order'); END IF;

  UPDATE public.payment_attempts SET status = 'expired', updated_at = now()
   WHERE order_id = v_order.id AND status = 'created' AND created_at < now() - interval '30 minutes';

  SELECT count(*) INTO v_recent FROM public.payment_attempts
   WHERE order_id = v_order.id AND created_at > now() - interval '1 hour';
  IF v_recent >= 8 THEN PERFORM public.sb_fail('Too many payment attempts. Please wait a while and try again.'); END IF;

  v_ref := 'SBP' || public._sb_random_code(14);   -- 17 alphanumeric chars: fits bKash invoice no. and Nagad orderId limits
  INSERT INTO public.payment_attempts (order_id, order_code, gateway, purpose, expected_amount, gateway_order_ref, client_ip_hash)
  VALUES (v_order.id, v_order.order_code, p_gateway, v_purpose, v_amount, v_ref, p_client_ip_hash)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'attemptId',       v_id,
    'orderCode',       v_order.order_code,
    'purpose',         v_purpose,
    'amount',          v_amount,
    'gatewayOrderRef', v_ref,
    'customerPhone',   v_order.customer_phone
  );
END;
$$;

-- 2. Remember the gateway's session id and mark the customer as redirected.
CREATE OR REPLACE FUNCTION public.attach_gateway_payment(p_attempt_id uuid, p_gateway_payment_id text, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_gateway_payment_id IS NULL OR btrim(p_gateway_payment_id) = '' OR length(p_gateway_payment_id) > 128 THEN
    PERFORM public.sb_fail('Invalid gateway payment id');
  END IF;
  UPDATE public.payment_attempts
     SET gateway_payment_id = btrim(p_gateway_payment_id), status = 'redirected',
         raw_payload = raw_payload || jsonb_build_object('create', coalesce(p_meta, '{}'::jsonb)),
         updated_at = now()
   WHERE id = p_attempt_id AND status = 'created';
  IF NOT FOUND THEN PERFORM public.sb_fail('Payment attempt is not in a valid state'); END IF;
END;
$$;

-- 3. Callback entry point. Resolves the attempt (and thus the order) from the GATEWAY's id and
--    atomically claims it, so concurrent/refreshed callbacks cannot execute a payment twice.
--    state: claimed | already_succeeded | in_progress | terminal | not_found
CREATE OR REPLACE FUNCTION public.claim_payment_attempt(p_gateway text, p_gateway_payment_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE a public.payment_attempts;
BEGIN
  SELECT * INTO a FROM public.payment_attempts
   WHERE gateway = p_gateway AND gateway_payment_id = btrim(coalesce(p_gateway_payment_id, '')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('state', 'not_found'); END IF;

  IF a.status = 'succeeded' THEN
    RETURN jsonb_build_object('state', 'already_succeeded', 'orderCode', a.order_code);
  END IF;
  IF a.status IN ('failed', 'cancelled', 'needs_review') THEN
    RETURN jsonb_build_object('state', 'terminal', 'status', a.status, 'orderCode', a.order_code);
  END IF;
  IF a.status = 'executing' AND a.updated_at > now() - interval '2 minutes' THEN
    RETURN jsonb_build_object('state', 'in_progress', 'orderCode', a.order_code);
  END IF;

  -- claimable: redirected | stale executing | expired (late callback: the gateway stays authoritative)
  UPDATE public.payment_attempts SET status = 'executing', updated_at = now() WHERE id = a.id;
  RETURN jsonb_build_object('state', 'claimed', 'attempt', jsonb_build_object(
    'id', a.id, 'orderId', a.order_id, 'orderCode', a.order_code, 'gateway', a.gateway,
    'purpose', a.purpose, 'expectedAmount', a.expected_amount,
    'gatewayOrderRef', a.gateway_order_ref, 'gatewayPaymentId', a.gateway_payment_id));
END;
$$;

-- Back to `redirected` when the gateway result is still pending/ambiguous (callback may be retried).
CREATE OR REPLACE FUNCTION public.release_payment_attempt(p_attempt_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.payment_attempts SET status = 'redirected', updated_at = now()
   WHERE id = p_attempt_id AND status = 'executing'
$$;

-- Definitive failure / customer cancellation reported by the gateway. Never touches the order.
CREATE OR REPLACE FUNCTION public.fail_payment_attempt(p_attempt_id uuid, p_status text, p_reason text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('failed', 'cancelled') THEN PERFORM public.sb_fail('Invalid attempt status'); END IF;
  UPDATE public.payment_attempts
     SET status = p_status, failure_reason = left(coalesce(p_reason, ''), 300),
         raw_payload = raw_payload || jsonb_build_object('failure', coalesce(p_payload, '{}'::jsonb)),
         updated_at = now(), completed_at = now()
   WHERE id = p_attempt_id AND status IN ('created', 'redirected', 'executing', 'expired');
END;
$$;

-- 4. THE settlement function. Called only after the edge has executed/verified the payment with the
--    gateway server-to-server. Re-checks everything against what THIS server stored at creation time.
CREATE OR REPLACE FUNCTION public.finalize_payment_attempt(
  p_attempt_id   uuid,
  p_trx_id       text,
  p_amount       numeric,
  p_currency     text,
  p_merchant_ref text,
  p_payload      jsonb DEFAULT '{}'::jsonb,
  p_sender_phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a        public.payment_attempts;
  v_order  public.orders;
  v_trx    text := btrim(coalesce(p_trx_id, ''));
  v_rows   integer;
  v_block  text;
BEGIN
  SELECT * INTO a FROM public.payment_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Payment attempt not found'); END IF;

  IF a.status = 'succeeded' THEN
    IF a.gateway_trx_id IS DISTINCT FROM v_trx THEN
      RETURN public._sb_attempt_needs_review(p_attempt_id, 'succeeded_attempt_seen_with_different_trx', p_payload);
    END IF;
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'orderCode', a.order_code);
  END IF;
  IF a.status <> 'executing' THEN PERFORM public.sb_fail('Payment attempt is not being processed'); END IF;

  -- Everything the gateway reports must match what we stored when we created the session.
  IF v_trx = '' OR length(v_trx) > 64 THEN RETURN public._sb_attempt_needs_review(p_attempt_id, 'missing_or_invalid_trx_id', p_payload); END IF;
  IF upper(coalesce(p_currency, '')) <> 'BDT'     THEN RETURN public._sb_attempt_needs_review(p_attempt_id, 'currency_mismatch', p_payload); END IF;
  IF p_merchant_ref IS DISTINCT FROM a.gateway_order_ref THEN RETURN public._sb_attempt_needs_review(p_attempt_id, 'merchant_reference_mismatch', p_payload); END IF;
  IF p_amount IS NULL OR abs(p_amount - a.expected_amount) > 0.001 THEN RETURN public._sb_attempt_needs_review(p_attempt_id, 'amount_mismatch', p_payload); END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = a.order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN public._sb_attempt_needs_review(p_attempt_id, 'order_missing', p_payload); END IF;
  v_block := public._sb_payment_blocker(v_order, p_amount);
  IF v_block IS NOT NULL THEN RETURN public._sb_attempt_needs_review(p_attempt_id, v_block, p_payload); END IF;
  IF a.purpose = 'initial' AND v_order.advance_paid <> 0 THEN
    RETURN public._sb_attempt_needs_review(p_attempt_id, 'duplicate_initial_payment', p_payload);
  END IF;
  IF a.purpose = 'due' AND abs(v_order.due_amount - a.expected_amount) > 0.001 THEN
    RETURN public._sb_attempt_needs_review(p_attempt_id, 'due_amount_changed', p_payload);
  END IF;

  -- Global anti-replay: a gateway transaction id can be consumed exactly once, ever.
  INSERT INTO public.processed_webhook_events (gateway, transaction_id, order_code, amount, currency, payload)
  VALUES (a.gateway, v_trx, a.order_code, p_amount, 'BDT', coalesce(p_payload, '{}'::jsonb))
  ON CONFLICT (gateway, transaction_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    PERFORM public._sb_security_event('payment_trx_replay', 'critical',
      jsonb_build_object('gateway', a.gateway, 'trx', v_trx, 'orderCode', a.order_code, 'attemptId', a.id));
    RETURN public._sb_attempt_needs_review(p_attempt_id, 'trx_replay', p_payload);
  END IF;

  v_order := public._sb_apply_payment(a.order_id, p_amount, v_trx);

  INSERT INTO public.payment_transactions (id, order_id, order_code, gateway, transaction_id, validation_id,
                                           amount, currency, status, sender_phone, verified_at, created_at)
  VALUES ('tx-' || replace(gen_random_uuid()::text, '-', ''), v_order.id, v_order.order_code, a.gateway, v_trx,
          a.gateway_payment_id, p_amount, 'BDT', 'validated', p_sender_phone, now(), now());

  UPDATE public.payment_attempts
     SET status = 'succeeded', gateway_trx_id = v_trx, completed_at = now(), updated_at = now(),
         raw_payload = raw_payload || jsonb_build_object('settled', coalesce(p_payload, '{}'::jsonb))
   WHERE id = a.id;

  RETURN jsonb_build_object('ok', true, 'orderCode', v_order.order_code,
                            'paymentStatus', v_order.payment_status, 'orderStatus', v_order.order_status,
                            'dueAmount', v_order.due_amount);
END;
$$;

-- Housekeeping: sessions that never reached a result.
CREATE OR REPLACE FUNCTION public.expire_stale_payment_attempts()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.payment_attempts SET status = 'expired', updated_at = now()
   WHERE (status = 'created' AND created_at < now() - interval '30 minutes')
      OR (status = 'redirected' AND created_at < now() - interval '24 hours');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMIT;


-- =============================================================================
-- MIGRATION 04/05 -- ADMIN OPERATIONS (service_role only)
--
-- Replaces every client-side order/payment mutation (updateOrderStatus,
-- updateOrderPaymentStatus, adjustOrderWeightAndBill, assignOrderLogistics, COD phone verify).
-- The edge layer verifies the caller's Supabase JWT + public.is_admin() BEFORE calling these,
-- and passes the verified admin's auth.users id as p_actor. Every action is audited.
-- Browsers cannot call these functions (no EXECUTE for anon/authenticated).
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_set_order_status(p_order_id text, p_new_status text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_flow  text[] := ARRAY['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  v_old   integer;
  v_new   integer;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_new_status IS NULL OR p_new_status NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') THEN
    PERFORM public.sb_fail('Invalid order status');
  END IF;

  IF p_new_status = 'cancelled' THEN
    RETURN public._sb_cancel_order(p_order_id, 'Cancelled by admin', p_actor);
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  IF v_order.order_status = 'cancelled' THEN PERFORM public.sb_fail('Cancelled orders cannot be reopened'); END IF;

  v_old := array_position(v_flow, v_order.order_status);
  v_new := array_position(v_flow, p_new_status);
  IF v_new <= v_old THEN PERFORM public.sb_fail('Order status can only move forward'); END IF;
  IF v_new >= 2 AND v_order.payment_method IN ('bkash', 'nagad') AND v_order.payment_status NOT IN ('advance_paid', 'paid') THEN
    PERFORM public.sb_fail('This online order has no verified payment yet');
  END IF;

  UPDATE public.orders SET order_status = p_new_status, updated_at = now() WHERE id = p_order_id
  RETURNING * INTO v_order;
  PERFORM public._sb_audit(p_actor, 'order.status', p_order_id, jsonb_build_object('to', p_new_status));
  RETURN public._sb_order_summary(v_order);
END;
$$;

-- Manual / COD settlement by an authenticated admin. Uses the SAME ledger and replay guard as
-- gateway payments; the reference must be unique (e.g. 'COD-<code>' or a bank/MFS receipt id).
CREATE OR REPLACE FUNCTION public.admin_mark_order_paid(
  p_order_id  text,
  p_amount    numeric,
  p_reference text,
  p_note      text,
  p_actor     uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_ref   text := btrim(coalesce(p_reference, ''));
  v_block text;
  v_rows  integer;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF length(v_ref) < 4 OR length(v_ref) > 64 THEN PERFORM public.sb_fail('Reference must be 4 to 64 characters'); END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > v_order.due_amount THEN
    PERFORM public.sb_fail('Amount must be greater than zero and not exceed the amount due');
  END IF;
  v_block := public._sb_payment_blocker(v_order, p_amount);
  IF v_block IS NOT NULL THEN PERFORM public.sb_fail('Payment cannot be recorded: ' || v_block); END IF;

  INSERT INTO public.processed_webhook_events (gateway, transaction_id, order_code, amount, currency, payload)
  VALUES ('manual_verify', v_ref, v_order.order_code, p_amount, 'BDT',
          jsonb_build_object('actor', p_actor, 'note', left(coalesce(p_note, ''), 300)))
  ON CONFLICT (gateway, transaction_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN PERFORM public.sb_fail('This reference has already been used'); END IF;

  v_order := public._sb_apply_payment(p_order_id, p_amount, v_ref);

  INSERT INTO public.payment_transactions (id, order_id, order_code, gateway, transaction_id, validation_id,
                                           amount, currency, status, verified_at, created_at)
  VALUES ('tx-' || replace(gen_random_uuid()::text, '-', ''), v_order.id, v_order.order_code, 'manual_verify', v_ref,
          'ADMIN:' || p_actor::text, p_amount, 'BDT', 'validated', now(), now());

  PERFORM public._sb_audit(p_actor, 'order.mark_paid', p_order_id,
    jsonb_build_object('amount', p_amount, 'reference', v_ref, 'note', left(coalesce(p_note, ''), 300)));
  RETURN public._sb_order_summary(v_order);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verify_cod_phone(p_order_id text, p_method text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_order public.orders;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_method IS NULL OR p_method NOT IN ('manual_call', 'sms_otp') THEN PERFORM public.sb_fail('Invalid verification method'); END IF;
  UPDATE public.orders
     SET is_phone_verified = true, verification_method = p_method,
         order_status = CASE WHEN order_status = 'pending' THEN 'confirmed' ELSE order_status END,
         updated_at = now()
   WHERE id = p_order_id AND order_status <> 'cancelled' AND payment_method = 'cod'
   RETURNING * INTO v_order;
  IF NOT FOUND THEN PERFORM public.sb_fail('COD order not found or not eligible'); END IF;
  PERFORM public._sb_audit(p_actor, 'order.verify_cod_phone', p_order_id, jsonb_build_object('method', p_method));
  RETURN public._sb_order_summary(v_order);
END;
$$;

-- Scale-weight bill adjustment (fish/meat are weighed before dispatch). Totals stay consistent with
-- the orders_total_consistent constraint; due is recomputed from what was actually paid.
CREATE OR REPLACE FUNCTION public.admin_adjust_order_weight(p_order_id text, p_adjustment numeric, p_note text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_total numeric(10, 2);
  v_due   numeric(10, 2);
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_adjustment IS NULL OR abs(p_adjustment) > 5000 THEN PERFORM public.sb_fail('Adjustment must be within +/- BDT 5,000'); END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  IF v_order.order_status IN ('cancelled', 'delivered') THEN PERFORM public.sb_fail('This order can no longer be adjusted'); END IF;

  v_total := greatest(0, v_order.subtotal - v_order.discount_amount + v_order.delivery_charge + p_adjustment);
  v_due   := greatest(0, v_total - v_order.advance_paid);

  UPDATE public.orders
     SET weight_adjustment_amount = p_adjustment,
         weight_adjustment_note   = left(public.sb_clean_text(p_note), 300),
         total_amount = v_total,
         due_amount   = v_due,
         payment_status = CASE
           WHEN v_due = 0 AND advance_paid > 0 THEN 'paid'
           WHEN v_due > 0 AND payment_status = 'paid' THEN 'advance_paid'
           ELSE payment_status END,
         updated_at = now()
   WHERE id = p_order_id
   RETURNING * INTO v_order;
  PERFORM public._sb_audit(p_actor, 'order.adjust_weight', p_order_id, jsonb_build_object('adjustment', p_adjustment));
  RETURN public._sb_order_summary(v_order);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_logistics(
  p_order_id text, p_courier text, p_tracking_ref text, p_rider_name text, p_rider_phone text, p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_order public.orders;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  UPDATE public.orders
     SET courier_name       = nullif(left(public.sb_clean_text(p_courier), 80), ''),
         tracking_reference = nullif(left(public.sb_clean_text(p_tracking_ref), 80), ''),
         rider_name         = nullif(left(public.sb_clean_text(p_rider_name), 80), ''),
         rider_phone        = nullif(left(regexp_replace(coalesce(p_rider_phone, ''), '[^0-9+]', '', 'g'), 20), ''),
         updated_at = now()
   WHERE id = p_order_id AND order_status <> 'cancelled'
   RETURNING * INTO v_order;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found or cancelled'); END IF;
  PERFORM public._sb_audit(p_actor, 'order.assign_logistics', p_order_id, '{}'::jsonb);
  RETURN public._sb_order_summary(v_order);
END;
$$;

-- Admin-facing triage for payments the gateway took money for but we could not auto-settle.
CREATE OR REPLACE FUNCTION public.admin_resolve_attempt(p_attempt_id uuid, p_resolution text, p_note text, p_actor uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_resolution NOT IN ('refunded', 'dismissed') THEN PERFORM public.sb_fail('Invalid resolution'); END IF;
  UPDATE public.payment_attempts
     SET status = 'failed', failure_reason = 'resolved:' || p_resolution || ':' || left(coalesce(p_note, ''), 200),
         completed_at = now(), updated_at = now()
   WHERE id = p_attempt_id AND status = 'needs_review';
  IF NOT FOUND THEN PERFORM public.sb_fail('Attempt not found or not awaiting review'); END IF;
  PERFORM public._sb_audit(p_actor, 'payment.resolve_attempt', p_attempt_id::text,
                           jsonb_build_object('resolution', p_resolution, 'note', left(coalesce(p_note, ''), 200)));
END;
$$;

COMMIT;


-- =============================================================================
-- MIGRATION 05/05 -- RLS + GRANTS LOCK-DOWN  (RUN LAST)
--
-- Result:
--   * anon / authenticated can NEVER insert/update/delete orders, order_items, payment_*,
--     processed_webhook_events, payment_attempts, coupons usage, admins... (grants revoked +
--     no policies + write-guard triggers from migration 01).
--   * payment_status / order_status / total_amount (and every other order column) can only be
--     changed by server code using SUPABASE_SERVICE_ROLE_KEY via the SQL functions in 02-04.
--   * Customers read nothing directly except the public catalogue, safe site settings and reviews.
--   * Admin console = Supabase Auth user listed in public.admins (is_admin()); admins get
--     READ access to orders/payments and WRITE access to catalogue/coupons/settings/messages only.
--     Order/payment mutations by admins go through the audited service-only functions.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Retire legacy insecure objects (hash-based admin RPCs, anon order dump, unverified payments)
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('get_admin_orders', 'get_admin_messages', 'get_order_by_code',
                        'get_order_items_by_order_id', 'verify_and_record_payment', 'create_secure_order')
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
  -- legacy admin_verify_cod_phone(text, text) is replaced by (text, text, uuid) from migration 04
  IF to_regprocedure('public.admin_verify_cod_phone(text, text)') IS NOT NULL THEN
    DROP FUNCTION public.admin_verify_cod_phone(text, text);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Start from zero: drop every policy on our tables, revoke every privilege from API roles
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY['site_settings', 'categories', 'products', 'product_variants', 'coupons',
                                 'orders', 'order_items', 'payment_transactions', 'payment_attempts',
                                 'processed_webhook_events', 'payment_gateway_tokens', 'product_reviews',
                                 'contact_messages', 'admins', 'security_events', 'admin_audit_log', 'api_rate_limits'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['site_settings', 'categories', 'products', 'product_variants', 'coupons',
                           'orders', 'order_items', 'payment_transactions', 'payment_attempts',
                           'processed_webhook_events', 'payment_gateway_tokens', 'product_reviews',
                           'contact_messages', 'admins', 'security_events', 'admin_audit_log', 'api_rate_limits']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Public storefront reads (catalogue, reviews, SAFE site-setting columns)
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.categories, public.products, public.product_variants, public.product_reviews
  TO anon, authenticated;

CREATE POLICY categories_public_read ON public.categories FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY products_public_read   ON public.products   FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY variants_public_read   ON public.product_variants FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.is_active));
CREATE POLICY reviews_public_read    ON public.product_reviews FOR SELECT TO anon, authenticated USING (true);

-- site_settings: column-level grants hide bkash_app_key, sslcommerz_* from every API role.
-- NOTE: clients must select these columns explicitly (select('*') is denied).
GRANT SELECT (id, inside_dhaka_fee, outside_dhaka_fee, free_delivery_threshold, enable_free_delivery,
              preorder_advance_percent, support_phone, whatsapp_number, bkash_merchant_number,
              bkash_account_type, nagad_number, nagad_account_type, nagad_enabled, bkash_enabled,
              cod_enabled, announcement_en, announcement_bn, updated_at)
  ON public.site_settings TO anon, authenticated;
GRANT INSERT (id, inside_dhaka_fee, outside_dhaka_fee, free_delivery_threshold, enable_free_delivery,
              preorder_advance_percent, support_phone, whatsapp_number, bkash_merchant_number,
              bkash_account_type, nagad_number, nagad_account_type, nagad_enabled, bkash_enabled,
              cod_enabled, announcement_en, announcement_bn, updated_at)
  ON public.site_settings TO authenticated;
GRANT UPDATE (inside_dhaka_fee, outside_dhaka_fee, free_delivery_threshold, enable_free_delivery,
              preorder_advance_percent, support_phone, whatsapp_number, bkash_merchant_number,
              bkash_account_type, nagad_number, nagad_account_type, nagad_enabled, bkash_enabled,
              cod_enabled, announcement_en, announcement_bn, updated_at)
  ON public.site_settings TO authenticated;
CREATE POLICY settings_public_read  ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY settings_admin_insert ON public.site_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY settings_admin_update ON public.site_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Contact form: anonymous INSERT only, constrained columns, bounded sizes. No read-back.
GRANT INSERT (id, name, phone, email, subject, message) ON public.contact_messages TO anon, authenticated;
CREATE POLICY contact_public_insert ON public.contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(name) BETWEEN 2 AND 80
    AND phone ~ '^[0-9+]{11,15}$'
    AND char_length(subject) BETWEEN 1 AND 150
    AND char_length(message) BETWEEN 5 AND 2000
    AND (email IS NULL OR char_length(email) <= 120)
  );

-- -----------------------------------------------------------------------------
-- 4. Admin console (Supabase Auth user in public.admins): catalogue/coupons/messages write access
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.admins TO authenticated;
CREATE POLICY admins_self_read ON public.admins FOR SELECT TO authenticated USING (user_id = auth.uid());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories', 'products', 'product_variants', 'product_reviews', 'coupons', 'contact_messages']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
                   t || '_admin_all', t);
  END LOOP;
END $$;

-- Admin READ-ONLY views of money/audit data. (Writes: service-only functions from migrations 02-04.)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders', 'order_items', 'payment_transactions', 'payment_attempts',
                           'processed_webhook_events', 'security_events', 'admin_audit_log']
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t || '_admin_read', t);
  END LOOP;
END $$;

-- payment_gateway_tokens, api_rate_limits: no grants, no policies => service_role only.

-- -----------------------------------------------------------------------------
-- 5. Functions: nothing is callable by API roles except is_admin() (used inside admin RLS policies)
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. The server (service_role) keeps full power; it bypasses RLS by design.
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =============================================================================
-- FIRST ADMIN (run once, as postgres, AFTER creating the user in Authentication -> Users
-- and disabling public sign-ups):
--
--   INSERT INTO public.admins (user_id, email)
--   SELECT id, email FROM auth.users WHERE email = 'you@example.com';
-- =============================================================================



-- =============================================================================
-- STEP 2 (RUN AFTER CREATING YOUR ADMIN USER IN SUPABASE AUTH -> USERS):
-- Enroll your admin email in public.admins:
--
-- INSERT INTO public.admins (user_id, email, role)
-- SELECT id, email, 'owner'
-- FROM auth.users
-- WHERE email = 'your-admin-email@example.com'
-- ON CONFLICT (user_id) DO NOTHING;
-- =============================================================================
