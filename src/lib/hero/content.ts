/**
 * Hero banner content helpers shared by the storefront and the admin preview:
 * built-in defaults (used until the database answers, or if it is unreachable), row mappers that
 * re-validate everything coming from the network / localStorage, and small pure utilities.
 *
 * KEEP `DEFAULT_HERO_*` IN SYNC with `_sb_hero_seed_defaults()` in the 06 migration.
 */
import type { HeroSettings, HeroSlide } from "@/types";
import {
  HERO_ICON_KEYS,
  HERO_IMAGE_POSITIONS,
  HERO_LIMITS,
  HERO_MAX_SLIDES,
  HERO_MAX_TRUST_ITEMS,
  cleanHeroText,
  isValidHeroImageUrl,
  isValidHeroLink,
  type HeroIconKey,
  type HeroImagePosition,
} from "./schema";

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    id: "default-jamuna-fish",
    sortOrder: 1,
    isActive: true,
    imageUrl: "/images/banners/hero-jamuna-river-dawn.jpg",
    imageAlt: "যমুনা নদীর ভোরবেলার তাজা মাছ — সাধ্যের বাজার",
    imagePosition: "center",
    badgeText: "যমুনার মোহনা থেকে সরাসরি",
    badgeIcon: "fish",
    title: "ভোরবেলা ধরা যমুনার তাজা নদীর মাছ",
    subtitle: "ফরমালিন ও রাসায়নিকমুক্ত • বরফ ছাড়া নদী থেকে সরাসরি আপনার ঘরে",
    ctaText: "তাজা মাছ প্রি-অর্ডার করুন",
    ctaLink: "/pre-orders",
    startsAt: null,
    endsAt: null,
  },
  {
    id: "default-ghee-doi",
    sortOrder: 2,
    isActive: true,
    imageUrl: "/images/banners/hero-gawa-ghee-bogura-doi.jpg",
    imageAlt: "সিরাজগঞ্জের খাঁটি গাওয়া ঘি ও বগুড়ার শাহী দই — সাধ্যের বাজার",
    imagePosition: "center",
    badgeText: "শতভাগ খাঁটি দুগ্ধজাত ঐতিহ্য",
    badgeIcon: "award",
    title: "সিরাজগঞ্জের গাওয়া ঘি ও বগুড়ার শাহী দই",
    subtitle: "কোনো প্রিজারভেটিভ বা ডালডা ছাড়া ঐতিহ্যবাহী গ্রাম্য মাটির স্বাদ",
    ctaText: "ঘি ও দই সংগ্রহ করুন",
    ctaLink: "/shop?category=ghee-and-dairy",
    startsAt: null,
    endsAt: null,
  },
  {
    id: "default-village-poultry",
    sortOrder: 3,
    isActive: true,
    imageUrl: "/images/banners/hero-village-deshi-poultry.jpg",
    imageAlt: "গ্রামের মুক্ত চারণভূমির দেশি মুরগি ও হাঁসের ডিম — সাধ্যের বাজার",
    imagePosition: "center",
    badgeText: "উন্মুক্ত চারণভূমির প্রাকৃতিক খামার",
    badgeIcon: "flame",
    title: "গ্রামের মুক্ত খামারের দেশি মুরগি ও ডিম",
    subtitle: "কৃত্রিম ফিড ও অ্যান্টিবায়োটিকমুক্ত স্বাস্থ্যকর প্রাকৃতিক পুষ্টি",
    ctaText: "দেশি মুরগি ও ডিম দেখুন",
    ctaLink: "/shop?category=deshi-meat-poultry",
    startsAt: null,
    endsAt: null,
  },
  {
    id: "default-heritage-rice",
    sortOrder: 4,
    isActive: true,
    imageUrl: "/images/banners/hero-heritage-golden-rice.jpg",
    imageAlt: "দিনাজপুরের কাটারিভোগ ও ঐতিহ্যবাহী লাল চাল — সাধ্যের বাজার",
    imagePosition: "center",
    badgeText: "অকৃত্রিম গ্রাম্য পুষ্টি ও সুবাস",
    badgeIcon: "wheat",
    title: "দিনাজপুরের কাটারিভোগ ও সুগন্ধি লাল চাল",
    subtitle: "পলিশহীন, ফাইবার সমৃদ্ধ ও প্রাচীন জাতের আসল পুষ্টিকর চাল",
    ctaText: "অর্গানিক চাল কিনুন",
    ctaLink: "/shop?category=organic-rice-honey",
    startsAt: null,
    endsAt: null,
  },
];

