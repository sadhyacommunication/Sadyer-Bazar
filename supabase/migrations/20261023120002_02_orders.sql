-- =============================================================================
-- MIGRATION 02/05 -- ORDERS: server-side pricing, creation, tracking, cancellation
--
-- ALL prices, delivery fees, coupons and payable amounts are computed here, in SQL NUMERIC,
-- from database rows. Nothing price-related is ever read from the client request.
-- Every function below is EXECUTE-granted to service_role ONLY (migration 05); the browser
-- reaches them exclusively through our rate-limited /api/* Pages Functions.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- Internal: compact, client-safe order summary
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sb_order_summary(p_order public.orders)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'orderId',          p_order.id,
    'orderCode',        p_order.order_code,
    'subtotal',         p_order.subtotal,
    'deliveryCharge',   p_order.delivery_charge,
    'discountAmount',   p_order.discount_amount,
    'totalAmount',      p_order.total_amount,
    'payableNow',       p_order.payable_now,
    'advancePaid',      p_order.advance_paid,
    'dueAmount',        p_order.due_amount,
    'paymentMethod',    p_order.payment_method,
    'paymentPlan',      p_order.payment_plan,
    'paymentStatus',    p_order.payment_status,
    'orderStatus',      p_order.order_status,
    'hasPreorderItems', p_order.has_preorder_items,
    'isSuspicious',     p_order.is_suspicious,
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

-- -----------------------------------------------------------------------------
-- Internal: the single pricing engine. Read-only. Used by quote_order_server (preview)
-- and create_order_server (real order) so both always agree.
-- -----------------------------------------------------------------------------
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
  IF p_method IS NULL OR p_method NOT IN ('bkash', 'nagad', 'cod') THEN
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
     OR (p_method = 'cod' AND NOT coalesce(v_settings.cod_enabled, false)) THEN
    PERFORM public.sb_fail('This payment method is currently unavailable');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN PERFORM public.sb_fail('Your basket is invalid'); END IF;
    IF coalesce(v_item ->> 'quantity', '') !~ '^[0-9]{1,2}$' THEN PERFORM public.sb_fail('Invalid item quantity'); END IF;
    v_qty := (v_item ->> 'quantity')::integer;
    IF v_qty < 1 OR v_qty > 50 THEN PERFORM public.sb_fail('Quantity must be between 1 and 50'); END IF;

    SELECT pv.id AS variant_id, pv.product_id, pv.label, pv.price, pv.stock_qty,
           p.title, p.title_bn, p.primary_image, p.is_preorder, p.is_active,
           p.preorder_cutoff_at, p.batch_target_qty, p.batch_booked_qty, p.cutting_options
      INTO v_row
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
     WHERE pv.id = (v_item ->> 'variantId')
       AND pv.product_id = (v_item ->> 'productId');

    IF NOT FOUND THEN PERFORM public.sb_fail('An item in your basket is no longer available'); END IF;
    IF NOT v_row.is_active THEN
      PERFORM public.sb_fail(format('%s is currently unavailable', v_row.title));
    END IF;

    IF v_row.is_preorder THEN
      IF v_row.preorder_cutoff_at IS NOT NULL AND v_row.preorder_cutoff_at <= now() THEN
        PERFORM public.sb_fail(format('Pre-orders for %s have closed', v_row.title));
      END IF;
      IF v_row.batch_booked_qty + v_qty > v_row.batch_target_qty THEN
        PERFORM public.sb_fail(format('%s: this batch is fully booked', v_row.title));
      END IF;
      v_has_preorder := true;
    ELSIF v_row.stock_qty < v_qty THEN
      PERFORM public.sb_fail(format('Insufficient stock for %s', v_row.title));
    END IF;

    v_cut := public.sb_clean_text(v_item ->> 'cuttingPreference');
    IF v_cut <> '' THEN
      IF jsonb_typeof(v_row.cutting_options) = 'array' AND jsonb_array_length(v_row.cutting_options) > 0 THEN
        IF NOT (v_row.cutting_options @> to_jsonb(v_cut)) THEN
          PERFORM public.sb_fail(format('Invalid preparation option for %s', v_row.title));
        END IF;
      ELSE
        v_cut := '';
      END IF;
    END IF;

    v_line := v_row.price * v_qty;
    v_subtotal := v_subtotal + v_line;
    v_items := v_items || jsonb_build_object(
      'productId',         v_row.product_id,
      'variantId',         v_row.variant_id,
      'productTitle',      v_row.title,
      'productTitleBn',    v_row.title_bn,
      'productImage',      v_row.primary_image,
      'variantLabel',      v_row.label,
      'cuttingPreference', v_cut,
      'isPreorder',        v_row.is_preorder,
      'quantity',          v_qty,
      'unitPrice',         v_row.price,
      'lineTotal',         v_line);
  END LOOP;

  -- Delivery fee (admin-configurable), free above threshold on the pre-discount subtotal
  IF p_zone = 'inside_dhaka' THEN v_fee := v_settings.inside_dhaka_fee; ELSE v_fee := v_settings.outside_dhaka_fee; END IF;
  IF v_settings.enable_free_delivery AND v_subtotal >= v_settings.free_delivery_threshold THEN v_fee := 0; END IF;

  -- Coupon (validated against the database, never the client)
  IF v_coupon_code IS NOT NULL THEN
    IF length(v_coupon_code) > 40 THEN PERFORM public.sb_fail('This coupon code is invalid or has expired'); END IF;
    SELECT * INTO v_coupon
      FROM public.coupons c
     WHERE upper(c.code) = upper(v_coupon_code)
       AND c.is_active
       AND (c.expires_at IS NULL OR c.expires_at > now())
       AND (c.max_uses IS NULL OR c.usage_count < c.max_uses)
     LIMIT 1;
    IF NOT FOUND THEN PERFORM public.sb_fail('This coupon code is invalid or has expired'); END IF;
    IF v_subtotal < v_coupon.min_order_amount THEN
      PERFORM public.sb_fail(format('A minimum order of BDT %s is required for this coupon', v_coupon.min_order_amount));
    END IF;
    IF v_coupon.discount_type = 'percentage' THEN
      v_discount := round(v_subtotal * v_coupon.discount_value / 100.0, 0);
      IF v_coupon.max_discount_amount IS NOT NULL THEN v_discount := least(v_discount, v_coupon.max_discount_amount); END IF;
    ELSE
      v_discount := v_coupon.discount_value;
    END IF;
    v_discount := least(v_discount, v_subtotal);
  END IF;

  v_total := greatest(0, v_subtotal - v_discount + v_fee);
  IF v_total <= 0 THEN PERFORM public.sb_fail('Order total must be greater than zero'); END IF;

  IF p_plan = 'cod' THEN
    v_payable := 0;
  ELSIF p_plan = 'full' THEN
    v_payable := v_total;
  ELSE
    v_payable := least(v_total, greatest(v_fee, round(greatest(0, v_subtotal - v_discount) * v_settings.preorder_advance_percent / 100.0, 0)));
  END IF;

  RETURN jsonb_build_object(
    'items',          v_items,
    'subtotal',       v_subtotal,
    'deliveryCharge', v_fee,
    'discountAmount', v_discount,
    'couponId',       v_coupon.id,
    'couponCode',     v_coupon.code,
    'totalAmount',    v_total,
    'payableNow',     v_payable,
    'dueAfterPayable', v_total - v_payable,
    'hasPreorder',    v_has_preorder
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Public-facing (via edge only): price preview for the checkout page
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quote_order_server(
  p_items jsonb, p_delivery_zone text, p_coupon_code text, p_payment_method text, p_payment_plan text
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_q jsonb;
BEGIN
  v_q := public._sb_quote_order(p_items, p_delivery_zone, p_coupon_code, p_payment_method, p_payment_plan);
  RETURN v_q - 'couponId';
END;
$$;

-- -----------------------------------------------------------------------------
-- Create an order. Inventory, coupon usage and the order row are written atomically.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_server(
  p_customer_name     text,
  p_customer_phone    text,
  p_delivery_zone     text,
  p_customer_district text,
  p_customer_address  text,
  p_customer_note     text,
  p_coupon_code       text,
  p_payment_method    text,
  p_payment_plan      text,
  p_items             jsonb,
  p_idempotency_key   text,
  p_client_ip_hash    text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now         timestamptz := now();
  v_phone       text;
  v_name        text := public.sb_clean_text(p_customer_name);
  v_district    text := public.sb_clean_text(p_customer_district);
  v_address     text := public.sb_clean_text(p_customer_address);
  v_note        text := nullif(public.sb_clean_text(p_customer_note), '');
  v_idem        text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_quote       jsonb;
  v_existing    public.orders;
  v_order       public.orders;
  v_order_id    text;
  v_code        text;
  v_item        jsonb;
  v_qty         integer;
  v_recent_phone integer;
  v_recent_ip   integer;
  v_score       integer := 0;
  v_reasons     text[] := ARRAY[]::text[];
  v_suspicious  boolean := false;
  v_total       numeric(12, 2);
  v_attempt     integer;
BEGIN
  -- 1. Input validation (lengths mirror the client Zod schema; the DB is the last line of defence)
  v_phone := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  IF v_phone LIKE '8801%' AND length(v_phone) = 13 THEN v_phone := substr(v_phone, 3); END IF;
  IF v_phone !~ '^01[3-9][0-9]{8}$' THEN PERFORM public.sb_fail('Please enter a valid Bangladeshi mobile number'); END IF;
  IF length(v_name) < 2 OR length(v_name) > 80 THEN PERFORM public.sb_fail('Please enter your full name'); END IF;
  IF length(v_district) < 2 OR length(v_district) > 80 THEN PERFORM public.sb_fail('Please enter your district / area'); END IF;
  IF length(v_address) < 8 OR length(v_address) > 350 THEN PERFORM public.sb_fail('Please provide a complete delivery address'); END IF;
  IF v_note IS NOT NULL AND length(v_note) > 300 THEN PERFORM public.sb_fail('Order note is too long'); END IF;
  IF v_idem IS NOT NULL AND (length(v_idem) < 8 OR length(v_idem) > 100) THEN PERFORM public.sb_fail('Invalid request key'); END IF;
  IF p_client_ip_hash IS NOT NULL AND length(p_client_ip_hash) > 64 THEN PERFORM public.sb_fail('Invalid client reference'); END IF;

  -- 2. Idempotent replay: same key + same phone returns the original order summary
  IF v_idem IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.orders WHERE idempotency_key = v_idem;
    IF FOUND THEN
      IF v_existing.customer_phone <> v_phone THEN PERFORM public.sb_fail('Invalid request key'); END IF;
      RETURN public._sb_order_summary(v_existing) || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  -- 3. Velocity limits (per phone and per client)
  SELECT count(*) INTO v_recent_phone FROM public.orders
   WHERE customer_phone = v_phone AND created_at >= v_now - interval '3 hours';
  IF v_recent_phone >= 5 THEN
    PERFORM public.sb_fail('Too many orders from this number. Please wait before placing another order.');
  END IF;
  IF p_client_ip_hash IS NOT NULL THEN
    SELECT count(*) INTO v_recent_ip FROM public.orders
     WHERE client_ip_hash = p_client_ip_hash AND created_at >= v_now - interval '1 hour';
    IF v_recent_ip >= 10 THEN
      PERFORM public.sb_fail('Too many orders from your connection. Please try again later.');
    END IF;
  END IF;

  -- 4. Authoritative pricing
  v_quote := public._sb_quote_order(p_items, p_delivery_zone, p_coupon_code, p_payment_method, p_payment_plan);
  v_total := (v_quote ->> 'totalAmount')::numeric;

  -- 5. Reserve inventory atomically (conditional UPDATEs are race-safe)
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_quote -> 'items') LOOP
    v_qty := (v_item ->> 'quantity')::integer;
    IF (v_item ->> 'isPreorder')::boolean THEN
      UPDATE public.products
         SET batch_booked_qty = batch_booked_qty + v_qty, updated_at = now()
       WHERE id = (v_item ->> 'productId') AND batch_booked_qty + v_qty <= batch_target_qty;
      IF NOT FOUND THEN PERFORM public.sb_fail(format('%s: this batch is fully booked', v_item ->> 'productTitle')); END IF;
    ELSE
      UPDATE public.product_variants
         SET stock_qty = stock_qty - v_qty
       WHERE id = (v_item ->> 'variantId') AND stock_qty >= v_qty;
      IF NOT FOUND THEN PERFORM public.sb_fail(format('Insufficient stock for %s', v_item ->> 'productTitle')); END IF;
    END IF;
  END LOOP;

  IF (v_quote ->> 'couponId') IS NOT NULL THEN
    UPDATE public.coupons SET usage_count = usage_count + 1
     WHERE id = (v_quote ->> 'couponId') AND (max_uses IS NULL OR usage_count < max_uses);
    IF NOT FOUND THEN PERFORM public.sb_fail('This coupon code is invalid or has expired'); END IF;
  END IF;

  -- 6. Anti-fraud scoring
  IF p_payment_method = 'cod' AND v_total > 5000 THEN
    v_score := v_score + 35; v_reasons := array_append(v_reasons, 'High-value COD order (> BDT 5,000)');
  END IF;
  IF v_recent_phone >= 2 THEN
    v_score := v_score + 25; v_reasons := array_append(v_reasons, 'Multiple orders from same phone within 3 hours');
  END IF;
  IF p_delivery_zone = 'inside_dhaka' AND v_district !~* 'dhaka' THEN
    v_score := v_score + 20; v_reasons := array_append(v_reasons, 'Inside-Dhaka zone selected for non-Dhaka district');
  END IF;
  v_suspicious := v_score >= 35;

  -- 7. Insert order (non-guessable code: 32^10 ~ 2^50 combinations; retry on the astronomically rare collision)
  v_order_id := 'ord-' || replace(gen_random_uuid()::text, '-', '');
  FOR v_attempt IN 1 .. 5 LOOP
    v_code := 'SB-' || to_char(v_now, 'YYMM') || '-' || public._sb_random_code(10);
    BEGIN
      INSERT INTO public.orders (
        id, order_code, customer_name, customer_phone, delivery_zone, customer_district,
        customer_address, customer_note, subtotal, delivery_charge, discount_amount, coupon_code,
        weight_adjustment_amount, total_amount, advance_paid, due_amount, payable_now,
        payment_method, payment_plan, payment_status, order_status, has_preorder_items, items,
        fraud_risk_score, is_suspicious, review_reasons, is_phone_verified, verification_method,
        idempotency_key, client_ip_hash, created_at, updated_at
      ) VALUES (
        v_order_id, v_code, v_name, v_phone, p_delivery_zone, v_district,
        v_address, v_note, (v_quote ->> 'subtotal')::numeric, (v_quote ->> 'deliveryCharge')::numeric,
        (v_quote ->> 'discountAmount')::numeric, v_quote ->> 'couponCode',
        0, v_total, 0, v_total, (v_quote ->> 'payableNow')::numeric,
        p_payment_method, p_payment_plan, 'pending', 'pending', (v_quote ->> 'hasPreorder')::boolean, v_quote -> 'items',
        v_score, v_suspicious, to_jsonb(v_reasons), false, 'unverified',
        v_idem, p_client_ip_hash, v_now, v_now
      );
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;

  INSERT INTO public.order_items (
    id, order_id, product_id, variant_id, product_title, product_title_bn, product_image,
    variant_label, cutting_preference, is_preorder, quantity, unit_price, line_total
  )
  SELECT 'item-' || replace(gen_random_uuid()::text, '-', ''), v_order_id,
         e ->> 'productId', e ->> 'variantId', e ->> 'productTitle', e ->> 'productTitleBn',
         e ->> 'productImage', e ->> 'variantLabel', nullif(e ->> 'cuttingPreference', ''),
         (e ->> 'isPreorder')::boolean, (e ->> 'quantity')::integer,
         (e ->> 'unitPrice')::numeric, (e ->> 'lineTotal')::numeric
    FROM jsonb_array_elements(v_quote -> 'items') AS e;

  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  RETURN public._sb_order_summary(v_order) || jsonb_build_object(
    'idempotent', false,
    'reviewReasons', to_jsonb(v_reasons),
    'fraudRiskScore', v_score
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Order tracking. Requires BOTH the (unguessable) order code AND the last 4 phone digits;
-- a wrong guess is indistinguishable from "not found". Returns masked, minimal data.
-- -----------------------------------------------------------------------------
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
    'orderCode',        v_order.order_code,
    'createdAt',        v_order.created_at,
    'updatedAt',        v_order.updated_at,
    'orderStatus',      v_order.order_status,
    'paymentStatus',    v_order.payment_status,
    'paymentMethod',    v_order.payment_method,
    'paymentPlan',      v_order.payment_plan,
    'latestPaymentAttempt', v_attempt,
    'deliveryZone',     v_order.delivery_zone,
    'customerDistrict', v_order.customer_district,
    'customerName',     split_part(v_order.customer_name, ' ', 1),
    'maskedPhone',      left(v_order.customer_phone, 5) || '-****' || right(v_order.customer_phone, 2),
    'maskedAddress',    split_part(v_order.customer_address, ' ', 1) || ' ***, ' || v_order.customer_district,
    'subtotal',         v_order.subtotal,
    'deliveryCharge',   v_order.delivery_charge,
    'discountAmount',   v_order.discount_amount,
    'weightAdjustmentAmount', v_order.weight_adjustment_amount,
    'weightAdjustmentNote',   v_order.weight_adjustment_note,
    'totalAmount',      v_order.total_amount,
    'advancePaid',      v_order.advance_paid,
    'dueAmount',        v_order.due_amount,
    'hasPreorderItems', v_order.has_preorder_items,
    'courierName',      v_order.courier_name,
    'trackingReference', v_order.tracking_reference,
    'riderName',        v_order.rider_name,
    'riderPhone',       v_order.rider_phone,
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

-- -----------------------------------------------------------------------------
-- Cancellation (restores inventory + coupon usage). Refuses paid / shipped orders.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sb_cancel_order(p_order_id text, p_reason text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  r       record;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  IF v_order.order_status = 'cancelled' THEN RETURN jsonb_build_object('ok', true, 'idempotent', true); END IF;
  IF v_order.order_status IN ('shipped', 'delivered') THEN
    PERFORM public.sb_fail('Shipped or delivered orders cannot be cancelled');
  END IF;
  IF v_order.advance_paid > 0 THEN
    PERFORM public.sb_fail('This order has received payment. Refund it first, then cancel it.');
  END IF;

  FOR r IN SELECT i.variant_id, i.product_id, i.quantity, i.is_preorder
             FROM public.order_items i WHERE i.order_id = p_order_id LOOP
    IF r.is_preorder THEN
      UPDATE public.products SET batch_booked_qty = greatest(0, batch_booked_qty - r.quantity), updated_at = now()
       WHERE id = r.product_id;
    ELSE
      UPDATE public.product_variants SET stock_qty = stock_qty + r.quantity WHERE id = r.variant_id;
    END IF;
  END LOOP;

  IF v_order.coupon_code IS NOT NULL THEN
    UPDATE public.coupons SET usage_count = greatest(0, usage_count - 1) WHERE upper(code) = upper(v_order.coupon_code);
  END IF;

  UPDATE public.payment_attempts
     SET status = 'cancelled', failure_reason = coalesce(p_reason, 'order cancelled'), updated_at = now()
   WHERE order_id = p_order_id AND status IN ('created', 'redirected');

  UPDATE public.orders SET order_status = 'cancelled', updated_at = now() WHERE id = p_order_id;
  PERFORM public._sb_audit(p_actor, 'order.cancel', p_order_id, jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('ok', true, 'orderCode', v_order.order_code);
END;
$$;

-- Sweeper: cancels online orders whose payment was never completed, releasing stock.
-- Schedule with pg_cron, e.g.:  select cron.schedule('expire-unpaid', '*/15 * * * *', $$select public.expire_unpaid_online_orders(120)$$);
CREATE OR REPLACE FUNCTION public.expire_unpaid_online_orders(p_minutes integer DEFAULT 120)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  IF p_minutes < 30 THEN PERFORM public.sb_fail('p_minutes must be at least 30'); END IF;
  FOR r IN
    SELECT o.id FROM public.orders o
     WHERE o.payment_method IN ('bkash', 'nagad')
       AND o.payment_status = 'pending' AND o.order_status = 'pending' AND o.advance_paid = 0
       AND o.created_at < now() - make_interval(mins => p_minutes)
       AND NOT EXISTS (
         SELECT 1 FROM public.payment_attempts a
          WHERE a.order_id = o.id
            AND (a.status IN ('executing', 'needs_review')
                 OR (a.status IN ('created', 'redirected') AND a.created_at > now() - interval '45 minutes')))
  LOOP
    PERFORM public._sb_cancel_order(r.id, 'Expired: online payment was not completed', NULL);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- -----------------------------------------------------------------------------
