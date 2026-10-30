-- =============================================================================
-- MIGRATION 06/06 -- HERO BANNER CMS  (run AFTER 05)
--
-- What this adds
--   * public.hero_slides    : the home-page slider (image, badge, title, subtitle, CTA, schedule...)
--   * public.hero_settings  : hero headline / sub-headline / trust highlights / slider behaviour
--   * Storage bucket `site-media` (public read, admin-only write, 3 MB, images only)
--   * Audited admin functions (service_role ONLY) -- the browser can never write these tables:
--       admin_hero_save_slide / admin_hero_delete_slide / admin_hero_reorder /
--       admin_hero_set_active / admin_hero_save_settings / admin_hero_reset_defaults
--
-- Security model (same as the order/payment tables)
--   * anon / authenticated : SELECT only (visible slides for the public, everything for admins).
--   * Writes : only via the SQL functions below, called by /api/admin/action after the edge layer
--              verified the admin's Supabase JWT + public.admins membership. Every call is audited.
--   * Defense in depth : CHECK constraints on every column (URL / link allow-lists, lengths),
--              write-guard triggers, strict input validation inside the functions.
--
-- NOTE: migration 05 revokes grants on every public table. If you ever re-run 05, re-run 06 after it.
-- Safe to re-run (idempotent). Run as the `postgres` role (Supabase SQL Editor does this).
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Validators (IMMUTABLE so they can be used in CHECK constraints)
-- -----------------------------------------------------------------------------

