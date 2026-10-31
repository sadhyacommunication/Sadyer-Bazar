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
