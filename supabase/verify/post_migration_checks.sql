-- =============================================================================
-- POST-MIGRATION ATTACK TESTS  (safe: everything runs inside a transaction that is ROLLED BACK)
-- Run in Supabase SQL Editor AFTER migrations 01-05. Returns one grid: test | outcome | verdict.
-- Every row must say PASS. Any FAIL = something is still exposed: send me that row.
-- =============================================================================
BEGIN;

CREATE TEMP TABLE attack_results (test text, outcome text, verdict text) ON COMMIT DROP;

DO $$
DECLARE
  t       record;
  v_out   text;
  v_state text;
  v_rows  bigint;
  v_ok    boolean;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      -- name,                                         role,            sql,                                                                                     expectation
      ('anon  UPDATE orders.payment_status',           'anon',          'UPDATE public.orders SET payment_status = ''paid''',                                      'deny'),
      ('anon  UPDATE orders.total_amount',             'anon',          'UPDATE public.orders SET total_amount = 0',                                               'deny'),
      ('anon  UPDATE orders.order_status',             'anon',          'UPDATE public.orders SET order_status = ''delivered''',                                   'deny'),
      ('anon  INSERT orders',                          'anon',          'INSERT INTO public.orders (id) VALUES (''x'')',                                           'deny'),
      ('anon  DELETE orders',                          'anon',          'DELETE FROM public.orders',                                                               'deny'),
      ('anon  SELECT orders',                          'anon',          'SELECT * FROM public.orders',                                                             'deny'),
      ('anon  SELECT order_items',                     'anon',          'SELECT * FROM public.order_items',                                                        'deny'),
      ('anon  INSERT payment_transactions',            'anon',          'INSERT INTO public.payment_transactions (id) VALUES (''x'')',                             'deny'),
      ('anon  SELECT payment_transactions',            'anon',          'SELECT * FROM public.payment_transactions',                                               'deny'),
      ('anon  INSERT payment_attempts',                'anon',          'INSERT INTO public.payment_attempts (order_id) VALUES (''x'')',                           'deny'),
      ('anon  INSERT processed_webhook_events',        'anon',          'INSERT INTO public.processed_webhook_events (gateway) VALUES (''bkash'')',                'deny'),
      ('anon  SELECT payment_gateway_tokens',          'anon',          'SELECT * FROM public.payment_gateway_tokens',                                             'deny'),
      ('anon  SELECT coupons (code enumeration)',      'anon',          'SELECT * FROM public.coupons',                                                            'deny'),
      ('anon  SELECT site_settings.bkash_app_key',     'anon',          'SELECT bkash_app_key FROM public.site_settings',                                          'deny'),
      ('anon  SELECT admins',                          'anon',          'SELECT * FROM public.admins',                                                             'deny'),
      ('anon  UPDATE products (price tamper)',         'anon',          'UPDATE public.products SET title = ''x''',                                                'deny'),
      ('anon  UPDATE product_variants.price',          'anon',          'UPDATE public.product_variants SET price = 1',                                            'deny'),
      ('anon  INSERT product_reviews (fake review)',   'anon',          'INSERT INTO public.product_reviews (id) VALUES (''x'')',                                  'deny'),
      ('anon  contact_messages: spoof status=replied', 'anon',          'INSERT INTO public.contact_messages (id,name,phone,subject,message,status) VALUES (''t'',''Test User'',''01712345678'',''hi'',''hello world'',''replied'')', 'deny'),
      ('anon  POSITIVE: read safe site_settings',      'anon',          'SELECT inside_dhaka_fee FROM public.site_settings',                                       'allow'),
      ('anon  POSITIVE: read active products',         'anon',          'SELECT id FROM public.products WHERE is_active LIMIT 1',                                  'allow'),
      ('anon  POSITIVE: contact form insert',          'anon',          'INSERT INTO public.contact_messages (id,name,phone,subject,message) VALUES (''t-attack-test'',''Test User'',''01712345678'',''hi'',''hello world'')', 'allow'),
      ('authN non-admin SELECT orders',                'authenticated', 'SELECT * FROM public.orders',                                                             'zero'),
      ('authN non-admin UPDATE orders',                'authenticated', 'UPDATE public.orders SET payment_status = ''paid''',                                      'deny'),
      ('authN non-admin SELECT payment_attempts',      'authenticated', 'SELECT * FROM public.payment_attempts',                                                   'zero'),
      ('authN non-admin SELECT coupons',               'authenticated', 'SELECT * FROM public.coupons',                                                            'zero'),
      ('authN non-admin UPDATE products',              'authenticated', 'UPDATE public.products SET title = ''hack''',                                             'zero'),
      ('authN non-admin INSERT coupons',               'authenticated', 'INSERT INTO public.coupons (id,code,title,discount_type,discount_value) VALUES (''x'',''X'',''x'',''flat'',1)', 'deny'),
      ('authN non-admin INSERT admins (self-promote)', 'authenticated', 'INSERT INTO public.admins (user_id) VALUES (gen_random_uuid())',                          'deny'),
      ('authN non-admin SELECT bkash_app_key',         'authenticated', 'SELECT bkash_app_key FROM public.site_settings',                                          'deny'),
      ('anon  UPDATE hero_slides (deface homepage)',   'anon',          'UPDATE public.hero_slides SET title = ''hacked''',                                        'deny'),
      ('anon  INSERT hero_slides',                     'anon',          'INSERT INTO public.hero_slides (image_url, title) VALUES (''/images/x.jpg'', ''x'')',     'deny'),
      ('anon  DELETE hero_slides',                     'anon',          'DELETE FROM public.hero_slides',                                                          'deny'),
      ('anon  UPDATE hero_settings',                   'anon',          'UPDATE public.hero_settings SET headline = ''hacked''',                                   'deny'),
      ('authN non-admin UPDATE hero_slides',           'authenticated', 'UPDATE public.hero_slides SET title = ''hacked''',                                        'deny'),
      ('authN non-admin DELETE hero_slides',           'authenticated', 'DELETE FROM public.hero_slides',                                                          'deny'),
      ('anon  POSITIVE: read visible hero slides',     'anon',          'SELECT id FROM public.hero_slides LIMIT 1',                                               'allow'),
      ('anon  POSITIVE: read hero settings',           'anon',          'SELECT headline FROM public.hero_settings',                                               'allow')
    ) AS x(name, role, stmt, expect)
  LOOP
    v_out := NULL; v_state := NULL; v_rows := NULL;
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I', t.role);
      PERFORM set_config('request.jwt.claims',
        CASE t.role WHEN 'anon' THEN '{"role":"anon"}'
                    ELSE '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}' END, true);
      EXECUTE t.stmt;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RESET ROLE;
      v_out := format('ALLOWED (%s rows)', v_rows);
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
      v_out := format('DENIED (%s)', v_state);
    END;
    RESET ROLE;

    v_ok := CASE t.expect
              WHEN 'deny'  THEN v_out LIKE 'DENIED%'
              WHEN 'zero'  THEN v_out = 'ALLOWED (0 rows)'
              WHEN 'allow' THEN v_out LIKE 'ALLOWED%'
              ELSE false END;
    INSERT INTO attack_results VALUES (t.name, v_out, CASE WHEN v_ok THEN 'PASS' ELSE 'FAIL' END);
  END LOOP;