export const DEFAULT_HERO_SETTINGS: HeroSettings = {
  showHeadline: true,
  headline: "সাধ্যের বাজার — যমুনা নদীর তাজা দেশি মাছ, খাঁটি গাওয়া ঘি ও বগুড়ার দই",
  subheadline:
    "১০০% কেমিক্যাল ও ফরমালিনমুক্ত • নদী ও প্রান্তিক খামার থেকে সরাসরি নিজস্ব কোল্ড-চেইনে হোম ডেলিভারি",
  showGuarantee: true,
  guaranteeText: "১০০% প্রাকৃতিক ও ফরমালিনমুক্ত",
  showCounter: true,
  autoplay: true,
  autoplaySeconds: 4.5,
  showTrustItems: true,
  trustItems: [
    { icon: "leaf", title: "১০০% ফরমালিনমুক্ত", subtitle: "যমুনা নদী ও গ্রাম্য খামার" },
    {
      icon: "truck",
      title: "থার্মাল হোম ডেলিভারি",
      subtitle: "ঢাকা ৳{insideDhakaFee} • সারা দেশ ৳{outsideDhakaFee}",
    },
    { icon: "shield", title: "নিরাপদ পেমেন্ট", subtitle: "বিকাশ, কার্ড ও ক্যাশ অন ডেলিভারি" },
    { icon: "clock", title: "লাইভ অর্ডার ট্র্যাকিং", subtitle: "ইউনিক অর্ডার আইডি দিয়ে ট্র্যাক" },
  ],
};

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? cleanHeroText(v).slice(0, max) : "";

const iconOf = (v: unknown, fallback: HeroIconKey = "sparkles"): HeroIconKey =>
  (HERO_ICON_KEYS as readonly string[]).includes(v as string) ? (v as HeroIconKey) : fallback;

const positionOf = (v: unknown): HeroImagePosition =>
  (HERO_IMAGE_POSITIONS as readonly string[]).includes(v as string)
    ? (v as HeroImagePosition)
    : "center";

const isoOrNull = (v: unknown): string | null => {
  if (typeof v !== "string" || v === "") return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
};

/** Maps one DB row (snake_case) OR one RPC/cache object (camelCase). Returns null if unusable. */
export function mapHeroSlide(raw: unknown): HeroSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const pick = (snake: string, camel: string) => (snake in r ? r[snake] : r[camel]);

  const imageUrl = pick("image_url", "imageUrl");
  const title = str(r.title, HERO_LIMITS.title);
  if (!isValidHeroImageUrl(imageUrl) || title === "" || typeof r.id !== "string") return null;

  const ctaTextRaw = str(pick("cta_text", "ctaText"), HERO_LIMITS.cta);
  const ctaLinkRaw = pick("cta_link", "ctaLink");
  const ctaLink = isValidHeroLink(ctaLinkRaw) ? ctaLinkRaw : "";

  return {
    id: r.id,
    sortOrder: Number(pick("sort_order", "sortOrder")) || 0,
    isActive: Boolean(pick("is_active", "isActive") ?? true),
    imageUrl,
    imageAlt: str(pick("image_alt", "imageAlt"), HERO_LIMITS.alt),
    imagePosition: positionOf(pick("image_position", "imagePosition")),
    badgeText: str(pick("badge_text", "badgeText"), HERO_LIMITS.badge),
    badgeIcon: iconOf(pick("badge_icon", "badgeIcon")),
    title,
    subtitle: str(r.subtitle, HERO_LIMITS.subtitle),
    // A button without a valid link would be a dead button: drop it instead.
    ctaText: ctaLink === "" ? "" : ctaTextRaw,
    ctaLink,
    startsAt: isoOrNull(pick("starts_at", "startsAt")),
    endsAt: isoOrNull(pick("ends_at", "endsAt")),
    updatedAt: typeof (r.updated_at ?? r.updatedAt) === "string" ? String(r.updated_at ?? r.updatedAt) : undefined,
  };
}

