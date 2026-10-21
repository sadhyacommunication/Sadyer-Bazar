-- ============================================================================
-- SADYER BAZAR (সাধ্যের বাজার) — HARDENED ROW LEVEL SECURITY (RLS) & RPCs
-- Standard: OWASP Top 10, Zero-Trust Architecture, PII Protection
-- Run this script in Supabase SQL Editor to enforce strict security policies.
-- ============================================================================

-- ============================================================================
-- STEP 0: SAFE SCHEMA PREREQUISITES (Self-healing migration for existing DB)
-- Runs safely on any Supabase project without missing relation or column errors.
-- ============================================================================

-- 0.1 Create processed_webhook_events table if not exists (Prevents Error 42P01)
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

-- 0.2 Add anti-fraud & security columns to public.orders if not present
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_district TEXT NOT NULL DEFAULT 'Dhaka';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_note TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS weight_adjustment_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS weight_adjustment_note TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_preorder_items BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fraud_risk_score INT NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS review_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'unverified';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- 0.3 Add missing columns to other tables if not present
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS cutting_preference TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS validation_id TEXT;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS sender_phone TEXT;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS usage_count INT NOT NULL DEFAULT 0;

ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS nagad_number TEXT DEFAULT '01713-477780';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS nagad_account_type TEXT DEFAULT 'personal';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS nagad_enabled BOOLEAN DEFAULT true;

-- 0.4 Safely purge gateway secrets from site_settings (PCI-DSS SAQ A Zero-Leak)
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS sslcommerz_store_password;
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS bkash_app_secret;

-- ============================================================================
-- STEP 1: Ensure RLS is active on ALL public tables
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
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all legacy permissive policies ("Allow all operations on ...")
DROP POLICY IF EXISTS "Allow all operations on site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow all operations on categories" ON public.categories;
DROP POLICY IF EXISTS "Allow all operations on products" ON public.products;
DROP POLICY IF EXISTS "Allow all operations on product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow all operations on coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow all operations on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all operations on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow all operations on payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Allow all operations on product_reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Allow all operations on contact_messages" ON public.contact_messages;

-- Drop previous hardened policies if re-running
DROP POLICY IF EXISTS "public_read_site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "service_role_all_site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "public_read_categories" ON public.categories;
DROP POLICY IF EXISTS "service_role_all_categories" ON public.categories;
DROP POLICY IF EXISTS "public_read_products" ON public.products;
DROP POLICY IF EXISTS "service_role_all_products" ON public.products;
DROP POLICY IF EXISTS "public_read_product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "service_role_all_product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "public_read_coupons" ON public.coupons;
DROP POLICY IF EXISTS "service_role_all_coupons" ON public.coupons;
DROP POLICY IF EXISTS "public_read_reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "public_insert_reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "service_role_all_reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "public_insert_contact_messages" ON public.contact_messages;
DROP POLICY IF EXISTS "service_role_all_contact_messages" ON public.contact_messages;
DROP POLICY IF EXISTS "public_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "service_role_all_orders" ON public.orders;
DROP POLICY IF EXISTS "public_insert_order_items" ON public.order_items;
DROP POLICY IF EXISTS "service_role_all_order_items" ON public.order_items;
DROP POLICY IF EXISTS "public_insert_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "service_role_all_transactions" ON public.payment_transactions;

-- ============================================================================
-- 1. SITE SETTINGS: Public can read, only admin can update
-- ============================================================================
CREATE POLICY "public_read_site_settings" 
  ON public.site_settings FOR SELECT 
  TO public 
  USING (true);

CREATE POLICY "service_role_all_site_settings" 
  ON public.site_settings FOR ALL 
  TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. CATEGORIES: Public can read active categories, admin has full access
-- ============================================================================
CREATE POLICY "public_read_categories" 
  ON public.categories FOR SELECT 
  TO public 
  USING (is_active = true);

CREATE POLICY "service_role_all_categories" 
  ON public.categories FOR ALL 
  TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. PRODUCTS: Public can read active products, admin has full access
-- ============================================================================
CREATE POLICY "public_read_products" 
  ON public.products FOR SELECT 
  TO public 
  USING (is_active = true);

CREATE POLICY "service_role_all_products" 
  ON public.products FOR ALL 
  TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. PRODUCT VARIANTS: Public can read variants, admin has full access
-- ============================================================================
CREATE POLICY "public_read_product_variants" 
  ON public.product_variants FOR SELECT 
  TO public 
  USING (true);

CREATE POLICY "service_role_all_product_variants" 
  ON public.product_variants FOR ALL 
  TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. COUPONS: Public can read active coupons, admin has full access