END $$;

-- Structural checks (independent of function signatures) ---------------------------------------
INSERT INTO attack_results
SELECT 'function callable by API role: ' || p.oid::regprocedure::text,
       'EXECUTE granted to ' || string_agg(r.rolname, ','),
       CASE WHEN p.proname = 'is_admin' AND string_agg(r.rolname, ',') = 'authenticated' THEN 'PASS' ELSE 'FAIL' END
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
  AND r.rolname IN ('anon', 'authenticated')
  AND has_function_privilege(r.oid, p.oid, 'EXECUTE')
GROUP BY p.oid, p.proname;

INSERT INTO attack_results
SELECT 'no function is callable by anon/authenticated (except is_admin)',
       'none exposed',
       'PASS'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc p CROSS JOIN pg_roles r
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f' AND p.proname <> 'is_admin'
    AND r.rolname IN ('anon', 'authenticated') AND has_function_privilege(r.oid, p.oid, 'EXECUTE'));

INSERT INTO attack_results
SELECT 'legacy RPCs removed', coalesce(string_agg(proname, ','), 'none present'),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('get_admin_orders', 'get_admin_messages', 'get_order_by_code',
                  'get_order_items_by_order_id', 'verify_and_record_payment', 'create_secure_order');

INSERT INTO attack_results
SELECT 'write-guard trigger on ' || c.relname,
       CASE WHEN g.tgname IS NULL THEN 'MISSING' ELSE 'present' END,
       CASE WHEN g.tgname IS NULL THEN 'FAIL' ELSE 'PASS' END
FROM pg_class c
LEFT JOIN pg_trigger g ON g.tgrelid = c.oid AND g.tgname = 'trg_forbid_api_writes' AND NOT g.tgisinternal
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('orders', 'order_items', 'payment_transactions', 'payment_attempts', 'processed_webhook_events', 'hero_slides', 'hero_settings');

INSERT INTO attack_results
SELECT 'RLS enabled on ' || c.relname,
       CASE WHEN c.relrowsecurity THEN 'enabled' ELSE 'DISABLED' END,
       CASE WHEN c.relrowsecurity THEN 'PASS' ELSE 'FAIL' END
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r';

INSERT INTO attack_results
SELECT 'replay guard: unique (gateway, transaction_id) on processed_webhook_events',
       CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_pwe_gateway_trx') THEN 'present' ELSE 'MISSING' END,
       CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_pwe_gateway_trx') THEN 'PASS' ELSE 'FAIL' END;

SELECT * FROM attack_results ORDER BY (verdict = 'PASS'), test;

ROLLBACK;
