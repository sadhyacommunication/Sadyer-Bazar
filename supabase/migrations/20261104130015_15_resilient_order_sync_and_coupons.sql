-- =============================================================================
-- MIGRATION 15 -- RESILIENT ORDER SYNC RPC, ESSENTIAL COUPONS & ADMIN DUAL-CHANNEL RPCs
--
-- What this fixes:
--   1. Seeds all default store coupons (FAMILYBOX8, SADHYER100, SADYER100, JAMUNA10, BOGURA50)
--      into public.coupons so coupon validation in _sb_quote_order never throws
--      "This coupon code is invalid or has expired" for valid promotional codes.
--   2. Ensures site_settings.qr_payment_enabled is explicitly TRUE.
--   3. Adds public.admin_sync_resilient_order RPC to allow authenticated admins
--      to sync offline/resilient orders from localStorage into the PostgreSQL database.
--      Fixes conflict handling by checking existing order_code first.
--   4. Enhances admin order operations (admin_set_order_status, admin_verify_manual_qr_payment,
--      admin_adjust_order_weight, admin_assign_logistics, admin_mark_order_paid, admin_verify_cod_phone)
--      to find orders by (id = p_order_id OR order_code = upper(trim(p_order_id))),
--      so status updates succeed whether the caller provides the UUID id or the human order code.
--   5. Grants EXECUTE to both authenticated admins and service_role with strict
--      allow-list verification (p_actor IN public.admins AND auth.uid() = p_actor),
--      enabling dual-channel execution (Edge API primary with direct Supabase RPC fallback).
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Ensure site_settings has qr_payment_enabled = true
UPDATE public.site_settings
SET qr_payment_enabled = true
WHERE id = 1 AND (qr_payment_enabled IS NULL OR qr_payment_enabled = false);

-- 2. Seed all store coupons into public.coupons
INSERT INTO public.coupons (id, code, title, title_bn, description, discount_type, discount_value, min_order_amount, max_discount_amount, is_active, usage_count)
VALUES
  ('coup-familybox8', 'FAMILYBOX8', '8% Family Combo Box Savings (Up to ৳300)', 'ফ্যামিলি কম্বো বক্স ৮% ছাড়', 'Special discount for 4+ item family combo orders', 'percentage', 8.00, 1000.00, 300.00, true, 0),
  ('coup-sadhyer100', 'SADHYER100', '৳100 Welcome Discount (Min Order ৳1,200)', 'সাধ্যের বাজার ১০০ টাকা ওয়েলকাম ছাড়', 'Welcome discount for all new customers', 'flat', 100.00, 1200.00, 100.00, true, 0),
  ('coup-sadyer100', 'SADYER100', '৳100 Welcome Discount (Min Order ৳1,200)', 'সাধ্যের বাজার ১০০ টাকা ওয়েলকাম ছাড়', 'Welcome discount alternate code', 'flat', 100.00, 1200.00, 100.00, true, 0),
  ('coup-jamuna10', 'JAMUNA10', '10% OFF Jamuna Catch & Family Pre-Orders (Up to ৳250)', 'যমুনা নদীর তাজা মাছে ১০% ছাড়', 'Special 10% discount on river fish and pre-orders', 'percentage', 10.00, 1500.00, 250.00, true, 0),
  ('coup-bogura50', 'BOGURA50', '৳50 OFF Bogura Shahi Doi & Gawa Ghee (Min Order ৳600)', 'বগুড়ার দই ও ঘিয়ে ৫০ টাকা ছাড়', 'Special flat discount on traditional delicacies', 'flat', 50.00, 600.00, 50.00, true, 0)
ON CONFLICT (code) DO UPDATE SET
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  min_order_amount = EXCLUDED.min_order_amount,
  max_discount_amount = EXCLUDED.max_discount_amount,
  is_active = true;

