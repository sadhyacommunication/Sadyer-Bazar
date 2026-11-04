-- =============================================================================
-- MIGRATION 15 -- RESILIENT ORDER SYNC RPC & ESSENTIAL COUPONS SEEDING
--
-- What this fixes:
--   1. Seeds all default store coupons (FAMILYBOX8, SADHYER100, SADYER100, JAMUNA10, BOGURA50)
--      into public.coupons so coupon validation in _sb_quote_order never throws
--      "This coupon code is invalid or has expired" for valid promotional codes.
--   2. Ensures site_settings.qr_payment_enabled is explicitly TRUE.
--   3. Adds public.admin_sync_resilient_order RPC to allow authenticated admins
--      to sync offline/resilient orders from localStorage into the PostgreSQL database.
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
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_actor) THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;

  IF p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN
    PERFORM public.sb_fail('Valid order object required');
  END IF;

  v_id := coalesce(nullif(trim(p_order ->> 'id'), ''), 'ord-' || replace(gen_random_uuid()::text, '-', ''));
  v_code := upper(trim(coalesce(p_order ->> 'orderCode', '')));
  IF v_code = '' THEN
    PERFORM public.sb_fail('Order code is required');
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

-- Grant execution to service_role and maintain zero-client-trust invariant
REVOKE ALL ON FUNCTION public.admin_sync_resilient_order(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_resilient_order(uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
