/**
 * Section banner & department carousel CMS: shared constants, validators and Zod schemas.
 *
 * Pure TypeScript (depends only on `zod`, no browser / Next imports) so the SAME rules run in:
 *   - the admin UI (instant feedback while typing)
 *   - the Cloudflare edge function `/api/admin/action` (authoritative server-side check)
 * and mirror the SQL validators / CHECK constraints in supabase/migrations/20261103130012_12_section_sliders_cms.sql
 * (defense in depth: the database independently rejects anything these rules would reject).
 */
import { z } from "zod";
import { HERO_ICON_KEYS, type HeroIconKey } from "@/lib/hero/schema";

export const DEPARTMENT_SECTION_KEYS = [
  "dept_jamuna_fish",
  "dept_village_chicken",
  "dept_heritage_rice",
  "dept_ghee_doi",
] as const;
export type DepartmentSectionKey = (typeof DEPARTMENT_SECTION_KEYS)[number];

export const SECTION_BANNER_LAYOUTS = ["default", "reversed"] as const;
export type SectionBannerLayout = (typeof SECTION_BANNER_LAYOUTS)[number];

export const SECTION_MAX_SLIDES_PER_DEPT = 8;
export const SECTION_STORAGE_BUCKET = "site-media";
export const SECTION_STORAGE_PREFIX = "section-banners";
export const SECTION_STORAGE_PUBLIC_PATH = `/storage/v1/object/public/${SECTION_STORAGE_BUCKET}/`;
export const SECTION_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export const SECTION_LIMITS = {
  titleEn: 160,
  headlineBn: 160,
  badgeText: 80,
  convincingSubtextBn: 450,
  descriptionEn: 450,
  originLocation: 120,
  highlight: 160,
  pairingTipText: 200,
  pairingTargetLabel: 80,
  ctaText: 60,
  alt: 200,
  link: 300,
} as const;

// ---------------------------------------------------------------------------------------------
// URL allow-lists (identical to public.sb_hero_valid_image / public.sb_hero_valid_link)
// ---------------------------------------------------------------------------------------------
const IMAGE_BUILTIN = /^\/images\/[A-Za-z0-9._/-]+$/;
const IMAGE_STORAGE =
  /^https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?\/storage\/v1\/object\/public\/site-media\/[A-Za-z0-9._/-]+$/;
const LINK_PATH = /^\/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*$/;
const LINK_HASH = /^#[A-Za-z0-9_-]+$/;
const LINK_HTTPS = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?(\/[A-Za-z0-9._~%/?#&=+@:,;!$()*-]*)?$/;

/** Built-in site asset (`/images/...`) or a file in OUR public `site-media` bucket. */
export function isValidSectionImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 600) return false;
  if (value.includes("..")) return false;
  return IMAGE_BUILTIN.test(value) || IMAGE_STORAGE.test(value);
}

/** `""` (no link), `#hash-id`, an on-site path, or an https URL. Never javascript:, data:, //host, http:. */
export function isValidSectionLink(value: unknown): value is string {
  if (typeof value !== "string" || value.length > SECTION_LIMITS.link) return false;
  if (value === "") return true;
  if (LINK_HASH.test(value)) return true;
  if (LINK_PATH.test(value) && !value.startsWith("//")) return true;
  return LINK_HTTPS.test(value);
}

/** True when the image lives in this project's Storage bucket. */
export function isSectionStorageImage(value: string): boolean {
  return value.includes(SECTION_STORAGE_PUBLIC_PATH);
}

/** Object path inside the bucket (e.g. `section-banners/abc.webp`) for one of our storage URLs, else null. */
export function sectionStoragePathFromUrl(value: string): string | null {
  const idx = value.indexOf(SECTION_STORAGE_PUBLIC_PATH);
  if (idx < 0) return null;
  const path = value.slice(idx + SECTION_STORAGE_PUBLIC_PATH.length);
  return /^[A-Za-z0-9._/-]+$/.test(path) && !path.includes("..") ? path : null;
}

