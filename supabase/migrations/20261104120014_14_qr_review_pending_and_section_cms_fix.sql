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

DROP FUNCTION IF EXISTS public.admin_section_reorder(uuid, text, uuid[]);
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

DROP FUNCTION IF EXISTS public.admin_section_reset_defaults(uuid, text);
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
