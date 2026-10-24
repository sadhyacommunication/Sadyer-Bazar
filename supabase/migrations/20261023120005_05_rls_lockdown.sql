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
