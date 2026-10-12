-- ============================================================================
-- SADYER BAZAR (সাধ্যের বাজার) — SUPABASE POSTGRESQL SCHEMA & RLS SECURITY (v2.0)
-- Run this script in your Supabase SQL Editor to initialize the database.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    announcement_en TEXT NOT NULL DEFAULT '🔥 Pre-Order Open: Fresh Jamuna River Catch & Authentic Bogura Shahi Doi — Nationwide Home Delivery!',
    announcement_bn TEXT NOT NULL DEFAULT 'যমুনা নদীর তাজা মাছ ও বগুড়ার শাহী দইয়ের প্রি-অর্ডার চলছে!',
    sslcommerz_enabled BOOLEAN NOT NULL DEFAULT true,
    bkash_enabled BOOLEAN NOT NULL DEFAULT true,
    cod_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
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
    rating NUMERIC(3, 2) NOT NULL DEFAULT 4.90,
    review_count INT NOT NULL DEFAULT 28,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PRODUCT VARIANTS TABLE (e.g. 500g Jar, 1kg Jar, 12 Pcs)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    weight_grams INT NOT NULL DEFAULT 1000,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(10, 2),
    stock_qty INT NOT NULL DEFAULT 100,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. COUPONS / PROMO CODES TABLE (v2.0 Server-Validated Promo Engine)
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('flat', 'percentage')),
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
    min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_discount_amount NUMERIC(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ORDERS TABLE (v2.0 with Scale Weight Adjustment & Cold-Chain Courier Tracking)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code TEXT NOT NULL UNIQUE, -- Format: SB-YYMM-XXXXX (Cryptographic Random)
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
    weight_adjustment_amount NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Can be + or - based on actual fish/meat scale weight
    weight_adjustment_note TEXT,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    advance_paid NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (advance_paid >= 0),
    due_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (due_amount >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('bkash', 'sslcommerz', 'cod')),
    payment_plan TEXT NOT NULL CHECK (payment_plan IN ('full', 'advance', 'cod')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'advance_paid', 'paid', 'failed', 'refunded')),
    order_status TEXT NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    has_preorder_items BOOLEAN NOT NULL DEFAULT false,
    transaction_id TEXT,
    courier_name TEXT,
    tracking_reference TEXT,
    rider_name TEXT,
    rider_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
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

-- 8. PAYMENT TRANSACTIONS TABLE (Audit Trail for bKash & SSLCommerz)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_code TEXT NOT NULL,
    gateway TEXT NOT NULL CHECK (gateway IN ('bkash', 'sslcommerz', 'manual_verify')),
    transaction_id TEXT NOT NULL UNIQUE,
    validation_id TEXT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'BDT',
    status TEXT NOT NULL CHECK (status IN ('initiated', 'validated', 'failed')),
    sender_phone TEXT,
    raw_response JSONB,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. VERIFIED PRODUCT REVIEWS TABLE (Order-ID Verified Reviews)
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    order_code TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_district TEXT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — ENTERPRISE PROTECTION
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

-- Public Read Policies
CREATE POLICY "Public can read site settings" ON public.site_settings
    FOR SELECT USING (true);

CREATE POLICY "Public can read active categories" ON public.categories
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read active products" ON public.products
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read product variants" ON public.product_variants
    FOR SELECT USING (true);

CREATE POLICY "Public can read active coupons" ON public.coupons
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read verified reviews" ON public.product_reviews
    FOR SELECT USING (true);

-- Strict Lock on Orders & Payments (Only Server Service Role or Authenticated Admin can read/write)
CREATE POLICY "Admins have full access to orders" ON public.orders
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Admins have full access to order items" ON public.order_items
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Admins have full access to payments" ON public.payment_transactions
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Admins can manage products" ON public.products
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Admins can manage variants" ON public.product_variants
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Admins can manage coupons" ON public.coupons
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Admins can manage settings" ON public.site_settings
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Initialize Default Site Settings
INSERT INTO public.site_settings (id, inside_dhaka_fee, outside_dhaka_fee, free_delivery_threshold, preorder_advance_percent)
VALUES (1, 70.00, 130.00, 3000.00, 25)
ON CONFLICT (id) DO NOTHING;
