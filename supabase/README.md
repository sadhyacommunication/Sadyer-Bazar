# Supabase database -- how to apply the hardening

## Files

| File | What it is |
|---|---|
| `schema.sql` | **Baseline tables only.** Apply once on a fresh project. Its legacy policies/functions are removed by migration 05. |
| `audit/00_live_db_audit.sql` | Read-only report of your *current* live DB. Run it **before** migrating. |
| `migrations/..._01_foundation.sql` | Helpers, `admins`, `payment_attempts`, rate limits, audit tables, constraints, write-guard triggers |
| `migrations/..._02_orders.sql` | Server-side pricing, `create_order_server`, tracking, cancel, reviews |
| `migrations/..._03_payments.sql` | Payment attempt lifecycle + `finalize_payment_attempt` (replay/amount/order binding) |
| `migrations/..._04_admin_ops.sql` | Audited admin operations (service role only) |
| `migrations/..._05_rls_lockdown.sql` | RLS policies + grants. **Run last.** Drops legacy insecure RPCs |
| `verify/post_migration_checks.sql` | Attack tests as `anon` / non-admin. Everything must say PASS. Rolls itself back. |
| `hardened_security_rls.sql` | **Deprecated** (emptied: it contained the leaked admin hashes) |

## Procedure (Supabase Dashboard -> SQL Editor, in this order)
1. `audit/00_live_db_audit.sql` -> keep the output; investigate every `!!` row (especially sections 6-8:
   *validated* transactions with no gateway record and paid orders without a payment).
2. Take a backup (Database -> Backups) or run `pg_dump`.
3. Run migrations `01` -> `02` -> `03` -> `04` -> `05`, each as a whole file. They are idempotent.
4. `verify/post_migration_checks.sql` -> all rows PASS.
5. Auth -> Providers -> Email: **disable sign-ups**. Create your admin user (Auth -> Users), then:
   ```sql
   INSERT INTO public.admins (user_id, email)
   SELECT id, email FROM auth.users WHERE email = 'you@example.com';
   ```
6. Optional but recommended (pg_cron enabled):
   ```sql
   select cron.schedule('expire-unpaid-orders',   '*/15 * * * *', $$select public.expire_unpaid_online_orders(120)$$);
   select cron.schedule('expire-stale-attempts',  '*/10 * * * *', $$select public.expire_stale_payment_attempts()$$);
   ```

## Behaviour changes the frontend must follow (Phase 3-4 work)
* `anon` / `authenticated` can no longer call **any** RPC (except `is_admin()`), nor read `orders`, `coupons`, `payment_*`.
  The browser talks to `/api/*` only: orders/create, orders/quote, orders/track, payments, coupons, reviews.
* `site_settings`: `select('*')` is denied (gateway columns are hidden). Select the safe columns explicitly.
* `contact_messages`: use `.insert()` (no `.upsert()`, no read-back).
* Order codes are now `SB-YYMM-` + **10** chars. Update client regexes (`/^SB-\d{4}-[A-Z0-9]{5}$/`).
* New orders accept `bkash`, `nagad`, `cod` only (SSLCommerz is disabled).
* Admin console signs in with Supabase Auth; order/payment changes go through `/api/admin/*` (service role).

## Local verification without a database
`npm run test:db` boots an in-process PostgreSQL (PGlite), simulates Supabase roles/`auth.uid()`, applies
`schema.sql` + all migrations (twice, to prove idempotency), runs the attack script and ~60 functional
checks (pricing, stock, coupons, replay, wrong amount, cross-order payment, admin rules...).