/** Strip control chars and < >, trim (matching public.sb_clean_text). */
export function cleanSectionText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------------------------
export const sectionSlideInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    sectionId: z.enum(DEPARTMENT_SECTION_KEYS, {
      errorMap: () => ({ message: "Please select a valid department section" }),
    }),
    sortOrder: z.coerce.number().int().min(0).max(100).default(0),
    isActive: z.boolean().default(true),
    imageUrl: z
      .string()
      .trim()
      .min(1, "Image is required")
      .refine(isValidSectionImageUrl, {
        message:
          "Image must be a built-in path (/images/...) or uploaded to the site-media bucket",
      }),
    imageAlt: z
      .string()
      .trim()
      .max(SECTION_LIMITS.alt, `Alt text cannot exceed ${SECTION_LIMITS.alt} characters`)
      .default(""),
    badgeTextEn: z
      .string()
      .trim()
      .max(SECTION_LIMITS.badgeText, `English badge cannot exceed ${SECTION_LIMITS.badgeText} chars`)
      .default(""),
    badgeTextBn: z
      .string()
      .trim()
      .max(SECTION_LIMITS.badgeText, `Bangla badge cannot exceed ${SECTION_LIMITS.badgeText} chars`)
      .default(""),
    badgeIcon: z.enum(HERO_ICON_KEYS).default("sparkles"),
    titleEn: z
      .string()
      .trim()
      .min(1, "English title is required")
      .max(SECTION_LIMITS.titleEn, `Title cannot exceed ${SECTION_LIMITS.titleEn} characters`),
    headlineBn: z
      .string()
      .trim()
      .min(1, "Bangla headline is required")
      .max(SECTION_LIMITS.headlineBn, `Headline cannot exceed ${SECTION_LIMITS.headlineBn} characters`),
    convincingSubtextBn: z
      .string()
      .trim()
      .max(SECTION_LIMITS.convincingSubtextBn, `Subtext cannot exceed ${SECTION_LIMITS.convincingSubtextBn} characters`)
      .default(""),
    descriptionEn: z
      .string()
      .trim()
      .max(SECTION_LIMITS.descriptionEn, `Description cannot exceed ${SECTION_LIMITS.descriptionEn} characters`)
      .default(""),
    originLocation: z
      .string()
      .trim()
      .max(SECTION_LIMITS.originLocation, `Origin cannot exceed ${SECTION_LIMITS.originLocation} characters`)
      .default(""),
    highlights: z
      .array(
        z.string().trim().max(SECTION_LIMITS.highlight, `Highlight item max ${SECTION_LIMITS.highlight} chars`)
      )
      .max(6, "Maximum 6 highlight guarantees are allowed")
      .default([]),
    pairingTipText: z
      .string()
      .trim()
      .max(SECTION_LIMITS.pairingTipText, `Pairing tip cannot exceed ${SECTION_LIMITS.pairingTipText} characters`)
      .default(""),
    pairingTargetHref: z
      .string()
      .trim()
      .refine(isValidSectionLink, { message: "Pairing target link is invalid" })
      .default(""),
    pairingTargetLabel: z
      .string()
      .trim()
      .max(SECTION_LIMITS.pairingTargetLabel, `Label cannot exceed ${SECTION_LIMITS.pairingTargetLabel} chars`)
      .default(""),
    ctaText: z
      .string()
      .trim()
      .max(SECTION_LIMITS.ctaText, `CTA button text cannot exceed ${SECTION_LIMITS.ctaText} characters`)
      .default(""),
    ctaLink: z
      .string()
      .trim()
      .refine(isValidSectionLink, { message: "CTA link is invalid" })
      .default(""),
    bannerLayout: z.enum(SECTION_BANNER_LAYOUTS).default("default"),
    startsAt: z.string().datetime({ offset: true }).nullable().default(null),
    endsAt: z.string().datetime({ offset: true }).nullable().default(null),
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime();
      }
      return true;
    },
    { message: "End date must be later than start date", path: ["endsAt"] }
  );

export type SectionSlideInput = z.input<typeof sectionSlideInputSchema>;

export const sectionSliderSettingsInputSchema = z.object({
  sectionId: z.enum(DEPARTMENT_SECTION_KEYS),
  autoplay: z.boolean().default(true),
  autoplaySeconds: z.coerce.number().min(2, "Minimum 2 seconds").max(20, "Maximum 20 seconds").default(5.0),
  showCounter: z.boolean().default(true),
  showNavigation: z.boolean().default(true),
  showDots: z.boolean().default(true),
});

export type SectionSliderSettingsInput = z.input<typeof sectionSliderSettingsInputSchema>;

export type SectionAdminActionPayload =
  | { action: "section_save_slide"; slide: SectionSlideInput }
  | { action: "section_delete_slide"; id: string }
  | { action: "section_reorder"; sectionId: DepartmentSectionKey; ids: string[] }
  | { action: "section_set_active"; id: string; isActive: boolean }
  | { action: "section_save_settings"; settings: SectionSliderSettingsInput }
  | { action: "section_reset_defaults"; targetSection?: DepartmentSectionKey; confirm: true };
