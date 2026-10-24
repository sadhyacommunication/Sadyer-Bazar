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
