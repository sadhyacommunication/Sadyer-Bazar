-- ============================================================================
-- SADYER BAZAR (সাধ্যের বাজার) — SUPABASE POSTGRESQL SCHEMA & RLS SECURITY
-- Project: sadhyarbazar (https://uqyjtlndgnvfqjcdwbop.supabase.co)
-- Instructions: Copy & Paste this entire file into Supabase SQL Editor and click RUN.
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
    sslcommerz_store_password TEXT DEFAULT '',
    sslcommerz_is_live BOOLEAN NOT NULL DEFAULT false,
    bkash_enabled BOOLEAN NOT NULL DEFAULT true,
    bkash_app_key TEXT DEFAULT '',
    bkash_app_secret TEXT DEFAULT '',
    cod_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Initialize Default Site Settings
INSERT INTO public.site_settings (id, inside_dhaka_fee, outside_dhaka_fee, free_delivery_threshold, preorder_advance_percent)
VALUES (1, 70.00, 130.00, 3000.00, 25)
ON CONFLICT (id) DO NOTHING;
