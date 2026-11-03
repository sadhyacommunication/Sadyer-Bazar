/**
 * Section banner & department carousel CMS: default data, mappers and helpers.
 *
 * Provides:
 *   - DEFAULT_SECTION_SLIDES (8 rich slides, 2 per department, mirroring migration 12)
 *   - DEFAULT_SECTION_SETTINGS (per department)
 *   - mapSectionSlide, mapSectionSlides, mapSectionSettings (robust camelCase <-> snake_case mappers)
 *   - isSectionSlideLive (filters out scheduled / inactive slides)
 *   - DEPARTMENT_METADATA (Bangla & English names, themes, badges)
 */
import type { HeroIconKey } from "@/lib/hero/schema";
import type { DepartmentSectionKey, SectionBannerLayout } from "./schema";

export interface SectionSlide {
  id: string;
  sectionId: DepartmentSectionKey;
  sortOrder: number;
  isActive: boolean;
  imageUrl: string;
  imageAlt: string;
  badgeTextEn: string;
  badgeTextBn: string;
  badgeIcon: HeroIconKey;
  titleEn: string;
  headlineBn: string;
  convincingSubtextBn: string;
  descriptionEn: string;
  originLocation: string;
  highlights: string[];
  pairingTipText: string;
  pairingTargetHref: string;
  pairingTargetLabel: string;
  ctaText: string;
  ctaLink: string;
  bannerLayout: SectionBannerLayout;
  startsAt: string | null;
  endsAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SectionSliderSettings {
  sectionId: DepartmentSectionKey;
  autoplay: boolean;
  autoplaySeconds: number;
  showCounter: boolean;
  showNavigation: boolean;
  showDots: boolean;
  updatedAt?: string;
}

export interface DepartmentMeta {
  sectionId: DepartmentSectionKey;
  deptNumber: string;
  nameEn: string;
  nameBn: string;
  categorySlug: string;
  accentTheme: "emerald" | "amber" | "terracotta" | "royal";
  defaultLayout: SectionBannerLayout;
}

export const DEPARTMENT_METAS: Record<DepartmentSectionKey, DepartmentMeta> = {
  dept_jamuna_fish: {
    sectionId: "dept_jamuna_fish",
    deptNumber: "01",
    nameEn: "Fresh Fish from Jamuna River",
    nameBn: "যমুনা নদীর ভোরের তাজা মাছ",
    categorySlug: "jamuna-river-fish",
    accentTheme: "emerald",
    defaultLayout: "default",
  },
  dept_village_chicken: {
    sectionId: "dept_village_chicken",
    deptNumber: "02",
    nameEn: "Deshi Chicken & Eggs from Village",
    nameBn: "গ্রামের আসল দেশি মুরগি, হাঁস ও ডিম",
    categorySlug: "deshi-meat-poultry",
    accentTheme: "amber",
    defaultLayout: "reversed",
  },
  dept_heritage_rice: {
    sectionId: "dept_heritage_rice",
    deptNumber: "03",
    nameEn: "Kataribhog, Basmati & Red Rice",
    nameBn: "দিনাজপুরের কাটারিভোগ, বাসমতি ও লাল চাল",
    categorySlug: "organic-rice-honey",
    accentTheme: "terracotta",
    defaultLayout: "default",
  },
  dept_ghee_doi: {
    sectionId: "dept_ghee_doi",
    deptNumber: "04",
    nameEn: "Pure Gawa Ghee & Bogura Doi",
    nameBn: "খাঁটি গাওয়া ঘি ও বগুড়ার শাহী দই",
    categorySlug: "ghee-and-dairy",
    accentTheme: "royal",
    defaultLayout: "reversed",
  },
};

export const DEFAULT_SECTION_SETTINGS: Record<DepartmentSectionKey, SectionSliderSettings> = {
  dept_jamuna_fish: {
    sectionId: "dept_jamuna_fish",
    autoplay: true,
    autoplaySeconds: 5.0,
    showCounter: true,
    showNavigation: true,
    showDots: true,
  },
  dept_village_chicken: {
    sectionId: "dept_village_chicken",
    autoplay: true,
    autoplaySeconds: 5.0,
    showCounter: true,
    showNavigation: true,
    showDots: true,
  },
  dept_heritage_rice: {
    sectionId: "dept_heritage_rice",
    autoplay: true,
    autoplaySeconds: 5.0,
    showCounter: true,
    showNavigation: true,
    showDots: true,
  },
  dept_ghee_doi: {
    sectionId: "dept_ghee_doi",
    autoplay: true,
    autoplaySeconds: 5.0,
    showCounter: true,
    showNavigation: true,
    showDots: true,
  },
};

export const DEFAULT_SECTION_SLIDES: SectionSlide[] = [
  // Dept 01: Jamuna River Fish
  {
    id: "00000000-0000-0000-0001-000000000001",
    sectionId: "dept_jamuna_fish",
    sortOrder: 1,
    isActive: true,
    imageUrl: "/images/banners/jamuna-fisherman-banner.jpg",
    imageAlt: "যমুনার ভোরের তাজা মাছ — জেলের জাল থেকে সরাসরি আপনার ঘরে",
    badgeTextEn: "Fresh Fish from Jamuna River",
    badgeTextBn: "যমুনা নদীর ভোরের তাজা মাছ",
    badgeIcon: "fish",
    titleEn: "Wild-Caught Fresh Fish Directly from Jamuna River",
    headlineBn: "যমুনার ভোরের তাজা মাছ — জেলের জাল থেকে সরাসরি আপনার ঘরে!",
    convincingSubtextBn:
      "১০০% ফরমালিন ও হিমাগার (Cold-Storage) মুক্ত। ভোরবেলা সিরাজগঞ্জ ও সারিয়াকান্দি ঘাটে জেলের জাল থেকে তুলেই ফুড-গ্রেড আইসবক্সে প্যাকিং করে পাঠানো হয়।",
    descriptionEn:
      "We never buy from city wholesale markets or keep fish frozen in storage. Our local team stands at the Jamuna river ghats at dawn to collect wild Piali, Kajoli, Ayer, Boal, Chital, Deshi Rui, and giant Galda Chingri.",
    originLocation: "Sirajganj & Sariakandi Jamuna Ghat",
    highlights: [
      "100% Wild River Catch — Zero Farmed or Cold-Storage Fish",
      "Custom Bengali Cutting & Cleaning Options Available",
      "Packed Immediately in Food-Grade Thermal Ice Boxes",
    ],
    pairingTipText: "Cook fresh river fish with unpolished Red Rice",
    pairingTargetHref: "#dept-heritage-rice",
    pairingTargetLabel: "See Heritage Rice",
    ctaText: "Shop All Fresh Fish from Jamuna River",
    ctaLink: "/shop?category=jamuna-river-fish",
    bannerLayout: "default",
    startsAt: null,
    endsAt: null,
  },
  {
    id: "00000000-0000-0000-0001-000000000002",
    sectionId: "dept_jamuna_fish",
    sortOrder: 2,
    isActive: true,
    imageUrl: "/images/banners/hero-jamuna-river-dawn.jpg",
    imageAlt: "সিরাজগঞ্জ ঘাটের স্পেশাল তাজা দেশি মাছ ও প্রিমিয়াম আইড় চিতল",
    badgeTextEn: "Daily Sunrise Catch",
    badgeTextBn: "ভোরের স্পেশাল নদীর আইড়, চিতল ও বোয়াল",
    badgeIcon: "sparkles",
    titleEn: "Dawn Harvest: Wild River Piali, Kajoli, Boal & Chital",
    headlineBn: "নদীর আসল স্বাদ পেতে আজই বুকিং করুন ভোরের তাজা মাছ!",
    convincingSubtextBn:
      "প্রাকৃতিক প্রবাহের জীবন্ত নদী থেকে সংগ্রহকৃত দেশি মাছ। অর্ডার করার পর তাজা মাছ এনে আপনার পছন্দমতো কেটে থার্মাল বক্সে পৌঁছে দেওয়া হয়।",
    descriptionEn:
      "Authentic fresh-water river fish with zero preservatives. Sourced strictly from verified traditional fishermen at first light.",
    originLocation: "Sariakandi, Bogura & Sirajganj Basin",
    highlights: [
      "Direct Fishermen Catch with Authentic Sweet River Taste",
      "No Preservatives, Ice-Cured Freshness Only",
      "100% Money-Back Quality & Freshness Guarantee",
    ],
    pairingTipText: "Pair Boal & Chital fish curry with fragrant Chinigura Rice",
    pairingTargetHref: "#dept-heritage-rice",
    pairingTargetLabel: "View Polao Rice",
    ctaText: "Pre-Order Tomorrow Sunrise Catch",
    ctaLink: "/pre-orders",
    bannerLayout: "default",
    startsAt: null,
    endsAt: null,
  },

  // Dept 02: Deshi Chicken, Duck & Eggs
  {
    id: "00000000-0000-0000-0002-000000000001",
    sectionId: "dept_village_chicken",
    sortOrder: 1,
    isActive: true,
    imageUrl: "/images/banners/village-chicken-banner.jpg",
    imageAlt: "গ্রামের আসল দেশি মুরগি ও ডিম — উঠানে পালা শতভাগ প্রাকৃতিক",
    badgeTextEn: "Deshi Chicken & Eggs from Village",
    badgeTextBn: "গ্রামের আসল দেশি মুরগি, হাঁস ও ডিম",
    badgeIcon: "flame",
    titleEn: "Free-Range Deshi Chicken, Wetland Duck & Golden-Yolk Eggs",
    headlineBn: "গ্রামীণ উঠানে প্রাকৃতিক খাবারে বেড়ে ওঠা আসল দেশি মুরগি ও ডিম!",
    convincingSubtextBn:
      "ফার্মের সিন্থেটিক ফিড, গ্রোথ হরমোন ও অ্যান্টিবায়োটিক সম্পূর্ণ মুক্ত। বগুড়া, টাঙ্গাইল ও চলনবিল অঞ্চলের গ্রামীণ গৃহস্থ বাড়ি থেকে সরাসরি সংগৃহীত।",
    descriptionEn:
      "Rediscover the authentic taste and aroma of childhood village curry (মাটির গন্ধ ও ঘরোয়া রান্নার স্বাদ). Our free-range Deshi chickens and Chalan Beel ducks are Halal processed on the morning of dispatch and cut to your exact preference.",
    originLocation: "Bogura, Tangail & Chalan Beel Villages",
    highlights: [
      "100% Free-Range Village Homestead Foraged Poultry",
      "Zero Antibiotics, Steroids, or Commercial Broiler Feed",
      "Freshly Halal Dressed & Custom Curry-Cut on Delivery Morning",
    ],
    pairingTipText: "Pair Deshi Chicken Roast or Bhuna with Chinigura Polao",
    pairingTargetHref: "#dept-heritage-rice",
    pairingTargetLabel: "Explore Polao & Basmati Rice",
    ctaText: "Shop All Deshi Chicken & Eggs from Village",
    ctaLink: "/shop?category=deshi-meat-poultry",
    bannerLayout: "reversed",
    startsAt: null,
    endsAt: null,
  },
  {
    id: "00000000-0000-0000-0002-000000000002",
    sectionId: "dept_village_chicken",
    sortOrder: 2,
    isActive: true,
    imageUrl: "/images/banners/hero-village-deshi-poultry.jpg",
    imageAlt: "চলনবিলের দেশি হাঁস ও লাল কুসুমের পুষ্টিকর ডিম",
    badgeTextEn: "Wetland Free-Range Duck",
    badgeTextBn: "চলনবিলের প্রাকৃতিক হাঁস ও খাঁটি দেশি ডিম",
    badgeIcon: "award",
    titleEn: "Natural Wetland Grazed Deshi Duck & Golden Yolk Eggs",
    headlineBn: "চলনবিলের জলজ শামুক-গেঁড়ি খাওয়া প্রাকৃতিক দেশি হাঁসের মাংস!",
    convincingSubtextBn:
      "গ্রামের মুক্ত জলাশয়ে সাঁতার কাটা দেশি হাঁস। দেশি মসলা ও খাঁটি ঘিয়ে রান্না করলে পাবেন ঐতিহ্যবাহী ভূনা মাংসের অতুলনীয় ঘ্রাণ।",
    descriptionEn:
      "Foraged naturally in wide freshwater wetlands. Rich in iron, clean protein and natural yellow yolk nutrients with no artificial coloring.",
    originLocation: "Chalan Beel, Natore & Sirajganj",
    highlights: [
      "Foraged on Natural Aquatic Snails and Farm Grains",
      "Strict Halal Processing with Skin-On/Off Options",
      "Chilled Packaging for Peak Freshness",
    ],
    pairingTipText: "Roast with Sirajganj Bilona Ghee for Rich Traditional Aroma",
    pairingTargetHref: "#dept-ghee-doi",
    pairingTargetLabel: "See Pure Gawa Ghee",
    ctaText: "Order Fresh Deshi Duck & Eggs",
    ctaLink: "/shop?category=deshi-meat-poultry",
    bannerLayout: "reversed",
    startsAt: null,
    endsAt: null,
  },

  // Dept 03: Heritage Rice
  {
    id: "00000000-0000-0000-0003-000000000001",
    sectionId: "dept_heritage_rice",
    sortOrder: 1,
    isActive: true,
    imageUrl: "/images/banners/heritage-rice-banner.jpg",
    imageAlt: "দিনাজপুরের ঐতিহ্যবাহী সুগন্ধি কাটারিভোগ ও পুষ্টিকর চালের সমাহার",
    badgeTextEn: "Kataribhog, Basmati & Red Rice",
    badgeTextBn: "দিনাজপুরের কাটারিভোগ, বাসমতি ও লাল চাল",
    badgeIcon: "wheat",
    titleEn: "Royal Heritage Rice: Kataribhog, Aged Basmati, Chinigura & Red Rice",
    headlineBn: "দিনাজপুরের ঐতিহ্যবাহী সুগন্ধি কাটারিভোগ, প্রিমিয়াম বাসমতি ও ঢেঁকি ছাঁটা লাল চাল!",
    convincingSubtextBn:
      "কৃত্রিম সুগন্ধি, মোম পলিশ (Wax Polish) এবং কেমিক্যাল ব্লিচিং মুক্ত। প্রতিদিনের স্বাস্থ্যকর ভাত, ডায়াবেটিক ডায়েট কিংবা রাজকীয় বিরিয়ানি ও পোলাওয়ের জন্য সেরা।",
    descriptionEn:
      "From GI-famous Dinajpur Kataribhog and 12-month aged extra-long Basmati to low-GI full-fiber unpolished Red Rice and Bogura Chinigura—every grain is sourced directly from heritage husking mills with intact nutrition.",
    originLocation: "Dinajpur, Sherpur & Naogaon Heritage Mills",
    highlights: [
      "Dinajpur GI-Origin Kataribhog & 12-Month Aged Extra-Long Basmati",
      "Unpolished Low-GI Full-Fiber Red Rice (Diabetic & Heart Friendly)",
      "100% Stone-Free, Unbleached & Zero Chemical Wax Polish",
    ],
    pairingTipText: "Top steaming Kataribhog or Red Rice with 1 spoon Gawa Ghee",
    pairingTargetHref: "#dept-ghee-doi",
    pairingTargetLabel: "See Pure Gawa Ghee",
    ctaText: "Shop All Kataribhog, Basmati & Red Rice",
    ctaLink: "/shop?category=organic-rice-honey",
    bannerLayout: "default",
    startsAt: null,
    endsAt: null,
  },
  {
    id: "00000000-0000-0000-0003-000000000002",
    sectionId: "dept_heritage_rice",
    sortOrder: 2,
    isActive: true,
    imageUrl: "/images/banners/hero-heritage-golden-rice.jpg",
    imageAlt: "বগুড়ার সুগন্ধি চিনিগুঁড়া পোলাও চাল ও সুন্দরবনের খাঁটি মধু",
    badgeTextEn: "Aromatic Polao & Honey",
    badgeTextBn: "ঐতিহ্যবাহী চিনিগুঁড়া পোলাও চাল ও সুন্দরবনের মধু",
    badgeIcon: "sparkles",
    titleEn: "Aromatic Bogura Chinigura Rice & Raw Forest Honey",
    headlineBn: "উৎসব ও পোলাওয়ের জন্য বগুড়ার আসল খুশবুদার চিনিগুঁড়া চাল!",
    convincingSubtextBn:
      "প্রাচীন মাটির উর্বরতায় ফলানো ছোট দানার সুগন্ধি চাল, যার মৌ মৌ ঘ্রাণে যেকোনো বিরিয়ানি ও পোলাও হয়ে ওঠে অনন্য।",
    descriptionEn:
      "Heritage non-GMO grain varieties carefully milled to preserve bran layer vitamins, low glycemic response and exquisite natural floral fragrance.",
    originLocation: "Sherpur, Bogura & Sundarbans Mangrove",
    highlights: [
      "Naturally Aged for 12 Months for Non-Sticky Fluffy Grains",
      "Full Grain Purity Guarantee with Zero Broken Rice",
      "Tested for 100% Natural Purity with Zero Synthetic Fragrance",
    ],
    pairingTipText: "Cook polao with Bilona Ghee for unmatched wedding aroma",
    pairingTargetHref: "#dept-ghee-doi",
    pairingTargetLabel: "View Gawa Ghee",
    ctaText: "Explore Fragrant Chinigura Rice",
    ctaLink: "/shop?category=organic-rice-honey",
    bannerLayout: "default",
    startsAt: null,
    endsAt: null,
  },

  // Dept 04: Pure Gawa Ghee & Bogura Doi
  {
    id: "00000000-0000-0000-0004-000000000001",
    sectionId: "dept_ghee_doi",
    sortOrder: 1,
    isActive: true,
    imageUrl: "/images/banners/ghee-bogura-doi-banner.jpg",
    imageAlt: "সিরাজগঞ্জের দানাদার ঘি ও বগুড়ার ঐতিহ্যবাহী মাটির সরার শাহী দই",
    badgeTextEn: "Pure Gawa Ghee & Bogura Doi",
    badgeTextBn: "খাঁটি গাওয়া ঘি ও বগুড়ার শাহী দই",
    badgeIcon: "award",
    titleEn: "Sirajganj Bilona Gawa Ghee, Bogura Clay-Pot Shahi Doi & Raw Honey",
    headlineBn: "সিরাজগঞ্জের দানাদার গাওয়া ঘি ও বগুড়ার ঐতিহ্যবাহী মাটির সরার শাহী দই!",
    convincingSubtextBn:
      "খাঁটি গরুর দুধের ননি থেকে কাঠের চুলায় তৈরি দানাদার গাওয়া ঘি এবং শেরপুর-বগুড়ার কারিগরদের হাতে তৈরি মাটির সরার আসল শাহী মিষ্টি দই ও ক্ষীরসা।",
    descriptionEn:
      "Experience the crown jewels of North Bengal's dairy heritage. Our Gawa Ghee is 100% free from dalda or palm oil, and our Bogura Shahi Doi & Khirsha are dispatched fresh in insulated thermal packaging.",
    originLocation: "Sirajganj Bathan & Sherpur, Bogura",
    highlights: [
      "Traditional Bilona Wood-Fired Granular Cow Milk Gawa Ghee",
      "Original Terracotta Clay Sora (মাটির সরা) Bogura Shahi Doi & Khirsha",
      "Lab-Verified 100% Pure — Zero Dalda, Artificial Essence or Starch",
    ],
    pairingTipText: "Bundle Ghee, Doi, Fish & Rice together for 8% Combo Savings",
    pairingTargetHref: "#combo-builder",
    pairingTargetLabel: "Build Family Box",
    ctaText: "Shop All Pure Gawa Ghee & Bogura Doi",
    ctaLink: "/shop?category=ghee-and-dairy",
    bannerLayout: "reversed",
    startsAt: null,
    endsAt: null,
  },
  {
    id: "00000000-0000-0000-0004-000000000002",
    sectionId: "dept_ghee_doi",
    sortOrder: 2,
    isActive: true,
    imageUrl: "/images/banners/hero-gawa-ghee-bogura-doi.jpg",
    imageAlt: "ঐতিহ্যবাহী বিলোনা ঘি ও শেরপুরের আসল সরের ক্ষীরসা দই",
    badgeTextEn: "Royal Dairy Heritage",
    badgeTextBn: "আসল শেরপুরের ক্ষীরসা ও দানাদার বাথান ঘি",
    badgeIcon: "sparkles",
    titleEn: "Heritage Sherpur Clay Sora Khirsha & Golden Bathan Ghee",
    headlineBn: "দুধের ঘন সর ও কাঠের চুলার মৃদু তাপে তৈরি ঐতিহ্যবাহী ক্ষীরসা দই!",
    convincingSubtextBn:
      "শত বছরের প্রাচীন রেসিপিতে খাঁটি গরুর দুধে তৈরি বগুড়ার মিষ্টি শাহী দই ও ক্ষীরসা। প্রতিটি চামচে অনুভব করুন প্রাচীন বাংলার আতিথেয়তার স্বাদ।",
    descriptionEn:
      "Crafted by generational sweet-makers in terracotta pots that naturally absorb excess whey, yielding dense, velvety curd and caramelized cream crust.",
    originLocation: "Sherpur, Bogura & Shahjadpur Bathan",
    highlights: [
      "Slow-Caramelized Over Tamarind Wood Fire for 8+ Hours",
      "Clay Pot Breathing Ensures Firm Texture & Deep Aroma",
      "Strict Cold-Chain Express Van Delivery to Dhaka Homes",
    ],
    pairingTipText: "Enjoy chilled Bogura Doi right after fresh river fish lunch",
    pairingTargetHref: "#dept-jamuna-fish",
    pairingTargetLabel: "See River Fish",
    ctaText: "Order Bogura Clay Sora Doi & Ghee",
    ctaLink: "/shop?category=ghee-and-dairy",
    bannerLayout: "reversed",
    startsAt: null,
    endsAt: null,
  },
];

/**
 * Maps raw database row or camelCase object to a validated SectionSlide.
 */
export function mapSectionSlide(raw: Record<string, unknown>): SectionSlide {
  const highlightsRaw = raw.highlights ?? [];
  let highlights: string[] = [];
  if (Array.isArray(highlightsRaw)) {
    highlights = highlightsRaw.map((h) =>
      typeof h === "string" ? h : typeof h === "object" && h && "text" in h ? String((h as { text: unknown }).text) : ""
    ).filter(Boolean);
  }

  return {
    id: String(raw.id ?? ""),
    sectionId: (raw.section_id ?? raw.sectionId ?? "dept_jamuna_fish") as DepartmentSectionKey,
    sortOrder: Number(raw.sort_order ?? raw.sortOrder ?? 0),
    isActive: Boolean(raw.is_active ?? raw.isActive ?? true),
    imageUrl: String(raw.image_url ?? raw.imageUrl ?? ""),
    imageAlt: String(raw.image_alt ?? raw.imageAlt ?? ""),
    badgeTextEn: String(raw.badge_text_en ?? raw.badgeTextEn ?? ""),
    badgeTextBn: String(raw.badge_text_bn ?? raw.badgeTextBn ?? ""),
    badgeIcon: (raw.badge_icon ?? raw.badgeIcon ?? "sparkles") as HeroIconKey,
    titleEn: String(raw.title_en ?? raw.titleEn ?? ""),
    headlineBn: String(raw.headline_bn ?? raw.headlineBn ?? ""),
    convincingSubtextBn: String(raw.convincing_subtext_bn ?? raw.convincingSubtextBn ?? ""),
    descriptionEn: String(raw.description_en ?? raw.descriptionEn ?? ""),
    originLocation: String(raw.origin_location ?? raw.originLocation ?? ""),
    highlights,
    pairingTipText: String(raw.pairing_tip_text ?? raw.pairingTipText ?? ""),
    pairingTargetHref: String(raw.pairing_target_href ?? raw.pairingTargetHref ?? ""),
    pairingTargetLabel: String(raw.pairing_target_label ?? raw.pairingTargetLabel ?? ""),
    ctaText: String(raw.cta_text ?? raw.ctaText ?? ""),
    ctaLink: String(raw.cta_link ?? raw.ctaLink ?? ""),
    bannerLayout: (raw.banner_layout ?? raw.bannerLayout ?? "default") as SectionBannerLayout,
    startsAt: raw.starts_at ? String(raw.starts_at) : raw.startsAt ? String(raw.startsAt) : null,
    endsAt: raw.ends_at ? String(raw.ends_at) : raw.endsAt ? String(raw.endsAt) : null,
    createdAt: raw.created_at ? String(raw.created_at) : raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updated_at ? String(raw.updated_at) : raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

export function mapSectionSlides(rows: unknown): SectionSlide[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => (r && typeof r === "object" ? mapSectionSlide(r as Record<string, unknown>) : null))
    .filter((s): s is SectionSlide => s !== null && Boolean(s.id && s.imageUrl));
}

export function mapSectionSettings(raw: Record<string, unknown>): SectionSliderSettings {
  const sectionId = (raw.section_id ?? raw.sectionId ?? "dept_jamuna_fish") as DepartmentSectionKey;
  const def = DEFAULT_SECTION_SETTINGS[sectionId] ?? DEFAULT_SECTION_SETTINGS.dept_jamuna_fish;
  return {
    sectionId,
    autoplay: raw.autoplay !== undefined ? Boolean(raw.autoplay) : def.autoplay,
    autoplaySeconds: Number(raw.autoplay_seconds ?? raw.autoplaySeconds ?? def.autoplaySeconds),
    showCounter: raw.show_counter !== undefined ? Boolean(raw.show_counter) : def.showCounter,
    showNavigation: raw.show_navigation !== undefined ? Boolean(raw.show_navigation) : def.showNavigation,
    showDots: raw.show_dots !== undefined ? Boolean(raw.show_dots) : def.showDots,
    updatedAt: raw.updated_at ? String(raw.updated_at) : raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

/** Check if a section slide is currently live (active + within schedule). */
export function isSectionSlideLive(slide: SectionSlide, now = Date.now()): boolean {
  if (!slide.isActive) return false;
  if (slide.startsAt && new Date(slide.startsAt).getTime() > now) return false;
  if (slide.endsAt && new Date(slide.endsAt).getTime() < now) return false;
  return true;
}