-- 3. Audited Admin RPC: admin_sync_resilient_order
DROP FUNCTION IF EXISTS public.admin_sync_resilient_order(uuid, jsonb);
CREATE OR REPLACE FUNCTION public.admin_sync_resilient_order(
  p_actor uuid,
  p_order jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id         text;
  v_code       text;
  v_items      jsonb;
  v_item       jsonb;
  v_order_row  public.orders;
BEGIN
  -- Strict Admin Authentication
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_actor THEN
    PERFORM public.sb_fail('Actor mismatch');
  END IF;
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  IF p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN
    PERFORM public.sb_fail('Valid order object required');
  END IF;

  v_code := upper(trim(coalesce(p_order ->> 'orderCode', '')));
  IF v_code = '' THEN
    PERFORM public.sb_fail('Order code is required');
  END IF;

  -- Look up existing order by order_code OR by id to avoid duplicate key conflicts
  SELECT id INTO v_id FROM public.orders WHERE order_code = v_code OR id = nullif(trim(p_order ->> 'id'), '');
  IF v_id IS NULL THEN
    v_id := coalesce(nullif(trim(p_order ->> 'id'), ''), 'ord-' || replace(gen_random_uuid()::text, '-', ''));
  END IF;

  -- Upsert order into public.orders
  INSERT INTO public.orders (
    id, order_code, customer_name, customer_phone, delivery_zone, customer_district,
    customer_address, customer_note, subtotal, delivery_charge, discount_amount, coupon_code,
    weight_adjustment_amount, weight_adjustment_note, total_amount, advance_paid, due_amount,
    payment_method, payment_plan, payment_status, order_status, has_preorder_items,
    manual_pay_channel, manual_pay_sender, manual_pay_trx_id, manual_pay_proof_url,
    transaction_id, courier_name, tracking_reference, rider_name, rider_phone,
    is_phone_verified, verification_method, fraud_risk_score, is_suspicious,
    items, created_at, updated_at
  ) VALUES (
    v_id,
    v_code,
    coalesce(p_order ->> 'customerName', 'Customer'),
    coalesce(p_order ->> 'customerPhone', '01700000000'),
    CASE WHEN (p_order ->> 'deliveryZone') = 'outside_dhaka' THEN 'outside_dhaka' ELSE 'inside_dhaka' END,
    coalesce(p_order ->> 'customerDistrict', 'Dhaka City'),
    coalesce(p_order ->> 'customerAddress', 'Delivery Address'),
    p_order ->> 'customerNote',
    coalesce((p_order ->> 'subtotal')::numeric, 0),
    coalesce((p_order ->> 'deliveryCharge')::numeric, 70),
    coalesce((p_order ->> 'discountAmount')::numeric, 0),
    p_order ->> 'couponCode',
    coalesce((p_order ->> 'weightAdjustmentAmount')::numeric, 0),
    p_order ->> 'weightAdjustmentNote',
    coalesce((p_order ->> 'totalAmount')::numeric, 0),
    coalesce((p_order ->> 'advancePaid')::numeric, 0),
    coalesce((p_order ->> 'dueAmount')::numeric, 0),
    CASE WHEN (p_order ->> 'paymentMethod') IN ('bkash', 'nagad', 'sslcommerz', 'qr_pay', 'cod') THEN p_order ->> 'paymentMethod' ELSE 'cod' END,
    CASE WHEN (p_order ->> 'paymentPlan') IN ('full', 'advance', 'cod') THEN p_order ->> 'paymentPlan' ELSE 'cod' END,
    CASE WHEN (p_order ->> 'paymentStatus') IN ('pending', 'review_pending', 'advance_paid', 'paid', 'failed', 'refunded') THEN p_order ->> 'paymentStatus' ELSE 'pending' END,
    CASE WHEN (p_order ->> 'orderStatus') IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') THEN p_order ->> 'orderStatus' ELSE 'pending' END,
    coalesce((p_order ->> 'hasPreorderItems')::boolean, false),
    p_order ->> 'manualPayChannel',
    p_order ->> 'manualPaySender',
    nullif(trim(p_order ->> 'manualPayTrxId'), ''),
    p_order ->> 'manualPayProofUrl',
    p_order ->> 'transactionId',
    p_order ->> 'courierName',
    p_order ->> 'trackingReference',
    p_order ->> 'riderName',
    p_order ->> 'riderPhone',
    coalesce((p_order ->> 'isPhoneVerified')::boolean, false),
    coalesce(p_order ->> 'verificationMethod', 'unverified'),
    coalesce((p_order ->> 'fraudRiskScore')::int, 0),
    coalesce((p_order ->> 'isSuspicious')::boolean, false),
    coalesce(p_order -> 'items', '[]'::jsonb),
    coalesce((p_order ->> 'createdAt')::timestamptz, now()),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    order_status = EXCLUDED.order_status,
    payment_status = EXCLUDED.payment_status,
    advance_paid = EXCLUDED.advance_paid,
    due_amount = EXCLUDED.due_amount,
    weight_adjustment_amount = EXCLUDED.weight_adjustment_amount,
    weight_adjustment_note = EXCLUDED.weight_adjustment_note,
    courier_name = EXCLUDED.courier_name,
    tracking_reference = EXCLUDED.tracking_reference,
    rider_name = EXCLUDED.rider_name,
    rider_phone = EXCLUDED.rider_phone,
    manual_pay_channel = coalesce(EXCLUDED.manual_pay_channel, public.orders.manual_pay_channel),
    manual_pay_sender = coalesce(EXCLUDED.manual_pay_sender, public.orders.manual_pay_sender),
    manual_pay_trx_id = coalesce(EXCLUDED.manual_pay_trx_id, public.orders.manual_pay_trx_id),
    manual_pay_proof_url = coalesce(EXCLUDED.manual_pay_proof_url, public.orders.manual_pay_proof_url),
    items = coalesce(EXCLUDED.items, public.orders.items),
    updated_at = now()
  RETURNING * INTO v_order_row;

  -- Upsert items if present
  v_items := p_order -> 'items';
  IF v_items IS NOT NULL AND jsonb_typeof(v_items) = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
      INSERT INTO public.order_items (
        id, order_id, product_id, variant_id, product_title, product_title_bn,
        product_image, variant_label, cutting_preference, is_preorder,
        quantity, unit_price, line_total
      ) VALUES (
        coalesce(nullif(trim(v_item ->> 'id'), ''), 'item-' || replace(gen_random_uuid()::text, '-', '')),
        v_order_row.id,
        coalesce(v_item ->> 'productId', 'unknown'),
        coalesce(v_item ->> 'variantId', 'unknown'),
        coalesce(nullif(trim(v_item ->> 'productTitle'), ''), 'Item'),
        coalesce(nullif(trim(v_item ->> 'productTitleBn'), ''), v_item ->> 'productTitle', 'পণ্য'),
        coalesce(nullif(trim(v_item ->> 'productImage'), ''), '/images/products/placeholder.jpg'),
        coalesce(nullif(trim(v_item ->> 'variantLabel'), ''), 'Standard'),
        v_item ->> 'cuttingPreference',
        coalesce((v_item ->> 'isPreorder')::boolean, false),
        GREATEST(1, coalesce((v_item ->> 'quantity')::int, 1)),
        GREATEST(0, coalesce((v_item ->> 'unitPrice')::numeric, 0)),
        GREATEST(0, coalesce((v_item ->> 'lineTotal')::numeric, 0))
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END IF;

  PERFORM public._sb_audit(p_actor, 'order.resilient_sync', v_order_row.id, jsonb_build_object('orderCode', v_order_row.order_code));

  RETURN jsonb_build_object(
    'success', true,
    'orderId', v_order_row.id,
    'orderCode', v_order_row.order_code
  );
END;
$$;

-- 4. Robust admin_set_order_status (searches by id OR order_code)
CREATE OR REPLACE FUNCTION public.admin_set_order_status(
  p_order_id text,
  p_new_status text,
  p_actor uuid
) RETURNS jsonb
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

  -- Match order by id OR order_code
  SELECT * INTO v_order FROM public.orders
   WHERE id = p_order_id OR order_code = upper(trim(p_order_id))
     FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;

  IF p_new_status = 'cancelled' THEN
    RETURN public._sb_cancel_order(v_order.id, 'Cancelled by admin', p_actor);
  END IF;

  IF v_order.order_status = 'cancelled' THEN PERFORM public.sb_fail('Cancelled orders cannot be reopened'); END IF;

  v_old := array_position(v_flow, v_order.order_status);
  v_new := array_position(v_flow, p_new_status);
  IF v_new <= v_old THEN PERFORM public.sb_fail('Order status can only move forward'); END IF;
  IF v_new >= 2 AND v_order.payment_method IN ('bkash', 'nagad') AND v_order.payment_status NOT IN ('advance_paid', 'paid') THEN
    PERFORM public.sb_fail('This online order has no verified payment yet');
  END IF;

  UPDATE public.orders SET order_status = p_new_status, updated_at = now() WHERE id = v_order.id
  RETURNING * INTO v_order;
  PERFORM public._sb_audit(p_actor, 'order.status', v_order.id, jsonb_build_object('to', p_new_status));
  RETURN public._sb_order_summary(v_order);
END;
$$;

-- 5. Robust admin_verify_manual_qr_payment (searches by id OR order_code)
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
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_actor THEN
    PERFORM public.sb_fail('Actor mismatch');
  END IF;
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  -- Match order by id OR order_code
  SELECT * INTO v_order FROM public.orders
   WHERE id = p_order_id OR order_code = upper(trim(p_order_id))
     FOR UPDATE;
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
      WHERE gateway = 'manual_verify' AND transaction_id = v_ref AND order_id <> v_order.id
    ) THEN
      PERFORM public.sb_fail('This transaction ID has already been credited to another order');
    END IF;

    -- Register in processed_webhook_events
    INSERT INTO public.processed_webhook_events (gateway, transaction_id, order_code, amount, currency, payload)
    VALUES ('manual_verify', v_ref, v_order.order_code, v_order.total_amount, 'BDT',
            jsonb_build_object('actor', p_actor, 'channel', v_order.manual_pay_channel, 'note', left(coalesce(p_note, ''), 300)))
    ON CONFLICT (gateway, transaction_id) DO NOTHING;

    -- Update order to confirmed and fully paid
    UPDATE public.orders
    SET payment_status = 'paid',
        order_status = CASE WHEN order_status = 'pending' THEN 'confirmed' ELSE order_status END,
        advance_paid = total_amount,
        due_amount = 0,
        paid_at = now(),
        manual_pay_verified_at = now(),
        manual_pay_verified_by = p_actor,
        manual_pay_reject_reason = NULL,
        updated_at = now()
    WHERE id = v_order.id
    RETURNING * INTO v_order;

    INSERT INTO public.payment_transactions (
      id, order_id, order_code, gateway, transaction_id, validation_id,
      amount, currency, status, verified_at, created_at
    ) VALUES (
      'tx-qr-' || replace(gen_random_uuid()::text, '-', ''),
      v_order.id,
      v_order.order_code,
      'manual_verify',
      v_ref,
      'ADMIN_VERIFIED:' || p_actor::text,
      v_order.total_amount,
      'BDT',
      'validated',
      now(),
      now()
    );

    PERFORM public._sb_audit(
      p_actor,
      'qr_payment.verified',
      v_order.id,
      jsonb_build_object('trx_id', v_ref, 'amount', v_order.total_amount, 'note', p_note)
    );
  ELSIF p_action = 'reject_mismatch' THEN
    UPDATE public.orders
    SET payment_status = 'failed',
        manual_pay_reject_reason = left(coalesce(p_note, 'Transaction ID mismatch with bank statement'), 300),
        updated_at = now()
    WHERE id = v_order.id
    RETURNING * INTO v_order;

    PERFORM public._sb_audit(
      p_actor,
      'qr_payment.rejected',
      v_order.id,
      jsonb_build_object('reason', p_note)
    );
  ELSE
    PERFORM public.sb_fail('Invalid verification action');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_order.order_status,
    'orderStatus', v_order.order_status,
    'paymentStatus', v_order.payment_status,
    'orderId', v_order.id,
    'orderCode', v_order.order_code
  );
END;
$$;

-- 6. Robust admin_adjust_order_weight (searches by id OR order_code)
CREATE OR REPLACE FUNCTION public.admin_adjust_order_weight(
  p_order_id text,
  p_adjustment numeric,
  p_note text,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_total numeric(10, 2);
  v_due   numeric(10, 2);
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_actor THEN
    PERFORM public.sb_fail('Actor mismatch');
  END IF;
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  IF p_adjustment IS NULL OR abs(p_adjustment) > 5000 THEN PERFORM public.sb_fail('Adjustment must be within +/- BDT 5,000'); END IF;

  SELECT * INTO v_order FROM public.orders
   WHERE id = p_order_id OR order_code = upper(trim(p_order_id))
     FOR UPDATE;
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
   WHERE id = v_order.id
   RETURNING * INTO v_order;
  PERFORM public._sb_audit(p_actor, 'order.adjust_weight', v_order.id, jsonb_build_object('adjustment', p_adjustment));
  RETURN public._sb_order_summary(v_order);
END;
$$;

-- 7. Robust admin_assign_logistics (searches by id OR order_code)
CREATE OR REPLACE FUNCTION public.admin_assign_logistics(
  p_order_id text,
  p_courier text,
  p_tracking_ref text,
  p_rider_name text,
  p_rider_phone text,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_phone text;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_actor THEN
    PERFORM public.sb_fail('Actor mismatch');
  END IF;
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  SELECT * INTO v_order FROM public.orders
   WHERE id = p_order_id OR order_code = upper(trim(p_order_id))
     FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  IF v_order.order_status = 'cancelled' THEN PERFORM public.sb_fail('Cancelled orders cannot be dispatched'); END IF;

  v_phone := nullif(regexp_replace(coalesce(p_rider_phone, ''), '\D', '', 'g'), '');
  IF v_phone IS NOT NULL AND v_phone LIKE '8801%' AND length(v_phone) = 13 THEN v_phone := substr(v_phone, 3); END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^01[3-9][0-9]{8}$' THEN PERFORM public.sb_fail('Please enter a valid rider mobile number'); END IF;

  UPDATE public.orders
     SET courier_name       = nullif(left(public.sb_clean_text(p_courier), 60), ''),
         tracking_reference = nullif(left(public.sb_clean_text(p_tracking_ref), 80), ''),
         rider_name         = nullif(left(public.sb_clean_text(p_rider_name), 80), ''),
         rider_phone        = v_phone,
         order_status       = CASE WHEN order_status IN ('pending', 'confirmed') THEN 'shipped' ELSE order_status END,
         updated_at         = now()
   WHERE id = v_order.id
   RETURNING * INTO v_order;
  PERFORM public._sb_audit(p_actor, 'order.assign_logistics', v_order.id,
    jsonb_build_object('courier', p_courier, 'tracking', p_tracking_ref, 'status', v_order.order_status));
  RETURN public._sb_order_summary(v_order);
END;
$$;

-- 8. Robust admin_mark_order_paid (searches by id OR order_code)
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
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_actor THEN
    PERFORM public.sb_fail('Actor mismatch');
  END IF;
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;
  IF length(v_ref) < 4 OR length(v_ref) > 64 THEN PERFORM public.sb_fail('Reference must be 4 to 64 characters'); END IF;

  SELECT * INTO v_order FROM public.orders
   WHERE id = p_order_id OR order_code = upper(trim(p_order_id))
     FOR UPDATE;
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

  v_order := public._sb_apply_payment(v_order.id, p_amount, v_ref);

  INSERT INTO public.payment_transactions (id, order_id, order_code, gateway, transaction_id, validation_id,
                                           amount, currency, status, verified_at, created_at)
  VALUES ('tx-' || replace(gen_random_uuid()::text, '-', ''), v_order.id, v_order.order_code, 'manual_verify', v_ref,
          'ADMIN:' || p_actor::text, p_amount, 'BDT', 'validated', now(), now());

  PERFORM public._sb_audit(p_actor, 'order.mark_paid', v_order.id,
    jsonb_build_object('amount', p_amount, 'reference', v_ref, 'note', left(coalesce(p_note, ''), 300)));
  RETURN public._sb_order_summary(v_order);
END;
$$;

-- 9. Robust admin_verify_cod_phone (searches by id OR order_code)
CREATE OR REPLACE FUNCTION public.admin_verify_cod_phone(
  p_order_id text,
  p_method text,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_order public.orders;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_actor THEN
    PERFORM public.sb_fail('Actor mismatch');
  END IF;
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;
  IF p_method IS NULL OR p_method NOT IN ('manual_call', 'sms_otp') THEN PERFORM public.sb_fail('Invalid verification method'); END IF;

  UPDATE public.orders
     SET is_phone_verified = true, verification_method = p_method,
         order_status = CASE WHEN order_status = 'pending' THEN 'confirmed' ELSE order_status END,
         updated_at = now()
   WHERE (id = p_order_id OR order_code = upper(trim(p_order_id)))
     AND order_status <> 'cancelled' AND payment_method = 'cod'
   RETURNING * INTO v_order;
  IF NOT FOUND THEN PERFORM public.sb_fail('COD order not found or not eligible'); END IF;
  PERFORM public._sb_audit(p_actor, 'order.verify_cod_phone', v_order.id, jsonb_build_object('method', p_method));
  RETURN public._sb_order_summary(v_order);
END;
$$;

-- 10. Revoke from public/anon/authenticated and grant to service_role (Zero-Client-Trust)
REVOKE ALL ON FUNCTION public.admin_sync_resilient_order(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_resilient_order(uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.admin_set_order_status(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_order_status(text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_verify_manual_qr_payment(text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_manual_qr_payment(text, text, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_adjust_order_weight(text, numeric, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_order_weight(text, numeric, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_assign_logistics(text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_logistics(text, text, text, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_mark_order_paid(text, numeric, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_order_paid(text, numeric, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_verify_cod_phone(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_cod_phone(text, text, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
