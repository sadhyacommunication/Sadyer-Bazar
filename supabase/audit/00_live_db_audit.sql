-- =============================================================================
-- PHASE 0 -- LIVE DATABASE AUDIT  (READ-ONLY: this script changes nothing)
-- Run in: Supabase Dashboard -> SQL Editor.  Paste the whole file and click RUN.
-- Prerequisite: supabase/schema.sql has been applied (tables exist).
--
-- Returns ONE result grid: section | item | detail.
-- Anything marked '!!' needs attention. Send me the '!!' rows (never any keys).
-- =============================================================================
WITH
rls AS (
  SELECT '1 RLS'::text AS section,
         c.relname::text AS item,
         (CASE WHEN c.relrowsecurity THEN 'enabled' ELSE '!! RLS DISABLED' END)::text AS detail
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),
pol AS (
  SELECT '2 POLICY'::text,
         (tablename || '.' || policyname)::text,
         format('cmd=%s roles=%s using=[%s] check=[%s]',
                cmd, roles, coalesce(qual, '-'), coalesce(with_check, '-'))::text
  FROM pg_policies
  WHERE schemaname = 'public'
),
tbl_grants AS (
  SELECT '3 TABLE GRANT to anon/authenticated'::text,
         (table_name || ' -> ' || grantee)::text,
         string_agg(privilege_type, ',' ORDER BY privilege_type)::text
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
  GROUP BY table_name, grantee
),
fn_exec AS (
  SELECT '4 FUNCTION callable by anon/authenticated'::text,
         p.oid::regprocedure::text,
         ('!! ' || string_agg(r.rolname, ','))::text
  FROM pg_proc p
  CROSS JOIN pg_roles r
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.prokind = 'f'
    AND r.rolname IN ('anon', 'authenticated')
    AND has_function_privilege(r.oid, p.oid, 'EXECUTE')
  GROUP BY p.oid
),
legacy_fn AS (
  SELECT '5 LEGACY INSECURE RPC STILL PRESENT'::text,
         p.oid::regprocedure::text,
         '!! must be removed (hash-based admin / anon order dump / unverified payment)'::text
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN ('get_admin_orders', 'get_admin_messages', 'get_order_by_code',
                      'get_order_items_by_order_id', 'verify_and_record_payment',
                      'create_secure_order', 'admin_verify_cod_phone')
),
suspect_tx AS (
  SELECT '6 SUSPECT validated tx (no gateway ledger record)'::text,
         (pt.order_code || ' / ' || pt.gateway || ' / ' || pt.transaction_id)::text,
         '!! status=validated but no processed_webhook_events row -> possibly inserted by an anonymous client'::text
  FROM public.payment_transactions pt
  WHERE pt.status = 'validated'
    AND NOT EXISTS (
      SELECT 1 FROM public.processed_webhook_events e
      WHERE e.gateway = pt.gateway AND e.transaction_id = pt.transaction_id
    )
),
paid_without_tx AS (
  SELECT '7 ORDER marked paid without validated tx'::text,
         o.order_code::text,
         format('!! payment_status=%s advance_paid=%s total=%s', o.payment_status, o.advance_paid, o.total_amount)::text
  FROM public.orders o
  WHERE o.payment_status IN ('paid', 'advance_paid')
    AND o.payment_method <> 'cod'
    AND NOT EXISTS (
      SELECT 1 FROM public.payment_transactions pt
      WHERE pt.order_id = o.id AND pt.status = 'validated'
    )
),
dup_trx AS (
  SELECT '8 DUPLICATE validated trxID'::text,
         (gateway || ' / ' || transaction_id)::text,
         ('!! used ' || count(*) || ' times')::text
  FROM public.payment_transactions
  WHERE status = 'validated'
  GROUP BY gateway, transaction_id
  HAVING count(*) > 1
),
bad_totals AS (
  SELECT '9 ORDER total does not match subtotal-discount+delivery(+weight adj)'::text,
         o.order_code::text,
         format('!! total=%s expected=%s', o.total_amount,
                greatest(0, o.subtotal - o.discount_amount + o.delivery_charge + coalesce(o.weight_adjustment_amount, 0)))::text
  FROM public.orders o
  WHERE o.total_amount <> greatest(0, o.subtotal - o.discount_amount + o.delivery_charge + coalesce(o.weight_adjustment_amount, 0))
),
secret_cols AS (
  SELECT '10 SENSITIVE COLUMN in public table'::text,
         (table_name || '.' || column_name)::text,
         '!! must never hold a secret; confirm it is empty or non-secret'::text
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (column_name ILIKE '%secret%' OR column_name ILIKE '%password%' OR column_name ILIKE '%private%')
),
summary AS (
  SELECT '0 SUMMARY'::text, 'orders'::text, count(*)::text FROM public.orders
  UNION ALL SELECT '0 SUMMARY', 'orders paid/advance_paid', count(*)::text
            FROM public.orders WHERE payment_status IN ('paid', 'advance_paid')
  UNION ALL SELECT '0 SUMMARY', 'orders using legacy sslcommerz', count(*)::text
            FROM public.orders WHERE payment_method = 'sslcommerz'
  UNION ALL SELECT '0 SUMMARY', 'payment_transactions', count(*)::text FROM public.payment_transactions
)
SELECT * FROM (
  SELECT * FROM summary
  UNION ALL SELECT * FROM rls
  UNION ALL SELECT * FROM pol
  UNION ALL SELECT * FROM tbl_grants
  UNION ALL SELECT * FROM fn_exec
  UNION ALL SELECT * FROM legacy_fn
  UNION ALL SELECT * FROM suspect_tx
  UNION ALL SELECT * FROM paid_without_tx
  UNION ALL SELECT * FROM dup_trx
  UNION ALL SELECT * FROM bad_totals
  UNION ALL SELECT * FROM secret_cols
) all_rows
ORDER BY section, item;
