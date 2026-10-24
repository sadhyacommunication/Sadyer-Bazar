-- =============================================================================
-- MIGRATION 03/05 -- PAYMENTS: attempt lifecycle + verified settlement
--
-- Money can only reach an order through finalize_payment_attempt(), which requires an attempt
-- that THIS SERVER created (so the order, amount and merchant reference are fixed server-side)
-- and a gateway-verified result. Replaying a trxID, paying the wrong amount, or paying for a
-- different order cannot credit an order: the attempt is parked as `needs_review` and a
-- security event is recorded.
-- All functions: service_role only (migration 05).
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- Internal helpers
-- -----------------------------------------------------------------------------

-- Why this payment may NOT be applied to this order (NULL = ok).
CREATE OR REPLACE FUNCTION public._sb_payment_blocker(p_order public.orders, p_amount numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_order.order_status = 'cancelled'                         THEN 'order_cancelled'
    WHEN p_order.payment_status = 'paid' OR p_order.due_amount <= 0 THEN 'already_paid'
    WHEN p_amount <= 0                                              THEN 'invalid_amount'
    WHEN p_order.advance_paid + p_amount > p_order.total_amount + 0.001 THEN 'overpayment'
    ELSE NULL
  END
$$;

-- Applies a (pre-validated) payment to an order and returns the updated row.
CREATE OR REPLACE FUNCTION public._sb_apply_payment(p_order_id text, p_amount numeric, p_trx text)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_blocker text;
  v_paid numeric(10, 2);
  v_due  numeric(10, 2);
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  v_blocker := public._sb_payment_blocker(v_order, p_amount);
  IF v_blocker IS NOT NULL THEN PERFORM public.sb_fail('Payment cannot be applied: ' || v_blocker); END IF;

  v_paid := v_order.advance_paid + p_amount;
  v_due  := greatest(0, v_order.total_amount - v_paid);

  UPDATE public.orders
     SET advance_paid   = v_paid,
         due_amount     = v_due,
         payment_status = CASE WHEN v_due = 0 THEN 'paid' ELSE 'advance_paid' END,
         order_status   = CASE WHEN order_status = 'pending' THEN 'confirmed' ELSE order_status END,
         transaction_id = CASE
                            WHEN transaction_id IS NULL OR transaction_id = '' THEN p_trx
                            WHEN position(p_trx IN transaction_id) > 0 THEN transaction_id
                            ELSE transaction_id || ', ' || p_trx
                          END,
         paid_at        = CASE WHEN v_due = 0 THEN now() ELSE paid_at END,
         updated_at     = now()
   WHERE id = p_order_id
   RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- Parks an attempt for human review (money moved but something does not add up). Never credits the order.
CREATE OR REPLACE FUNCTION public._sb_attempt_needs_review(p_attempt_id uuid, p_reason text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE a public.payment_attempts;
BEGIN
  UPDATE public.payment_attempts
     SET status = 'needs_review', failure_reason = p_reason,
         raw_payload = raw_payload || jsonb_build_object('review', coalesce(p_payload, '{}'::jsonb)),
         updated_at = now()
   WHERE id = p_attempt_id RETURNING * INTO a;
  PERFORM public._sb_security_event('payment_needs_review', 'critical',
    jsonb_build_object('attemptId', p_attempt_id, 'orderCode', a.order_code, 'gateway', a.gateway,
                       'reason', p_reason, 'expected', a.expected_amount));
  RETURN jsonb_build_object('ok', false, 'reason', p_reason, 'orderCode', a.order_code);
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. begin_payment_attempt: server decides purpose + amount from the ORDER ROW.
--    The client supplies nothing but an order code (and the edge supplies the gateway).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_payment_attempt(
  p_order_code     text,
  p_gateway        text,
  p_client_ip_hash text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order    public.orders;
  v_settings public.site_settings;
  v_purpose  text;
  v_amount   numeric(10, 2);
  v_ref      text;
  v_id       uuid;
  v_recent   integer;
BEGIN
  IF p_gateway IS NULL OR p_gateway NOT IN ('bkash', 'nagad') THEN PERFORM public.sb_fail('Unsupported payment gateway'); END IF;

  SELECT * INTO v_order FROM public.orders
   WHERE upper(order_code) = upper(btrim(coalesce(p_order_code, ''))) FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  IF v_order.order_status IN ('cancelled', 'delivered') THEN PERFORM public.sb_fail('This order can no longer be paid online'); END IF;
  IF v_order.payment_method = 'cod' OR v_order.payment_plan = 'cod' THEN PERFORM public.sb_fail('This is a cash-on-delivery order'); END IF;
  IF v_order.payment_status = 'paid' OR v_order.due_amount <= 0 THEN PERFORM public.sb_fail('This order is already fully paid'); END IF;

  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1;
  IF (p_gateway = 'bkash' AND NOT coalesce(v_settings.bkash_enabled, false))
     OR (p_gateway = 'nagad' AND NOT coalesce(v_settings.nagad_enabled, false)) THEN
    PERFORM public.sb_fail('This payment method is currently unavailable');
  END IF;

  IF v_order.advance_paid = 0 THEN
    v_purpose := 'initial';
    IF v_order.payment_method <> p_gateway THEN
      PERFORM public.sb_fail(format('This order must be paid with %s', v_order.payment_method));
    END IF;
    v_amount := v_order.payable_now;
  ELSE
    v_purpose := 'due';           -- advance already received: customer settles the remainder
    v_amount := v_order.due_amount;
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN PERFORM public.sb_fail('Nothing is payable for this order'); END IF;

  UPDATE public.payment_attempts SET status = 'expired', updated_at = now()
   WHERE order_id = v_order.id AND status = 'created' AND created_at < now() - interval '30 minutes';

  SELECT count(*) INTO v_recent FROM public.payment_attempts
   WHERE order_id = v_order.id AND created_at > now() - interval '1 hour';
  IF v_recent >= 8 THEN PERFORM public.sb_fail('Too many payment attempts. Please wait a while and try again.'); END IF;

  v_ref := 'SBP' || public._sb_random_code(14);   -- 17 alphanumeric chars: fits bKash invoice no. and Nagad orderId limits
  INSERT INTO public.payment_attempts (order_id, order_code, gateway, purpose, expected_amount, gateway_order_ref, client_ip_hash)
  VALUES (v_order.id, v_order.order_code, p_gateway, v_purpose, v_amount, v_ref, p_client_ip_hash)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'attemptId',       v_id,
    'orderCode',       v_order.order_code,
    'purpose',         v_purpose,
    'amount',          v_amount,
    'gatewayOrderRef', v_ref,
    'customerPhone',   v_order.customer_phone
  );
END;
$$;

-- 2. Remember the gateway's session id and mark the customer as redirected.
CREATE OR REPLACE FUNCTION public.attach_gateway_payment(p_attempt_id uuid, p_gateway_payment_id text, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_gateway_payment_id IS NULL OR btrim(p_gateway_payment_id) = '' OR length(p_gateway_payment_id) > 128 THEN
    PERFORM public.sb_fail('Invalid gateway payment id');
  END IF;
  UPDATE public.payment_attempts
     SET gateway_payment_id = btrim(p_gateway_payment_id), status = 'redirected',
         raw_payload = raw_payload || jsonb_build_object('create', coalesce(p_meta, '{}'::jsonb)),
         updated_at = now()
   WHERE id = p_attempt_id AND status = 'created';
  IF NOT FOUND THEN PERFORM public.sb_fail('Payment attempt is not in a valid state'); END IF;
END;
$$;

-- 3. Callback entry point. Resolves the attempt (and thus the order) from the GATEWAY's id and
--    atomically claims it, so concurrent/refreshed callbacks cannot execute a payment twice.
--    state: claimed | already_succeeded | in_progress | terminal | not_found
CREATE OR REPLACE FUNCTION public.claim_payment_attempt(p_gateway text, p_gateway_payment_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE a public.payment_attempts;
BEGIN
  SELECT * INTO a FROM public.payment_attempts
   WHERE gateway = p_gateway AND gateway_payment_id = btrim(coalesce(p_gateway_payment_id, '')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('state', 'not_found'); END IF;

  IF a.status = 'succeeded' THEN
    RETURN jsonb_build_object('state', 'already_succeeded', 'orderCode', a.order_code);
  END IF;
  IF a.status IN ('failed', 'cancelled', 'needs_review') THEN
    RETURN jsonb_build_object('state', 'terminal', 'status', a.status, 'orderCode', a.order_code);
  END IF;
  IF a.status = 'executing' AND a.updated_at > now() - interval '2 minutes' THEN
    RETURN jsonb_build_object('state', 'in_progress', 'orderCode', a.order_code);
  END IF;

  -- claimable: redirected | stale executing | expired (late callback: the gateway stays authoritative)
  UPDATE public.payment_attempts SET status = 'executing', updated_at = now() WHERE id = a.id;
  RETURN jsonb_build_object('state', 'claimed', 'attempt', jsonb_build_object(
    'id', a.id, 'orderId', a.order_id, 'orderCode', a.order_code, 'gateway', a.gateway,
    'purpose', a.purpose, 'expectedAmount', a.expected_amount,
    'gatewayOrderRef', a.gateway_order_ref, 'gatewayPaymentId', a.gateway_payment_id));
END;
$$;

-- Back to `redirected` when the gateway result is still pending/ambiguous (callback may be retried).
CREATE OR REPLACE FUNCTION public.release_payment_attempt(p_attempt_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.payment_attempts SET status = 'redirected', updated_at = now()
   WHERE id = p_attempt_id AND status = 'executing'
$$;

-- Definitive failure / customer cancellation reported by the gateway. Never touches the order.
CREATE OR REPLACE FUNCTION public.fail_payment_attempt(p_attempt_id uuid, p_status text, p_reason text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('failed', 'cancelled') THEN PERFORM public.sb_fail('Invalid attempt status'); END IF;
  UPDATE public.payment_attempts
     SET status = p_status, failure_reason = left(coalesce(p_reason, ''), 300),
         raw_payload = raw_payload || jsonb_build_object('failure', coalesce(p_payload, '{}'::jsonb)),
         updated_at = now(), completed_at = now()
   WHERE id = p_attempt_id AND status IN ('created', 'redirected', 'executing', 'expired');
END;
$$;

-- 4. THE settlement function. Called only after the edge has executed/verified the payment with the
--    gateway server-to-server. Re-checks everything against what THIS server stored at creation time.
CREATE OR REPLACE FUNCTION public.finalize_payment_attempt(
  p_attempt_id   uuid,
  p_trx_id       text,
  p_amount       numeric,
  p_currency     text,
  p_merchant_ref text,
  p_payload      jsonb DEFAULT '{}'::jsonb,
  p_sender_phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a        public.payment_attempts;
  v_order  public.orders;
  v_trx    text := btrim(coalesce(p_trx_id, ''));
  v_rows   integer;
  v_block  text;
BEGIN
  SELECT * INTO a FROM public.payment_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Payment attempt not found'); END IF;

  IF a.status = 'succeeded' THEN
    IF a.gateway_trx_id IS DISTINCT FROM v_trx THEN
      RETURN public._sb_attempt_needs_review(p_attempt_id, 'succeeded_attempt_seen_with_different_trx', p_payload);
    END IF;
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'orderCode', a.order_code);
  END IF;
  IF a.status <> 'executing' THEN PERFORM public.sb_fail('Payment attempt is not being processed'); END IF;

  -- Everything the gateway reports must match what we stored when we created the session.
  IF v_trx = '' OR length(v_trx) > 64 THEN RETURN public._sb_attempt_needs_review(p_attempt_id, 'missing_or_invalid_trx_id', p_payload); END IF;
  IF upper(coalesce(p_currency, '')) <> 'BDT'     THEN RETURN public._sb_attempt_needs_review(p_attempt_id, 'currency_mismatch', p_payload); END IF;
  IF p_merchant_ref IS DISTINCT FROM a.gateway_order_ref THEN RETURN public._sb_attempt_needs_review(p_attempt_id, 'merchant_reference_mismatch', p_payload); END IF;
  IF p_amount IS NULL OR abs(p_amount - a.expected_amount) > 0.001 THEN RETURN public._sb_attempt_needs_review(p_attempt_id, 'amount_mismatch', p_payload); END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = a.order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN public._sb_attempt_needs_review(p_attempt_id, 'order_missing', p_payload); END IF;
  v_block := public._sb_payment_blocker(v_order, p_amount);
  IF v_block IS NOT NULL THEN RETURN public._sb_attempt_needs_review(p_attempt_id, v_block, p_payload); END IF;
  IF a.purpose = 'initial' AND v_order.advance_paid <> 0 THEN
    RETURN public._sb_attempt_needs_review(p_attempt_id, 'duplicate_initial_payment', p_payload);
  END IF;
  IF a.purpose = 'due' AND abs(v_order.due_amount - a.expected_amount) > 0.001 THEN
    RETURN public._sb_attempt_needs_review(p_attempt_id, 'due_amount_changed', p_payload);
  END IF;

  -- Global anti-replay: a gateway transaction id can be consumed exactly once, ever.
  INSERT INTO public.processed_webhook_events (gateway, transaction_id, order_code, amount, currency, payload)
  VALUES (a.gateway, v_trx, a.order_code, p_amount, 'BDT', coalesce(p_payload, '{}'::jsonb))
  ON CONFLICT (gateway, transaction_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    PERFORM public._sb_security_event('payment_trx_replay', 'critical',
      jsonb_build_object('gateway', a.gateway, 'trx', v_trx, 'orderCode', a.order_code, 'attemptId', a.id));
    RETURN public._sb_attempt_needs_review(p_attempt_id, 'trx_replay', p_payload);
  END IF;

  v_order := public._sb_apply_payment(a.order_id, p_amount, v_trx);

  INSERT INTO public.payment_transactions (id, order_id, order_code, gateway, transaction_id, validation_id,
                                           amount, currency, status, sender_phone, verified_at, created_at)
  VALUES ('tx-' || replace(gen_random_uuid()::text, '-', ''), v_order.id, v_order.order_code, a.gateway, v_trx,
          a.gateway_payment_id, p_amount, 'BDT', 'validated', p_sender_phone, now(), now());

  UPDATE public.payment_attempts
     SET status = 'succeeded', gateway_trx_id = v_trx, completed_at = now(), updated_at = now(),
         raw_payload = raw_payload || jsonb_build_object('settled', coalesce(p_payload, '{}'::jsonb))
   WHERE id = a.id;

  RETURN jsonb_build_object('ok', true, 'orderCode', v_order.order_code,
                            'paymentStatus', v_order.payment_status, 'orderStatus', v_order.order_status,
                            'dueAmount', v_order.due_amount);
END;
$$;

-- Housekeeping: sessions that never reached a result.
CREATE OR REPLACE FUNCTION public.expire_stale_payment_attempts()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.payment_attempts SET status = 'expired', updated_at = now()
   WHERE (status = 'created' AND created_at < now() - interval '30 minutes')
      OR (status = 'redirected' AND created_at < now() - interval '24 hours');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMIT;
