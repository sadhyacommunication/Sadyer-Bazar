-- =============================================================================
-- MIGRATION 08/08 -- CONTACT MESSAGES RESILIENCE & DEFAULT IDENTIFIERS (run AFTER 07)
--
-- What this adds:
--   * Ensures public.contact_messages.id has a safe DEFAULT UUID expression so that
--     any client or public inquiry insertion without an explicit id never violates not-null.
--   * Maintains strict Zero-Client-Trust: direct writes to orders and order_items
--     remain restricted exclusively to audited service functions (migrations 02-04).
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Ensure contact_messages id has a default UUID expression
ALTER TABLE public.contact_messages
  ALTER COLUMN id SET DEFAULT ('msg_' || replace(gen_random_uuid()::text, '-', ''));

COMMIT;
