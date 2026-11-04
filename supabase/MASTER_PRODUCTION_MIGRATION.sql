-- ============================================================================
-- SADYER BAZAR (সাধ্যের বাজার) — ONE-CLICK MASTER PRODUCTION SQL MIGRATION
-- Project: sadhyarbazar
-- Instructions: Copy & Paste this entire file into Supabase SQL Editor and click RUN.
-- Safe to re-run (idempotent).
-- ============================================================================

-- =============================================================================
-- FILE: schema.sql
-- =============================================================================

-- ============================================================================
-- SADYER BAZAR (সাধ্যের বাজার) — SUPABASE POSTGRESQL SCHEMA & RLS SECURITY
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
    announcement_en TEXT NOT NULL DEFAULT 'Pre-Order Live: Fresh Jamuna River Fish & Authentic Bogura Shahi Doi — Nationwide Home Delivery!',
    announcement_bn TEXT NOT NULL DEFAULT 'যমুনা নদীর তাজা মাছ ও বগুড়ার শাহী দইয়ের প্রি-অর্ডার চলছে!',
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

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR STOREFRONT & ADMIN SYNC
-- ============================================================================
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Hardened Zero-Trust RLS Policies:
-- Public (anon) can read catalog & submit orders, but cannot dump orders, delete, or alter pricing
CREATE POLICY "public_read_site_settings" ON public.site_settings FOR SELECT TO public USING (true);
CREATE POLICY "service_role_all_site_settings" ON public.site_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_categories" ON public.categories FOR SELECT TO public USING (is_active = true);
CREATE POLICY "service_role_all_categories" ON public.categories FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_products" ON public.products FOR SELECT TO public USING (is_active = true);
CREATE POLICY "service_role_all_products" ON public.products FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_product_variants" ON public.product_variants FOR SELECT TO public USING (true);
CREATE POLICY "service_role_all_product_variants" ON public.product_variants FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_coupons" ON public.coupons FOR SELECT TO public USING (is_active = true);
CREATE POLICY "service_role_all_coupons" ON public.coupons FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_reviews" ON public.product_reviews FOR SELECT TO public USING (true);
CREATE POLICY "public_insert_reviews" ON public.product_reviews FOR INSERT TO public WITH CHECK (rating BETWEEN 1 AND 5);
CREATE POLICY "service_role_all_reviews" ON public.product_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_insert_contact_messages" ON public.contact_messages FOR INSERT TO public WITH CHECK (length(name) > 0 AND length(phone) >= 11);
CREATE POLICY "service_role_all_contact_messages" ON public.contact_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_insert_transactions" ON public.payment_transactions FOR INSERT TO public WITH CHECK (amount >= 0);
CREATE POLICY "service_role_all_transactions" ON public.payment_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Zero-Trust Orders Policy: Public can only insert orders; mass SELECT * is blocked
CREATE POLICY "public_insert_orders" ON public.orders FOR INSERT TO public WITH CHECK (total_amount >= 0 AND length(customer_phone) >= 11);
CREATE POLICY "service_role_all_orders" ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_insert_order_items" ON public.order_items FOR INSERT TO public WITH CHECK (quantity > 0 AND unit_price >= 0);
CREATE POLICY "service_role_all_order_items" ON public.order_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Secure single-order lookup RPC (prevents customer database dumping)
CREATE OR REPLACE FUNCTION public.get_order_by_code(p_order_code TEXT)
RETURNS SETOF public.orders LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT * FROM public.orders WHERE UPPER(TRIM(order_code)) = UPPER(TRIM(p_order_code)) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_order_by_code(TEXT) TO anon, authenticated, service_role;