export function mapHeroSlides(rows: unknown): HeroSlide[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(mapHeroSlide)
    .filter((s): s is HeroSlide => s !== null)
    .slice(0, HERO_MAX_SLIDES * 2)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Maps a hero_settings row / cache object, falling back to the defaults field by field. */
export function mapHeroSettings(raw: unknown): HeroSettings {
  const d = DEFAULT_HERO_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const pick = (snake: string, camel: string) => (snake in r ? r[snake] : r[camel]);
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

  const rawItems = pick("trust_items", "trustItems");
  const items = Array.isArray(rawItems)
    ? rawItems
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const o = it as Record<string, unknown>;
          const title = str(o.title, HERO_LIMITS.trustTitle);
          if (title === "") return null;
          return {
            icon: iconOf(o.icon, "leaf"),
            title,
            subtitle: str(o.subtitle, HERO_LIMITS.trustSubtitle),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .slice(0, HERO_MAX_TRUST_ITEMS)
    : d.trustItems;

  const seconds = Number(pick("autoplay_seconds", "autoplaySeconds"));
  return {
    showHeadline: bool(pick("show_headline", "showHeadline"), d.showHeadline),
    headline: str(r.headline, HERO_LIMITS.headline),
    subheadline: str(pick("subheadline", "subheadline"), HERO_LIMITS.subheadline),
    showGuarantee: bool(pick("show_guarantee", "showGuarantee"), d.showGuarantee),
    guaranteeText: str(pick("guarantee_text", "guaranteeText"), HERO_LIMITS.guarantee),
    showCounter: bool(pick("show_counter", "showCounter"), d.showCounter),
    autoplay: bool(r.autoplay, d.autoplay),
    autoplaySeconds: Number.isFinite(seconds) && seconds >= 2 && seconds <= 20 ? seconds : d.autoplaySeconds,
    showTrustItems: bool(pick("show_trust_items", "showTrustItems"), d.showTrustItems),
    trustItems: items,
  };
}

/** True when the slide should be on the storefront right now (switch on + inside its schedule). */
export function isHeroSlideLive(slide: HeroSlide, now: number = Date.now()): boolean {
  if (!slide.isActive) return false;
  if (slide.startsAt && Date.parse(slide.startsAt) > now) return false;
  if (slide.endsAt && Date.parse(slide.endsAt) <= now) return false;
  return true;
}

export type HeroSlideState = "live" | "hidden" | "scheduled" | "expired";

export function heroSlideState(slide: HeroSlide, now: number = Date.now()): HeroSlideState {
  if (!slide.isActive) return "hidden";
  if (slide.startsAt && Date.parse(slide.startsAt) > now) return "scheduled";
  if (slide.endsAt && Date.parse(slide.endsAt) <= now) return "expired";
  return "live";
}

/** Fills {insideDhakaFee} / {outsideDhakaFee} so highlight text stays in sync with delivery settings. */
export function applyHeroPlaceholders(
  textValue: string,
  fees: { insideDhakaFee: number; outsideDhakaFee: number }
): string {
  return textValue
    .replace(/\{insideDhakaFee\}/g, String(fees.insideDhakaFee))
    .replace(/\{outsideDhakaFee\}/g, String(fees.outsideDhakaFee));
}
