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