-- 11. GATEWAY TOKEN CACHE TABLE (bKash id_token & refresh_token with TTL)
CREATE TABLE IF NOT EXISTS public.payment_gateway_tokens (
    gateway TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_gateway_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_gateway_tokens FROM anon, authenticated, public;
GRANT ALL ON public.payment_gateway_tokens TO service_role;

-- 12. SERVER-SIDE PAYMENT & WEBHOOK VERIFICATION (WITH IDEMPOTENCY & SPLIT PAYMENT SAFETY)
CREATE OR REPLACE FUNCTION public.verify_and_record_payment(
    p_order_code TEXT,
    p_gateway TEXT,
    p_transaction_id TEXT,
    p_validation_id TEXT,
    p_amount NUMERIC(10, 2),
    p_currency TEXT DEFAULT 'BDT',
    p_sender_phone TEXT DEFAULT NULL,
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_new_payment_status TEXT;
    v_advance_paid NUMERIC(10, 2);
    v_due_amount NUMERIC(10, 2);
    v_order_status TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Currency Enforcement
    IF UPPER(p_currency) != 'BDT' THEN
        RAISE EXCEPTION 'Currency mismatch: Expected BDT, got %', p_currency;
    END IF;

    -- 2. Idempotency Check: Prevent duplicate payment replay
    INSERT INTO public.processed_webhook_events (
        gateway,
        transaction_id,
        order_code,
        amount,
        currency,
        payload,
        processed_at
    ) VALUES (
        p_gateway,
        trim(p_transaction_id),
        trim(p_order_code),
        p_amount,
        p_currency,
        p_raw_payload,
        v_now
    )
    ON CONFLICT (gateway, transaction_id) DO NOTHING;

    -- If conflict occurred, event was already processed
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Transaction already processed previously'
        );
    END IF;

    -- 3. Order Verification
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE upper(order_code) = upper(trim(p_order_code)) 
    LIMIT 1;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order not found for code: %', p_order_code;
    END IF;

    -- 4. Calculate Verified Status (Accumulative / Split Payment Safe)
    v_advance_paid := COALESCE(v_order.advance_paid, 0) + p_amount;
    v_due_amount := GREATEST(0, v_order.total_amount - v_advance_paid);

    IF v_due_amount <= 0 THEN
        v_new_payment_status := 'paid';
        v_order_status := 'confirmed';
    ELSE
        v_new_payment_status := 'advance_paid';
        v_order_status := 'confirmed';
    END IF;

    -- 5. Record Transaction in Audit Trail
    INSERT INTO public.payment_transactions (
        id,
        order_id,
        order_code,
        gateway,
        transaction_id,
        validation_id,
        amount,
        currency,
        status,
        sender_phone,
        verified_at,
        created_at
    ) VALUES (
        'tx-' || extract(epoch from v_now)::bigint || '-' || substr(md5(random()::text), 1, 4),
        v_order.id,
        v_order.order_code,
        p_gateway,
        trim(p_transaction_id),
        p_validation_id,
        p_amount,
        'BDT',
        'validated',
        p_sender_phone,
        v_now,
        v_now
    );

    -- 6. Update Order Status in Database (Preserve prior TrxIDs if multi-stage payment)
    UPDATE public.orders 
    SET payment_status = v_new_payment_status,
        order_status = v_order_status,
        advance_paid = v_advance_paid,
        due_amount = v_due_amount,
        transaction_id = CASE 
            WHEN transaction_id IS NULL OR transaction_id = '' THEN trim(p_transaction_id)
            WHEN position(trim(p_transaction_id) in transaction_id) > 0 THEN transaction_id
            ELSE transaction_id || ', ' || trim(p_transaction_id)
        END,
        updated_at = v_now
    WHERE id = v_order.id;

    RETURN jsonb_build_object(
        'success', true,
        'orderCode', v_order.order_code,
        'paymentStatus', v_new_payment_status,
        'orderStatus', v_order_status,
        'amountPaid', p_amount,
        'dueAmount', v_due_amount
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_and_record_payment FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.verify_and_record_payment TO service_role;

-- Initialize Default Site Settings
INSERT INTO public.site_settings (id, inside_dhaka_fee, outside_dhaka_fee, free_delivery_threshold, preorder_advance_percent)
VALUES (1, 70.00, 130.00, 3000.00, 25)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- FILE: migrations/20261023120001_01_foundation.sql
-- =============================================================================

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
  role       text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner';
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
-- FILE: migrations/20261023120002_02_orders.sql
-- =============================================================================

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
-- FILE: migrations/20261023120003_03_payments.sql
-- =============================================================================

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
-- FILE: migrations/20261023120004_04_admin_ops.sql
-- =============================================================================

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
-- FILE: migrations/20261023120005_05_rls_lockdown.sql
-- =============================================================================

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
-- FILE: migrations/20261031120006_06_hero_cms.sql
-- =============================================================================

-- =============================================================================
-- MIGRATION 06/06 -- HERO BANNER CMS  (run AFTER 05)
--
-- What this adds
--   * public.hero_slides    : the home-page slider (image, badge, title, subtitle, CTA, schedule...)
--   * public.hero_settings  : hero headline / sub-headline / trust highlights / slider behaviour
--   * Storage bucket `site-media` (public read, admin-only write, 3 MB, images only)
--   * Audited admin functions (service_role ONLY) -- the browser can never write these tables:
--       admin_hero_save_slide / admin_hero_delete_slide / admin_hero_reorder /
--       admin_hero_set_active / admin_hero_save_settings / admin_hero_reset_defaults
--
-- Security model (same as the order/payment tables)
--   * anon / authenticated : SELECT only (visible slides for the public, everything for admins).
--   * Writes : only via the SQL functions below, called by /api/admin/action after the edge layer
--              verified the admin's Supabase JWT + public.admins membership. Every call is audited.
--   * Defense in depth : CHECK constraints on every column (URL / link allow-lists, lengths),
--              write-guard triggers, strict input validation inside the functions.
--
-- NOTE: migration 05 revokes grants on every public table. If you ever re-run 05, re-run 06 after it.
-- Safe to re-run (idempotent). Run as the `postgres` role (Supabase SQL Editor does this).
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Validators (IMMUTABLE so they can be used in CHECK constraints)
-- -----------------------------------------------------------------------------

-- Slide images: a built-in site asset (/images/...) or a file in OUR public `site-media` bucket.
CREATE OR REPLACE FUNCTION public.sb_hero_valid_image(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NOT NULL
     AND length(p) <= 600
     AND position('..' IN p) = 0
     AND (
          p ~ '^/images/[A-Za-z0-9._/-]+$'
       OR p ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/storage/v1/object/public/site-media/[A-Za-z0-9._/-]+$'
     )
$$;

-- Button links: '' (no button), an on-site path, or an https URL. Never javascript:, data:, //evil.com ...
CREATE OR REPLACE FUNCTION public.sb_hero_valid_link(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NOT NULL
     AND length(p) <= 300
     AND (
          p = ''
       OR (p ~ '^/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*$' AND p !~ '^//')
       OR p ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*)?$'
     )
$$;

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hero_slides (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order     integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  image_url      text NOT NULL CHECK (public.sb_hero_valid_image(image_url)),
  image_alt      text NOT NULL DEFAULT '' CHECK (char_length(image_alt) <= 200),
  image_position text NOT NULL DEFAULT 'center' CHECK (image_position IN ('center', 'top', 'bottom', 'left', 'right')),
  badge_text     text NOT NULL DEFAULT '' CHECK (char_length(badge_text) <= 60),
  badge_icon     text NOT NULL DEFAULT 'sparkles'
                 CHECK (badge_icon IN ('fish', 'award', 'flame', 'wheat', 'leaf', 'sparkles', 'truck', 'shield',
                                       'clock', 'star', 'heart', 'gift', 'phone')),
  title          text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  subtitle       text NOT NULL DEFAULT '' CHECK (char_length(subtitle) <= 220),
  cta_text       text NOT NULL DEFAULT '' CHECK (char_length(cta_text) <= 40),
  cta_link       text NOT NULL DEFAULT '' CHECK (public.sb_hero_valid_link(cta_link)),
  starts_at      timestamptz,
  ends_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hero_slides_cta_pair_chk CHECK (cta_text = '' OR cta_link <> ''),
  CONSTRAINT hero_slides_schedule_chk CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_hero_slides_order ON public.hero_slides (sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.hero_settings (
  id               integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  show_headline    boolean NOT NULL DEFAULT true,
  headline         text NOT NULL DEFAULT '' CHECK (char_length(headline) <= 160),
  subheadline      text NOT NULL DEFAULT '' CHECK (char_length(subheadline) <= 240),
  show_guarantee   boolean NOT NULL DEFAULT true,
  guarantee_text   text NOT NULL DEFAULT '' CHECK (char_length(guarantee_text) <= 60),
  show_counter     boolean NOT NULL DEFAULT true,
  autoplay         boolean NOT NULL DEFAULT true,
  autoplay_seconds numeric(4, 1) NOT NULL DEFAULT 4.5 CHECK (autoplay_seconds BETWEEN 2 AND 20),
  show_trust_items boolean NOT NULL DEFAULT true,
  trust_items      jsonb NOT NULL DEFAULT '[]'::jsonb
                   CHECK (jsonb_typeof(trust_items) = 'array' AND jsonb_array_length(trust_items) <= 6),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_slides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. Internal helpers (never callable by API roles)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sb_hero_slide_json(s public.hero_slides)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'sortOrder', s.sort_order, 'isActive', s.is_active,
    'imageUrl', s.image_url, 'imageAlt', s.image_alt, 'imagePosition', s.image_position,
    'badgeText', s.badge_text, 'badgeIcon', s.badge_icon,
    'title', s.title, 'subtitle', s.subtitle, 'ctaText', s.cta_text, 'ctaLink', s.cta_link,
    'startsAt', s.starts_at, 'endsAt', s.ends_at, 'updatedAt', s.updated_at)
$$;

-- Returns the storage URL only when it is one of OUR uploads and no slide references it any more
-- (the edge layer then deletes the file so the bucket never fills up with orphans).
CREATE OR REPLACE FUNCTION public._sb_hero_orphan(p_url text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p_url IS NOT NULL
     AND p_url LIKE '%/storage/v1/object/public/site-media/%'
     AND NOT EXISTS (SELECT 1 FROM public.hero_slides WHERE image_url = p_url)
    THEN p_url END
$$;

-- Validate + normalise the trust-highlight list. Fails with a user-safe message.
CREATE OR REPLACE FUNCTION public._sb_hero_clean_trust(p jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_out   jsonb := '[]'::jsonb;
  v_item  jsonb;
  v_icon  text;
  v_title text;
  v_sub   text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN PERFORM public.sb_fail('Highlights must be a list'); END IF;
  IF jsonb_array_length(p) > 6 THEN PERFORM public.sb_fail('You can add at most 6 highlights'); END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN PERFORM public.sb_fail('Invalid highlight'); END IF;
    v_icon  := coalesce(v_item ->> 'icon', '');
    v_title := public.sb_clean_text(v_item ->> 'title');
    v_sub   := public.sb_clean_text(v_item ->> 'subtitle');
    IF v_icon NOT IN ('fish', 'award', 'flame', 'wheat', 'leaf', 'sparkles', 'truck', 'shield',
                      'clock', 'star', 'heart', 'gift', 'phone') THEN
      PERFORM public.sb_fail('Invalid highlight icon');
    END IF;
    IF char_length(v_title) < 1 OR char_length(v_title) > 60 THEN
      PERFORM public.sb_fail('Each highlight needs a title of up to 60 characters');
    END IF;
    IF char_length(v_sub) > 100 THEN PERFORM public.sb_fail('Highlight text can be at most 100 characters'); END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object('icon', v_icon, 'title', v_title, 'subtitle', v_sub));
  END LOOP;
  RETURN v_out;
END;
$$;

-- The original four banners + hero copy. Used by the first-time seed and by "Restore defaults".
CREATE OR REPLACE FUNCTION public._sb_hero_seed_defaults()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.hero_slides;
  INSERT INTO public.hero_slides
    (sort_order, image_url, image_alt, image_position, badge_text, badge_icon, title, subtitle, cta_text, cta_link)
  VALUES
    (1, '/images/banners/hero-jamuna-river-dawn.jpg',
        'যমুনা নদীর ভোরবেলার তাজা মাছ — সাধ্যের বাজার', 'center',
        'যমুনার মোহনা থেকে সরাসরি', 'fish',
        'ভোরবেলা ধরা যমুনার তাজা নদীর মাছ',
        'ফরমালিন ও রাসায়নিকমুক্ত • বরফ ছাড়া নদী থেকে সরাসরি আপনার ঘরে',
        'তাজা মাছ প্রি-অর্ডার করুন', '/pre-orders'),
    (2, '/images/banners/hero-gawa-ghee-bogura-doi.jpg',
        'সিরাজগঞ্জের খাঁটি গাওয়া ঘি ও বগুড়ার শাহী দই — সাধ্যের বাজার', 'center',
        'শতভাগ খাঁটি দুগ্ধজাত ঐতিহ্য', 'award',
        'সিরাজগঞ্জের গাওয়া ঘি ও বগুড়ার শাহী দই',
        'কোনো প্রিজারভেটিভ বা ডালডা ছাড়া ঐতিহ্যবাহী গ্রাম্য মাটির স্বাদ',
        'ঘি ও দই সংগ্রহ করুন', '/shop?category=ghee-and-dairy'),
    (3, '/images/banners/hero-village-deshi-poultry.jpg',
        'গ্রামের মুক্ত চারণভূমির দেশি মুরগি ও হাঁসের ডিম — সাধ্যের বাজার', 'center',
        'উন্মুক্ত চারণভূমির প্রাকৃতিক খামার', 'flame',
        'গ্রামের মুক্ত খামারের দেশি মুরগি ও ডিম',
        'কৃত্রিম ফিড ও অ্যান্টিবায়োটিকমুক্ত স্বাস্থ্যকর প্রাকৃতিক পুষ্টি',
        'দেশি মুরগি ও ডিম দেখুন', '/shop?category=deshi-meat-poultry'),
    (4, '/images/banners/hero-heritage-golden-rice.jpg',
        'দিনাজপুরের কাটারিভোগ ও ঐতিহ্যবাহী লাল চাল — সাধ্যের বাজার', 'center',
        'অকৃত্রিম গ্রাম্য পুষ্টি ও সুবাস', 'wheat',
        'দিনাজপুরের কাটারিভোগ ও সুগন্ধি লাল চাল',
        'পলিশহীন, ফাইবার সমৃদ্ধ ও প্রাচীন জাতের আসল পুষ্টিকর চাল',
        'অর্গানিক চাল কিনুন', '/shop?category=organic-rice-honey');

  INSERT INTO public.hero_settings
    (id, show_headline, headline, subheadline, show_guarantee, guarantee_text, show_counter,
     autoplay, autoplay_seconds, show_trust_items, trust_items, updated_at)
  VALUES
    (1, true,
     'সাধ্যের বাজার — যমুনা নদীর তাজা দেশি মাছ, খাঁটি গাওয়া ঘি ও বগুড়ার দই',
     '১০০% কেমিক্যাল ও ফরমালিনমুক্ত • নদী ও প্রান্তিক খামার থেকে সরাসরি নিজস্ব কোল্ড-চেইনে হোম ডেলিভারি',
     true, '১০০% প্রাকৃতিক ও ফরমালিনমুক্ত', true, true, 4.5, true,
     '[{"icon":"leaf","title":"১০০% ফরমালিনমুক্ত","subtitle":"যমুনা নদী ও গ্রাম্য খামার"},
       {"icon":"truck","title":"থার্মাল হোম ডেলিভারি","subtitle":"ঢাকা ৳{insideDhakaFee} • সারা দেশ ৳{outsideDhakaFee}"},
       {"icon":"shield","title":"নিরাপদ পেমেন্ট","subtitle":"বিকাশ, কার্ড ও ক্যাশ অন ডেলিভারি"},
       {"icon":"clock","title":"লাইভ অর্ডার ট্র্যাকিং","subtitle":"ইউনিক অর্ডার আইডি দিয়ে ট্র্যাক"}]'::jsonb,
     now())
  ON CONFLICT (id) DO UPDATE SET
    show_headline = EXCLUDED.show_headline, headline = EXCLUDED.headline, subheadline = EXCLUDED.subheadline,
    show_guarantee = EXCLUDED.show_guarantee, guarantee_text = EXCLUDED.guarantee_text,
    show_counter = EXCLUDED.show_counter, autoplay = EXCLUDED.autoplay,
    autoplay_seconds = EXCLUDED.autoplay_seconds, show_trust_items = EXCLUDED.show_trust_items,
    trust_items = EXCLUDED.trust_items, updated_at = now();
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Admin operations (service_role only; p_actor = verified admin id, audited)
-- -----------------------------------------------------------------------------

-- Create (no id) or update (id) a slide. New slides are appended at the end.
CREATE OR REPLACE FUNCTION public.admin_hero_save_slide(p_actor uuid, p_slide jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id       uuid;
  v_old      public.hero_slides;
  v_row      public.hero_slides;
  v_image    text;
  v_alt      text;
  v_pos      text;
  v_badge    text;
  v_icon     text;
  v_title    text;
  v_sub      text;
  v_cta      text;
  v_link     text;
  v_active   boolean;
  v_starts   timestamptz;
  v_ends     timestamptz;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_slide IS NULL OR jsonb_typeof(p_slide) <> 'object' THEN PERFORM public.sb_fail('Invalid slide'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('hero_slides'));

  BEGIN
    v_id     := nullif(p_slide ->> 'id', '')::uuid;
    v_starts := nullif(p_slide ->> 'startsAt', '')::timestamptz;
    v_ends   := nullif(p_slide ->> 'endsAt', '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sb_fail('Invalid slide id or schedule date');
  END;

  v_image  := btrim(coalesce(p_slide ->> 'imageUrl', ''));
  v_alt    := public.sb_clean_text(p_slide ->> 'imageAlt');
  v_pos    := coalesce(nullif(p_slide ->> 'imagePosition', ''), 'center');
  v_badge  := public.sb_clean_text(p_slide ->> 'badgeText');
  v_icon   := coalesce(nullif(p_slide ->> 'badgeIcon', ''), 'sparkles');
  v_title  := public.sb_clean_text(p_slide ->> 'title');
  v_sub    := public.sb_clean_text(p_slide ->> 'subtitle');
  v_cta    := public.sb_clean_text(p_slide ->> 'ctaText');
  v_link   := btrim(coalesce(p_slide ->> 'ctaLink', ''));
  v_active := coalesce((p_slide ->> 'isActive')::boolean, true);

  IF NOT public.sb_hero_valid_image(v_image) THEN
    PERFORM public.sb_fail('The slide image must be an uploaded image or a built-in site image');
  END IF;
  IF v_pos NOT IN ('center', 'top', 'bottom', 'left', 'right') THEN PERFORM public.sb_fail('Invalid image position'); END IF;
  IF v_icon NOT IN ('fish', 'award', 'flame', 'wheat', 'leaf', 'sparkles', 'truck', 'shield',
                    'clock', 'star', 'heart', 'gift', 'phone') THEN
    PERFORM public.sb_fail('Invalid badge icon');
  END IF;
  IF char_length(v_title) < 1 OR char_length(v_title) > 120 THEN PERFORM public.sb_fail('Title is required (max 120 characters)'); END IF;
  IF char_length(v_alt) > 200   THEN PERFORM public.sb_fail('Image description is too long (max 200)'); END IF;
  IF char_length(v_badge) > 60  THEN PERFORM public.sb_fail('Badge text is too long (max 60)'); END IF;
  IF char_length(v_sub) > 220   THEN PERFORM public.sb_fail('Subtitle is too long (max 220)'); END IF;
  IF char_length(v_cta) > 40    THEN PERFORM public.sb_fail('Button text is too long (max 40)'); END IF;
  IF NOT public.sb_hero_valid_link(v_link) THEN
    PERFORM public.sb_fail('Button link must be a page on this site (e.g. /shop) or an https:// address');
  END IF;
  IF v_cta <> '' AND v_link = '' THEN PERFORM public.sb_fail('Add a button link or clear the button text'); END IF;
  IF v_starts IS NOT NULL AND v_ends IS NOT NULL AND v_ends <= v_starts THEN
    PERFORM public.sb_fail('The end date must be after the start date');
  END IF;

  IF v_id IS NULL THEN
    IF (SELECT count(*) FROM public.hero_slides) >= 12 THEN
      PERFORM public.sb_fail('You can have at most 12 slides. Delete one first.');
    END IF;
    INSERT INTO public.hero_slides
      (sort_order, is_active, image_url, image_alt, image_position, badge_text, badge_icon,
       title, subtitle, cta_text, cta_link, starts_at, ends_at)
    VALUES
      ((SELECT coalesce(max(sort_order), 0) + 1 FROM public.hero_slides), v_active, v_image, v_alt, v_pos,
       v_badge, v_icon, v_title, v_sub, v_cta, v_link, v_starts, v_ends)
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_old FROM public.hero_slides WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM public.sb_fail('Slide not found. It may have been deleted - refresh the page.'); END IF;
    UPDATE public.hero_slides SET
      is_active = v_active, image_url = v_image, image_alt = v_alt, image_position = v_pos,
      badge_text = v_badge, badge_icon = v_icon, title = v_title, subtitle = v_sub,
      cta_text = v_cta, cta_link = v_link, starts_at = v_starts, ends_at = v_ends, updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  PERFORM public._sb_audit(p_actor, CASE WHEN v_id IS NULL THEN 'hero.create_slide' ELSE 'hero.update_slide' END,
                           v_row.id::text, jsonb_build_object('title', v_row.title, 'active', v_row.is_active));
  RETURN jsonb_build_object(
    'slide', public._sb_hero_slide_json(v_row),
    'orphanedImageUrl', CASE WHEN v_old.id IS NOT NULL AND v_old.image_url <> v_row.image_url
                             THEN public._sb_hero_orphan(v_old.image_url) END);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hero_delete_slide(p_actor uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_row public.hero_slides;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_id IS NULL THEN PERFORM public.sb_fail('Slide id required'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('hero_slides'));

  DELETE FROM public.hero_slides WHERE id = p_id RETURNING * INTO v_row;
  IF NOT FOUND THEN PERFORM public.sb_fail('Slide not found. It may already be deleted.'); END IF;

  -- keep sort_order gap-free
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY sort_order, created_at) AS rn FROM public.hero_slides
  )
  UPDATE public.hero_slides s SET sort_order = ranked.rn
  FROM ranked WHERE s.id = ranked.id AND s.sort_order <> ranked.rn;

  PERFORM public._sb_audit(p_actor, 'hero.delete_slide', p_id::text, jsonb_build_object('title', v_row.title));
  RETURN jsonb_build_object('deleted', true, 'orphanedImageUrl', public._sb_hero_orphan(v_row.image_url));
END;
$$;

-- p_ids must contain EVERY existing slide exactly once, in the desired order.
CREATE OR REPLACE FUNCTION public.admin_hero_reorder(p_actor uuid, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_total integer;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_ids IS NULL OR cardinality(p_ids) < 1 THEN PERFORM public.sb_fail('Nothing to reorder'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('hero_slides'));

  SELECT count(*) INTO v_total FROM public.hero_slides;
  IF cardinality(p_ids) <> v_total
     OR (SELECT count(DISTINCT x) FROM unnest(p_ids) AS x) <> v_total
     OR EXISTS (SELECT 1 FROM public.hero_slides s WHERE NOT (s.id = ANY (p_ids))) THEN
    PERFORM public.sb_fail('The slide list changed. Refresh the page and try again.');
  END IF;

  UPDATE public.hero_slides s SET sort_order = o.ord, updated_at = now()
  FROM unnest(p_ids) WITH ORDINALITY AS o(id, ord)
  WHERE s.id = o.id;

  PERFORM public._sb_audit(p_actor, 'hero.reorder', NULL, jsonb_build_object('count', v_total));
  RETURN jsonb_build_object('reordered', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hero_set_active(p_actor uuid, p_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_row public.hero_slides;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_id IS NULL OR p_active IS NULL THEN PERFORM public.sb_fail('Invalid request'); END IF;
  UPDATE public.hero_slides SET is_active = p_active, updated_at = now() WHERE id = p_id RETURNING * INTO v_row;
  IF NOT FOUND THEN PERFORM public.sb_fail('Slide not found. It may have been deleted - refresh the page.'); END IF;
  PERFORM public._sb_audit(p_actor, 'hero.set_active', p_id::text, jsonb_build_object('active', p_active));
  RETURN jsonb_build_object('slide', public._sb_hero_slide_json(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hero_save_settings(p_actor uuid, p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_headline  text;
  v_sub       text;
  v_guarantee text;
  v_seconds   numeric;
  v_trust     jsonb;
  v_flags     text[] := ARRAY['showHeadline', 'showGuarantee', 'showCounter', 'autoplay', 'showTrustItems'];
  f           text;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN PERFORM public.sb_fail('Invalid settings'); END IF;
  FOREACH f IN ARRAY v_flags LOOP
    IF jsonb_typeof(p_settings -> f) IS DISTINCT FROM 'boolean' THEN
      PERFORM public.sb_fail('Invalid value for ' || f);
    END IF;
  END LOOP;
  IF jsonb_typeof(p_settings -> 'autoplaySeconds') IS DISTINCT FROM 'number' THEN
    PERFORM public.sb_fail('Slide duration must be a number');
  END IF;

  v_seconds   := (p_settings ->> 'autoplaySeconds')::numeric;
  v_headline  := public.sb_clean_text(p_settings ->> 'headline');
  v_sub       := public.sb_clean_text(p_settings ->> 'subheadline');
  v_guarantee := public.sb_clean_text(p_settings ->> 'guaranteeText');
  v_trust     := public._sb_hero_clean_trust(p_settings -> 'trustItems');

  IF v_seconds < 2 OR v_seconds > 20 THEN PERFORM public.sb_fail('Slide duration must be between 2 and 20 seconds'); END IF;
  IF char_length(v_headline) > 160 THEN PERFORM public.sb_fail('Headline is too long (max 160)'); END IF;
  IF char_length(v_sub) > 240 THEN PERFORM public.sb_fail('Sub-headline is too long (max 240)'); END IF;
  IF char_length(v_guarantee) > 60 THEN PERFORM public.sb_fail('Guarantee badge text is too long (max 60)'); END IF;

  INSERT INTO public.hero_settings AS h
    (id, show_headline, headline, subheadline, show_guarantee, guarantee_text, show_counter,
     autoplay, autoplay_seconds, show_trust_items, trust_items, updated_at)
  VALUES
    (1, (p_settings ->> 'showHeadline')::boolean, v_headline, v_sub,
     (p_settings ->> 'showGuarantee')::boolean, v_guarantee, (p_settings ->> 'showCounter')::boolean,
     (p_settings ->> 'autoplay')::boolean, round(v_seconds, 1), (p_settings ->> 'showTrustItems')::boolean,
     v_trust, now())
  ON CONFLICT (id) DO UPDATE SET
    show_headline = EXCLUDED.show_headline, headline = EXCLUDED.headline, subheadline = EXCLUDED.subheadline,
    show_guarantee = EXCLUDED.show_guarantee, guarantee_text = EXCLUDED.guarantee_text,
    show_counter = EXCLUDED.show_counter, autoplay = EXCLUDED.autoplay,
    autoplay_seconds = EXCLUDED.autoplay_seconds, show_trust_items = EXCLUDED.show_trust_items,
    trust_items = EXCLUDED.trust_items, updated_at = now();

  PERFORM public._sb_audit(p_actor, 'hero.save_settings', '1', '{}'::jsonb);
  RETURN jsonb_build_object('saved', true);
END;
$$;

-- "Restore defaults": replaces ALL slides and hero copy with the original built-in content.
CREATE OR REPLACE FUNCTION public.admin_hero_reset_defaults(p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_urls text[];
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('hero_slides'));

  SELECT coalesce(array_agg(DISTINCT image_url), ARRAY[]::text[]) INTO v_urls
  FROM public.hero_slides WHERE image_url LIKE '%/storage/v1/object/public/site-media/%';

  PERFORM public._sb_hero_seed_defaults();
  PERFORM public._sb_audit(p_actor, 'hero.reset_defaults', NULL, '{}'::jsonb);
  RETURN jsonb_build_object('reset', true, 'orphanedImageUrls', to_jsonb(v_urls));
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. First-time seed (only when hero_settings has never been created)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hero_settings WHERE id = 1) THEN
    PERFORM public._sb_hero_seed_defaults();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. RLS + grants
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS hero_slides_public_read   ON public.hero_slides;
DROP POLICY IF EXISTS hero_slides_admin_read    ON public.hero_slides;
DROP POLICY IF EXISTS hero_slides_admin_all     ON public.hero_slides;
DROP POLICY IF EXISTS hero_settings_public_read ON public.hero_settings;
DROP POLICY IF EXISTS hero_settings_admin_all   ON public.hero_settings;

REVOKE ALL ON public.hero_slides, public.hero_settings FROM anon, authenticated;
GRANT SELECT ON public.hero_slides   TO anon;
GRANT SELECT ON public.hero_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_slides   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_settings TO authenticated;

-- Public: only slides that are switched on AND inside their schedule window.
CREATE POLICY hero_slides_public_read ON public.hero_slides FOR SELECT TO anon, authenticated
  USING (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));

-- Admins also see hidden / scheduled / expired slides and can write (to manage them).
CREATE POLICY hero_slides_admin_all  ON public.hero_slides FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY hero_settings_public_read ON public.hero_settings FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY hero_settings_admin_all ON public.hero_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Remove write-guard triggers so authenticated admins can manage CMS tables directly via RLS
DROP TRIGGER IF EXISTS trg_forbid_api_writes ON public.hero_slides;
DROP TRIGGER IF EXISTS trg_forbid_api_writes ON public.hero_settings;

-- Functions: nobody but the server (service_role) may execute any of them.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND (p.proname LIKE 'admin\_hero\_%' OR p.proname LIKE '\_sb\_hero\_%' OR p.proname LIKE 'sb\_hero\_%')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.sb_hero_valid_image(text), public.sb_hero_valid_link(text) TO authenticated;
GRANT ALL ON public.hero_slides, public.hero_settings TO service_role;

-- -----------------------------------------------------------------------------
-- 7. Storage bucket for uploaded slide images (skipped automatically where Storage is not installed)
--    public read (served from the CDN, no listing), admin-only write, images only, 3 MB cap.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'Supabase Storage is not available: skipped site-media bucket setup.';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('site-media', 'site-media', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
  ON CONFLICT (id) DO UPDATE
    SET public = true, file_size_limit = 3145728,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

  DROP POLICY IF EXISTS site_media_admin_read   ON storage.objects;
  DROP POLICY IF EXISTS site_media_admin_insert ON storage.objects;
  DROP POLICY IF EXISTS site_media_admin_update ON storage.objects;
  DROP POLICY IF EXISTS site_media_admin_delete ON storage.objects;

  CREATE POLICY site_media_admin_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'site-media' AND public.is_admin());
  CREATE POLICY site_media_admin_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'site-media' AND name LIKE 'hero/%' AND public.is_admin());
  CREATE POLICY site_media_admin_update ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'site-media' AND public.is_admin())
    WITH CHECK (bucket_id = 'site-media' AND name LIKE 'hero/%' AND public.is_admin());
  CREATE POLICY site_media_admin_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'site-media' AND public.is_admin());
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Not allowed to configure Storage from SQL (%). Create the public bucket "site-media" in Dashboard -> Storage and add the 4 policies from docs/HERO_CMS.md.', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =============================================================================
-- FILE: migrations/20261031130007_07_preorder_settings.sql
-- =============================================================================

-- =============================================================================
-- MIGRATION 07/07 -- PRE-ORDER BATCH & CAMPAIGN CMS (run AFTER 06)
--
-- What this adds
--   * public.preorder_settings : Global pre-order batch schedule, cut-off time,
--                                status, headlines, delivery date, advance payment rule,
--                                and capacity controls.
--   * Audited admin functions (service_role only):
--       admin_preorder_save_settings / admin_preorder_sync_product_dates /
--       admin_preorder_reset_batch_booked
--
-- Security model:
--   * anon / authenticated : SELECT only via RLS.
--   * Writes : authenticated admins can update directly via RLS (public.is_admin())
--              or via audited edge functions (/api/admin/action).
--   * Defense in depth: column CHECK constraints prevent out-of-range dates or
--     invalid status enums.
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Pre-Order Batch Settings Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.preorder_settings (
  id                      integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_batch_active         boolean NOT NULL DEFAULT true,
  batch_status            text NOT NULL DEFAULT 'booking_open'
                          CHECK (batch_status IN ('booking_open', 'paused', 'booking_closed', 'sold_out')),
  badge_text              text NOT NULL DEFAULT 'LIVE PRE-ORDER BATCH BOOKING'
                          CHECK (char_length(badge_text) BETWEEN 1 AND 80),
  headline                text NOT NULL DEFAULT 'Next Jamuna River Catch & Bogura Doi Dispatch'
                          CHECK (char_length(headline) BETWEEN 1 AND 160),
  subheadline             text NOT NULL DEFAULT ''
                          CHECK (char_length(subheadline) <= 300),
  cutoff_time             timestamptz NOT NULL DEFAULT (now() + interval '2 days'),
  expected_delivery_date  text NOT NULL DEFAULT 'Friday Morning Batch (শুক্রবার সকালের ডেলিভারি)'
                          CHECK (char_length(expected_delivery_date) BETWEEN 1 AND 120),
  dispatch_location       text NOT NULL DEFAULT 'Jamuna River Ghat (Sirajganj) & Sherpur, Bogura'
                          CHECK (char_length(dispatch_location) <= 120),
  closed_message          text NOT NULL DEFAULT 'বর্তমান ব্যাচের বুকিং সম্পন্ন হয়েছে। পরবর্তী ব্যাচ শিগগিরই শুরু হবে।'
                          CHECK (char_length(closed_message) <= 300),
  show_countdown          boolean NOT NULL DEFAULT true,
  require_advance_payment boolean NOT NULL DEFAULT true,
  advance_percent         integer NOT NULL DEFAULT 25
                          CHECK (advance_percent BETWEEN 0 AND 100),
  banner_alert            text NOT NULL DEFAULT ''
                          CHECK (char_length(banner_alert) <= 200),
  show_banner_alert       boolean NOT NULL DEFAULT false,
  max_batch_capacity      integer NOT NULL DEFAULT 200
                          CHECK (max_batch_capacity >= 0),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preorder_settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Helper Functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sb_preorder_json(s public.preorder_settings)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'isBatchActive', s.is_batch_active,
    'batchStatus', s.batch_status,
    'badgeText', s.badge_text,
    'headline', s.headline,
    'subheadline', s.subheadline,
    'cutoffTime', s.cutoff_time,
    'expectedDeliveryDate', s.expected_delivery_date,
    'dispatchLocation', s.dispatch_location,
    'closedMessage', s.closed_message,
    'showCountdown', s.show_countdown,
    'requireAdvancePayment', s.require_advance_payment,
    'advancePercent', s.advance_percent,
    'bannerAlert', s.banner_alert,
    'showBannerAlert', s.show_banner_alert,
    'maxBatchCapacity', s.max_batch_capacity,
    'updatedAt', s.updated_at
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. Audited Admin RPCs
-- -----------------------------------------------------------------------------

-- Save global pre-order settings
CREATE OR REPLACE FUNCTION public.admin_preorder_save_settings(p_actor uuid, p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_badge        text;
  v_headline     text;
  v_sub          text;
  v_cutoff       timestamptz;
  v_delivery     text;
  v_location     text;
  v_closed       text;
  v_alert        text;
  v_status       text;
  v_advance      integer;
  v_capacity     integer;
  v_active       boolean;
  v_countdown    boolean;
  v_req_advance  boolean;
  v_show_alert   boolean;
  v_row          public.preorder_settings;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    PERFORM public.sb_fail('Settings payload must be a JSON object');
  END IF;

  v_badge       := public.sb_clean_text(p_settings ->> 'badgeText');
  v_headline    := public.sb_clean_text(p_settings ->> 'headline');
  v_sub         := public.sb_clean_text(p_settings ->> 'subheadline');
  v_delivery    := public.sb_clean_text(p_settings ->> 'expectedDeliveryDate');
  v_location    := public.sb_clean_text(p_settings ->> 'dispatchLocation');
  v_closed      := public.sb_clean_text(p_settings ->> 'closedMessage');
  v_alert       := public.sb_clean_text(p_settings ->> 'bannerAlert');
  v_status      := coalesce(p_settings ->> 'batchStatus', 'booking_open');
  v_active      := coalesce((p_settings ->> 'isBatchActive')::boolean, true);
  v_countdown   := coalesce((p_settings ->> 'showCountdown')::boolean, true);
  v_req_advance := coalesce((p_settings ->> 'requireAdvancePayment')::boolean, true);
  v_show_alert  := coalesce((p_settings ->> 'showBannerAlert')::boolean, false);
  v_advance     := coalesce((p_settings ->> 'advancePercent')::integer, 25);
  v_capacity    := coalesce((p_settings ->> 'maxBatchCapacity')::integer, 200);

  BEGIN
    v_cutoff := (p_settings ->> 'cutoffTime')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    v_cutoff := now() + interval '2 days';
  END;

  IF v_status NOT IN ('booking_open', 'paused', 'booking_closed', 'sold_out') THEN
    PERFORM public.sb_fail('Invalid batch status');
  END IF;

  IF char_length(v_badge) < 1 OR char_length(v_badge) > 80 THEN
    PERFORM public.sb_fail('Badge text must be between 1 and 80 characters');
  END IF;

  IF char_length(v_headline) < 1 OR char_length(v_headline) > 160 THEN
    PERFORM public.sb_fail('Headline must be between 1 and 160 characters');
  END IF;

  IF char_length(v_delivery) < 1 OR char_length(v_delivery) > 120 THEN
    PERFORM public.sb_fail('Expected delivery date must be between 1 and 120 characters');
  END IF;

  IF v_advance < 0 OR v_advance > 100 THEN
    PERFORM public.sb_fail('Advance percent must be between 0 and 100');
  END IF;

  INSERT INTO public.preorder_settings (
    id,
    is_batch_active,
    batch_status,
    badge_text,
    headline,
    subheadline,
    cutoff_time,
    expected_delivery_date,
    dispatch_location,
    closed_message,
    show_countdown,
    require_advance_payment,
    advance_percent,
    banner_alert,
    show_banner_alert,
    max_batch_capacity,
    updated_at
  ) VALUES (
    1,
    v_active,
    v_status,
    v_badge,
    v_headline,
    v_sub,
    v_cutoff,
    v_delivery,
    v_location,
    v_closed,
    v_countdown,
    v_req_advance,
    v_advance,
    v_alert,
    v_show_alert,
    v_capacity,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    is_batch_active         = EXCLUDED.is_batch_active,
    batch_status            = EXCLUDED.batch_status,
    badge_text              = EXCLUDED.badge_text,
    headline                = EXCLUDED.headline,
    subheadline             = EXCLUDED.subheadline,
    cutoff_time             = EXCLUDED.cutoff_time,
    expected_delivery_date  = EXCLUDED.expected_delivery_date,
    dispatch_location       = EXCLUDED.dispatch_location,
    closed_message          = EXCLUDED.closed_message,
    show_countdown          = EXCLUDED.show_countdown,
    require_advance_payment = EXCLUDED.require_advance_payment,
    advance_percent         = EXCLUDED.advance_percent,
    banner_alert            = EXCLUDED.banner_alert,
    show_banner_alert       = EXCLUDED.show_banner_alert,
    max_batch_capacity      = EXCLUDED.max_batch_capacity,
    updated_at              = now()
  RETURNING * INTO v_row;

  PERFORM public._sb_audit(p_actor, 'preorder.save_settings', '1', jsonb_build_object('status', v_status));

  RETURN jsonb_build_object('saved', true, 'settings', public._sb_preorder_json(v_row));
END;
$$;

-- Synchronize batch cut-off time and delivery date to all pre-order products in one click
CREATE OR REPLACE FUNCTION public.admin_preorder_sync_product_dates(
  p_actor uuid,
  p_cutoff timestamptz,
  p_delivery text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
  v_clean_delivery text;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  v_clean_delivery := public.sb_clean_text(p_delivery);
  IF char_length(v_clean_delivery) < 1 THEN
    PERFORM public.sb_fail('Delivery date description is required');
  END IF;

  UPDATE public.products
  SET
    preorder_cutoff_at = p_cutoff,
    expected_delivery_date = v_clean_delivery
  WHERE is_preorder = true;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  PERFORM public._sb_audit(
    p_actor,
    'preorder.sync_product_dates',
    NULL,
    jsonb_build_object('updated_products', v_updated, 'delivery', v_clean_delivery)
  );

  RETURN jsonb_build_object('updated', v_updated);
END;
$$;

-- Reset booked quantities for all pre-order products when launching a fresh batch
CREATE OR REPLACE FUNCTION public.admin_preorder_reset_batch_booked(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  UPDATE public.products
  SET batch_booked_qty = 0
  WHERE is_preorder = true;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  PERFORM public._sb_audit(
    p_actor,
    'preorder.reset_batch_booked',
    NULL,
    jsonb_build_object('reset_products', v_updated)
  );

  RETURN jsonb_build_object('reset', v_updated);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Initial Seed (if table empty)
-- -----------------------------------------------------------------------------
INSERT INTO public.preorder_settings (
  id,
  is_batch_active,
  batch_status,
  badge_text,
  headline,
  subheadline,
  cutoff_time,
  expected_delivery_date,
  dispatch_location,
  closed_message,
  show_countdown,
  require_advance_payment,
  advance_percent,
  banner_alert,
  show_banner_alert,
  max_batch_capacity
) VALUES (
  1,
  true,
  'booking_open',
  'LIVE PRE-ORDER BATCH BOOKING',
  'Next Jamuna River Catch & Bogura Doi Dispatch',
  'Reserve your share before the batch closes. Caught at dawn and delivered straight to your home in thermal boxes.',
  now() + interval '2 days',
  'Friday Morning Batch (শুক্রবার সকালের ডেলিভারি)',
  'Jamuna River Ghat (Sirajganj) & Sherpur, Bogura',
  'বর্তমান ব্যাচের বুকিং সম্পন্ন হয়েছে। পরবর্তী ব্যাচ শিগগিরই শুরু হবে।',
  true,
  true,
  25,
  'সীমিত কোটা: তাজা নদীর মাছ ও বগুড়ার শাহী দইয়ের অগ্রিম বুকিং চলছে।',
  true,
  250
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. RLS Policies & Grants
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS preorder_settings_public_read ON public.preorder_settings;
DROP POLICY IF EXISTS preorder_settings_admin_all   ON public.preorder_settings;

REVOKE ALL ON public.preorder_settings FROM anon, authenticated;
GRANT SELECT ON public.preorder_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preorder_settings TO authenticated;
GRANT ALL ON public.preorder_settings TO service_role;

CREATE POLICY preorder_settings_public_read ON public.preorder_settings FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY preorder_settings_admin_all ON public.preorder_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Remove any write-guard triggers on preorder_settings
DROP TRIGGER IF EXISTS trg_forbid_api_writes ON public.preorder_settings;

-- Restrict RPC execution to service_role only
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND (p.proname LIKE 'admin\_preorder\_%' OR p.proname LIKE '\_sb\_preorder\_%')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =============================================================================
-- FILE: migrations/20261031140008_08_admin_orders_resilience.sql
-- =============================================================================

-- =============================================================================
-- MIGRATION 08/08 -- CONTACT MESSAGES RESILIENCE & DEFAULT IDENTIFIERS (run AFTER 07)
--
-- What this adds:
--   * Ensures public.contact_messages.id has a safe DEFAULT UUID expression so that
--     any client or public inquiry insertion without an explicit id never violates not-null.
--   * Maintains strict Zero-Client-Trust: direct writes to orders and order_items
--     remain restricted exclusively to audited service functions (migrations 02-04).
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Ensure contact_messages id has a default UUID expression
ALTER TABLE public.contact_messages
  ALTER COLUMN id SET DEFAULT ('msg_' || replace(gen_random_uuid()::text, '-', ''));

COMMIT;

-- =============================================================================
-- FILE: migrations/20261031150009_09_brand_identity.sql
-- =============================================================================

-- =============================================================================
-- MIGRATION 09/09 -- BRAND IDENTITY, COMPANY LOGO, NAME & SLOGAN CMS
--
-- What this adds:
--   * brand_name_en: English brand name (e.g. 'Sadhyer Bazar')
--   * brand_name_bn: Bengali brand name (e.g. 'সাধ্যের বাজার')
--   * slogan_en: English slogan (e.g. 'Village Freshness in the City, at Your Home')
--   * slogan_bn: Bengali slogan (e.g. 'গ্রামের পণ্য শহরে, আপনার ঘরে')
--   * logo_url: Direct URL or WebP/PNG data URL of the company logo
--   * logo_mode: 'custom' (renders logo_url image) or 'badge' (renders iconic circular badge)
--   * favicon_url: Optional custom browser favicon URL
--
-- Column-level grants:
--   * anon, authenticated: SELECT on all new brand columns
--   * authenticated (admins): INSERT, UPDATE on all new brand columns
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Add Brand Identity columns to public.site_settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS brand_name_en TEXT DEFAULT 'Sadhyer Bazar',
  ADD COLUMN IF NOT EXISTS brand_name_bn TEXT DEFAULT 'সাধ্যের বাজার',
  ADD COLUMN IF NOT EXISTS slogan_en TEXT DEFAULT 'Village Freshness in the City, at Your Home',
  ADD COLUMN IF NOT EXISTS slogan_bn TEXT DEFAULT 'গ্রামের পণ্য শহরে, আপনার ঘরে',
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_mode TEXT DEFAULT 'badge',
  ADD COLUMN IF NOT EXISTS favicon_url TEXT DEFAULT '';

-- 2. Grant column-level access to API roles (matching zero-client-trust policy in Migration 05)
GRANT SELECT (
  brand_name_en,
  brand_name_bn,
  slogan_en,
  slogan_bn,
  logo_url,
  logo_mode,
  favicon_url
) ON public.site_settings TO anon, authenticated;

GRANT INSERT (
  brand_name_en,
  brand_name_bn,
  slogan_en,
  slogan_bn,
  logo_url,
  logo_mode,
  favicon_url
) ON public.site_settings TO authenticated;

GRANT UPDATE (
  brand_name_en,
  brand_name_bn,
  slogan_en,
  slogan_bn,
  logo_url,
  logo_mode,
  favicon_url
) ON public.site_settings TO authenticated;

-- 3. Set default values on existing row if empty/null
UPDATE public.site_settings
SET
  brand_name_en = COALESCE(NULLIF(brand_name_en, ''), 'Sadhyer Bazar'),
  brand_name_bn = COALESCE(NULLIF(brand_name_bn, ''), 'সাধ্যের বাজার'),
  slogan_en = COALESCE(NULLIF(slogan_en, ''), 'Village Freshness in the City, at Your Home'),
  slogan_bn = COALESCE(NULLIF(slogan_bn, ''), 'গ্রামের পণ্য শহরে, আপনার ঘরে'),
  logo_mode = COALESCE(NULLIF(logo_mode, ''), 'badge')
WHERE id = 1;

COMMIT;

-- =============================================================================
-- FILE: migrations/20261103100010_10_payment_gateways_on_hold.sql
-- =============================================================================

-- =============================================================================
-- MIGRATION 10/10 -- KEEP ONLINE PAYMENT GATEWAYS ON HOLD (COD ONLY ACTIVE)
--
-- What this does:
--   * Updates public.site_settings:
--     - bkash_enabled = false (on hold as per client request)
--     - nagad_enabled = false (on hold as per client request)
--     - cod_enabled = true (Cash on Delivery is the sole active method)
--   * Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

UPDATE public.site_settings
SET
  bkash_enabled = false,
  nagad_enabled = false,
  cod_enabled = true,
  updated_at = now()
WHERE id = 1;

COMMIT;

-- =============================================================================
-- FILE: migrations/20261103120011_11_qr_payment_verification.sql
-- =============================================================================

-- =============================================================================
-- MIGRATION 11/11 -- BANGLA QR SCAN & PAY & ANTI-HACKER PAYMENT VERIFICATION
--
-- What this adds:
--   * Expands public.orders with manual QR payment tracking columns:
--     - manual_pay_channel: ('bkash', 'nagad', 'card_bank', 'upay', 'other')
--     - manual_pay_sender: Customer's sender mobile/account number
--     - manual_pay_trx_id: Customer's claimed Transaction ID / Reference
--     - manual_pay_proof_url: Optional customer proof screenshot
--     - manual_pay_verified_at: Timestamp when verified by admin
--     - manual_pay_verified_by: Admin UUID who verified the payment
--     - manual_pay_reject_reason: Rejection reason if TrxID mismatched
--   * Expands orders payment_method check to include 'qr_pay'
--   * Anti-Replay Guard: Unique index on uppercase TrxID preventing reuse
--   * site_settings columns: qr_payment_enabled, qr_code_image_url, qr_merchant_name
--   * Customer submission RPC: submit_manual_qr_payment_proof
--   * Atomic Admin verification RPC: admin_verify_manual_qr_payment
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Extend public.orders with manual QR payment columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS manual_pay_channel text CHECK (manual_pay_channel IN ('bkash', 'nagad', 'card_bank', 'upay', 'other')),
  ADD COLUMN IF NOT EXISTS manual_pay_sender text,
  ADD COLUMN IF NOT EXISTS manual_pay_trx_id text,
  ADD COLUMN IF NOT EXISTS manual_pay_proof_url text,
  ADD COLUMN IF NOT EXISTS manual_pay_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_pay_verified_by uuid,
  ADD COLUMN IF NOT EXISTS manual_pay_reject_reason text;

-- 2. Update payment_method CHECK constraint to support 'qr_pay'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cod', 'qr_pay', 'bkash', 'nagad', 'sslcommerz'));

-- 3. Global Anti-Replay Guard: Unique index on TrxID (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_manual_trx_id
  ON public.orders (upper(trim(manual_pay_trx_id)))
  WHERE manual_pay_trx_id IS NOT NULL AND trim(manual_pay_trx_id) <> '';

-- 4. Enable QR payment in site_settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS qr_payment_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS qr_code_image_url text DEFAULT '/images/payments/sadhyer-bazar-qr.jpg',
  ADD COLUMN IF NOT EXISTS qr_merchant_name text DEFAULT 'Sadhyer Bazar';

-- Column level grants matching zero-client-trust policy
GRANT SELECT (qr_payment_enabled, qr_code_image_url, qr_merchant_name)
  ON public.site_settings TO anon, authenticated;
GRANT INSERT (qr_payment_enabled, qr_code_image_url, qr_merchant_name)
  ON public.site_settings TO authenticated;
GRANT UPDATE (qr_payment_enabled, qr_code_image_url, qr_merchant_name)
  ON public.site_settings TO authenticated;

-- Ensure orders grants for authenticated admins cover new columns
GRANT SELECT, INSERT, UPDATE (
  manual_pay_channel,
  manual_pay_sender,
  manual_pay_trx_id,
  manual_pay_proof_url,
  manual_pay_verified_at,
  manual_pay_verified_by,
  manual_pay_reject_reason
) ON public.orders TO authenticated;

-- 5. Customer submission RPC for manual QR payment proof
CREATE OR REPLACE FUNCTION public.submit_manual_qr_payment_proof(
  p_order_id          text,
  p_order_code        text,
  p_channel           text,
  p_sender            text,
  p_trx_id            text,
  p_proof_url         text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_clean_trx text;
BEGIN
  v_clean_trx := upper(trim(coalesce(p_trx_id, '')));
  IF v_clean_trx = '' THEN
    PERFORM public.sb_fail('Transaction ID (TrxID) is required');
  END IF;

  -- Replay guard: Check if TrxID was already validated or submitted on an existing order
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE upper(trim(manual_pay_trx_id)) = v_clean_trx
      AND id <> p_order_id
  ) OR EXISTS (
    SELECT 1 FROM public.processed_webhook_events
    WHERE transaction_id = v_clean_trx
  ) THEN
    PERFORM public.sb_fail('This Transaction ID has already been submitted for another order');
  END IF;

  UPDATE public.orders
  SET
    manual_pay_channel = p_channel,
    manual_pay_sender = left(trim(coalesce(p_sender, '')), 50),
    manual_pay_trx_id = v_clean_trx,
    manual_pay_proof_url = p_proof_url,
    payment_status = 'review_pending',
    updated_at = now()
  WHERE id = p_order_id AND order_code = p_order_code
  RETURNING * INTO v_order;

  IF NOT FOUND THEN
    PERFORM public.sb_fail('Order not found or invalid credentials');
  END IF;

  RETURN jsonb_build_object('success', true, 'orderCode', v_order.order_code, 'status', 'review_pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_manual_qr_payment_proof TO anon, authenticated;

-- 6. Atomic Admin Verification RPC
CREATE OR REPLACE FUNCTION public.admin_verify_manual_qr_payment(
  p_order_id text,
  p_action   text,      -- 'verify_confirm' OR 'reject_mismatch'
  p_actor    uuid,
  p_note     text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_ref   text;
BEGIN
  -- Strict Admin Authentication
  IF p_actor IS NULL OR NOT public.is_admin() THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.sb_fail('Order not found');
  END IF;

  IF p_action = 'verify_confirm' THEN
    v_ref := upper(trim(coalesce(v_order.manual_pay_trx_id, '')));
    IF v_ref = '' THEN
      PERFORM public.sb_fail('Order has no customer TrxID to verify');
    END IF;

    -- Register in processed_webhook_events to guarantee global replay resistance
    INSERT INTO public.processed_webhook_events (gateway, transaction_id, order_code, amount, currency, payload)
    VALUES ('manual_verify', v_ref, v_order.order_code, v_order.total_amount, 'BDT',
            jsonb_build_object('actor', p_actor, 'channel', v_order.manual_pay_channel, 'note', left(coalesce(p_note, ''), 300)))
    ON CONFLICT (gateway, transaction_id) DO NOTHING;

    -- Update order to confirmed and fully paid
    UPDATE public.orders
    SET
      payment_status = 'paid',
      order_status = CASE WHEN order_status = 'pending' THEN 'confirmed' ELSE order_status END,
      advance_paid = total_amount,
      due_amount = 0,
      paid_at = now(),
      manual_pay_verified_at = now(),
      manual_pay_verified_by = p_actor,
      manual_pay_reject_reason = NULL,
      updated_at = now()
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    -- Record transaction in payment_transactions
    INSERT INTO public.payment_transactions (id, order_id, order_code, gateway, transaction_id, validation_id, amount, currency, status, verified_at, created_at)
    VALUES ('tx-' || replace(gen_random_uuid()::text, '-', ''), v_order.id, v_order.order_code, 'manual_verify', v_ref,
            'ADMIN:' || p_actor::text, v_order.total_amount, 'BDT', 'validated', now(), now())
    ON CONFLICT DO NOTHING;

    -- Audit log
    PERFORM public._sb_audit(p_actor, 'order.qr_verify_paid', p_order_id, jsonb_build_object(
      'trxId', v_ref,
      'channel', v_order.manual_pay_channel,
      'amount', v_order.total_amount,
      'note', p_note
    ));

    RETURN jsonb_build_object('success', true, 'status', v_order.order_status, 'paymentStatus', 'paid', 'orderCode', v_order.order_code);

  ELSIF p_action = 'reject_mismatch' THEN
    UPDATE public.orders
    SET
      payment_status = 'failed',
      manual_pay_reject_reason = coalesce(p_note, 'Payment verification failed: TrxID mismatch or payment not found in statement'),
      updated_at = now()
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    PERFORM public._sb_audit(p_actor, 'order.qr_reject_mismatch', p_order_id, jsonb_build_object(
      'trxId', v_order.manual_pay_trx_id,
      'reason', p_note
    ));

    RETURN jsonb_build_object('success', true, 'status', v_order.order_status, 'paymentStatus', 'failed', 'orderCode', v_order.order_code);
  ELSE
    PERFORM public.sb_fail('Invalid action specified');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_verify_manual_qr_payment TO authenticated;

COMMIT;

-- =============================================================================
-- FILE: migrations/20261103130012_12_section_sliders_cms.sql
-- =============================================================================

-- =============================================================================
-- MIGRATION 12/12 -- HOMEPAGE SECTION SLIDERS CMS & DEPARTMENT BANNER CAROUSELS
--
-- What this adds:
--   * public.section_slides : dynamic multi-slide carousels for the 4 homepage departments
--     (dept_jamuna_fish, dept_village_chicken, dept_heritage_rice, dept_ghee_doi)
--   * public.section_slider_settings : per-section autoplay, counter & navigation toggles
--   * Audited admin RPC functions (service_role / authenticated admin ONLY):
--       admin_section_save_slide / admin_section_delete_slide / admin_section_reorder /
--       admin_section_set_active / admin_section_save_settings / admin_section_reset_defaults
--   * Pre-seeds 2 rich slides per department (Slide #1: existing hero-grade banners, Slide #2: promotional offer)
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Helper Link Validators (Support anchor hashes e.g. #dept-heritage-rice)
CREATE OR REPLACE FUNCTION public.sb_section_valid_link(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NOT NULL
     AND length(p) <= 300
     AND (
          p = ''
       OR p ~ '^#[A-Za-z0-9_-]+$'
       OR (p ~ '^/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*$' AND p !~ '^//')
       OR p ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*)?$'
     )
$$;

-- Keep sb_hero_valid_link backward compatible while supporting anchors as well
CREATE OR REPLACE FUNCTION public.sb_hero_valid_link(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT public.sb_section_valid_link(p);
$$;

-- Drop obsolete constraints if table already exists from previous runs
ALTER TABLE IF EXISTS public.section_slides DROP CONSTRAINT IF EXISTS section_slides_pairing_target_href_check;
ALTER TABLE IF EXISTS public.section_slides DROP CONSTRAINT IF EXISTS section_slides_cta_link_check;

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.section_slides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id            text NOT NULL CHECK (section_id IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi')),
  sort_order            integer NOT NULL DEFAULT 0,
  is_active             boolean NOT NULL DEFAULT true,
  image_url             text NOT NULL CHECK (public.sb_hero_valid_image(image_url)),
  image_alt             text NOT NULL DEFAULT '' CHECK (char_length(image_alt) <= 200),
  badge_text_en         text NOT NULL DEFAULT '' CHECK (char_length(badge_text_en) <= 80),
  badge_text_bn         text NOT NULL DEFAULT '' CHECK (char_length(badge_text_bn) <= 80),
  badge_icon            text NOT NULL DEFAULT 'sparkles'
                        CHECK (badge_icon IN ('fish', 'award', 'flame', 'wheat', 'leaf', 'sparkles', 'truck', 'shield', 'clock', 'star', 'heart', 'gift', 'phone')),
  title_en              text NOT NULL CHECK (char_length(title_en) BETWEEN 1 AND 160),
  headline_bn           text NOT NULL CHECK (char_length(headline_bn) BETWEEN 1 AND 160),
  convincing_subtext_bn text NOT NULL DEFAULT '' CHECK (char_length(convincing_subtext_bn) <= 450),
  description_en        text NOT NULL DEFAULT '' CHECK (char_length(description_en) <= 450),
  origin_location       text NOT NULL DEFAULT '' CHECK (char_length(origin_location) <= 120),
  highlights            jsonb NOT NULL DEFAULT '[]'::jsonb
                        CHECK (jsonb_typeof(highlights) = 'array' AND jsonb_array_length(highlights) <= 6),
  pairing_tip_text      text NOT NULL DEFAULT '' CHECK (char_length(pairing_tip_text) <= 200),
  pairing_target_href   text NOT NULL DEFAULT '' CHECK (public.sb_section_valid_link(pairing_target_href)),
  pairing_target_label  text NOT NULL DEFAULT '' CHECK (char_length(pairing_target_label) <= 80),
  cta_text              text NOT NULL DEFAULT '' CHECK (char_length(cta_text) <= 60),
  cta_link              text NOT NULL DEFAULT '' CHECK (public.sb_section_valid_link(cta_link)),
  banner_layout         text NOT NULL DEFAULT 'default' CHECK (banner_layout IN ('default', 'reversed')),
  starts_at             timestamptz,
  ends_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT section_slides_schedule_chk CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

-- Ensure constraints exist if table already pre-existed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'section_slides_pairing_target_href_check'
  ) THEN
    ALTER TABLE public.section_slides
      ADD CONSTRAINT section_slides_pairing_target_href_check
      CHECK (public.sb_section_valid_link(pairing_target_href));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'section_slides_cta_link_check'
  ) THEN
    ALTER TABLE public.section_slides
      ADD CONSTRAINT section_slides_cta_link_check
      CHECK (public.sb_section_valid_link(cta_link));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_section_slides_lookup
  ON public.section_slides (section_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.section_slider_settings (
  section_id            text PRIMARY KEY CHECK (section_id IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi')),
  autoplay              boolean NOT NULL DEFAULT true,
  autoplay_seconds      numeric(4, 1) NOT NULL DEFAULT 5.0 CHECK (autoplay_seconds BETWEEN 2 AND 20),
  show_counter          boolean NOT NULL DEFAULT true,
  show_navigation       boolean NOT NULL DEFAULT true,
  show_dots             boolean NOT NULL DEFAULT true,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- RLS Enforcement
ALTER TABLE public.section_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_slider_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.section_slides TO anon, authenticated;
GRANT SELECT ON public.section_slider_settings TO anon, authenticated;

-- 2. Helper JSON serialization
CREATE OR REPLACE FUNCTION public._sb_section_slide_json(s public.section_slides)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'sectionId', s.section_id,
    'sortOrder', s.sort_order,
    'isActive', s.is_active,
    'imageUrl', s.image_url,
    'imageAlt', s.image_alt,
    'badgeTextEn', s.badge_text_en,
    'badgeTextBn', s.badge_text_bn,
    'badgeIcon', s.badge_icon,
    'titleEn', s.title_en,
    'headlineBn', s.headline_bn,
    'convincingSubtextBn', s.convincing_subtext_bn,
    'descriptionEn', s.description_en,
    'originLocation', s.origin_location,
    'highlights', s.highlights,
    'pairingTipText', s.pairing_tip_text,
    'pairingTargetHref', s.pairing_target_href,
    'pairingTargetLabel', s.pairing_target_label,
    'ctaText', s.cta_text,
    'ctaLink', s.cta_link,
    'bannerLayout', s.banner_layout,
    'startsAt', s.starts_at,
    'endsAt', s.ends_at,
    'updatedAt', s.updated_at
  )
$$;

-- 3. Validate highlights array
CREATE OR REPLACE FUNCTION public._sb_section_clean_highlights(p jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_out  jsonb := '[]'::jsonb;
  v_item jsonb;
  v_text text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;
  IF jsonb_array_length(p) > 6 THEN
    PERFORM public.sb_fail('A maximum of 6 highlights are allowed');
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(v_item) = 'string' THEN
      v_text := public.sb_clean_text(v_item #>> '{}');
    ELSIF jsonb_typeof(v_item) = 'object' THEN
      v_text := public.sb_clean_text(v_item ->> 'text');
    ELSE
      v_text := '';
    END IF;
    IF char_length(v_text) > 0 THEN
      IF char_length(v_text) > 120 THEN
        PERFORM public.sb_fail('Each highlight must be at most 120 characters');
      END IF;
      v_out := v_out || to_jsonb(v_text);
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

-- 4. Seed function for default department slides
CREATE OR REPLACE FUNCTION public._sb_section_seed_defaults(p_target_section text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_target_section IS NULL OR p_target_section = 'dept_jamuna_fish' THEN
    DELETE FROM public.section_slides WHERE section_id = 'dept_jamuna_fish';
    INSERT INTO public.section_slides (
      section_id, sort_order, is_active, image_url, image_alt,
      badge_text_en, badge_text_bn, badge_icon,
      title_en, headline_bn, convincing_subtext_bn, description_en, origin_location,
      highlights, pairing_tip_text, pairing_target_href, pairing_target_label,
      cta_text, cta_link, banner_layout
    ) VALUES (
      'dept_jamuna_fish', 1, true, '/images/banners/jamuna-fisherman-banner.jpg',
      'যমুনার ভোরবেলার তাজা মাছ — জেলের জাল থেকে সরাসরি আপনার ঘরে',
      'Fresh River Catch', 'যমুনা নদীর ভোরের তাজা মাছ', 'fish',
      'Fresh River Catch from Jamuna River Basin',
      'যমুনার ভোরের তাজা মাছ — জেলের জাল থেকে সরাসরি আপনার ঘরে!',
      '১০০% ফরমালিন ও হিমাগার (Cold-Storage) মুক্ত। ভোরবেলা সিরাজগঞ্জ ও সারিয়াকান্দি ঘাটে জেলের জাল থেকে তুলেই ফুড-গ্রেড আইসবক্সে প্যাকিং করে পাঠানো হয়।',
      'We never buy from city wholesale markets or keep fish frozen in storage. Our local team stands at the Jamuna river ghats at dawn to collect wild Piali, Kajoli, Ayer, Boal, Chital, Deshi Rui, and giant Galda Chingri.',
      'Sirajganj & Sariakandi Jamuna Ghat',
      '["100% Wild River Catch — Zero Farmed or Cold-Storage Fish", "Custom Bengali Cutting & Cleaning Options Available", "Packed Immediately in Food-Grade Thermal Ice Boxes"]'::jsonb,
      'Cook fresh river fish with unpolished Red Rice', '#dept-heritage-rice', 'See Heritage Rice',
      'Shop All Fresh Fish from Jamuna River', '/pre-orders', 'default'
    ), (
      'dept_jamuna_fish', 2, true, '/images/banners/hero-jamuna-river-dawn.jpg',
      'সিরাজগঞ্জ ঘাটের স্পেশাল তাজা দেশি মাছ ও প্রিমিয়াম আইড় চিতল',
      'Daily Sunrise Catch', 'ভোরের স্পেশাল নদীর আইড়, চিতল ও বোয়াল', 'sparkles',
      'Dawn Harvest: Wild River Piali, Kajoli, Boal & Chital',
      'নদীর আসল স্বাদ পেতে আজই বুকিং করুন ভোরের তাজা মাছ!',
      'প্রাকৃতিক প্রবাহের জীবন্ত নদী থেকে সংগ্রহকৃত দেশি মাছ। অর্ডার করার পর তাজা মাছ এনে আপনার পছন্দমতো কেটে থার্মাল বক্সে পৌঁছে দেওয়া হয়।',
      'Authentic fresh-water river fish with zero preservatives. Sourced strictly from verified traditional fishermen at first light.',
      'Sariakandi, Bogura & Sirajganj Basin',
      '["Direct Fishermen Catch with Authentic Sweet River Taste", "No Preservatives, Ice-Cured Freshness Only", "100% Money-Back Quality & Freshness Guarantee"]'::jsonb,
      'Pair Boal & Chital fish curry with fragrant Chinigura Rice', '#dept-heritage-rice', 'View Polao Rice',
      'Pre-Order Tomorrow Sunrise Catch', '/pre-orders', 'default'
    );

    INSERT INTO public.section_slider_settings (section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at)
    VALUES ('dept_jamuna_fish', true, 5.0, true, true, true, now())
    ON CONFLICT (section_id) DO UPDATE SET updated_at = now();
  END IF;

  IF p_target_section IS NULL OR p_target_section = 'dept_village_chicken' THEN
    DELETE FROM public.section_slides WHERE section_id = 'dept_village_chicken';
    INSERT INTO public.section_slides (
      section_id, sort_order, is_active, image_url, image_alt,
      badge_text_en, badge_text_bn, badge_icon,
      title_en, headline_bn, convincing_subtext_bn, description_en, origin_location,
      highlights, pairing_tip_text, pairing_target_href, pairing_target_label,
      cta_text, cta_link, banner_layout
    ) VALUES (
      'dept_village_chicken', 1, true, '/images/banners/village-chicken-banner.jpg',
      'গ্রামের আসল দেশি মুরগি ও ডিম — প্রাকৃতিক খামার',
      'Deshi Chicken & Eggs from Village', 'গ্রামের আসল দেশি মুরগি, হাঁস ও ডিম', 'flame',
      'Free-Range Deshi Chicken, Wetland Duck & Golden-Yolk Eggs',
      'গ্রামীন উঠানে প্রাকৃতিক খাবারে বেড়ে ওঠা আসল দেশি মুরগি ও ডিম!',
      'ফার্মের সিন্থেটিক ফিড, গ্রোথ হরমোন ও অ্যান্টিবায়োটিক সম্পূর্ণ মুক্ত। বগুড়া, টাঙ্গাইল ও চলনবিল অঞ্চলের গ্রামীণ গৃহস্থ বাড়ি থেকে সরাসরি সংগৃহীত।',
      'Rediscover the authentic taste and aroma of childhood village curry (মাটির গন্ধ ও ঘরোয়া রান্নার স্বাদ). Our free-range Deshi chickens and Chalan Beel ducks are Halal processed on the morning of dispatch and cut to your exact preference.',
      'Bogura, Tangail & Chalan Beel Villages',
      '["100% Free-Range Village Homestead Foraged Poultry", "Zero Antibiotics, Steroids, or Commercial Broiler Feed", "Freshly Halal Dressed & Custom Curry-Cut on Delivery Morning"]'::jsonb,
      'Pair Deshi Chicken Roast or Bhuna with Chinigura Polao', '#dept-heritage-rice', 'Explore Polao & Basmati Rice',
      'Shop All Deshi Chicken & Eggs from Village', '/shop?category=deshi-meat-poultry', 'reversed'
    ), (
      'dept_village_chicken', 2, true, '/images/banners/hero-village-deshi-poultry.jpg',
      'চলনবিলের দেশি হাঁস ও লাল কুসুমের পুষ্টিকর ডিম',
      'Wetland Free-Range Duck', 'চলনবিলের প্রাকৃতিক হাঁস ও খাঁটি দেশি ডিম', 'award',
      'Natural Wetland Grazed Deshi Duck & Golden Yolk Eggs',
      'চলনবিলের জলজ শামুক-গেঁড়ি খাওয়া প্রাকৃতিক দেশি হাঁসের মাংস!',
      'গ্রামের মুক্ত জলাশয়ে সাঁতার কাটা দেশি হাঁস। দেশি মসলা ও খাঁটি ঘিয়ে রান্না করলে পাবেন ঐতিহ্যবাহী ভূনা মাংসের অতুলনীয় ঘ্রাণ।',
      'Foraged naturally in wide freshwater wetlands. Rich in iron, clean protein and natural yellow yolk nutrients with no artificial coloring.',
      'Chalan Beel, Natore & Sirajganj',
      '["Foraged on Natural Aquatic Snails and Farm Grains", "Strict Halal Processing with Skin-On/Off Options", "Chilled Packaging for Peak Freshness"]'::jsonb,
      'Roast with Sirajganj Bilona Ghee for Rich Traditional Aroma', '#dept-ghee-doi', 'See Pure Gawa Ghee',
      'Order Fresh Deshi Duck & Eggs', '/shop?category=deshi-meat-poultry', 'reversed'
    );

    INSERT INTO public.section_slider_settings (section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at)
    VALUES ('dept_village_chicken', true, 5.0, true, true, true, now())
    ON CONFLICT (section_id) DO UPDATE SET updated_at = now();
  END IF;

  IF p_target_section IS NULL OR p_target_section = 'dept_heritage_rice' THEN
    DELETE FROM public.section_slides WHERE section_id = 'dept_heritage_rice';
    INSERT INTO public.section_slides (
      section_id, sort_order, is_active, image_url, image_alt,
      badge_text_en, badge_text_bn, badge_icon,
      title_en, headline_bn, convincing_subtext_bn, description_en, origin_location,
      highlights, pairing_tip_text, pairing_target_href, pairing_target_label,
      cta_text, cta_link, banner_layout
    ) VALUES (
      'dept_heritage_rice', 1, true, '/images/banners/heritage-rice-banner.jpg',
      'দিনাজপুরের ঐতিহ্যবাহী সুগন্ধি কাটারিভোগ ও পুষ্টিকর চালের সমাহার',
      'Kataribhog, Basmati & Red Rice', 'দিনাজপুরের কাটারিভোগ, বাসমতি ও লাল চাল', 'wheat',
      'Royal Heritage Rice: Kataribhog, Aged Basmati, Chinigura & Red Rice',
      'দিনাজপুরের ঐতিহ্যবাহী সুগন্ধি কাটারিভোগ, প্রিমিয়াম বাসমতি ও ঢেঁকি ছাঁটা লাল চাল!',
      'কৃত্রিম সুগন্ধি, মোম পলিশ (Wax Polish) এবং কেমিক্যাল ব্লিচিং মুক্ত। প্রতিদিনের স্বাস্থ্যকর ভাত, ডায়াবেটিক ডায়েট কিংবা রাজকীয় বিরিয়ানি ও পোলাওয়ের জন্য সেরা।',
      'From GI-famous Dinajpur Kataribhog and 12-month aged extra-long Basmati to low-GI full-fiber unpolished Red Rice and Bogura Chinigura—every grain is sourced directly from heritage husking mills with intact nutrition.',
      'Dinajpur, Sherpur & Naogaon Heritage Mills',
      '["Dinajpur GI-Origin Kataribhog & 12-Month Aged Extra-Long Basmati", "Unpolished Low-GI Full-Fiber Red Rice (Diabetic & Heart Friendly)", "100% Stone-Free, Unbleached & Zero Chemical Wax Polish"]'::jsonb,
      'Top steaming Kataribhog or Red Rice with 1 spoon Gawa Ghee', '#dept-ghee-doi', 'See Pure Gawa Ghee',
      'Shop All Kataribhog, Basmati & Red Rice', '/shop?category=organic-rice-honey', 'default'
    ), (
      'dept_heritage_rice', 2, true, '/images/banners/hero-heritage-golden-rice.jpg',
      'বগুড়ার সুগন্ধি চিনিগুঁড়া পোলাও চাল ও সুন্দরবনের খাঁটি মধু',
      'Aromatic Polao & Honey', 'ঐতিহ্যবাহী চিনিগুঁড়া পোলাও চাল ও সুন্দরবনের মধু', 'sparkles',
      'Aromatic Bogura Chinigura Rice & Raw Forest Honey',
      'উৎসব ও পোলাওয়ের জন্য বগুড়ার আসল খুশবুদার চিনিগুঁড়া চাল!',
      'প্রাচীন মাটির উর্বরতায় ফলানো ছোট দানার সুগন্ধি চাল, যার মৌ মৌ ঘ্রাণে যেকোনো বিরিয়ানি ও পোলাও হয়ে ওঠে অনন্য।',
      'Heritage non-GMO grain varieties carefully milled to preserve bran layer vitamins, low glycemic response and exquisite natural floral fragrance.',
      'Sherpur, Bogura & Sundarbans Mangrove',
      '["Naturally Aged for 12 Months for Non-Sticky Fluffy Grains", "Full Grain Purity Guarantee with Zero Broken Rice", "Tested for 100% Natural Purity with Zero Synthetic Fragrance"]'::jsonb,
      'Cook polao with Bilona Ghee for unmatched wedding aroma', '#dept-ghee-doi', 'View Gawa Ghee',
      'Explore Fragrant Chinigura Rice', '/shop?category=organic-rice-honey', 'default'
    );

    INSERT INTO public.section_slider_settings (section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at)
    VALUES ('dept_heritage_rice', true, 5.0, true, true, true, now())
    ON CONFLICT (section_id) DO UPDATE SET updated_at = now();
  END IF;

  IF p_target_section IS NULL OR p_target_section = 'dept_ghee_doi' THEN
    DELETE FROM public.section_slides WHERE section_id = 'dept_ghee_doi';
    INSERT INTO public.section_slides (
      section_id, sort_order, is_active, image_url, image_alt,
      badge_text_en, badge_text_bn, badge_icon,
      title_en, headline_bn, convincing_subtext_bn, description_en, origin_location,
      highlights, pairing_tip_text, pairing_target_href, pairing_target_label,
      cta_text, cta_link, banner_layout
    ) VALUES (
      'dept_ghee_doi', 1, true, '/images/banners/ghee-bogura-doi-banner.jpg',
      'সিরাজগঞ্জের দানাদার ঘি ও বগুড়ার ঐতিহ্যবাহী মাটির সরার শাহী দই',
      'Pure Gawa Ghee & Bogura Doi', 'খাঁটি গাওয়া ঘি ও বগুড়ার শাহী দই', 'award',
      'Sirajganj Bilona Gawa Ghee, Bogura Clay-Pot Shahi Doi & Raw Honey',
      'সিরাজগঞ্জের দানাদার গাওয়া ঘি ও বগুড়ার ঐতিহ্যবাহী মাটির সরার শাহী দই!',
      'খাঁটি গরুর দুধের ননি থেকে কাঠের চুলায় তৈরি মাখুঞ্চে দানাদার গাওয়া ঘি এবং শেরপুর-বগুড়ার কারিগরদের হাতে তৈরি মাটির সরার আসল শাহী মিষ্টি দই ও ক্ষীরসা।',
      'Experience the crown jewels of North Bengal''s dairy heritage. Our Gawa Ghee is 100% free from dalda or palm oil, and our Bogura Shahi Doi & Khirsha are dispatched fresh in insulated thermal packaging.',
      'Sirajganj Bathan & Sherpur, Bogura',
      '["Traditional Bilona Wood-Fired Granular Cow Milk Gawa Ghee", "Original Terracotta Clay Sora (মাটির সরা) Bogura Shahi Doi & Khirsha", "Lab-Verified 100% Pure — Zero Dalda, Artificial Essence or Starch"]'::jsonb,
      'Bundle Ghee, Doi, Fish & Rice together for 8% Combo Savings', '#combo-builder', 'Build Family Box',
      'Shop All Pure Gawa Ghee & Bogura Doi', '/shop?category=ghee-and-dairy', 'reversed'
    ), (
      'dept_ghee_doi', 2, true, '/images/banners/hero-gawa-ghee-bogura-doi.jpg',
      'ঐতিহ্যবাহী বিলোনা ঘি ও শেরপুরের আসল সরের ক্ষীরসা দই',
      'Royal Dairy Heritage', 'আসল শেরপুরের ক্ষীরসা ও দানাদার বাথান ঘি', 'sparkles',
      'Heritage Sherpur Clay Sora Khirsha & Golden Bathan Ghee',
      'দুধের ঘন সর ও কাঠের চুলার মৃদু তাপে তৈরি ঐতিহ্যবাহী ক্ষীরসা দই!',
      'শত বছরের প্রাচীন রেসিপিতে খাঁটি গরুর দুধে তৈরি বগুড়ার মিষ্টি শাহী দই ও ক্ষীরসা। প্রতিটি চামচে অনুভব করুন প্রাচীন বাংলার আতিথেয়তার স্বাদ।',
      'Crafted by generational sweet-makers in terracotta pots that naturally absorb excess whey, yielding dense, velvety curd and caramelized cream crust.',
      'Sherpur, Bogura & Shahjadpur Bathan',
      '["Slow-Caramelized Over Tamarind Wood Fire for 8+ Hours", "Clay Pot Breathing Ensures Firm Texture & Deep Aroma", "Strict Cold-Chain Express Van Delivery to Dhaka Homes"]'::jsonb,
      'Enjoy chilled Bogura Doi right after fresh river fish lunch', '#dept-jamuna-fish', 'See River Fish',
      'Order Bogura Clay Sora Doi & Ghee', '/shop?category=ghee-and-dairy', 'reversed'
    );

    INSERT INTO public.section_slider_settings (section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at)
    VALUES ('dept_ghee_doi', true, 5.0, true, true, true, now())
    ON CONFLICT (section_id) DO UPDATE SET updated_at = now();
  END IF;
END;
$$;

-- Run initial seed
SELECT public._sb_section_seed_defaults();

-- 5. Audited Admin RPC: admin_section_save_slide
CREATE OR REPLACE FUNCTION public.admin_section_save_slide(p_actor uuid, p_slide jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id         uuid;
  v_section_id text;
  v_image      text;
  v_alt        text;
  v_badge_en   text;
  v_badge_bn   text;
  v_icon       text;
  v_title_en   text;
  v_headline   text;
  v_subtext    text;
  v_desc_en    text;
  v_origin     text;
  v_highlights jsonb;
  v_tip_text   text;
  v_tip_href   text;
  v_tip_label  text;
  v_cta_text   text;
  v_cta_link   text;
  v_layout     text;
  v_active     boolean;
  v_starts     timestamptz;
  v_ends       timestamptz;
  v_row        public.section_slides;
  v_old        public.section_slides;
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;
  IF p_slide IS NULL OR jsonb_typeof(p_slide) <> 'object' THEN
    PERFORM public.sb_fail('Slide payload required');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('section_slides'));

  BEGIN
    v_id     := nullif(p_slide ->> 'id', '')::uuid;
    v_starts := nullif(p_slide ->> 'startsAt', '')::timestamptz;
    v_ends   := nullif(p_slide ->> 'endsAt', '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sb_fail('Invalid slide id or schedule date');
  END;

  v_section_id := btrim(coalesce(p_slide ->> 'sectionId', ''));
  IF v_section_id NOT IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi') THEN
    PERFORM public.sb_fail('Invalid department section identifier');
  END IF;

  v_image      := btrim(coalesce(p_slide ->> 'imageUrl', ''));
  v_alt        := public.sb_clean_text(p_slide ->> 'imageAlt');
  v_badge_en   := public.sb_clean_text(p_slide ->> 'badgeTextEn');
  v_badge_bn   := public.sb_clean_text(p_slide ->> 'badgeTextBn');
  v_icon       := coalesce(nullif(p_slide ->> 'badgeIcon', ''), 'sparkles');
  v_title_en   := public.sb_clean_text(p_slide ->> 'titleEn');
  v_headline   := public.sb_clean_text(p_slide ->> 'headlineBn');
  v_subtext    := public.sb_clean_text(p_slide ->> 'convincingSubtextBn');
  v_desc_en    := public.sb_clean_text(p_slide ->> 'descriptionEn');
  v_origin     := public.sb_clean_text(p_slide ->> 'originLocation');
  v_highlights := public._sb_section_clean_highlights(p_slide -> 'highlights');
  v_tip_text   := public.sb_clean_text(p_slide ->> 'pairingTipText');
  v_tip_href   := btrim(coalesce(p_slide ->> 'pairingTargetHref', ''));
  v_tip_label  := public.sb_clean_text(p_slide ->> 'pairingTargetLabel');
  v_cta_text   := public.sb_clean_text(p_slide ->> 'ctaText');
  v_cta_link   := btrim(coalesce(p_slide ->> 'ctaLink', ''));
  v_layout     := coalesce(nullif(p_slide ->> 'bannerLayout', ''), 'default');
  v_active     := coalesce((p_slide ->> 'isActive')::boolean, true);

  IF NOT public.sb_hero_valid_image(v_image) THEN
    PERFORM public.sb_fail('Banner image must be an uploaded media file or valid /images/... asset');
  END IF;
  IF v_icon NOT IN ('fish', 'award', 'flame', 'wheat', 'leaf', 'sparkles', 'truck', 'shield', 'clock', 'star', 'heart', 'gift', 'phone') THEN
    PERFORM public.sb_fail('Invalid badge icon selected');
  END IF;
  IF char_length(v_title_en) < 1 OR char_length(v_title_en) > 160 THEN
    PERFORM public.sb_fail('English Title is required (1-160 characters)');
  END IF;
  IF char_length(v_headline) < 1 OR char_length(v_headline) > 160 THEN
    PERFORM public.sb_fail('Bengali Headline is required (1-160 characters)');
  END IF;
  IF char_length(v_subtext) > 450 THEN PERFORM public.sb_fail('Bengali Subtext is too long (max 450)'); END IF;
  IF char_length(v_desc_en) > 450 THEN PERFORM public.sb_fail('English Description is too long (max 450)'); END IF;
  IF char_length(v_origin) > 120 THEN PERFORM public.sb_fail('Origin location is too long (max 120)'); END IF;
  IF NOT public.sb_section_valid_link(v_cta_link) THEN
    PERFORM public.sb_fail('Button link must be a safe route (e.g. /shop), anchor (#section), or https address');
  END IF;
  IF NOT public.sb_section_valid_link(v_tip_href) THEN
    PERFORM public.sb_fail('Pairing link must be a safe route, anchor (#section), or https address');
  END IF;
  IF v_layout NOT IN ('default', 'reversed') THEN
    v_layout := 'default';
  END IF;
  IF v_starts IS NOT NULL AND v_ends IS NOT NULL AND v_ends <= v_starts THEN
    PERFORM public.sb_fail('Schedule end date must be after start date');
  END IF;

  IF v_id IS NULL THEN
    IF (SELECT count(*) FROM public.section_slides WHERE section_id = v_section_id) >= 10 THEN
      PERFORM public.sb_fail('You can have at most 10 slides per section. Delete an old one first.');
    END IF;

    INSERT INTO public.section_slides (
      section_id, sort_order, is_active, image_url, image_alt,
      badge_text_en, badge_text_bn, badge_icon,
      title_en, headline_bn, convincing_subtext_bn, description_en, origin_location,
      highlights, pairing_tip_text, pairing_target_href, pairing_target_label,
      cta_text, cta_link, banner_layout, starts_at, ends_at
    ) VALUES (
      v_section_id,
      (SELECT coalesce(max(sort_order), 0) + 1 FROM public.section_slides WHERE section_id = v_section_id),
      v_active, v_image, v_alt, v_badge_en, v_badge_bn, v_icon,
      v_title_en, v_headline, v_subtext, v_desc_en, v_origin,
      v_highlights, v_tip_text, v_tip_href, v_tip_label,
      v_cta_text, v_cta_link, v_layout, v_starts, v_ends
    ) RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_old FROM public.section_slides WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.sb_fail('Slide not found. Please refresh and try again.');
    END IF;

    UPDATE public.section_slides SET
      section_id            = v_section_id,
      is_active             = v_active,
      image_url             = v_image,
      image_alt             = v_alt,
      badge_text_en         = v_badge_en,
      badge_text_bn         = v_badge_bn,
      badge_icon            = v_icon,
      title_en              = v_title_en,
      headline_bn           = v_headline,
      convincing_subtext_bn = v_subtext,
      description_en        = v_desc_en,
      origin_location       = v_origin,
      highlights            = v_highlights,
      pairing_tip_text      = v_tip_text,
      pairing_target_href   = v_tip_href,
      pairing_target_label  = v_tip_label,
      cta_text              = v_cta_text,
      cta_link              = v_cta_link,
      banner_layout         = v_layout,
      starts_at             = v_starts,
      ends_at               = v_ends,
      updated_at            = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  PERFORM public._sb_audit(
    p_actor,
    CASE WHEN v_id IS NULL THEN 'section.create_slide' ELSE 'section.update_slide' END,
    v_row.id::text,
    jsonb_build_object('sectionId', v_row.section_id, 'title', v_row.title_en, 'active', v_row.is_active)
  );

  RETURN jsonb_build_object(
    'slide', public._sb_section_slide_json(v_row),
    'orphanedImageUrl', CASE WHEN v_old.id IS NOT NULL AND v_old.image_url <> v_row.image_url
                             THEN public._sb_hero_orphan(v_old.image_url) END
  );
END;
$$;

-- 6. Audited Admin RPC: admin_section_delete_slide
CREATE OR REPLACE FUNCTION public.admin_section_delete_slide(p_actor uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.section_slides;
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;
  IF p_id IS NULL THEN PERFORM public.sb_fail('Slide id required'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('section_slides'));

  DELETE FROM public.section_slides WHERE id = p_id RETURNING * INTO v_row;
  IF NOT FOUND THEN PERFORM public.sb_fail('Slide not found or already deleted.'); END IF;

  -- Re-rank remaining slides in that department to stay gap-free
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY sort_order, created_at) AS rn
    FROM public.section_slides
    WHERE section_id = v_row.section_id
  )
  UPDATE public.section_slides s
  SET sort_order = ranked.rn
  FROM ranked
  WHERE s.id = ranked.id AND s.sort_order <> ranked.rn;

  PERFORM public._sb_audit(p_actor, 'section.delete_slide', p_id::text, jsonb_build_object('sectionId', v_row.section_id, 'title', v_row.title_en));

  RETURN jsonb_build_object(
    'deleted', true,
    'sectionId', v_row.section_id,
    'orphanedImageUrl', public._sb_hero_orphan(v_row.image_url)
  );
END;
$$;

-- 7. Audited Admin RPC: admin_section_reorder
CREATE OR REPLACE FUNCTION public.admin_section_reorder(p_actor uuid, p_section_id text, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_i     integer;
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_section_id NOT IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi') THEN
    PERFORM public.sb_fail('Invalid department section identifier');
  END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) = 0 THEN PERFORM public.sb_fail('Slide ID array required'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('section_slides'));

  SELECT count(*) INTO v_count FROM public.section_slides WHERE section_id = p_section_id;
  IF array_length(p_ids, 1) <> v_count THEN
    PERFORM public.sb_fail('Slide list is out of date. Please refresh the page.');
  END IF;

  FOR v_i IN 1 .. array_length(p_ids, 1) LOOP
    UPDATE public.section_slides
    SET sort_order = v_i, updated_at = now()
    WHERE id = p_ids[v_i] AND section_id = p_section_id;
  END LOOP;

  PERFORM public._sb_audit(p_actor, 'section.reorder', p_section_id, jsonb_build_object('count', v_count));
  RETURN jsonb_build_object('success', true, 'sectionId', p_section_id);
END;
$$;

-- 8. Audited Admin RPC: admin_section_set_active
CREATE OR REPLACE FUNCTION public.admin_section_set_active(p_actor uuid, p_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.section_slides;
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_id IS NULL THEN PERFORM public.sb_fail('Slide id required'); END IF;

  UPDATE public.section_slides
  SET is_active = coalesce(p_active, false), updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN PERFORM public.sb_fail('Slide not found'); END IF;

  PERFORM public._sb_audit(p_actor, 'section.set_active', p_id::text, jsonb_build_object('sectionId', v_row.section_id, 'active', v_row.is_active));
  RETURN jsonb_build_object('success', true, 'slide', public._sb_section_slide_json(v_row));
END;
$$;

-- 9. Audited Admin RPC: admin_section_save_settings
CREATE OR REPLACE FUNCTION public.admin_section_save_settings(p_actor uuid, p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_section_id  text;
  v_autoplay    boolean;
  v_speed       numeric(4, 1);
  v_counter     boolean;
  v_nav         boolean;
  v_dots        boolean;
  v_row         public.section_slider_settings;
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN PERFORM public.sb_fail('Settings object required'); END IF;

  v_section_id := btrim(coalesce(p_settings ->> 'sectionId', ''));
  IF v_section_id NOT IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi') THEN
    PERFORM public.sb_fail('Invalid department section identifier');
  END IF;

  v_autoplay := coalesce((p_settings ->> 'autoplay')::boolean, true);
  v_speed    := coalesce((p_settings ->> 'autoplaySeconds')::numeric, 5.0);
  IF v_speed < 2 OR v_speed > 20 THEN PERFORM public.sb_fail('Autoplay speed must be between 2 and 20 seconds'); END IF;
  v_counter  := coalesce((p_settings ->> 'showCounter')::boolean, true);
  v_nav      := coalesce((p_settings ->> 'showNavigation')::boolean, true);
  v_dots     := coalesce((p_settings ->> 'showDots')::boolean, true);

  INSERT INTO public.section_slider_settings (
    section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at
  ) VALUES (
    v_section_id, v_autoplay, v_speed, v_counter, v_nav, v_dots, now()
  )
  ON CONFLICT (section_id) DO UPDATE SET
    autoplay         = EXCLUDED.autoplay,
    autoplay_seconds = EXCLUDED.autoplay_seconds,
    show_counter     = EXCLUDED.show_counter,
    show_navigation  = EXCLUDED.show_navigation,
    show_dots        = EXCLUDED.show_dots,
    updated_at       = now()
  RETURNING * INTO v_row;

  PERFORM public._sb_audit(p_actor, 'section.save_settings', v_section_id, to_jsonb(v_row));
  RETURN to_jsonb(v_row);
END;
$$;

-- 10. Audited Admin RPC: admin_section_reset_defaults
CREATE OR REPLACE FUNCTION public.admin_section_reset_defaults(p_actor uuid, p_section_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_section_id IS NOT NULL AND p_section_id NOT IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi') THEN
    PERFORM public.sb_fail('Invalid department section identifier');
  END IF;

  PERFORM public._sb_section_seed_defaults(p_section_id);
  PERFORM public._sb_audit(p_actor, 'section.reset_defaults', coalesce(p_section_id, 'all_sections'), jsonb_build_object('reset', true));

  RETURN jsonb_build_object('success', true, 'sectionId', coalesce(p_section_id, 'all_sections'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.sb_section_valid_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sb_hero_valid_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_save_slide TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_delete_slide TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_reorder TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_set_active TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_save_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_reset_defaults TO authenticated;

-- Storage Policy Update (allows admin to upload hero/ and section-banners/ media)
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL AND to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS site_media_admin_insert ON storage.objects;
    DROP POLICY IF EXISTS site_media_admin_update ON storage.objects;

    CREATE POLICY site_media_admin_insert ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'site-media' AND (name LIKE 'hero/%' OR name LIKE 'section-banners/%') AND public.is_admin());

    CREATE POLICY site_media_admin_update ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'site-media' AND public.is_admin())
      WITH CHECK (bucket_id = 'site-media' AND (name LIKE 'hero/%' OR name LIKE 'section-banners/%') AND public.is_admin());
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

COMMIT;

-- =============================================================================
-- FILE: migrations/20261104100013_13_qr_quote_and_tracking_fix.sql
-- =============================================================================

-- =============================================================================
-- MIGRATION 13/13 -- QR PAY AUTHORITATIVE PRICING, TRACKING & SUMMARY FIX
--
-- What this fixes:
--   * _sb_quote_order: Allows 'qr_pay' in p_method allowlist and verifies
--     coalesce(v_settings.qr_payment_enabled, false).
--   * _sb_order_summary: Returns manual_pay_channel, manual_pay_sender,
--     manual_pay_trx_id, manual_pay_verified_at, manual_pay_reject_reason.
--   * track_order_server: Returns manual_pay_channel, manual_pay_trx_id,
--     manual_pay_verified_at, manual_pay_reject_reason so tracking across
--     devices accurately displays customer submission and admin verification status.
--   * Grant EXECUTE on submit_manual_qr_payment_proof & admin_verify_manual_qr_payment
--     to service_role as well as authenticated.
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Update _sb_quote_order to support 'qr_pay'
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
  IF p_method IS NULL OR p_method NOT IN ('bkash', 'nagad', 'cod', 'qr_pay') THEN
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
     OR (p_method = 'cod' AND NOT coalesce(v_settings.cod_enabled, false))
     OR (p_method = 'qr_pay' AND NOT coalesce(v_settings.qr_payment_enabled, false)) THEN
    PERFORM public.sb_fail('This payment method is currently unavailable');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN PERFORM public.sb_fail('Your basket is invalid'); END IF;
    IF coalesce(v_item ->> 'quantity', '') !~ '^[0-9]{1,2}$' THEN PERFORM public.sb_fail('Invalid item quantity'); END IF;
    v_qty := (v_item ->> 'quantity')::integer;
    IF v_qty < 1 OR v_qty > 50 THEN PERFORM public.sb_fail('Quantity must be between 1 and 50'); END IF;

    SELECT pv.id AS variant_id, pv.product_id, pv.label, pv.price, pv.stock_qty,
           p.title, p.title_bn, p.primary_image, p.is_preorder, p.cutting_options,
           p.is_active AS prod_active, pv.id IS NOT NULL AS var_found
      INTO v_row
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
     WHERE pv.id = (v_item ->> 'variantId')
       AND p.id  = (v_item ->> 'productId');

    IF NOT FOUND OR NOT v_row.prod_active THEN
      PERFORM public.sb_fail(format('Product %s is unavailable', coalesce(v_item ->> 'productId', 'item')));
    END IF;

    v_cut := nullif(btrim(coalesce(v_item ->> 'cuttingPreference', '')), '');
    IF v_cut IS NOT NULL AND jsonb_array_length(coalesce(v_row.cutting_options, '[]'::jsonb)) > 0 THEN
      IF NOT (v_row.cutting_options ? v_cut) THEN
        PERFORM public.sb_fail(format('Invalid preparation option for %s', v_row.title));
      END IF;
    ELSE
      v_cut := NULL;
    END IF;

    v_line := v_row.price * v_qty;
    v_subtotal := v_subtotal + v_line;
    IF v_row.is_preorder THEN v_has_preorder := true; END IF;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId',         v_row.product_id,
      'variantId',         v_row.variant_id,
      'productTitle',      v_row.title,
      'productTitleBn',    v_row.title_bn,
      'productImage',      v_row.primary_image,
      'variantLabel',      v_row.label,
      'cuttingPreference', coalesce(v_cut, ''),
      'isPreorder',        v_row.is_preorder,
      'quantity',          v_qty,
      'unitPrice',         v_row.price,
      'lineTotal',         v_line
    ));
  END LOOP;

  IF coalesce(v_settings.enable_free_delivery, false) AND v_subtotal >= coalesce(v_settings.free_delivery_threshold, 3000) THEN
    v_fee := 0;
  ELSIF p_zone = 'inside_dhaka' THEN
    v_fee := coalesce(v_settings.inside_dhaka_fee, 70);
  ELSE
    v_fee := coalesce(v_settings.outside_dhaka_fee, 130);
  END IF;

  IF v_coupon_code IS NOT NULL THEN
    SELECT * INTO v_coupon FROM public.coupons
     WHERE upper(code) = upper(v_coupon_code) AND is_active = true;
    IF NOT FOUND THEN PERFORM public.sb_fail('This coupon code is invalid or has expired'); END IF;
    IF v_coupon.max_uses IS NOT NULL AND v_coupon.usage_count >= v_coupon.max_uses THEN
      PERFORM public.sb_fail('This coupon code is invalid or has expired');
    END IF;
    IF v_subtotal < v_coupon.min_order_amount THEN
      PERFORM public.sb_fail(format('Minimum order of BDT %s required for this coupon', v_coupon.min_order_amount));
    END IF;

    IF v_coupon.discount_type = 'flat' THEN
      v_discount := v_coupon.discount_value;
    ELSIF v_coupon.discount_type = 'percentage' THEN
      v_discount := round((v_subtotal * v_coupon.discount_value) / 100.0, 0);
      IF v_coupon.max_discount_amount IS NOT NULL AND v_discount > v_coupon.max_discount_amount THEN
        v_discount := v_coupon.max_discount_amount;
      END IF;
    ELSE
      PERFORM public.sb_fail('Unknown coupon discount type');
    END IF;
    v_discount := least(v_subtotal, greatest(0, v_discount));
  END IF;

  v_total := greatest(0, v_subtotal - v_discount + v_fee);
  IF v_total <= 0 THEN PERFORM public.sb_fail('Order total must be greater than zero'); END IF;

  IF p_plan = 'cod' THEN
    v_payable := 0;
  ELSIF p_plan = 'full' THEN
    v_payable := v_total;
  ELSE
    v_payable := least(v_total, greatest(v_fee, round(greatest(0, v_subtotal - v_discount) * coalesce(v_settings.preorder_advance_percent, 25) / 100.0, 0)));
  END IF;

  RETURN jsonb_build_object(
    'items',           v_items,
    'subtotal',        v_subtotal,
    'deliveryCharge',  v_fee,
    'discountAmount',  v_discount,
    'couponId',        v_coupon.id,
    'couponCode',      v_coupon.code,
    'totalAmount',     v_total,
    'payableNow',      v_payable,
    'dueAfterPayable', v_total - v_payable,
    'hasPreorder',     v_has_preorder
  );
END;
$$;

-- 2. Update _sb_order_summary to return QR payment details
CREATE OR REPLACE FUNCTION public._sb_order_summary(p_order public.orders)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'orderId',               p_order.id,
    'orderCode',             p_order.order_code,
    'subtotal',              p_order.subtotal,
    'deliveryCharge',        p_order.delivery_charge,
    'discountAmount',        p_order.discount_amount,
    'totalAmount',           p_order.total_amount,
    'payableNow',            p_order.payable_now,
    'advancePaid',           p_order.advance_paid,
    'dueAmount',             p_order.due_amount,
    'paymentMethod',         p_order.payment_method,
    'paymentPlan',           p_order.payment_plan,
    'paymentStatus',         p_order.payment_status,
    'orderStatus',           p_order.order_status,
    'hasPreorderItems',      p_order.has_preorder_items,
    'isSuspicious',          p_order.is_suspicious,
    'manualPayChannel',      p_order.manual_pay_channel,
    'manualPaySender',       p_order.manual_pay_sender,
    'manualPayTrxId',        p_order.manual_pay_trx_id,
    'manualPayProofUrl',     p_order.manual_pay_proof_url,
    'manualPayVerifiedAt',   p_order.manual_pay_verified_at,
    'manualPayRejectReason', p_order.manual_pay_reject_reason,
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

-- 3. Update track_order_server to return QR payment status to customers
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
    'orderCode',             v_order.order_code,
    'createdAt',             v_order.created_at,
    'updatedAt',             v_order.updated_at,
    'orderStatus',           v_order.order_status,
    'paymentStatus',         v_order.payment_status,
    'paymentMethod',         v_order.payment_method,
    'paymentPlan',           v_order.payment_plan,
    'latestPaymentAttempt',  v_attempt,
    'deliveryZone',          v_order.delivery_zone,
    'customerDistrict',      v_order.customer_district,
    'customerName',          split_part(v_order.customer_name, ' ', 1),
    'maskedPhone',           left(v_order.customer_phone, 5) || '-****' || right(v_order.customer_phone, 2),
    'maskedAddress',         split_part(v_order.customer_address, ' ', 1) || ' ***, ' || v_order.customer_district,
    'subtotal',              v_order.subtotal,
    'deliveryCharge',        v_order.delivery_charge,
    'discountAmount',        v_order.discount_amount,
    'weightAdjustmentAmount', v_order.weight_adjustment_amount,
    'weightAdjustmentNote',  v_order.weight_adjustment_note,
    'totalAmount',           v_order.total_amount,
    'advancePaid',           v_order.advance_paid,
    'dueAmount',             v_order.due_amount,
    'hasPreorderItems',      v_order.has_preorder_items,
    'courierName',           v_order.courier_name,
    'trackingReference',     v_order.tracking_reference,
    'riderName',             v_order.rider_name,
    'riderPhone',            v_order.rider_phone,
    'manualPayChannel',      v_order.manual_pay_channel,
    'manualPayTrxId',        v_order.manual_pay_trx_id,
    'manualPayVerifiedAt',   v_order.manual_pay_verified_at,
    'manualPayRejectReason', v_order.manual_pay_reject_reason,
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

-- 4. Restore self-contained sb_hero_valid_link so hero_slides check constraint does not depend on sb_section_valid_link
CREATE OR REPLACE FUNCTION public.sb_hero_valid_link(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT p IS NOT NULL
     AND length(p) <= 300
     AND (
          p = ''
       OR (p ~ '^/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*$' AND p !~ '^//')
       OR (p ~ '^#[A-Za-z0-9_-]+$')
       OR p ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*)?$'
     );
$$;

-- 5. Lockdown RPC grants: Revoke exposed functions from anon & authenticated to maintain zero-client-trust invariant
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND (
        p.proname LIKE 'admin\_section\_%'
        OR p.proname IN ('admin_verify_manual_qr_payment', 'submit_manual_qr_payment_proof', 'sb_section_valid_link')
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
  EXECUTE 'REVOKE ALL ON FUNCTION public.sb_hero_valid_link(text) FROM PUBLIC, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.sb_hero_valid_link(text) TO authenticated, service_role';
END $$;

COMMIT;

-- =============================================================================
-- FILE: migrations/20261104120014_14_qr_review_pending_and_section_cms_fix.sql
-- =============================================================================

-- =============================================================================
-- MIGRATION 14/14 -- QR REVIEW_PENDING CONSTRAINT & SECTION CMS ZERO-TRUST FIX
--
-- What this fixes:
--   1. orders_payment_status_check: Adds 'review_pending' to allowed payment statuses
--      so customer proof submissions via submit_manual_qr_payment_proof succeed.
--   2. admin_verify_manual_qr_payment: Replaces auth.uid() is_admin check with
--      EXISTS(SELECT 1 FROM public.admins WHERE user_id = p_actor) so Edge API
--      actions (called via service_role) authenticate correctly.
--   3. admin_section_* (all 6 functions): Replaces auth.uid() is_admin check with
--      EXISTS(SELECT 1 FROM public.admins WHERE user_id = p_actor) so Edge API
--      actions authenticate correctly.
--   4. RLS SELECT policies for section_slides & section_slider_settings:
--      Allows public (anon) to read active/scheduled slides and settings,
--      and admins (authenticated) to read all slides.
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Update orders_payment_status_check constraint to include 'review_pending'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending', 'review_pending', 'advance_paid', 'paid', 'failed', 'refunded'));

-- Customer manual QR payment proof submission (returns both status and paymentStatus)
CREATE OR REPLACE FUNCTION public.submit_manual_qr_payment_proof(
  p_order_id          text,
  p_order_code        text,
  p_channel           text,
  p_sender            text,
  p_trx_id            text,
  p_proof_url         text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_clean_trx text;
BEGIN
  v_clean_trx := upper(trim(coalesce(p_trx_id, '')));
  IF v_clean_trx = '' THEN
    PERFORM public.sb_fail('Transaction ID (TrxID) is required');
  END IF;

  -- Replay guard: Check if TrxID was already validated or submitted on an existing order
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE upper(trim(manual_pay_trx_id)) = v_clean_trx
      AND id <> p_order_id
  ) OR EXISTS (
    SELECT 1 FROM public.processed_webhook_events
    WHERE transaction_id = v_clean_trx
  ) THEN
    PERFORM public.sb_fail('This Transaction ID has already been submitted for another order');
  END IF;

  UPDATE public.orders
  SET
    manual_pay_channel = p_channel,
    manual_pay_sender = left(trim(coalesce(p_sender, '')), 50),
    manual_pay_trx_id = v_clean_trx,
    manual_pay_proof_url = p_proof_url,
    payment_status = 'review_pending',
    updated_at = now()
  WHERE id = p_order_id AND order_code = p_order_code
  RETURNING * INTO v_order;

  IF NOT FOUND THEN
    PERFORM public.sb_fail('Order not found or invalid credentials');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'orderCode', v_order.order_code,
    'status', 'review_pending',
    'paymentStatus', 'review_pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_manual_qr_payment_proof TO service_role;
REVOKE ALL ON FUNCTION public.submit_manual_qr_payment_proof FROM PUBLIC, anon, authenticated;

-- 2. Update admin_verify_manual_qr_payment to support Edge API service_role execution
CREATE OR REPLACE FUNCTION public.admin_verify_manual_qr_payment(
  p_order_id text,
  p_action   text,      -- 'verify_confirm' OR 'reject_mismatch'
  p_actor    uuid,
  p_note     text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_ref   text;
BEGIN
  -- Strict Admin Authentication (supports service_role calls with p_actor from Edge API)
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.sb_fail('Order not found');
  END IF;

  IF v_order.order_status = 'cancelled' THEN
    PERFORM public.sb_fail('Cancelled orders cannot be verified or reopened');
  END IF;

  IF p_action = 'verify_confirm' THEN
    IF v_order.payment_status = 'paid' THEN
      PERFORM public.sb_fail('Order is already marked as paid');
    END IF;

    v_ref := upper(trim(coalesce(v_order.manual_pay_trx_id, '')));
    IF v_ref = '' THEN
      PERFORM public.sb_fail('Order has no customer TrxID to verify');
    END IF;

    -- Anti-replay: Ensure this transaction ID has not already been credited to another order
    IF EXISTS (
      SELECT 1 FROM public.payment_transactions
      WHERE gateway = 'manual_verify' AND transaction_id = v_ref AND order_id <> p_order_id
    ) THEN
      PERFORM public.sb_fail('This transaction ID has already been credited to another order');
    END IF;

    -- Register in processed_webhook_events to guarantee global replay resistance
    INSERT INTO public.processed_webhook_events (gateway, transaction_id, order_code, amount, currency, payload)
    VALUES ('manual_verify', v_ref, v_order.order_code, v_order.total_amount, 'BDT',
            jsonb_build_object('actor', p_actor, 'channel', v_order.manual_pay_channel, 'note', left(coalesce(p_note, ''), 300)))
    ON CONFLICT (gateway, transaction_id) DO NOTHING;

    -- Update order to confirmed and fully paid
    UPDATE public.orders
    SET
      payment_status = 'paid',
      order_status = CASE WHEN order_status = 'pending' THEN 'confirmed' ELSE order_status END,
      advance_paid = total_amount,
      due_amount = 0,
      paid_at = now(),
      manual_pay_verified_at = now(),
      manual_pay_verified_by = p_actor,
      manual_pay_reject_reason = NULL,
      updated_at = now()
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    -- Record transaction in payment_transactions
    INSERT INTO public.payment_transactions (id, order_id, order_code, gateway, transaction_id, validation_id, amount, currency, status, verified_at, created_at)
    VALUES ('tx-' || replace(gen_random_uuid()::text, '-', ''), v_order.id, v_order.order_code, 'manual_verify', v_ref,
            'ADMIN:' || p_actor::text, v_order.total_amount, 'BDT', 'validated', now(), now())
    ON CONFLICT DO NOTHING;

    -- Audit log
    PERFORM public._sb_audit(p_actor, 'order.qr_verify_paid', p_order_id, jsonb_build_object(
      'trxId', v_ref,
      'channel', v_order.manual_pay_channel,
      'amount', v_order.total_amount,
      'note', p_note
    ));

    RETURN jsonb_build_object('success', true, 'status', v_order.order_status, 'paymentStatus', 'paid', 'orderCode', v_order.order_code);

  ELSIF p_action = 'reject_mismatch' THEN
    UPDATE public.orders
    SET
      payment_status = 'failed',
      manual_pay_reject_reason = coalesce(p_note, 'Payment verification failed: TrxID mismatch or payment not found in statement'),
      updated_at = now()
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    PERFORM public._sb_audit(p_actor, 'order.qr_reject_mismatch', p_order_id, jsonb_build_object(
      'trxId', v_order.manual_pay_trx_id,
      'reason', p_note
    ));

    RETURN jsonb_build_object('success', true, 'status', v_order.order_status, 'paymentStatus', 'failed', 'orderCode', v_order.order_code);
  ELSE
    PERFORM public.sb_fail('Invalid action specified');
  END IF;
END;
$$;

-- Clean up any obsolete helper
DROP FUNCTION IF EXISTS public.sb_section_valid_image(text);

-- 3. Update all 6 admin_section_* functions to support Edge API service_role execution
CREATE OR REPLACE FUNCTION public.admin_section_save_slide(
  p_actor uuid,
  p_slide jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id         uuid;
  v_section    text;
  v_image      text;
  v_alt        text;
  v_badge_en   text;
  v_badge_bn   text;
  v_badge_icon text;
  v_title_en   text;
  v_headline   text;
  v_subtext    text;
  v_desc_en    text;
  v_origin     text;
  v_highlights jsonb;
  v_tip_text   text;
  v_tip_href   text;
  v_tip_label  text;
  v_cta_text   text;
  v_cta_link   text;
  v_layout     text;
  v_active     boolean;
  v_starts     timestamptz;
  v_ends       timestamptz;
  v_sort       integer;
  v_total      integer;
  v_row        public.section_slides;
  v_old        public.section_slides;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;
  IF p_slide IS NULL OR jsonb_typeof(p_slide) <> 'object' THEN
    PERFORM public.sb_fail('Slide payload required');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('section_slides'));

  BEGIN
    v_id     := nullif(p_slide ->> 'id', '')::uuid;
    v_starts := nullif(p_slide ->> 'startsAt', '')::timestamptz;
    v_ends   := nullif(p_slide ->> 'endsAt', '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sb_fail('Invalid slide ID or schedule timestamp format');
  END;

  v_section    := btrim(coalesce(p_slide ->> 'sectionId', ''));
  v_image      := btrim(coalesce(p_slide ->> 'imageUrl', ''));
  v_alt        := public.sb_clean_text(p_slide ->> 'imageAlt');
  v_badge_en   := public.sb_clean_text(p_slide ->> 'badgeTextEn');
  v_badge_bn   := public.sb_clean_text(p_slide ->> 'badgeTextBn');
  v_badge_icon := coalesce(nullif(btrim(p_slide ->> 'badgeIcon'), ''), 'sparkles');
  v_title_en   := public.sb_clean_text(p_slide ->> 'titleEn');
  v_headline   := public.sb_clean_text(p_slide ->> 'headlineBn');
  v_subtext    := public.sb_clean_text(p_slide ->> 'convincingSubtextBn');
  v_desc_en    := public.sb_clean_text(p_slide ->> 'descriptionEn');
  v_origin     := public.sb_clean_text(p_slide ->> 'originLocation');
  v_tip_text   := public.sb_clean_text(p_slide ->> 'pairingTipText');
  v_tip_href   := coalesce(p_slide ->> 'pairingTargetHref', '');
  v_tip_label  := public.sb_clean_text(p_slide ->> 'pairingTargetLabel');
  v_cta_text   := public.sb_clean_text(p_slide ->> 'ctaText');
  v_cta_link   := coalesce(p_slide ->> 'ctaLink', '');
  v_layout     := coalesce(nullif(btrim(p_slide ->> 'bannerLayout'), ''), 'default');
  v_active     := coalesce((p_slide ->> 'isActive')::boolean, true);
  v_highlights := coalesce(p_slide -> 'highlights', '[]'::jsonb);

  IF v_section NOT IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi') THEN
    PERFORM public.sb_fail('Invalid department section identifier');
  END IF;
  IF v_headline = '' AND v_title_en = '' THEN
    PERFORM public.sb_fail('A headline or title is required');
  END IF;
  IF v_image = '' THEN
    PERFORM public.sb_fail('An image URL is required');
  END IF;
  IF NOT public.sb_hero_valid_image(v_image) THEN
    PERFORM public.sb_fail('Image must be from /images/ or https://uqyjtlndgnvfqjcdwbop.supabase.co/storage/v1/object/public/site-media/');
  END IF;
  IF NOT public.sb_section_valid_link(v_cta_link) THEN
    PERFORM public.sb_fail('Invalid CTA link format');
  END IF;
  IF NOT public.sb_section_valid_link(v_tip_href) THEN
    PERFORM public.sb_fail('Invalid pairing target link format');
  END IF;
  IF v_starts IS NOT NULL AND v_ends IS NOT NULL AND v_starts >= v_ends THEN
    PERFORM public.sb_fail('End schedule must be strictly after start schedule');
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.section_slides WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.sb_fail('Slide not found. It may have already been removed.');
    END IF;

    UPDATE public.section_slides
    SET
      section_id            = v_section,
      is_active             = v_active,
      image_url             = v_image,
      image_alt             = v_alt,
      badge_text_en         = v_badge_en,
      badge_text_bn         = v_badge_bn,
      badge_icon            = v_badge_icon,
      title_en              = v_title_en,
      headline_bn           = v_headline,
      convincing_subtext_bn = v_subtext,
      description_en        = v_desc_en,
      origin_location       = v_origin,
      highlights            = v_highlights,
      pairing_tip_text      = v_tip_text,
      pairing_target_href   = v_tip_href,
      pairing_target_label  = v_tip_label,
      cta_text              = v_cta_text,
      cta_link              = v_cta_link,
      banner_layout         = v_layout,
      starts_at             = v_starts,
      ends_at               = v_ends,
      updated_at            = now()
    WHERE id = v_id
    RETURNING * INTO v_row;

    PERFORM public._sb_audit(p_actor, 'section_cms.update_slide', v_id::text, jsonb_build_object(
      'sectionId', v_section,
      'headline', v_headline
    ));
  ELSE
    SELECT count(*) INTO v_total FROM public.section_slides WHERE section_id = v_section;
    IF v_total >= 12 THEN
      PERFORM public.sb_fail('You can have at most 12 slides per section. Delete an unused one first.');
    END IF;

    SELECT coalesce(max(sort_order), 0) + 1 INTO v_sort
    FROM public.section_slides
    WHERE section_id = v_section;

    INSERT INTO public.section_slides (
      section_id, sort_order, is_active,
      image_url, image_alt,
      badge_text_en, badge_text_bn, badge_icon,
      title_en, headline_bn, convincing_subtext_bn, description_en,
      origin_location, highlights,
      pairing_tip_text, pairing_target_href, pairing_target_label,
      cta_text, cta_link, banner_layout,
      starts_at, ends_at
    ) VALUES (
      v_section, v_sort, v_active,
      v_image, v_alt,
      v_badge_en, v_badge_bn, v_badge_icon,
      v_title_en, v_headline, v_subtext, v_desc_en,
      v_origin, v_highlights,
      v_tip_text, v_tip_href, v_tip_label,
      v_cta_text, v_cta_link, v_layout,
      v_starts, v_ends
    )
    RETURNING * INTO v_row;

    PERFORM public._sb_audit(p_actor, 'section_cms.create_slide', v_row.id::text, jsonb_build_object(
      'sectionId', v_section,
      'headline', v_headline
    ));
  END IF;

  RETURN jsonb_build_object(
    'slide', public._sb_section_slide_json(v_row),
    'orphanedImageUrl', CASE WHEN v_old.image_url IS NOT NULL AND v_old.image_url <> v_row.image_url THEN v_old.image_url ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_section_delete_slide(
  p_actor uuid,
  p_id    uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.section_slides;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;
  IF p_id IS NULL THEN PERFORM public.sb_fail('Slide ID required'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('section_slides'));

  DELETE FROM public.section_slides WHERE id = p_id RETURNING * INTO v_row;
  IF NOT FOUND THEN
    PERFORM public.sb_fail('Slide not found. It may have already been deleted.');
  END IF;

  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY sort_order, created_at) AS rn
    FROM public.section_slides
    WHERE section_id = v_row.section_id
  )
  UPDATE public.section_slides s
  SET sort_order = ranked.rn
  FROM ranked
  WHERE s.id = ranked.id AND s.sort_order <> ranked.rn;

  PERFORM public._sb_audit(p_actor, 'section_cms.delete_slide', p_id::text, jsonb_build_object(
    'sectionId', v_row.section_id,
    'imageUrl', v_row.image_url
  ));

  RETURN jsonb_build_object(
    'deleted', true,
    'id', p_id,
    'orphanedImageUrl', v_row.image_url
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_section_reorder(
  p_actor      uuid,
  p_section_id text,
  p_ids        uuid[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total integer;
  i       integer;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;
  IF p_ids IS NULL OR cardinality(p_ids) < 1 THEN
    PERFORM public.sb_fail('At least one slide ID must be provided to reorder');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('section_slides'));

  SELECT count(*) INTO v_total FROM public.section_slides WHERE section_id = p_section_id;
  IF cardinality(p_ids) <> v_total THEN
    PERFORM public.sb_fail('The slide list has changed in the meantime. Please reload and try again.');
  END IF;

  FOR i IN 1 .. cardinality(p_ids) LOOP
    UPDATE public.section_slides
    SET sort_order = i, updated_at = now()
    WHERE id = p_ids[i] AND section_id = p_section_id;
    IF NOT FOUND THEN
      PERFORM public.sb_fail('Slide ID mismatch during reordering. Refresh and try again.');
    END IF;
  END LOOP;

  PERFORM public._sb_audit(p_actor, 'section_cms.reorder', p_section_id, jsonb_build_object('count', cardinality(p_ids)));
  RETURN jsonb_build_object('reordered', true, 'count', cardinality(p_ids));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_section_set_active(
  p_actor  uuid,
  p_id     uuid,
  p_active boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.section_slides;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;
  IF p_id IS NULL OR p_active IS NULL THEN
    PERFORM public.sb_fail('Slide ID and active status are required');
  END IF;

  UPDATE public.section_slides
  SET is_active = p_active, updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    PERFORM public.sb_fail('Slide not found or already deleted');
  END IF;

  PERFORM public._sb_audit(p_actor, 'section_cms.set_active', p_id::text, jsonb_build_object('isActive', p_active));
  RETURN jsonb_build_object('id', p_id, 'isActive', p_active);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_section_save_settings(
  p_actor    uuid,
  p_settings jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_section    text;
  v_autoplay   boolean;
  v_seconds    integer;
  v_counter    boolean;
  v_navigation boolean;
  v_dots       boolean;
  v_row        public.section_slider_settings;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    PERFORM public.sb_fail('Settings object required');
  END IF;

  v_section    := btrim(coalesce(p_settings ->> 'sectionId', ''));
  v_autoplay   := coalesce((p_settings ->> 'autoplay')::boolean, true);
  v_seconds    := coalesce((p_settings ->> 'autoplaySeconds')::integer, 5);
  v_counter    := coalesce((p_settings ->> 'showCounter')::boolean, true);
  v_navigation := coalesce((p_settings ->> 'showNavigation')::boolean, true);
  v_dots       := coalesce((p_settings ->> 'showDots')::boolean, true);

  IF v_section NOT IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi') THEN
    PERFORM public.sb_fail('Invalid department section identifier');
  END IF;
  IF v_seconds < 2 OR v_seconds > 20 THEN
    PERFORM public.sb_fail('Autoplay seconds must be between 2 and 20');
  END IF;

  INSERT INTO public.section_slider_settings (
    section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at
  ) VALUES (
    v_section, v_autoplay, v_seconds, v_counter, v_navigation, v_dots, now()
  )
  ON CONFLICT (section_id) DO UPDATE
  SET
    autoplay         = EXCLUDED.autoplay,
    autoplay_seconds = EXCLUDED.autoplay_seconds,
    show_counter     = EXCLUDED.show_counter,
    show_navigation  = EXCLUDED.show_navigation,
    show_dots        = EXCLUDED.show_dots,
    updated_at       = now()
  RETURNING * INTO v_row;

  PERFORM public._sb_audit(p_actor, 'section_cms.save_settings', v_section, p_settings);
  RETURN jsonb_build_object('success', true, 'sectionId', v_section);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_section_reset_defaults(
  p_actor      uuid,
  p_section_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('section_slides'));

  IF p_section_id IS NOT NULL AND btrim(p_section_id) <> '' THEN
    DELETE FROM public.section_slides WHERE section_id = p_section_id;
    DELETE FROM public.section_slider_settings WHERE section_id = p_section_id;
  ELSE
    DELETE FROM public.section_slides;
    DELETE FROM public.section_slider_settings;
  END IF;

  PERFORM public._sb_section_seed_defaults(p_section_id);
  PERFORM public._sb_audit(p_actor, 'section_cms.reset_defaults', coalesce(p_section_id, 'all'), '{}'::jsonb);

  RETURN jsonb_build_object('success', true, 'sectionId', coalesce(p_section_id, 'all_sections'));
END;
$$;

-- 4. RLS SELECT policies for section_slides & section_slider_settings
DROP POLICY IF EXISTS section_slides_public_read ON public.section_slides;
CREATE POLICY section_slides_public_read ON public.section_slides
  FOR SELECT TO anon
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >= now())
  );

DROP POLICY IF EXISTS section_slider_settings_public_read ON public.section_slider_settings;
CREATE POLICY section_slider_settings_public_read ON public.section_slider_settings
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS section_slides_admin_read ON public.section_slides;
CREATE POLICY section_slides_admin_read ON public.section_slides
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS section_slider_settings_admin_read ON public.section_slider_settings;
CREATE POLICY section_slider_settings_admin_read ON public.section_slider_settings
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Ensure explicit permissions
GRANT SELECT ON public.section_slides TO anon, authenticated;
GRANT SELECT ON public.section_slider_settings TO anon, authenticated;

-- Ensure service_role execution on the admin functions
GRANT EXECUTE ON FUNCTION public.admin_verify_manual_qr_payment TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_section_save_slide TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_section_delete_slide TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_section_reorder TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_section_set_active TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_section_save_settings TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_section_reset_defaults TO service_role;

-- Ensure default department slides are seeded if empty
DO $$
BEGIN
  IF (SELECT count(*) FROM public.section_slides) = 0 THEN
    PERFORM public._sb_section_seed_defaults();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