-- Verified-purchase review (replaces the anonymous INSERT policy)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_review_server(
  p_order_code text, p_phone_last4 text, p_product_id text, p_rating integer, p_comment text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order   public.orders;
  v_comment text := public.sb_clean_text(p_comment);
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN PERFORM public.sb_fail('Rating must be between 1 and 5'); END IF;
  IF length(v_comment) < 5 OR length(v_comment) > 1000 THEN PERFORM public.sb_fail('Review must be 5 to 1000 characters'); END IF;
  IF coalesce(p_phone_last4, '') !~ '^[0-9]{4}$' THEN PERFORM public.sb_fail('Order not found'); END IF;

  SELECT * INTO v_order FROM public.orders
   WHERE upper(order_code) = upper(btrim(coalesce(p_order_code, ''))) AND right(customer_phone, 4) = p_phone_last4;
  IF NOT FOUND THEN PERFORM public.sb_fail('Order not found'); END IF;
  IF v_order.order_status <> 'delivered' THEN PERFORM public.sb_fail('You can review a product after your order is delivered'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order.id AND product_id = p_product_id) THEN
    PERFORM public.sb_fail('This product is not part of that order');
  END IF;

  BEGIN
    INSERT INTO public.product_reviews (id, product_id, order_code, customer_name, customer_district, rating, comment, is_verified_purchase)
    VALUES ('rev-' || replace(gen_random_uuid()::text, '-', ''), p_product_id, v_order.order_code,
            split_part(v_order.customer_name, ' ', 1), v_order.customer_district, p_rating, v_comment, true);
  EXCEPTION WHEN unique_violation THEN
    PERFORM public.sb_fail('You have already reviewed this product for this order');
  END;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMIT;
