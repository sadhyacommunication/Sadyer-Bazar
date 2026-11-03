-- =============================================================================
-- MIGRATION 12/12 -- HOMEPAGE SECTION SLIDERS CMS & DEPARTMENT BANNER CAROUSELS
--
-- What this adds:
--   * public.section_slides : dynamic multi-slide carousels for the 4 homepage departments
--     (dept_jamuna_fish, dept_village_chicken, dept_heritage_rice, dept_ghee_doi)
--   * public.section_slider_settings : per-section autoplay, counter & navigation toggles
--   * Audited admin RPC functions (service_role / authenticated admin ONLY):
--       admin_section_save_slide / admin_section_delete_slide / admin_section_reorder /
--       admin_section_set_active / admin_section_save_settings / admin_section_reset_defaults
--   * Pre-seeds 2 rich slides per department (Slide #1: existing hero-grade banners, Slide #2: promotional offer)
--
-- Safe to re-run (idempotent).
-- =============================================================================
BEGIN;

-- 1. Helper Link Validators (Support anchor hashes e.g. #dept-heritage-rice)
CREATE OR REPLACE FUNCTION public.sb_section_valid_link(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NOT NULL
     AND length(p) <= 300
     AND (
          p = ''
       OR p ~ '^#[A-Za-z0-9_-]+$'
       OR (p ~ '^/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*$' AND p !~ '^//')
       OR p ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*)?$'
     )
$$;

-- Keep sb_hero_valid_link backward compatible while supporting anchors as well
CREATE OR REPLACE FUNCTION public.sb_hero_valid_link(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT public.sb_section_valid_link(p);
$$;

-- Drop obsolete constraints if table already exists from previous runs
ALTER TABLE IF EXISTS public.section_slides DROP CONSTRAINT IF EXISTS section_slides_pairing_target_href_check;
ALTER TABLE IF EXISTS public.section_slides DROP CONSTRAINT IF EXISTS section_slides_cta_link_check;

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.section_slides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id            text NOT NULL CHECK (section_id IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi')),
  sort_order            integer NOT NULL DEFAULT 0,
  is_active             boolean NOT NULL DEFAULT true,
  image_url             text NOT NULL CHECK (public.sb_hero_valid_image(image_url)),
  image_alt             text NOT NULL DEFAULT '' CHECK (char_length(image_alt) <= 200),
  badge_text_en         text NOT NULL DEFAULT '' CHECK (char_length(badge_text_en) <= 80),
  badge_text_bn         text NOT NULL DEFAULT '' CHECK (char_length(badge_text_bn) <= 80),
  badge_icon            text NOT NULL DEFAULT 'sparkles'
                        CHECK (badge_icon IN ('fish', 'award', 'flame', 'wheat', 'leaf', 'sparkles', 'truck', 'shield', 'clock', 'star', 'heart', 'gift', 'phone')),
  title_en              text NOT NULL CHECK (char_length(title_en) BETWEEN 1 AND 160),
  headline_bn           text NOT NULL CHECK (char_length(headline_bn) BETWEEN 1 AND 160),
  convincing_subtext_bn text NOT NULL DEFAULT '' CHECK (char_length(convincing_subtext_bn) <= 450),
  description_en        text NOT NULL DEFAULT '' CHECK (char_length(description_en) <= 450),
  origin_location       text NOT NULL DEFAULT '' CHECK (char_length(origin_location) <= 120),
  highlights            jsonb NOT NULL DEFAULT '[]'::jsonb
                        CHECK (jsonb_typeof(highlights) = 'array' AND jsonb_array_length(highlights) <= 6),
  pairing_tip_text      text NOT NULL DEFAULT '' CHECK (char_length(pairing_tip_text) <= 200),
  pairing_target_href   text NOT NULL DEFAULT '' CHECK (public.sb_section_valid_link(pairing_target_href)),
  pairing_target_label  text NOT NULL DEFAULT '' CHECK (char_length(pairing_target_label) <= 80),
  cta_text              text NOT NULL DEFAULT '' CHECK (char_length(cta_text) <= 60),
  cta_link              text NOT NULL DEFAULT '' CHECK (public.sb_section_valid_link(cta_link)),
  banner_layout         text NOT NULL DEFAULT 'default' CHECK (banner_layout IN ('default', 'reversed')),
  starts_at             timestamptz,
  ends_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT section_slides_schedule_chk CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

-- Ensure constraints exist if table already pre-existed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'section_slides_pairing_target_href_check'
  ) THEN
    ALTER TABLE public.section_slides
      ADD CONSTRAINT section_slides_pairing_target_href_check
      CHECK (public.sb_section_valid_link(pairing_target_href));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'section_slides_cta_link_check'
  ) THEN
    ALTER TABLE public.section_slides
      ADD CONSTRAINT section_slides_cta_link_check
      CHECK (public.sb_section_valid_link(cta_link));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_section_slides_lookup
  ON public.section_slides (section_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.section_slider_settings (
  section_id            text PRIMARY KEY CHECK (section_id IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi')),
  autoplay              boolean NOT NULL DEFAULT true,
  autoplay_seconds      numeric(4, 1) NOT NULL DEFAULT 5.0 CHECK (autoplay_seconds BETWEEN 2 AND 20),
  show_counter          boolean NOT NULL DEFAULT true,
  show_navigation       boolean NOT NULL DEFAULT true,
  show_dots             boolean NOT NULL DEFAULT true,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- RLS Enforcement
ALTER TABLE public.section_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_slider_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.section_slides TO anon, authenticated;
GRANT SELECT ON public.section_slider_settings TO anon, authenticated;

-- 2. Helper JSON serialization
CREATE OR REPLACE FUNCTION public._sb_section_slide_json(s public.section_slides)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'sectionId', s.section_id,
    'sortOrder', s.sort_order,
    'isActive', s.is_active,
    'imageUrl', s.image_url,
    'imageAlt', s.image_alt,
    'badgeTextEn', s.badge_text_en,
    'badgeTextBn', s.badge_text_bn,
    'badgeIcon', s.badge_icon,
    'titleEn', s.title_en,
    'headlineBn', s.headline_bn,
    'convincingSubtextBn', s.convincing_subtext_bn,
    'descriptionEn', s.description_en,
    'originLocation', s.origin_location,
    'highlights', s.highlights,
    'pairingTipText', s.pairing_tip_text,
    'pairingTargetHref', s.pairing_target_href,
    'pairingTargetLabel', s.pairing_target_label,
    'ctaText', s.cta_text,
    'ctaLink', s.cta_link,
    'bannerLayout', s.banner_layout,
    'startsAt', s.starts_at,
    'endsAt', s.ends_at,
    'updatedAt', s.updated_at
  )
$$;

-- 3. Validate highlights array
CREATE OR REPLACE FUNCTION public._sb_section_clean_highlights(p jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_out  jsonb := '[]'::jsonb;
  v_item jsonb;
  v_text text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;
  IF jsonb_array_length(p) > 6 THEN
    PERFORM public.sb_fail('A maximum of 6 highlights are allowed');
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(v_item) = 'string' THEN
      v_text := public.sb_clean_text(v_item #>> '{}');
    ELSIF jsonb_typeof(v_item) = 'object' THEN
      v_text := public.sb_clean_text(v_item ->> 'text');
    ELSE
      v_text := '';
    END IF;
    IF char_length(v_text) > 0 THEN
      IF char_length(v_text) > 120 THEN
        PERFORM public.sb_fail('Each highlight must be at most 120 characters');
      END IF;
      v_out := v_out || to_jsonb(v_text);
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

-- 4. Seed function for default department slides
CREATE OR REPLACE FUNCTION public._sb_section_seed_defaults(p_target_section text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_target_section IS NULL OR p_target_section = 'dept_jamuna_fish' THEN
    DELETE FROM public.section_slides WHERE section_id = 'dept_jamuna_fish';
    INSERT INTO public.section_slides (
      section_id, sort_order, is_active, image_url, image_alt,
      badge_text_en, badge_text_bn, badge_icon,
      title_en, headline_bn, convincing_subtext_bn, description_en, origin_location,
      highlights, pairing_tip_text, pairing_target_href, pairing_target_label,
      cta_text, cta_link, banner_layout
    ) VALUES (
      'dept_jamuna_fish', 1, true, '/images/banners/jamuna-fisherman-banner.jpg',
      'যমুনার ভোরবেলার তাজা মাছ — জেলের জাল থেকে সরাসরি আপনার ঘরে',
      'Fresh River Catch', 'যমুনা নদীর ভোরের তাজা মাছ', 'fish',
      'Fresh River Catch from Jamuna River Basin',
      'যমুনার ভোরের তাজা মাছ — জেলের জাল থেকে সরাসরি আপনার ঘরে!',
      '১০০% ফরমালিন ও হিমাগার (Cold-Storage) মুক্ত। ভোরবেলা সিরাজগঞ্জ ও সারিয়াকান্দি ঘাটে জেলের জাল থেকে তুলেই ফুড-গ্রেড আইসবক্সে প্যাকিং করে পাঠানো হয়।',
      'We never buy from city wholesale markets or keep fish frozen in storage. Our local team stands at the Jamuna river ghats at dawn to collect wild Piali, Kajoli, Ayer, Boal, Chital, Deshi Rui, and giant Galda Chingri.',
      'Sirajganj & Sariakandi Jamuna Ghat',
      '["100% Wild River Catch — Zero Farmed or Cold-Storage Fish", "Custom Bengali Cutting & Cleaning Options Available", "Packed Immediately in Food-Grade Thermal Ice Boxes"]'::jsonb,
      'Cook fresh river fish with unpolished Red Rice', '#dept-heritage-rice', 'See Heritage Rice',
      'Shop All Fresh Fish from Jamuna River', '/pre-orders', 'default'
    ), (
      'dept_jamuna_fish', 2, true, '/images/banners/hero-jamuna-river-dawn.jpg',
      'সিরাজগঞ্জ ঘাটের স্পেশাল তাজা দেশি মাছ ও প্রিমিয়াম আইড় চিতল',
      'Daily Sunrise Catch', 'ভোরের স্পেশাল নদীর আইড়, চিতল ও বোয়াল', 'sparkles',
      'Dawn Harvest: Wild River Piali, Kajoli, Boal & Chital',
      'নদীর আসল স্বাদ পেতে আজই বুকিং করুন ভোরের তাজা মাছ!',
      'প্রাকৃতিক প্রবাহের জীবন্ত নদী থেকে সংগ্রহকৃত দেশি মাছ। অর্ডার করার পর তাজা মাছ এনে আপনার পছন্দমতো কেটে থার্মাল বক্সে পৌঁছে দেওয়া হয়।',
      'Authentic fresh-water river fish with zero preservatives. Sourced strictly from verified traditional fishermen at first light.',
      'Sariakandi, Bogura & Sirajganj Basin',
      '["Direct Fishermen Catch with Authentic Sweet River Taste", "No Preservatives, Ice-Cured Freshness Only", "100% Money-Back Quality & Freshness Guarantee"]'::jsonb,
      'Pair Boal & Chital fish curry with fragrant Chinigura Rice', '#dept-heritage-rice', 'View Polao Rice',
      'Pre-Order Tomorrow Sunrise Catch', '/pre-orders', 'default'
    );

    INSERT INTO public.section_slider_settings (section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at)
    VALUES ('dept_jamuna_fish', true, 5.0, true, true, true, now())
    ON CONFLICT (section_id) DO UPDATE SET updated_at = now();
  END IF;

  IF p_target_section IS NULL OR p_target_section = 'dept_village_chicken' THEN
    DELETE FROM public.section_slides WHERE section_id = 'dept_village_chicken';
    INSERT INTO public.section_slides (
      section_id, sort_order, is_active, image_url, image_alt,
      badge_text_en, badge_text_bn, badge_icon,
      title_en, headline_bn, convincing_subtext_bn, description_en, origin_location,
      highlights, pairing_tip_text, pairing_target_href, pairing_target_label,
      cta_text, cta_link, banner_layout
    ) VALUES (
      'dept_village_chicken', 1, true, '/images/banners/village-chicken-banner.jpg',
      'গ্রামের আসল দেশি মুরগি ও ডিম — প্রাকৃতিক খামার',
      'Deshi Chicken & Eggs from Village', 'গ্রামের আসল দেশি মুরগি, হাঁস ও ডিম', 'flame',
      'Free-Range Deshi Chicken, Wetland Duck & Golden-Yolk Eggs',
      'গ্রামীন উঠানে প্রাকৃতিক খাবারে বেড়ে ওঠা আসল দেশি মুরগি ও ডিম!',
      'ফার্মের সিন্থেটিক ফিড, গ্রোথ হরমোন ও অ্যান্টিবায়োটিক সম্পূর্ণ মুক্ত। বগুড়া, টাঙ্গাইল ও চলনবিল অঞ্চলের গ্রামীণ গৃহস্থ বাড়ি থেকে সরাসরি সংগৃহীত।',
      'Rediscover the authentic taste and aroma of childhood village curry (মাটির গন্ধ ও ঘরোয়া রান্নার স্বাদ). Our free-range Deshi chickens and Chalan Beel ducks are Halal processed on the morning of dispatch and cut to your exact preference.',
      'Bogura, Tangail & Chalan Beel Villages',
      '["100% Free-Range Village Homestead Foraged Poultry", "Zero Antibiotics, Steroids, or Commercial Broiler Feed", "Freshly Halal Dressed & Custom Curry-Cut on Delivery Morning"]'::jsonb,
      'Pair Deshi Chicken Roast or Bhuna with Chinigura Polao', '#dept-heritage-rice', 'Explore Polao & Basmati Rice',
      'Shop All Deshi Chicken & Eggs from Village', '/shop?category=deshi-meat-poultry', 'reversed'
    ), (
      'dept_village_chicken', 2, true, '/images/banners/hero-village-deshi-poultry.jpg',
      'চলনবিলের দেশি হাঁস ও লাল কুসুমের পুষ্টিকর ডিম',
      'Wetland Free-Range Duck', 'চলনবিলের প্রাকৃতিক হাঁস ও খাঁটি দেশি ডিম', 'award',
      'Natural Wetland Grazed Deshi Duck & Golden Yolk Eggs',
      'চলনবিলের জলজ শামুক-গেঁড়ি খাওয়া প্রাকৃতিক দেশি হাঁসের মাংস!',
      'গ্রামের মুক্ত জলাশয়ে সাঁতার কাটা দেশি হাঁস। দেশি মসলা ও খাঁটি ঘিয়ে রান্না করলে পাবেন ঐতিহ্যবাহী ভূনা মাংসের অতুলনীয় ঘ্রাণ।',
      'Foraged naturally in wide freshwater wetlands. Rich in iron, clean protein and natural yellow yolk nutrients with no artificial coloring.',
      'Chalan Beel, Natore & Sirajganj',
      '["Foraged on Natural Aquatic Snails and Farm Grains", "Strict Halal Processing with Skin-On/Off Options", "Chilled Packaging for Peak Freshness"]'::jsonb,
      'Roast with Sirajganj Bilona Ghee for Rich Traditional Aroma', '#dept-ghee-doi', 'See Pure Gawa Ghee',
      'Order Fresh Deshi Duck & Eggs', '/shop?category=deshi-meat-poultry', 'reversed'
    );

    INSERT INTO public.section_slider_settings (section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at)
    VALUES ('dept_village_chicken', true, 5.0, true, true, true, now())
    ON CONFLICT (section_id) DO UPDATE SET updated_at = now();
  END IF;

  IF p_target_section IS NULL OR p_target_section = 'dept_heritage_rice' THEN
    DELETE FROM public.section_slides WHERE section_id = 'dept_heritage_rice';
    INSERT INTO public.section_slides (
      section_id, sort_order, is_active, image_url, image_alt,
      badge_text_en, badge_text_bn, badge_icon,
      title_en, headline_bn, convincing_subtext_bn, description_en, origin_location,
      highlights, pairing_tip_text, pairing_target_href, pairing_target_label,
      cta_text, cta_link, banner_layout
    ) VALUES (
      'dept_heritage_rice', 1, true, '/images/banners/heritage-rice-banner.jpg',
      'দিনাজপুরের ঐতিহ্যবাহী সুগন্ধি কাটারিভোগ ও পুষ্টিকর চালের সমাহার',
      'Kataribhog, Basmati & Red Rice', 'দিনাজপুরের কাটারিভোগ, বাসমতি ও লাল চাল', 'wheat',
      'Royal Heritage Rice: Kataribhog, Aged Basmati, Chinigura & Red Rice',
      'দিনাজপুরের ঐতিহ্যবাহী সুগন্ধি কাটারিভোগ, প্রিমিয়াম বাসমতি ও ঢেঁকি ছাঁটা লাল চাল!',
      'কৃত্রিম সুগন্ধি, মোম পলিশ (Wax Polish) এবং কেমিক্যাল ব্লিচিং মুক্ত। প্রতিদিনের স্বাস্থ্যকর ভাত, ডায়াবেটিক ডায়েট কিংবা রাজকীয় বিরিয়ানি ও পোলাওয়ের জন্য সেরা।',
      'From GI-famous Dinajpur Kataribhog and 12-month aged extra-long Basmati to low-GI full-fiber unpolished Red Rice and Bogura Chinigura—every grain is sourced directly from heritage husking mills with intact nutrition.',
      'Dinajpur, Sherpur & Naogaon Heritage Mills',
      '["Dinajpur GI-Origin Kataribhog & 12-Month Aged Extra-Long Basmati", "Unpolished Low-GI Full-Fiber Red Rice (Diabetic & Heart Friendly)", "100% Stone-Free, Unbleached & Zero Chemical Wax Polish"]'::jsonb,
      'Top steaming Kataribhog or Red Rice with 1 spoon Gawa Ghee', '#dept-ghee-doi', 'See Pure Gawa Ghee',
      'Shop All Kataribhog, Basmati & Red Rice', '/shop?category=organic-rice-honey', 'default'
    ), (
      'dept_heritage_rice', 2, true, '/images/banners/hero-heritage-golden-rice.jpg',
      'বগুড়ার সুগন্ধি চিনিগুঁড়া পোলাও চাল ও সুন্দরবনের খাঁটি মধু',
      'Aromatic Polao & Honey', 'ঐতিহ্যবাহী চিনিগুঁড়া পোলাও চাল ও সুন্দরবনের মধু', 'sparkles',
      'Aromatic Bogura Chinigura Rice & Raw Forest Honey',
      'উৎসব ও পোলাওয়ের জন্য বগুড়ার আসল খুশবুদার চিনিগুঁড়া চাল!',
      'প্রাচীন মাটির উর্বরতায় ফলানো ছোট দানার সুগন্ধি চাল, যার মৌ মৌ ঘ্রাণে যেকোনো বিরিয়ানি ও পোলাও হয়ে ওঠে অনন্য।',
      'Heritage non-GMO grain varieties carefully milled to preserve bran layer vitamins, low glycemic response and exquisite natural floral fragrance.',
      'Sherpur, Bogura & Sundarbans Mangrove',
      '["Naturally Aged for 12 Months for Non-Sticky Fluffy Grains", "Full Grain Purity Guarantee with Zero Broken Rice", "Tested for 100% Natural Purity with Zero Synthetic Fragrance"]'::jsonb,
      'Cook polao with Bilona Ghee for unmatched wedding aroma', '#dept-ghee-doi', 'View Gawa Ghee',
      'Explore Fragrant Chinigura Rice', '/shop?category=organic-rice-honey', 'default'
    );

    INSERT INTO public.section_slider_settings (section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at)
    VALUES ('dept_heritage_rice', true, 5.0, true, true, true, now())
    ON CONFLICT (section_id) DO UPDATE SET updated_at = now();
  END IF;

  IF p_target_section IS NULL OR p_target_section = 'dept_ghee_doi' THEN
    DELETE FROM public.section_slides WHERE section_id = 'dept_ghee_doi';
    INSERT INTO public.section_slides (
      section_id, sort_order, is_active, image_url, image_alt,
      badge_text_en, badge_text_bn, badge_icon,
      title_en, headline_bn, convincing_subtext_bn, description_en, origin_location,
      highlights, pairing_tip_text, pairing_target_href, pairing_target_label,
      cta_text, cta_link, banner_layout
    ) VALUES (
      'dept_ghee_doi', 1, true, '/images/banners/ghee-bogura-doi-banner.jpg',
      'সিরাজগঞ্জের দানাদার ঘি ও বগুড়ার ঐতিহ্যবাহী মাটির সরার শাহী দই',
      'Pure Gawa Ghee & Bogura Doi', 'খাঁটি গাওয়া ঘি ও বগুড়ার শাহী দই', 'award',
      'Sirajganj Bilona Gawa Ghee, Bogura Clay-Pot Shahi Doi & Raw Honey',
      'সিরাজগঞ্জের দানাদার গাওয়া ঘি ও বগুড়ার ঐতিহ্যবাহী মাটির সরার শাহী দই!',
      'খাঁটি গরুর দুধের ননি থেকে কাঠের চুলায় তৈরি মাখুঞ্চে দানাদার গাওয়া ঘি এবং শেরপুর-বগুড়ার কারিগরদের হাতে তৈরি মাটির সরার আসল শাহী মিষ্টি দই ও ক্ষীরসা।',
      'Experience the crown jewels of North Bengal''s dairy heritage. Our Gawa Ghee is 100% free from dalda or palm oil, and our Bogura Shahi Doi & Khirsha are dispatched fresh in insulated thermal packaging.',
      'Sirajganj Bathan & Sherpur, Bogura',
      '["Traditional Bilona Wood-Fired Granular Cow Milk Gawa Ghee", "Original Terracotta Clay Sora (মাটির সরা) Bogura Shahi Doi & Khirsha", "Lab-Verified 100% Pure — Zero Dalda, Artificial Essence or Starch"]'::jsonb,
      'Bundle Ghee, Doi, Fish & Rice together for 8% Combo Savings', '#combo-builder', 'Build Family Box',
      'Shop All Pure Gawa Ghee & Bogura Doi', '/shop?category=ghee-and-dairy', 'reversed'
    ), (
      'dept_ghee_doi', 2, true, '/images/banners/hero-gawa-ghee-bogura-doi.jpg',
      'ঐতিহ্যবাহী বিলোনা ঘি ও শেরপুরের আসল সরের ক্ষীরসা দই',
      'Royal Dairy Heritage', 'আসল শেরপুরের ক্ষীরসা ও দানাদার বাথান ঘি', 'sparkles',
      'Heritage Sherpur Clay Sora Khirsha & Golden Bathan Ghee',
      'দুধের ঘন সর ও কাঠের চুলার মৃদু তাপে তৈরি ঐতিহ্যবাহী ক্ষীরসা দই!',
      'শত বছরের প্রাচীন রেসিপিতে খাঁটি গরুর দুধে তৈরি বগুড়ার মিষ্টি শাহী দই ও ক্ষীরসা। প্রতিটি চামচে অনুভব করুন প্রাচীন বাংলার আতিথেয়তার স্বাদ।',
      'Crafted by generational sweet-makers in terracotta pots that naturally absorb excess whey, yielding dense, velvety curd and caramelized cream crust.',
      'Sherpur, Bogura & Shahjadpur Bathan',
      '["Slow-Caramelized Over Tamarind Wood Fire for 8+ Hours", "Clay Pot Breathing Ensures Firm Texture & Deep Aroma", "Strict Cold-Chain Express Van Delivery to Dhaka Homes"]'::jsonb,
      'Enjoy chilled Bogura Doi right after fresh river fish lunch', '#dept-jamuna-fish', 'See River Fish',
      'Order Bogura Clay Sora Doi & Ghee', '/shop?category=ghee-and-dairy', 'reversed'
    );

    INSERT INTO public.section_slider_settings (section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at)
    VALUES ('dept_ghee_doi', true, 5.0, true, true, true, now())
    ON CONFLICT (section_id) DO UPDATE SET updated_at = now();
  END IF;
END;
$$;

-- Run initial seed
SELECT public._sb_section_seed_defaults();

-- 5. Audited Admin RPC: admin_section_save_slide
CREATE OR REPLACE FUNCTION public.admin_section_save_slide(p_actor uuid, p_slide jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id         uuid;
  v_section_id text;
  v_image      text;
  v_alt        text;
  v_badge_en   text;
  v_badge_bn   text;
  v_icon       text;
  v_title_en   text;
  v_headline   text;
  v_subtext    text;
  v_desc_en    text;
  v_origin     text;
  v_highlights jsonb;
  v_tip_text   text;
  v_tip_href   text;
  v_tip_label  text;
  v_cta_text   text;
  v_cta_link   text;
  v_layout     text;
  v_active     boolean;
  v_starts     timestamptz;
  v_ends       timestamptz;
  v_row        public.section_slides;
  v_old        public.section_slides;
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;
  IF p_slide IS NULL OR jsonb_typeof(p_slide) <> 'object' THEN
    PERFORM public.sb_fail('Slide payload required');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('section_slides'));

  BEGIN
    v_id     := nullif(p_slide ->> 'id', '')::uuid;
    v_starts := nullif(p_slide ->> 'startsAt', '')::timestamptz;
    v_ends   := nullif(p_slide ->> 'endsAt', '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sb_fail('Invalid slide id or schedule date');
  END;

  v_section_id := btrim(coalesce(p_slide ->> 'sectionId', ''));
  IF v_section_id NOT IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi') THEN
    PERFORM public.sb_fail('Invalid department section identifier');
  END IF;

  v_image      := btrim(coalesce(p_slide ->> 'imageUrl', ''));
  v_alt        := public.sb_clean_text(p_slide ->> 'imageAlt');
  v_badge_en   := public.sb_clean_text(p_slide ->> 'badgeTextEn');
  v_badge_bn   := public.sb_clean_text(p_slide ->> 'badgeTextBn');
  v_icon       := coalesce(nullif(p_slide ->> 'badgeIcon', ''), 'sparkles');
  v_title_en   := public.sb_clean_text(p_slide ->> 'titleEn');
  v_headline   := public.sb_clean_text(p_slide ->> 'headlineBn');
  v_subtext    := public.sb_clean_text(p_slide ->> 'convincingSubtextBn');
  v_desc_en    := public.sb_clean_text(p_slide ->> 'descriptionEn');
  v_origin     := public.sb_clean_text(p_slide ->> 'originLocation');
  v_highlights := public._sb_section_clean_highlights(p_slide -> 'highlights');
  v_tip_text   := public.sb_clean_text(p_slide ->> 'pairingTipText');
  v_tip_href   := btrim(coalesce(p_slide ->> 'pairingTargetHref', ''));
  v_tip_label  := public.sb_clean_text(p_slide ->> 'pairingTargetLabel');
  v_cta_text   := public.sb_clean_text(p_slide ->> 'ctaText');
  v_cta_link   := btrim(coalesce(p_slide ->> 'ctaLink', ''));
  v_layout     := coalesce(nullif(p_slide ->> 'bannerLayout', ''), 'default');
  v_active     := coalesce((p_slide ->> 'isActive')::boolean, true);

  IF NOT public.sb_hero_valid_image(v_image) THEN
    PERFORM public.sb_fail('Banner image must be an uploaded media file or valid /images/... asset');
  END IF;
  IF v_icon NOT IN ('fish', 'award', 'flame', 'wheat', 'leaf', 'sparkles', 'truck', 'shield', 'clock', 'star', 'heart', 'gift', 'phone') THEN
    PERFORM public.sb_fail('Invalid badge icon selected');
  END IF;
  IF char_length(v_title_en) < 1 OR char_length(v_title_en) > 160 THEN
    PERFORM public.sb_fail('English Title is required (1-160 characters)');
  END IF;
  IF char_length(v_headline) < 1 OR char_length(v_headline) > 160 THEN
    PERFORM public.sb_fail('Bengali Headline is required (1-160 characters)');
  END IF;
  IF char_length(v_subtext) > 450 THEN PERFORM public.sb_fail('Bengali Subtext is too long (max 450)'); END IF;
  IF char_length(v_desc_en) > 450 THEN PERFORM public.sb_fail('English Description is too long (max 450)'); END IF;
  IF char_length(v_origin) > 120 THEN PERFORM public.sb_fail('Origin location is too long (max 120)'); END IF;
  IF NOT public.sb_section_valid_link(v_cta_link) THEN
    PERFORM public.sb_fail('Button link must be a safe route (e.g. /shop), anchor (#section), or https address');
  END IF;
  IF NOT public.sb_section_valid_link(v_tip_href) THEN
    PERFORM public.sb_fail('Pairing link must be a safe route, anchor (#section), or https address');
  END IF;
  IF v_layout NOT IN ('default', 'reversed') THEN
    v_layout := 'default';
  END IF;
  IF v_starts IS NOT NULL AND v_ends IS NOT NULL AND v_ends <= v_starts THEN
    PERFORM public.sb_fail('Schedule end date must be after start date');
  END IF;

  IF v_id IS NULL THEN
    IF (SELECT count(*) FROM public.section_slides WHERE section_id = v_section_id) >= 10 THEN
      PERFORM public.sb_fail('You can have at most 10 slides per section. Delete an old one first.');
    END IF;

    INSERT INTO public.section_slides (
      section_id, sort_order, is_active, image_url, image_alt,
      badge_text_en, badge_text_bn, badge_icon,
      title_en, headline_bn, convincing_subtext_bn, description_en, origin_location,
      highlights, pairing_tip_text, pairing_target_href, pairing_target_label,
      cta_text, cta_link, banner_layout, starts_at, ends_at
    ) VALUES (
      v_section_id,
      (SELECT coalesce(max(sort_order), 0) + 1 FROM public.section_slides WHERE section_id = v_section_id),
      v_active, v_image, v_alt, v_badge_en, v_badge_bn, v_icon,
      v_title_en, v_headline, v_subtext, v_desc_en, v_origin,
      v_highlights, v_tip_text, v_tip_href, v_tip_label,
      v_cta_text, v_cta_link, v_layout, v_starts, v_ends
    ) RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_old FROM public.section_slides WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.sb_fail('Slide not found. Please refresh and try again.');
    END IF;

    UPDATE public.section_slides SET
      section_id            = v_section_id,
      is_active             = v_active,
      image_url             = v_image,
      image_alt             = v_alt,
      badge_text_en         = v_badge_en,
      badge_text_bn         = v_badge_bn,
      badge_icon            = v_icon,
      title_en              = v_title_en,
      headline_bn           = v_headline,
      convincing_subtext_bn = v_subtext,
      description_en        = v_desc_en,
      origin_location       = v_origin,
      highlights            = v_highlights,
      pairing_tip_text      = v_tip_text,
      pairing_target_href   = v_tip_href,
      pairing_target_label  = v_tip_label,
      cta_text              = v_cta_text,
      cta_link              = v_cta_link,
      banner_layout         = v_layout,
      starts_at             = v_starts,
      ends_at               = v_ends,
      updated_at            = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  PERFORM public._sb_audit(
    p_actor,
    CASE WHEN v_id IS NULL THEN 'section.create_slide' ELSE 'section.update_slide' END,
    v_row.id::text,
    jsonb_build_object('sectionId', v_row.section_id, 'title', v_row.title_en, 'active', v_row.is_active)
  );

  RETURN jsonb_build_object(
    'slide', public._sb_section_slide_json(v_row),
    'orphanedImageUrl', CASE WHEN v_old.id IS NOT NULL AND v_old.image_url <> v_row.image_url
                             THEN public._sb_hero_orphan(v_old.image_url) END
  );
END;
$$;

-- 6. Audited Admin RPC: admin_section_delete_slide
CREATE OR REPLACE FUNCTION public.admin_section_delete_slide(p_actor uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.section_slides;
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN
    PERFORM public.sb_fail('Admin identity required');
  END IF;
  IF p_id IS NULL THEN PERFORM public.sb_fail('Slide id required'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('section_slides'));

  DELETE FROM public.section_slides WHERE id = p_id RETURNING * INTO v_row;
  IF NOT FOUND THEN PERFORM public.sb_fail('Slide not found or already deleted.'); END IF;

  -- Re-rank remaining slides in that department to stay gap-free
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY sort_order, created_at) AS rn
    FROM public.section_slides
    WHERE section_id = v_row.section_id
  )
  UPDATE public.section_slides s
  SET sort_order = ranked.rn
  FROM ranked
  WHERE s.id = ranked.id AND s.sort_order <> ranked.rn;

  PERFORM public._sb_audit(p_actor, 'section.delete_slide', p_id::text, jsonb_build_object('sectionId', v_row.section_id, 'title', v_row.title_en));

  RETURN jsonb_build_object(
    'deleted', true,
    'sectionId', v_row.section_id,
    'orphanedImageUrl', public._sb_hero_orphan(v_row.image_url)
  );
END;
$$;

-- 7. Audited Admin RPC: admin_section_reorder
CREATE OR REPLACE FUNCTION public.admin_section_reorder(p_actor uuid, p_section_id text, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_i     integer;
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_section_id NOT IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi') THEN
    PERFORM public.sb_fail('Invalid department section identifier');
  END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) = 0 THEN PERFORM public.sb_fail('Slide ID array required'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('section_slides'));

  SELECT count(*) INTO v_count FROM public.section_slides WHERE section_id = p_section_id;
  IF array_length(p_ids, 1) <> v_count THEN
    PERFORM public.sb_fail('Slide list is out of date. Please refresh the page.');
  END IF;

  FOR v_i IN 1 .. array_length(p_ids, 1) LOOP
    UPDATE public.section_slides
    SET sort_order = v_i, updated_at = now()
    WHERE id = p_ids[v_i] AND section_id = p_section_id;
  END LOOP;

  PERFORM public._sb_audit(p_actor, 'section.reorder', p_section_id, jsonb_build_object('count', v_count));
  RETURN jsonb_build_object('success', true, 'sectionId', p_section_id);
END;
$$;

-- 8. Audited Admin RPC: admin_section_set_active
CREATE OR REPLACE FUNCTION public.admin_section_set_active(p_actor uuid, p_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.section_slides;
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_id IS NULL THEN PERFORM public.sb_fail('Slide id required'); END IF;

  UPDATE public.section_slides
  SET is_active = coalesce(p_active, false), updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN PERFORM public.sb_fail('Slide not found'); END IF;

  PERFORM public._sb_audit(p_actor, 'section.set_active', p_id::text, jsonb_build_object('sectionId', v_row.section_id, 'active', v_row.is_active));
  RETURN jsonb_build_object('success', true, 'slide', public._sb_section_slide_json(v_row));
END;
$$;

-- 9. Audited Admin RPC: admin_section_save_settings
CREATE OR REPLACE FUNCTION public.admin_section_save_settings(p_actor uuid, p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_section_id  text;
  v_autoplay    boolean;
  v_speed       numeric(4, 1);
  v_counter     boolean;
  v_nav         boolean;
  v_dots        boolean;
  v_row         public.section_slider_settings;
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN PERFORM public.sb_fail('Settings object required'); END IF;

  v_section_id := btrim(coalesce(p_settings ->> 'sectionId', ''));
  IF v_section_id NOT IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi') THEN
    PERFORM public.sb_fail('Invalid department section identifier');
  END IF;

  v_autoplay := coalesce((p_settings ->> 'autoplay')::boolean, true);
  v_speed    := coalesce((p_settings ->> 'autoplaySeconds')::numeric, 5.0);
  IF v_speed < 2 OR v_speed > 20 THEN PERFORM public.sb_fail('Autoplay speed must be between 2 and 20 seconds'); END IF;
  v_counter  := coalesce((p_settings ->> 'showCounter')::boolean, true);
  v_nav      := coalesce((p_settings ->> 'showNavigation')::boolean, true);
  v_dots     := coalesce((p_settings ->> 'showDots')::boolean, true);

  INSERT INTO public.section_slider_settings (
    section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at
  ) VALUES (
    v_section_id, v_autoplay, v_speed, v_counter, v_nav, v_dots, now()
  )
  ON CONFLICT (section_id) DO UPDATE SET
    autoplay         = EXCLUDED.autoplay,
    autoplay_seconds = EXCLUDED.autoplay_seconds,
    show_counter     = EXCLUDED.show_counter,
    show_navigation  = EXCLUDED.show_navigation,
    show_dots        = EXCLUDED.show_dots,
    updated_at       = now()
  RETURNING * INTO v_row;

  PERFORM public._sb_audit(p_actor, 'section.save_settings', v_section_id, to_jsonb(v_row));
  RETURN to_jsonb(v_row);
END;
$$;

-- 10. Audited Admin RPC: admin_section_reset_defaults
CREATE OR REPLACE FUNCTION public.admin_section_reset_defaults(p_actor uuid, p_section_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_actor IS NULL OR NOT public.is_admin() THEN PERFORM public.sb_fail('Admin identity required'); END IF;
  IF p_section_id IS NOT NULL AND p_section_id NOT IN ('dept_jamuna_fish', 'dept_village_chicken', 'dept_heritage_rice', 'dept_ghee_doi') THEN
    PERFORM public.sb_fail('Invalid department section identifier');
  END IF;

  PERFORM public._sb_section_seed_defaults(p_section_id);
  PERFORM public._sb_audit(p_actor, 'section.reset_defaults', coalesce(p_section_id, 'all_sections'), jsonb_build_object('reset', true));

  RETURN jsonb_build_object('success', true, 'sectionId', coalesce(p_section_id, 'all_sections'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.sb_section_valid_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sb_hero_valid_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_save_slide TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_delete_slide TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_reorder TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_set_active TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_save_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_section_reset_defaults TO authenticated;

COMMIT;
