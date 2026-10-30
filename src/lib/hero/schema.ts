/**
 * Hero banner CMS: shared constants, validators and Zod schemas.
 *
 * Pure TypeScript (only depends on `zod`, no browser / Next imports) so the SAME rules run in:
 *   - the admin UI (instant feedback while typing)
 *   - the Cloudflare edge function `/api/admin/action` (authoritative server-side check)
 * and mirror the SQL validators / CHECK constraints in supabase/migrations/*_06_hero_cms.sql
 * (defense in depth: the database independently rejects anything these rules would reject).
 */
import { z } from "zod";

export const HERO_ICON_KEYS = [
  "fish",
  "award",
  "flame",
  "wheat",
  "leaf",
  "sparkles",
  "truck",
  "shield",
  "clock",
  "star",
  "heart",
  "gift",
  "phone",
] as const;
export type HeroIconKey = (typeof HERO_ICON_KEYS)[number];

export const HERO_IMAGE_POSITIONS = ["center", "top", "bottom", "left", "right"] as const;
export type HeroImagePosition = (typeof HERO_IMAGE_POSITIONS)[number];

export const HERO_MAX_SLIDES = 12;
export const HERO_MAX_TRUST_ITEMS = 6;

export const HERO_STORAGE_BUCKET = "site-media";
export const HERO_STORAGE_PREFIX = "hero";
export const HERO_STORAGE_PUBLIC_PATH = `/storage/v1/object/public/${HERO_STORAGE_BUCKET}/`;
/** Hard cap enforced by the bucket itself (file_size_limit); the admin UI compresses well below it. */
export const HERO_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export const HERO_LIMITS = {
  title: 120,
  subtitle: 220,
  badge: 60,
  cta: 40,
  alt: 200,
  headline: 160,
  subheadline: 240,
  guarantee: 60,
  trustTitle: 60,
  trustSubtitle: 100,
  link: 300,
} as const;

// ---------------------------------------------------------------------------------------------
// URL allow-lists (identical to public.sb_hero_valid_image / public.sb_hero_valid_link)
// ---------------------------------------------------------------------------------------------
const IMAGE_BUILTIN = /^\/images\/[A-Za-z0-9._/-]+$/;
const IMAGE_STORAGE =
  /^https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?\/storage\/v1\/object\/public\/site-media\/[A-Za-z0-9._/-]+$/;
const LINK_PATH = /^\/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*$/;
const LINK_HTTPS = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?(\/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*)?$/;

/** Built-in site asset (`/images/...`) or a file in OUR public `site-media` bucket. */
export function isValidHeroImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 600) return false;
  if (value.includes("..")) return false;
  return IMAGE_BUILTIN.test(value) || IMAGE_STORAGE.test(value);
}

/** `""` (no button), an on-site path, or an https URL. Never javascript:, data:, //host, http:. */
export function isValidHeroLink(value: unknown): value is string {
  if (typeof value !== "string" || value.length > HERO_LIMITS.link) return false;
  if (value === "") return true;
  if (LINK_PATH.test(value) && !value.startsWith("//")) return true;
  return LINK_HTTPS.test(value);
}

/** True when the image lives in this project's Storage bucket (so it can be deleted on replace). */
export function isHeroStorageImage(value: string): boolean {
  return value.includes(HERO_STORAGE_PUBLIC_PATH);
}

/** Object path inside the bucket (e.g. `hero/abc.webp`) for one of our storage URLs, else null. */
export function heroStoragePathFromUrl(value: string): string | null {
  const idx = value.indexOf(HERO_STORAGE_PUBLIC_PATH);
  if (idx < 0) return null;
  const path = value.slice(idx + HERO_STORAGE_PUBLIC_PATH.length);
  return /^[A-Za-z0-9._/-]+$/.test(path) && !path.includes("..") ? path : null;
}

/** Same cleaning the database applies (public.sb_clean_text): strip control chars and < >, trim. */
export function cleanHeroText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------------------------
const text = (max: number, label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .transform(cleanHeroText)
    .pipe(z.string().max(max, `${label} is too long (max ${max} characters)`));

export const heroSlideInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    imageUrl: z
      .string()
      .trim()
      .refine(isValidHeroImageUrl, "Choose or upload a slide image"),
    imageAlt: text(HERO_LIMITS.alt, "Image description").default(""),
    imagePosition: z.enum(HERO_IMAGE_POSITIONS).default("center"),
    badgeText: text(HERO_LIMITS.badge, "Badge text").default(""),
    badgeIcon: z.enum(HERO_ICON_KEYS).default("sparkles"),
    title: text(HERO_LIMITS.title, "Title").pipe(z.string().min(1, "Title is required")),
    subtitle: text(HERO_LIMITS.subtitle, "Subtitle").default(""),
    ctaText: text(HERO_LIMITS.cta, "Button text").default(""),
    ctaLink: z
      .string()
      .trim()
      .refine(
        isValidHeroLink,
        "Button link must be a page on this site (e.g. /shop) or an https:// address"
      )
      .default(""),
    isActive: z.boolean().default(true),
    startsAt: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .superRefine((slide, ctx) => {
    if (slide.ctaText !== "" && slide.ctaLink === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ctaLink"],
        message: "Add a button link or clear the button text",
      });
    }
    if (slide.startsAt && slide.endsAt && Date.parse(slide.endsAt) <= Date.parse(slide.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "The end date must be after the start date",
      });
    }
  });
export type HeroSlideInput = z.input<typeof heroSlideInputSchema>;

export const heroTrustItemSchema = z.object({
  icon: z.enum(HERO_ICON_KEYS),
  title: text(HERO_LIMITS.trustTitle, "Highlight title").pipe(
    z.string().min(1, "Each highlight needs a title")
  ),
  subtitle: text(HERO_LIMITS.trustSubtitle, "Highlight text").default(""),
});

export const heroSettingsInputSchema = z.object({
  showHeadline: z.boolean(),
  headline: text(HERO_LIMITS.headline, "Headline"),
  subheadline: text(HERO_LIMITS.subheadline, "Sub-headline"),
  showGuarantee: z.boolean(),
  guaranteeText: text(HERO_LIMITS.guarantee, "Guarantee badge text"),
  showCounter: z.boolean(),
  autoplay: z.boolean(),
  autoplaySeconds: z
    .number()
    .min(2, "Slide duration must be at least 2 seconds")
    .max(20, "Slide duration can be at most 20 seconds"),
  showTrustItems: z.boolean(),
  trustItems: z
    .array(heroTrustItemSchema)
    .max(HERO_MAX_TRUST_ITEMS, `You can add at most ${HERO_MAX_TRUST_ITEMS} highlights`),
});
export type HeroSettingsInput = z.input<typeof heroSettingsInputSchema>;

/** Admin actions understood by /api/admin/action (kept next to the schemas that validate them). */
export type HeroAdminActionPayload =
  | { action: "hero_save_slide"; slide: HeroSlideInput }
  | { action: "hero_delete_slide"; id: string }
  | { action: "hero_reorder"; ids: string[] }
  | { action: "hero_set_active"; id: string; isActive: boolean }
  | { action: "hero_save_settings"; settings: HeroSettingsInput }
  | { action: "hero_reset_defaults"; confirm: true };