-- Slide images: a built-in site asset (/images/...) or a file in OUR public `site-media` bucket.
CREATE OR REPLACE FUNCTION public.sb_hero_valid_image(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NOT NULL
     AND length(p) <= 600
     AND position('..' IN p) = 0
     AND (
          p ~ '^/images/[A-Za-z0-9._/-]+$'
       OR p ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/storage/v1/object/public/site-media/[A-Za-z0-9._/-]+$'
     )
$$;

-- Button links: '' (no button), an on-site path, or an https URL. Never javascript:, data:, //evil.com ...
CREATE OR REPLACE FUNCTION public.sb_hero_valid_link(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NOT NULL
     AND length(p) <= 300
     AND (
          p = ''
       OR (p ~ '^/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*$' AND p !~ '^//')
       OR p ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*)?$'
     )
$$;

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hero_slides (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order     integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  image_url      text NOT NULL CHECK (public.sb_hero_valid_image(image_url)),
  image_alt      text NOT NULL DEFAULT '' CHECK (char_length(image_alt) <= 200),
  image_position text NOT NULL DEFAULT 'center' CHECK (image_position IN ('center', 'top', 'bottom', 'left', 'right')),
  badge_text     text NOT NULL DEFAULT '' CHECK (char_length(badge_text) <= 60),
  badge_icon     text NOT NULL DEFAULT 'sparkles'
                 CHECK (badge_icon IN ('fish', 'award', 'flame', 'wheat', 'leaf', 'sparkles', 'truck', 'shield',
                                       'clock', 'star', 'heart', 'gift', 'phone')),
  title          text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  subtitle       text NOT NULL DEFAULT '' CHECK (char_length(subtitle) <= 220),
  cta_text       text NOT NULL DEFAULT '' CHECK (char_length(cta_text) <= 40),
  cta_link       text NOT NULL DEFAULT '' CHECK (public.sb_hero_valid_link(cta_link)),
  starts_at      timestamptz,
  ends_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hero_slides_cta_pair_chk CHECK (cta_text = '' OR cta_link <> ''),
  CONSTRAINT hero_slides_schedule_chk CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_hero_slides_order ON public.hero_slides (sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.hero_settings (
  id               integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  show_headline    boolean NOT NULL DEFAULT true,
  headline         text NOT NULL DEFAULT '' CHECK (char_length(headline) <= 160),
  subheadline      text NOT NULL DEFAULT '' CHECK (char_length(subheadline) <= 240),
  show_guarantee   boolean NOT NULL DEFAULT true,
  guarantee_text   text NOT NULL DEFAULT '' CHECK (char_length(guarantee_text) <= 60),
  show_counter     boolean NOT NULL DEFAULT true,
  autoplay         boolean NOT NULL DEFAULT true,
  autoplay_seconds numeric(4, 1) NOT NULL DEFAULT 4.5 CHECK (autoplay_seconds BETWEEN 2 AND 20),
  show_trust_items boolean NOT NULL DEFAULT true,
  trust_items      jsonb NOT NULL DEFAULT '[]'::jsonb
                   CHECK (jsonb_typeof(trust_items) = 'array' AND jsonb_array_length(trust_items) <= 6),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_slides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. Internal helpers (never callable by API roles)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sb_hero_slide_json(s public.hero_slides)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'sortOrder', s.sort_order, 'isActive', s.is_active,
    'imageUrl', s.image_url, 'imageAlt', s.image_alt, 'imagePosition', s.image_position,
    'badgeText', s.badge_text, 'badgeIcon', s.badge_icon,
    'title', s.title, 'subtitle', s.subtitle, 'ctaText', s.cta_text, 'ctaLink', s.cta_link,
    'startsAt', s.starts_at, 'endsAt', s.ends_at, 'updatedAt', s.updated_at)
$$;

-- Returns the storage URL only when it is one of OUR uploads and no slide references it any more
-- (the edge layer then deletes the file so the bucket never fills up with orphans).
CREATE OR REPLACE FUNCTION public._sb_hero_orphan(p_url text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p_url IS NOT NULL
     AND p_url LIKE '%/storage/v1/object/public/site-media/%'
     AND NOT EXISTS (SELECT 1 FROM public.hero_slides WHERE image_url = p_url)
    THEN p_url END
$$;

-- Validate + normalise the trust-highlight list. Fails with a user-safe message.
CREATE OR REPLACE FUNCTION public._sb_hero_clean_trust(p jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_out   jsonb := '[]'::jsonb;
  v_item  jsonb;
  v_icon  text;
  v_title text;
  v_sub   text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN PERFORM public.sb_fail('Highlights must be a list'); END IF;
  IF jsonb_array_length(p) > 6 THEN PERFORM public.sb_fail('You can add at most 6 highlights'); END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN PERFORM public.sb_fail('Invalid highlight'); END IF;
    v_icon  := coalesce(v_item ->> 'icon', '');
    v_title := public.sb_clean_text(v_item ->> 'title');
    v_sub   := public.sb_clean_text(v_item ->> 'subtitle');
    IF v_icon NOT IN ('fish', 'award', 'flame', 'wheat', 'leaf', 'sparkles', 'truck', 'shield',
                      'clock', 'star', 'heart', 'gift', 'phone') THEN
      PERFORM public.sb_fail('Invalid highlight icon');
    END IF;
    IF char_length(v_title) < 1 OR char_length(v_title) > 60 THEN
      PERFORM public.sb_fail('Each highlight needs a title of up to 60 characters');
    END IF;
    IF char_length(v_sub) > 100 THEN PERFORM public.sb_fail('Highlight text can be at most 100 characters'); END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object('icon', v_icon, 'title', v_title, 'subtitle', v_sub));
  END LOOP;
  RETURN v_out;
END;
$$;

-- The original four banners + hero copy. Used by the first-time seed and by "Restore defaults".
CREATE OR REPLACE FUNCTION public._sb_hero_seed_defaults()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.hero_slides;
  INSERT INTO public.hero_slides
    (sort_order, image_url, image_alt, image_position, badge_text, badge_icon, title, subtitle, cta_text, cta_link)
  VALUES
    (1, '/images/banners/hero-jamuna-river-dawn.jpg',
        'যমুনা নদীর ভোরবেলার তাজা মাছ — সাধ্যের বাজার', 'center',
        'যমুনার মোহনা থেকে সরাসরি', 'fish',
        'ভোরবেলা ধরা যমুনার তাজা নদীর মাছ',
        'ফরমালিন ও রাসায়নিকমুক্ত • বরফ ছাড়া নদী থেকে সরাসরি আপনার ঘরে',
        'তাজা মাছ প্রি-অর্ডার করুন', '/pre-orders'),
    (2, '/images/banners/hero-gawa-ghee-bogura-doi.jpg',
        'সিরাজগঞ্জের খাঁটি গাওয়া ঘি ও বগুড়ার শাহী দই — সাধ্যের বাজার', 'center',
        'শতভাগ খাঁটি দুগ্ধজাত ঐতিহ্য', 'award',
        'সিরাজগঞ্জের গাওয়া ঘি ও বগুড়ার শাহী দই',
        'কোনো প্রিজারভেটিভ বা ডালডা ছাড়া ঐতিহ্যবাহী গ্রাম্য মাটির স্বাদ',
        'ঘি ও দই সংগ্রহ করুন', '/shop?category=ghee-and-dairy'),
    (3, '/images/banners/hero-village-deshi-poultry.jpg',
        'গ্রামের মুক্ত চারণভূমির দেশি মুরগি ও হাঁসের ডিম — সাধ্যের বাজার', 'center',
        'উন্মুক্ত চারণভূমির প্রাকৃতিক খামার', 'flame',
        'গ্রামের মুক্ত খামারের দেশি মুরগি ও ডিম',
        'কৃত্রিম ফিড ও অ্যান্টিবায়োটিকমুক্ত স্বাস্থ্যকর প্রাকৃতিক পুষ্টি',
        'দেশি মুরগি ও ডিম দেখুন', '/shop?category=deshi-meat-poultry'),
    (4, '/images/banners/hero-heritage-golden-rice.jpg',
        'দিনাজপুরের কাটারিভোগ ও ঐতিহ্যবাহী লাল চাল — সাধ্যের বাজার', 'center',
        'অকৃত্রিম গ্রাম্য পুষ্টি ও সুবাস', 'wheat',
        'দিনাজপুরের কাটারিভোগ ও সুগন্ধি লাল চাল',
        'পলিশহীন, ফাইবার সমৃদ্ধ ও প্রাচীন জাতের আসল পুষ্টিকর চাল',
        'অর্গানিক চাল কিনুন', '/shop?category=organic-rice-honey');

  INSERT INTO public.hero_settings
    (id, show_headline, headline, subheadline, show_guarantee, guarantee_text, show_counter,
     autoplay, autoplay_seconds, show_trust_items, trust_items, updated_at)
  VALUES
    (1, true,
     'সাধ্যের বাজার — যমুনা নদীর তাজা দেশি মাছ, খাঁটি গাওয়া ঘি ও বগুড়ার দই',
     '১০০% কেমিক্যাল ও ফরমালিনমুক্ত • নদী ও প্রান্তিক খামার থেকে সরাসরি নিজস্ব কোল্ড-চেইনে হোম ডেলিভারি',
     true, '১০০% প্রাকৃতিক ও ফরমালিনমুক্ত', true, true, 4.5, true,
     '[{"icon":"leaf","title":"১০০% ফরমালিনমুক্ত","subtitle":"যমুনা নদী ও গ্রাম্য খামার"},
       {"icon":"truck","title":"থার্মাল হোম ডেলিভারি","subtitle":"ঢাকা ৳{insideDhakaFee} • সারা দেশ ৳{outsideDhakaFee}"},
       {"icon":"shield","title":"নিরাপদ পেমেন্ট","subtitle":"বিকাশ, কার্ড ও ক্যাশ অন ডেলিভারি"},
       {"icon":"clock","title":"লাইভ অর্ডার ট্র্যাকিং","subtitle":"ইউনিক অর্ডার আইডি দিয়ে ট্র্যাক"}]'::jsonb,
     now())
  ON CONFLICT (id) DO UPDATE SET
    show_headline = EXCLUDED.show_headline, headline = EXCLUDED.headline, subheadline = EXCLUDED.subheadline,
    show_guarantee = EXCLUDED.show_guarantee, guarantee_text = EXCLUDED.guarantee_text,
    show_counter = EXCLUDED.show_counter, autoplay = EXCLUDED.autoplay,
    autoplay_seconds = EXCLUDED.autoplay_seconds, show_trust_items = EXCLUDED.show_trust_items,
    trust_items = EXCLUDED.trust_items, updated_at = now();
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Admin operations (service_role only; p_actor = verified admin id, audited)
-- -----------------------------------------------------------------------------

-- Create (no id) or update (id) a slide. New slides are appended at the end.
CREATE OR REPLACE FUNCTION public.admin_hero_save_slide(p_actor uuid, p_slide jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id       uuid;
  v_old      public.hero_slides;
  v_row      public.hero_slides;
  v_image    text;
  v_alt      text;
  v_pos      text;
  v_badge    text;
  v_icon     text;
  v_title    text;
  v_sub      text;
  v_cta      text;
  v_link     text;
  v_active   boolean;
  v_starts   timestamptz;
  v_ends     timestamptz;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_slide IS NULL OR jsonb_typeof(p_slide) <> 'object' THEN PERFORM public.sb_fail('Invalid slide'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('hero_slides'));

  BEGIN
    v_id     := nullif(p_slide ->> 'id', '')::uuid;
    v_starts := nullif(p_slide ->> 'startsAt', '')::timestamptz;
    v_ends   := nullif(p_slide ->> 'endsAt', '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sb_fail('Invalid slide id or schedule date');
  END;

  v_image  := btrim(coalesce(p_slide ->> 'imageUrl', ''));
  v_alt    := public.sb_clean_text(p_slide ->> 'imageAlt');
  v_pos    := coalesce(nullif(p_slide ->> 'imagePosition', ''), 'center');
  v_badge  := public.sb_clean_text(p_slide ->> 'badgeText');
  v_icon   := coalesce(nullif(p_slide ->> 'badgeIcon', ''), 'sparkles');
  v_title  := public.sb_clean_text(p_slide ->> 'title');
  v_sub    := public.sb_clean_text(p_slide ->> 'subtitle');
  v_cta    := public.sb_clean_text(p_slide ->> 'ctaText');
  v_link   := btrim(coalesce(p_slide ->> 'ctaLink', ''));
  v_active := coalesce((p_slide ->> 'isActive')::boolean, true);

  IF NOT public.sb_hero_valid_image(v_image) THEN
    PERFORM public.sb_fail('The slide image must be an uploaded image or a built-in site image');
  END IF;
  IF v_pos NOT IN ('center', 'top', 'bottom', 'left', 'right') THEN PERFORM public.sb_fail('Invalid image position'); END IF;
  IF v_icon NOT IN ('fish', 'award', 'flame', 'wheat', 'leaf', 'sparkles', 'truck', 'shield',
                    'clock', 'star', 'heart', 'gift', 'phone') THEN
    PERFORM public.sb_fail('Invalid badge icon');
  END IF;
  IF char_length(v_title) < 1 OR char_length(v_title) > 120 THEN PERFORM public.sb_fail('Title is required (max 120 characters)'); END IF;
  IF char_length(v_alt) > 200   THEN PERFORM public.sb_fail('Image description is too long (max 200)'); END IF;
  IF char_length(v_badge) > 60  THEN PERFORM public.sb_fail('Badge text is too long (max 60)'); END IF;
  IF char_length(v_sub) > 220   THEN PERFORM public.sb_fail('Subtitle is too long (max 220)'); END IF;
  IF char_length(v_cta) > 40    THEN PERFORM public.sb_fail('Button text is too long (max 40)'); END IF;
  IF NOT public.sb_hero_valid_link(v_link) THEN
    PERFORM public.sb_fail('Button link must be a page on this site (e.g. /shop) or an https:// address');
  END IF;
  IF v_cta <> '' AND v_link = '' THEN PERFORM public.sb_fail('Add a button link or clear the button text'); END IF;
  IF v_starts IS NOT NULL AND v_ends IS NOT NULL AND v_ends <= v_starts THEN
    PERFORM public.sb_fail('The end date must be after the start date');
  END IF;

  IF v_id IS NULL THEN
    IF (SELECT count(*) FROM public.hero_slides) >= 12 THEN
      PERFORM public.sb_fail('You can have at most 12 slides. Delete one first.');
    END IF;
    INSERT INTO public.hero_slides
      (sort_order, is_active, image_url, image_alt, image_position, badge_text, badge_icon,
       title, subtitle, cta_text, cta_link, starts_at, ends_at)
    VALUES
      ((SELECT coalesce(max(sort_order), 0) + 1 FROM public.hero_slides), v_active, v_image, v_alt, v_pos,
       v_badge, v_icon, v_title, v_sub, v_cta, v_link, v_starts, v_ends)
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_old FROM public.hero_slides WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM public.sb_fail('Slide not found. It may have been deleted - refresh the page.'); END IF;
    UPDATE public.hero_slides SET
      is_active = v_active, image_url = v_image, image_alt = v_alt, image_position = v_pos,
      badge_text = v_badge, badge_icon = v_icon, title = v_title, subtitle = v_sub,
      cta_text = v_cta, cta_link = v_link, starts_at = v_starts, ends_at = v_ends, updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  PERFORM public._sb_audit(p_actor, CASE WHEN v_id IS NULL THEN 'hero.create_slide' ELSE 'hero.update_slide' END,
                           v_row.id::text, jsonb_build_object('title', v_row.title, 'active', v_row.is_active));
  RETURN jsonb_build_object(
    'slide', public._sb_hero_slide_json(v_row),
    'orphanedImageUrl', CASE WHEN v_old.id IS NOT NULL AND v_old.image_url <> v_row.image_url
                             THEN public._sb_hero_orphan(v_old.image_url) END);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hero_delete_slide(p_actor uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_row public.hero_slides;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_id IS NULL THEN PERFORM public.sb_fail('Slide id required'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('hero_slides'));

  DELETE FROM public.hero_slides WHERE id = p_id RETURNING * INTO v_row;
  IF NOT FOUND THEN PERFORM public.sb_fail('Slide not found. It may already be deleted.'); END IF;

  -- keep sort_order gap-free
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY sort_order, created_at) AS rn FROM public.hero_slides
  )
  UPDATE public.hero_slides s SET sort_order = ranked.rn
  FROM ranked WHERE s.id = ranked.id AND s.sort_order <> ranked.rn;

  PERFORM public._sb_audit(p_actor, 'hero.delete_slide', p_id::text, jsonb_build_object('title', v_row.title));
  RETURN jsonb_build_object('deleted', true, 'orphanedImageUrl', public._sb_hero_orphan(v_row.image_url));
END;
$$;

-- p_ids must contain EVERY existing slide exactly once, in the desired order.
CREATE OR REPLACE FUNCTION public.admin_hero_reorder(p_actor uuid, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_total integer;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_ids IS NULL OR cardinality(p_ids) < 1 THEN PERFORM public.sb_fail('Nothing to reorder'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('hero_slides'));

  SELECT count(*) INTO v_total FROM public.hero_slides;
  IF cardinality(p_ids) <> v_total
     OR (SELECT count(DISTINCT x) FROM unnest(p_ids) AS x) <> v_total
     OR EXISTS (SELECT 1 FROM public.hero_slides s WHERE NOT (s.id = ANY (p_ids))) THEN
    PERFORM public.sb_fail('The slide list changed. Refresh the page and try again.');
  END IF;

  UPDATE public.hero_slides s SET sort_order = o.ord, updated_at = now()
  FROM unnest(p_ids) WITH ORDINALITY AS o(id, ord)
  WHERE s.id = o.id;

  PERFORM public._sb_audit(p_actor, 'hero.reorder', NULL, jsonb_build_object('count', v_total));
  RETURN jsonb_build_object('reordered', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hero_set_active(p_actor uuid, p_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_row public.hero_slides;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_id IS NULL OR p_active IS NULL THEN PERFORM public.sb_fail('Invalid request'); END IF;
  UPDATE public.hero_slides SET is_active = p_active, updated_at = now() WHERE id = p_id RETURNING * INTO v_row;
  IF NOT FOUND THEN PERFORM public.sb_fail('Slide not found. It may have been deleted - refresh the page.'); END IF;
  PERFORM public._sb_audit(p_actor, 'hero.set_active', p_id::text, jsonb_build_object('active', p_active));
  RETURN jsonb_build_object('slide', public._sb_hero_slide_json(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hero_save_settings(p_actor uuid, p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_headline  text;
  v_sub       text;
  v_guarantee text;
  v_seconds   numeric;
  v_trust     jsonb;
  v_flags     text[] := ARRAY['showHeadline', 'showGuarantee', 'showCounter', 'autoplay', 'showTrustItems'];
  f           text;
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN PERFORM public.sb_fail('Invalid settings'); END IF;
  FOREACH f IN ARRAY v_flags LOOP
    IF jsonb_typeof(p_settings -> f) IS DISTINCT FROM 'boolean' THEN
      PERFORM public.sb_fail('Invalid value for ' || f);
    END IF;
  END LOOP;
  IF jsonb_typeof(p_settings -> 'autoplaySeconds') IS DISTINCT FROM 'number' THEN
    PERFORM public.sb_fail('Slide duration must be a number');
  END IF;

  v_seconds   := (p_settings ->> 'autoplaySeconds')::numeric;
  v_headline  := public.sb_clean_text(p_settings ->> 'headline');
  v_sub       := public.sb_clean_text(p_settings ->> 'subheadline');
  v_guarantee := public.sb_clean_text(p_settings ->> 'guaranteeText');
  v_trust     := public._sb_hero_clean_trust(p_settings -> 'trustItems');

  IF v_seconds < 2 OR v_seconds > 20 THEN PERFORM public.sb_fail('Slide duration must be between 2 and 20 seconds'); END IF;
  IF char_length(v_headline) > 160 THEN PERFORM public.sb_fail('Headline is too long (max 160)'); END IF;
  IF char_length(v_sub) > 240 THEN PERFORM public.sb_fail('Sub-headline is too long (max 240)'); END IF;
  IF char_length(v_guarantee) > 60 THEN PERFORM public.sb_fail('Guarantee badge text is too long (max 60)'); END IF;

  INSERT INTO public.hero_settings AS h
    (id, show_headline, headline, subheadline, show_guarantee, guarantee_text, show_counter,
     autoplay, autoplay_seconds, show_trust_items, trust_items, updated_at)
  VALUES
    (1, (p_settings ->> 'showHeadline')::boolean, v_headline, v_sub,
     (p_settings ->> 'showGuarantee')::boolean, v_guarantee, (p_settings ->> 'showCounter')::boolean,
     (p_settings ->> 'autoplay')::boolean, round(v_seconds, 1), (p_settings ->> 'showTrustItems')::boolean,
     v_trust, now())
  ON CONFLICT (id) DO UPDATE SET
    show_headline = EXCLUDED.show_headline, headline = EXCLUDED.headline, subheadline = EXCLUDED.subheadline,
    show_guarantee = EXCLUDED.show_guarantee, guarantee_text = EXCLUDED.guarantee_text,
    show_counter = EXCLUDED.show_counter, autoplay = EXCLUDED.autoplay,
    autoplay_seconds = EXCLUDED.autoplay_seconds, show_trust_items = EXCLUDED.show_trust_items,
    trust_items = EXCLUDED.trust_items, updated_at = now();

  PERFORM public._sb_audit(p_actor, 'hero.save_settings', '1', '{}'::jsonb);
  RETURN jsonb_build_object('saved', true);
END;
$$;

-- "Restore defaults": replaces ALL slides and hero copy with the original built-in content.
CREATE OR REPLACE FUNCTION public.admin_hero_reset_defaults(p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_urls text[];
BEGIN
  IF p_actor IS NULL THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('hero_slides'));

  SELECT coalesce(array_agg(DISTINCT image_url), ARRAY[]::text[]) INTO v_urls
  FROM public.hero_slides WHERE image_url LIKE '%/storage/v1/object/public/site-media/%';

  PERFORM public._sb_hero_seed_defaults();
  PERFORM public._sb_audit(p_actor, 'hero.reset_defaults', NULL, '{}'::jsonb);
  RETURN jsonb_build_object('reset', true, 'orphanedImageUrls', to_jsonb(v_urls));
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. First-time seed (only when hero_settings has never been created)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hero_settings WHERE id = 1) THEN
    PERFORM public._sb_hero_seed_defaults();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. RLS + grants
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS hero_slides_public_read   ON public.hero_slides;
DROP POLICY IF EXISTS hero_slides_admin_read    ON public.hero_slides;
DROP POLICY IF EXISTS hero_settings_public_read ON public.hero_settings;

REVOKE ALL ON public.hero_slides, public.hero_settings FROM anon, authenticated;
GRANT SELECT ON public.hero_slides   TO anon, authenticated;
GRANT SELECT ON public.hero_settings TO anon, authenticated;

-- Public: only slides that are switched on AND inside their schedule window.
CREATE POLICY hero_slides_public_read ON public.hero_slides FOR SELECT TO anon, authenticated
  USING (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));
-- Admins also see hidden / scheduled / expired slides (to manage them).
CREATE POLICY hero_slides_admin_read  ON public.hero_slides FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY hero_settings_public_read ON public.hero_settings FOR SELECT TO anon, authenticated
  USING (true);

-- Defense in depth: even if a grant/policy is loosened by mistake, API roles can never write.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hero_slides', 'hero_settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_forbid_api_writes ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_forbid_api_writes BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
                   'FOR EACH ROW EXECUTE FUNCTION public.forbid_api_writes()', t);
  END LOOP;
END $$;

-- Functions: nobody but the server (service_role) may execute any of them.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND (p.proname LIKE 'admin\_hero\_%' OR p.proname LIKE '\_sb\_hero\_%' OR p.proname LIKE 'sb\_hero\_%')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

GRANT ALL ON public.hero_slides, public.hero_settings TO service_role;

-- -----------------------------------------------------------------------------
-- 7. Storage bucket for uploaded slide images (skipped automatically where Storage is not installed)
--    public read (served from the CDN, no listing), admin-only write, images only, 3 MB cap.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'Supabase Storage is not available: skipped site-media bucket setup.';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('site-media', 'site-media', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
  ON CONFLICT (id) DO UPDATE
    SET public = true, file_size_limit = 3145728,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

  DROP POLICY IF EXISTS site_media_admin_read   ON storage.objects;
  DROP POLICY IF EXISTS site_media_admin_insert ON storage.objects;
  DROP POLICY IF EXISTS site_media_admin_update ON storage.objects;
  DROP POLICY IF EXISTS site_media_admin_delete ON storage.objects;

  CREATE POLICY site_media_admin_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'site-media' AND public.is_admin());
  CREATE POLICY site_media_admin_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'site-media' AND name LIKE 'hero/%' AND public.is_admin());
  CREATE POLICY site_media_admin_update ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'site-media' AND public.is_admin())
    WITH CHECK (bucket_id = 'site-media' AND name LIKE 'hero/%' AND public.is_admin());
  CREATE POLICY site_media_admin_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'site-media' AND public.is_admin());
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Not allowed to configure Storage from SQL (%). Create the public bucket "site-media" in Dashboard -> Storage and add the 4 policies from docs/HERO_CMS.md.', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
