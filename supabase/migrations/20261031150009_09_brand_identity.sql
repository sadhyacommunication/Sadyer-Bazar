-- =============================================================================
-- MIGRATION 09/09 -- BRAND IDENTITY, COMPANY LOGO, NAME & SLOGAN CMS
--
-- What this adds:
--   * brand_name_en: English brand name (e.g. 'Sadhyer Bazar')
--   * brand_name_bn: Bengali brand name (e.g. 'সাধ্যের বাজার')
--   * slogan_en: English slogan (e.g. 'Village Freshness in the City, at Your Home')
--   * slogan_bn: Bengali slogan (e.g. 'গ্রামের পণ্য শহরে, আপনার ঘরে')
--   * logo_url: Direct URL or WebP/PNG data URL of the company logo
--   * logo_mode: 'custom' (renders logo_url image) or 'badge' (renders iconic circular badge)
--   * favicon_url: Optional custom browser favicon URL
--
-- Column-level grants:
--   * anon, authenticated: SELECT on all new brand columns
--   * authenticated (admins): INSERT, UPDATE on all new brand columns
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Add Brand Identity columns to public.site_settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS brand_name_en TEXT DEFAULT 'Sadhyer Bazar',
  ADD COLUMN IF NOT EXISTS brand_name_bn TEXT DEFAULT 'সাধ্যের বাজার',
  ADD COLUMN IF NOT EXISTS slogan_en TEXT DEFAULT 'Village Freshness in the City, at Your Home',
  ADD COLUMN IF NOT EXISTS slogan_bn TEXT DEFAULT 'গ্রামের পণ্য শহরে, আপনার ঘরে',
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_mode TEXT DEFAULT 'badge',
  ADD COLUMN IF NOT EXISTS favicon_url TEXT DEFAULT '';

-- 2. Grant column-level access to API roles (matching zero-client-trust policy in Migration 05)
GRANT SELECT (
  brand_name_en,
  brand_name_bn,
  slogan_en,
  slogan_bn,
  logo_url,
  logo_mode,
  favicon_url
) ON public.site_settings TO anon, authenticated;

GRANT INSERT (
  brand_name_en,
  brand_name_bn,
  slogan_en,
  slogan_bn,
  logo_url,
  logo_mode,
  favicon_url
) ON public.site_settings TO authenticated;

GRANT UPDATE (
  brand_name_en,
  brand_name_bn,
  slogan_en,
  slogan_bn,
  logo_url,
  logo_mode,
  favicon_url
) ON public.site_settings TO authenticated;

-- 3. Set default values on existing row if empty/null
UPDATE public.site_settings
SET
  brand_name_en = COALESCE(NULLIF(brand_name_en, ''), 'Sadhyer Bazar'),
  brand_name_bn = COALESCE(NULLIF(brand_name_bn, ''), 'সাধ্যের বাজার'),
  slogan_en = COALESCE(NULLIF(slogan_en, ''), 'Village Freshness in the City, at Your Home'),
  slogan_bn = COALESCE(NULLIF(slogan_bn, ''), 'গ্রামের পণ্য শহরে, আপনার ঘরে'),
  logo_mode = COALESCE(NULLIF(logo_mode, ''), 'badge')
WHERE id = 1;

COMMIT;
