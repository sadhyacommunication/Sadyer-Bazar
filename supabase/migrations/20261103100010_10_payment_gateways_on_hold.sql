-- =============================================================================
-- MIGRATION 10/10 -- KEEP ONLINE PAYMENT GATEWAYS ON HOLD (COD ONLY ACTIVE)
--
-- What this does:
--   * Updates public.site_settings:
--     - bkash_enabled = false (on hold as per client request)
--     - nagad_enabled = false (on hold as per client request)
--     - cod_enabled = true (Cash on Delivery is the sole active method)
--   * Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

UPDATE public.site_settings
SET
  bkash_enabled = false,
  nagad_enabled = false,
  cod_enabled = true,
  updated_at = now()
WHERE id = 1;

COMMIT;