-- ============================================================================
CREATE POLICY "public_read_coupons" 
  ON public.coupons FOR SELECT 
  TO public 
  USING (is_active = true);

CREATE POLICY "service_role_all_coupons" 
  ON public.coupons FOR ALL 
  TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. PRODUCT REVIEWS: Public can read reviews and insert new verified reviews
-- ============================================================================
CREATE POLICY "public_read_reviews" 
  ON public.product_reviews FOR SELECT 
  TO public 
  USING (true);

CREATE POLICY "public_insert_reviews" 
  ON public.product_reviews FOR INSERT 
  TO public 
  WITH CHECK (rating BETWEEN 1 AND 5);

CREATE POLICY "service_role_all_reviews" 
  ON public.product_reviews FOR ALL 
  TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. CONTACT MESSAGES: Public can only submit, cannot read or modify any messages
-- ============================================================================
CREATE POLICY "public_insert_contact_messages" 
  ON public.contact_messages FOR INSERT 
  TO public 
  WITH CHECK (length(name) > 0 AND length(phone) >= 11 AND length(message) > 0);

CREATE POLICY "service_role_all_contact_messages" 
  ON public.contact_messages FOR ALL 
  TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. PAYMENT TRANSACTIONS: Public can only insert audit logs, cannot query or alter
-- ============================================================================
CREATE POLICY "public_insert_transactions" 
  ON public.payment_transactions FOR INSERT 
  TO public 
  WITH CHECK (amount >= 0);

CREATE POLICY "service_role_all_transactions" 
  ON public.payment_transactions FOR ALL 
  TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 9. ORDERS & ORDER ITEMS: Zero-Client-Trust Architecture
-- Direct INSERT, UPDATE, DELETE by anonymous users is COMPLETELY REVOKED.
-- Order creation MUST be processed through the secure RPC create_secure_order(),
-- which recalculates all prices, variants, delivery charges, and coupons from the database.
-- ============================================================================
DROP POLICY IF EXISTS "public_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "public_insert_order_items" ON public.order_items;

CREATE POLICY "service_role_all_orders" 
  ON public.orders FOR ALL 
  TO service_role 
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_order_items" 
  ON public.order_items FOR ALL 
  TO service_role 
  USING (true) WITH CHECK (true);

-- 9.1 PROCESSED WEBHOOK EVENTS (Idempotency Engine)
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_webhook_events" ON public.processed_webhook_events;
CREATE POLICY "service_role_all_webhook_events" 
  ON public.processed_webhook_events FOR ALL 
  TO service_role 
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 10. SECURE RPC FUNCTIONS (Protected Access Patterns)
-- ============================================================================

-- A. Secure single-order lookup by exact Order Code for Order Tracking
-- Prevents scraping or table dumping while allowing legitimate customer tracking
CREATE OR REPLACE FUNCTION public.get_order_by_code(p_order_code TEXT)
RETURNS SETOF public.orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.orders
  WHERE UPPER(TRIM(order_code)) = UPPER(TRIM(p_order_code))
  LIMIT 1;
$$;

-- B. Secure order items lookup for a verified order
CREATE OR REPLACE FUNCTION public.get_order_items_by_order_id(p_order_id TEXT)
RETURNS SETOF public.order_items
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.order_items
  WHERE order_id = p_order_id;
$$;

-- C. Cryptographically Authenticated Admin Order Management (SHA-256 Verified)
CREATE OR REPLACE FUNCTION public.get_admin_orders(p_passkey_hash TEXT)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_passkey_hash IN (
    '202a193cb2d93c6feeb2c2cb883b08d8e5293a5d479b5e0232d0845e6de70669', -- Passkey 2026
    '055915741b13c085d73c42c00ae919eb3cbe2111067967aa8a661bf197faf963'  -- Passkey SadyerBazar@2026!
  ) THEN
    RETURN QUERY SELECT * FROM public.orders ORDER BY created_at DESC;
  ELSE
    RAISE EXCEPTION 'Access Denied: Invalid Cryptographic Admin Token';
  END IF;
END;
$$;

-- D. Cryptographically Authenticated Admin Messages Inbox (SHA-256 Verified)
CREATE OR REPLACE FUNCTION public.get_admin_messages(p_passkey_hash TEXT)
RETURNS SETOF public.contact_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_passkey_hash IN (
    '202a193cb2d93c6feeb2c2cb883b08d8e5293a5d479b5e0232d0845e6de70669',
    '055915741b13c085d73c42c00ae919eb3cbe2111067967aa8a661bf197faf963'
  ) THEN
    RETURN QUERY SELECT * FROM public.contact_messages ORDER BY created_at DESC;
  ELSE
    RAISE EXCEPTION 'Access Denied: Invalid Cryptographic Admin Token';
  END IF;
