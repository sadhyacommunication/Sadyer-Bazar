-- =============================================================================
-- MIGRATION 11/11 -- BANGLA QR SCAN & PAY & ANTI-HACKER PAYMENT VERIFICATION
--
-- What this adds:
--   * Expands public.orders with manual QR payment tracking columns:
--     - manual_pay_channel: ('bkash', 'nagad', 'card_bank', 'upay', 'other')
--     - manual_pay_sender: Customer's sender mobile/account number
--     - manual_pay_trx_id: Customer's claimed Transaction ID / Reference
--     - manual_pay_proof_url: Optional customer proof screenshot
--     - manual_pay_verified_at: Timestamp when verified by admin
--     - manual_pay_verified_by: Admin UUID who verified the payment
--     - manual_pay_reject_reason: Rejection reason if TrxID mismatched
--   * Expands orders payment_method check to include 'qr_pay'
--   * Anti-Replay Guard: Unique index on uppercase TrxID preventing reuse
--   * site_settings columns: qr_payment_enabled, qr_code_image_url, qr_merchant_name
--   * Customer submission RPC: submit_manual_qr_payment_proof
--   * Atomic Admin verification RPC: admin_verify_manual_qr_payment
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Extend public.orders with manual QR payment columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS manual_pay_channel text CHECK (manual_pay_channel IN ('bkash', 'nagad', 'card_bank', 'upay', 'other')),
  ADD COLUMN IF NOT EXISTS manual_pay_sender text,
  ADD COLUMN IF NOT EXISTS manual_pay_trx_id text,
  ADD COLUMN IF NOT EXISTS manual_pay_proof_url text,
  ADD COLUMN IF NOT EXISTS manual_pay_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_pay_verified_by uuid,
  ADD COLUMN IF NOT EXISTS manual_pay_reject_reason text;

-- 2. Update payment_method CHECK constraint to support 'qr_pay'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cod', 'qr_pay', 'bkash', 'nagad', 'sslcommerz'));

-- 3. Global Anti-Replay Guard: Unique index on TrxID (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_manual_trx_id
  ON public.orders (upper(trim(manual_pay_trx_id)))
  WHERE manual_pay_trx_id IS NOT NULL AND trim(manual_pay_trx_id) <> '';

-- 4. Enable QR payment in site_settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS qr_payment_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS qr_code_image_url text DEFAULT '/images/payments/sadhyer-bazar-qr.jpg',
  ADD COLUMN IF NOT EXISTS qr_merchant_name text DEFAULT 'Sadhyer Bazar';

-- Column level grants matching zero-client-trust policy
GRANT SELECT (qr_payment_enabled, qr_code_image_url, qr_merchant_name)
  ON public.site_settings TO anon, authenticated;
GRANT INSERT (qr_payment_enabled, qr_code_image_url, qr_merchant_name)
  ON public.site_settings TO authenticated;
GRANT UPDATE (qr_payment_enabled, qr_code_image_url, qr_merchant_name)
  ON public.site_settings TO authenticated;

-- Ensure orders grants for authenticated admins cover new columns
GRANT SELECT, INSERT, UPDATE (
  manual_pay_channel,
  manual_pay_sender,
  manual_pay_trx_id,
  manual_pay_proof_url,
  manual_pay_verified_at,
  manual_pay_verified_by,
  manual_pay_reject_reason
) ON public.orders TO authenticated;

-- 5. Customer submission RPC for manual QR payment proof
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

  RETURN jsonb_build_object('success', true, 'orderCode', v_order.order_code, 'status', 'review_pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_manual_qr_payment_proof TO anon, authenticated;

-- 6. Atomic Admin Verification RPC
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
  -- Strict Admin Authentication
  IF p_actor IS NULL OR NOT public.is_admin() THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.sb_fail('Order not found');
  END IF;

  IF p_action = 'verify_confirm' THEN
    v_ref := upper(trim(coalesce(v_order.manual_pay_trx_id, '')));
    IF v_ref = '' THEN
      PERFORM public.sb_fail('Order has no customer TrxID to verify');
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

GRANT EXECUTE ON FUNCTION public.admin_verify_manual_qr_payment TO authenticated;

COMMIT;
