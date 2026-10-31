-- =============================================================================
-- MIGRATION 08/08 -- ADMIN ORDERS & CONTACT MESSAGES RESILIENCE (run AFTER 07)
--
-- What this adds:
--   * Allow authenticated admins (public.is_admin() = true) to INSERT and UPDATE
--     public.orders and public.order_items directly via Supabase Auth session.
--     This allows zero-downtime offline order synchronization from the Admin Panel
--     even if the edge API/Cloudflare worker is restarting or updating secrets.
--   * Ensures public.contact_messages.id has a safe DEFAULT UUID expression so that
--     any client insertion without an explicit id never violates not-null.
--
-- Security model:
--   * anon / public: STRICT ZERO-CLIENT-TRUST maintained.
--     - anon CANNOT insert or update public.orders or order_items.
--     - anon can only insert sanitized contact inquiries.
--   * authenticated admins: verified via public.is_admin() membership in public.admins.
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Ensure contact_messages id has a default UUID expression
ALTER TABLE public.contact_messages
  ALTER COLUMN id SET DEFAULT ('msg_' || replace(gen_random_uuid()::text, '-', ''));

-- 2. Grant INSERT and UPDATE on orders and order_items to authenticated
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.order_items TO authenticated;

-- 3. RLS Policies for authenticated admins
DROP POLICY IF EXISTS orders_admin_insert ON public.orders;
CREATE POLICY orders_admin_insert ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS orders_admin_update ON public.orders;
CREATE POLICY orders_admin_update ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS order_items_admin_insert ON public.order_items;
CREATE POLICY order_items_admin_insert ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS order_items_admin_update ON public.order_items;
CREATE POLICY order_items_admin_update ON public.order_items
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