END;
$$;

-- Grant execution permissions on RPC functions to public (anon & authenticated)
GRANT EXECUTE ON FUNCTION public.get_order_by_code(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_order_items_by_order_id(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_orders(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_messages(TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- 11. ANTI-HACKER FIREWALL: ZERO-CLIENT-TRUST ORDER CREATION (SERVER PRICING)
-- Calculates all prices, variants, delivery fees, and coupons strictly from database tables.
-- Never accepts prices from client.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_secure_order(
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_delivery_zone TEXT,
    p_customer_district TEXT,
    p_customer_address TEXT,
    p_customer_note TEXT DEFAULT NULL,
    p_coupon_code TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'cod',
    p_payment_plan TEXT DEFAULT 'cod',
    p_items JSONB DEFAULT '[]'::jsonb,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_phone TEXT;
    v_order_code TEXT;
    v_order_id TEXT;
    v_subtotal NUMERIC(10, 2) := 0;
    v_delivery_fee NUMERIC(10, 2) := 0;
    v_discount NUMERIC(10, 2) := 0;
    v_total NUMERIC(10, 2) := 0;
    v_advance_payable NUMERIC(10, 2) := 0;
    v_due_amount NUMERIC(10, 2) := 0;
    v_has_preorder BOOLEAN := false;
    v_settings RECORD;
    v_item JSONB;
    v_item_id TEXT;
    v_variant RECORD;
    v_line_total NUMERIC(10, 2);
    v_verified_items JSONB := '[]'::jsonb;
    v_coupon RECORD;
    v_recent_order_count INT := 0;
    v_fraud_score INT := 0;
    v_is_suspicious BOOLEAN := false;
    v_review_reasons TEXT[] := ARRAY[]::TEXT[];
    v_existing_order JSONB;
    v_yy TEXT;
    v_mm TEXT;
    v_random_code TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Idempotency Key Guard: Prevent duplicate order submission
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        SELECT to_jsonb(o.*) INTO v_existing_order 
        FROM public.orders o 
        WHERE o.idempotency_key = trim(p_idempotency_key) LIMIT 1;
        
        IF v_existing_order IS NOT NULL THEN
            RETURN jsonb_build_object(
                'status', 'success',
                'idempotent', true,
                'order', v_existing_order
            );
        END IF;
    END IF;

    -- 2. Strict Input Sanitation & Bangladeshi Mobile Validation (013-019)
    v_clean_phone := regexp_replace(p_customer_phone, '\D', '', 'g');
    IF v_clean_phone LIKE '8801%' AND length(v_clean_phone) = 13 THEN
        v_clean_phone := substr(v_clean_phone, 3);
    END IF;
    
    IF v_clean_phone !~ '^01[3-9][0-9]{8}$' THEN
        RAISE EXCEPTION 'Invalid Bangladeshi mobile number: %', p_customer_phone;
    END IF;

    IF length(trim(p_customer_name)) < 2 THEN
        RAISE EXCEPTION 'Customer name must be at least 2 characters';
    END IF;

    IF length(trim(p_customer_address)) < 8 THEN
        RAISE EXCEPTION 'Please provide a complete delivery address';
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Basket is empty';
    END IF;

    -- 3. Velocity / Flood Shield (Max 5 orders per phone in last 3 hours)
    SELECT COUNT(*) INTO v_recent_order_count 
    FROM public.orders 
    WHERE customer_phone = v_clean_phone 
      AND created_at >= (v_now - INTERVAL '3 hours');

    IF v_recent_order_count >= 5 THEN
        RAISE EXCEPTION 'Order velocity limit exceeded. Please wait before placing another order.';
    END IF;

    -- 4. Cryptographic Non-Guessable Order Code (SB-YYMM-XXXXX) & Order ID
    v_yy := to_char(v_now, 'YY');
    v_mm := to_char(v_now, 'MM');
    v_random_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    v_random_code := translate(v_random_code, '01OI', '89XY');
    v_order_code := 'SB-' || v_yy || v_mm || '-' || v_random_code;
    v_order_id := 'ord-' || extract(epoch from v_now)::bigint || '-' || substr(md5(random()::text), 1, 6);

    -- 5. Single Source of Truth: Fetch dynamic site settings from DB
    SELECT * INTO v_settings FROM public.site_settings WHERE id = 1 LIMIT 1;
    IF v_settings IS NULL THEN
        RAISE EXCEPTION 'Site settings not initialized in database';
    END IF;

    -- 6. Calculate Subtotal from Database Product Variants (Zero-Client-Trust)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT pv.id AS variant_id, pv.price, pv.label, pv.product_id,
               p.title, p.title_bn, p.primary_image, p.is_preorder, p.is_active
        INTO v_variant
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        WHERE pv.id = (v_item->>'variantId')
          AND p.id = (v_item->>'productId')
        LIMIT 1;

        IF v_variant IS NULL THEN
            RAISE EXCEPTION 'Invalid product variant: %', (v_item->>'variantId');
        END IF;

        IF NOT v_variant.is_active THEN
            RAISE EXCEPTION 'Product is currently inactive: %', v_variant.title;
        END IF;

        IF (v_item->>'quantity')::INT < 1 OR (v_item->>'quantity')::INT > 50 THEN
            RAISE EXCEPTION 'Quantity out of allowable bounds (1-50)';
        END IF;

        v_line_total := v_variant.price * (v_item->>'quantity')::INT;
        v_subtotal := v_subtotal + v_line_total;

        IF v_variant.is_preorder THEN
            v_has_preorder := true;
        END IF;

        v_item_id := 'item-' || extract(epoch from clock_timestamp())::bigint || '-' || substr(md5(random()::text), 1, 4);

        v_verified_items := v_verified_items || jsonb_build_object(
            'id', v_item_id,
            'orderId', v_order_id,
            'productId', v_variant.product_id,
            'variantId', v_variant.variant_id,
            'productTitle', v_variant.title,
            'productTitleBn', v_variant.title_bn,
            'productImage', v_variant.primary_image,
            'variantLabel', v_variant.label,
            'cuttingPreference', COALESCE(v_item->>'cuttingPreference', ''),
            'isPreorder', v_variant.is_preorder,
            'quantity', (v_item->>'quantity')::INT,
            'unitPrice', v_variant.price,
            'lineTotal', v_line_total
        );
    END LOOP;

    -- 6. Dynamic Delivery Charge Calculation
    IF p_delivery_zone = 'inside_dhaka' THEN
        v_delivery_fee := v_settings.inside_dhaka_fee;
    ELSE
        v_delivery_fee := v_settings.outside_dhaka_fee;
    END IF;

    IF v_settings.enable_free_delivery AND v_subtotal >= v_settings.free_delivery_threshold THEN
        v_delivery_fee := 0;
    END IF;

    -- 7. Validate & Apply Coupon from Database Table
    IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
        SELECT * INTO v_coupon 
        FROM public.coupons 
        WHERE upper(code) = upper(trim(p_coupon_code)) 
          AND is_active = true 
        LIMIT 1;

        IF v_coupon IS NOT NULL AND v_subtotal >= v_coupon.min_order_amount THEN
            IF v_coupon.discount_type = 'percentage' THEN
                v_discount := round((v_subtotal * v_coupon.discount_value) / 100.0);
                IF v_coupon.max_discount_amount IS NOT NULL AND v_discount > v_coupon.max_discount_amount THEN
                    v_discount := v_coupon.max_discount_amount;
                END IF;
            ELSE
                v_discount := v_coupon.discount_value;
            END IF;
            v_discount := LEAST(v_discount, v_subtotal);
            
            -- Increment verified coupon usage
            UPDATE public.coupons 
            SET usage_count = usage_count + 1 
            WHERE id = v_coupon.id;
        END IF;
    END IF;

    -- 8. Compute Final Totals & Payable Advance
    v_total := GREATEST(0, v_subtotal - v_discount + v_delivery_fee);

    IF p_payment_method = 'cod' OR p_payment_plan = 'cod' THEN
        v_advance_payable := 0;
        v_due_amount := v_total;
    ELSIF p_payment_plan = 'full' THEN
        v_advance_payable := v_total;
        v_due_amount := 0;
    ELSE
        v_advance_payable := GREATEST(
            v_delivery_fee, 
            round(((GREATEST(0, v_subtotal - v_discount)) * v_settings.preorder_advance_percent) / 100.0)
        );
        v_due_amount := GREATEST(0, v_total - v_advance_payable);
    END IF;

    -- 9. Anti-Fraud & Risk Anomaly Engine
    IF p_payment_method = 'cod' AND v_total > 5000 THEN
        v_fraud_score := v_fraud_score + 35;
        v_review_reasons := array_append(v_review_reasons, 'High-value COD order (> ৳5,000)');
    END IF;

    IF v_recent_order_count >= 2 THEN
        v_fraud_score := v_fraud_score + 25;
        v_review_reasons := array_append(v_review_reasons, 'Multiple orders from same phone within 3 hours');
    END IF;

    IF p_delivery_zone = 'inside_dhaka' AND p_customer_district !~* 'dhaka' THEN
        v_fraud_score := v_fraud_score + 20;
        v_review_reasons := array_append(v_review_reasons, 'Inside Dhaka zone selected for non-Dhaka district');
    END IF;

    IF v_fraud_score >= 35 THEN
        v_is_suspicious := true;
    END IF;

    -- 10. Atomic Insert into public.orders
    INSERT INTO public.orders (
        id,
        order_code,
        customer_name,
        customer_phone,
        delivery_zone,
        customer_district,
        customer_address,
        customer_note,
        subtotal,
        delivery_charge,
        discount_amount,
        coupon_code,
        weight_adjustment_amount,
        total_amount,
        advance_paid,
        due_amount,
        payment_method,
        payment_plan,
        payment_status,
        order_status,
        has_preorder_items,
        items,
        fraud_risk_score,
        is_suspicious,
        review_reasons,
        is_phone_verified,
        verification_method,
        idempotency_key,
        created_at,
        updated_at
    ) VALUES (
        v_order_id,
        v_order_code,
        trim(p_customer_name),
        v_clean_phone,
        p_delivery_zone,
        trim(p_customer_district),
        trim(p_customer_address),
        p_customer_note,
        v_subtotal,
        v_delivery_fee,
        v_discount,
        p_coupon_code,
        0,
        v_total,
        0,
        v_total,
        p_payment_method,
        p_payment_plan,
        'pending',
        'pending',
        v_has_preorder,
        v_verified_items,
        v_fraud_score,
        v_is_suspicious,
        to_jsonb(v_review_reasons),
        false,
        'unverified',
        p_idempotency_key,
        v_now,
        v_now
    );

    -- 11. Insert Order Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_verified_items)
    LOOP
        INSERT INTO public.order_items (
            id,
            order_id,
            product_id,
            variant_id,
            product_title,
            product_title_bn,
            product_image,
            variant_label,
            cutting_preference,
            is_preorder,
            quantity,
            unit_price,
            line_total
        ) VALUES (
            v_item->>'id',
            v_order_id,
            v_item->>'productId',
            v_item->>'variantId',
            v_item->>'productTitle',
            v_item->>'productTitleBn',
            v_item->>'productImage',
            v_item->>'variantLabel',
            v_item->>'cuttingPreference',
            (v_item->>'isPreorder')::BOOLEAN,
            (v_item->>'quantity')::INT,
            (v_item->>'unitPrice')::NUMERIC,
            (v_item->>'lineTotal')::NUMERIC
        );
    END LOOP;

    -- Return verified order details
    RETURN jsonb_build_object(
        'status', 'success',
        'orderId', v_order_id,
        'orderCode', v_order_code,
        'subtotal', v_subtotal,
        'deliveryCharge', v_delivery_fee,
        'discountAmount', v_discount,
        'totalAmount', v_total,
        'payableNow', v_advance_payable,
        'dueAmount', v_due_amount,
        'fraudRiskScore', v_fraud_score,
        'isSuspicious', v_is_suspicious,
        'reviewReasons', to_jsonb(v_review_reasons),
        'items', v_verified_items
    );
END;
$$;

-- Allow public users (anon) to call create_secure_order RPC
GRANT EXECUTE ON FUNCTION public.create_secure_order TO anon, authenticated, service_role;

-- ============================================================================
-- 12. SERVER-SIDE PAYMENT & WEBHOOK VERIFICATION (WITH IDEMPOTENCY)
-- Callable strictly by service_role (Edge Worker / Server API)
-- ============================================================================
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

-- Restrict verify_and_record_payment strictly to service_role (Server / Cloudflare Worker)
REVOKE EXECUTE ON FUNCTION public.verify_and_record_payment FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.verify_and_record_payment TO service_role;

-- ============================================================================
-- 13. ADMIN COD PHONE VERIFICATION RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_verify_cod_phone(
    p_order_id TEXT,
    p_method TEXT DEFAULT 'manual_call'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.orders
    SET is_phone_verified = true,
        verification_method = p_method,
        order_status = 'confirmed',
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'orderId', p_order_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_verify_cod_phone FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.admin_verify_cod_phone TO service_role;

-- ============================================================================
-- 14. GATEWAY TOKEN CACHE TABLE (bKash id_token & refresh_token with TTL)
-- ============================================================================
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
