# Security rotation & go-live checklist (Phase 0)

Do these **before** the first real payment. Tick each box.

## A. Treat these as compromised and replace
- [ ] **Admin passkeys** (`2026` and `SadyerBazar@2026!`) and the salt `sadyer_bazar_sec_salt_2026_9x8k`
  were shipped in the public JS bundle and in `hardened_security_rls.sql`. They are retired by the
  migration (the hash-based admin RPCs are dropped). Never reuse these strings anywhere.
- [ ] **Supabase service-role key** — rotate it in *Project Settings → API* if it was ever pasted into chat,
  a ticket, a screenshot, a `.env` committed to git, or a build log. Then store the new key only as a
  Cloudflare Pages **secret**.
- [ ] **bKash / Nagad credentials** — if they were ever shared in plain text, ask the gateway to reset them.
- [ ] **Git history** — the old SQL files with the admin hashes are in history. Rotating (above) is what
  matters; rewriting history is optional.

## B. Supabase dashboard settings
- [ ] *Authentication → Providers → Email*: **disable "Allow new users to sign up"**
  (admins are created by you, then added to `public.admins`).
- [ ] *Authentication → Policies*: minimum password length 12; enable leaked-password protection if available.
- [ ] *Authentication → URL configuration*: Site URL = production domain only.
- [ ] *Database → Backups*: confirm daily backups (or PITR) are on.
- [ ] Run `supabase/audit/00_live_db_audit.sql` **before** and `supabase/verify/post_migration_checks.sql` **after** the migration.

## C. Cloudflare Pages
- [ ] Project is a **Pages** project (Git integration or `wrangler pages deploy out`), not a Workers+assets project.
- [ ] Secrets set with `wrangler pages secret put <NAME> --project-name sadyer-bazar` (or dashboard → Settings →
  Variables and Secrets → *Encrypt*):
  `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SALT`, `TURNSTILE_SECRET_KEY`, `BKASH_APP_KEY`, `BKASH_APP_SECRET`,
  `BKASH_USERNAME`, `BKASH_PASSWORD`, `NAGAD_MERCHANT_ID`, `NAGAD_PUBLIC_KEY`, `NAGAD_PRIVATE_KEY`.
- [ ] **No secret has a `NEXT_PUBLIC_` prefix.** Only these are public: `NEXT_PUBLIC_SITE_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- [ ] Production has `APP_ENV=production` and `PAYMENT_MODE=live` (set in `wrangler.toml`, already done).
  Sandbox credentials must only exist in **Preview**.
- [ ] Cloudflare WAF: enable *Bot Fight Mode*; add a rate-limiting rule for `/api/*` (defense in depth on top of ours).
- [ ] Custom domain forces HTTPS; HSTS is sent from `public/_headers`.

## D. Gateways
- [ ] bKash merchant: whitelist the production callback host `https://sadhyerbazar.com/api/payment/bkash/callback`.
- [ ] Nagad merchant: register the production callback host and upload/confirm the merchant public key.
- [ ] Run one sandbox end-to-end in **Preview** for each gateway before switching credentials to live.
