/**
 * Hero banner CMS: browser-side data access.
 *
 *  - PUBLIC reads  : anon key + RLS (only visible slides). Every row is re-validated before use.
 *  - ADMIN reads   : the admin's own session (RLS `is_admin()` lets them see hidden/scheduled slides).
 *  - ADMIN writes  : NEVER direct. They go to `/api/admin/action`, which verifies the Supabase JWT
 *                    + public.admins membership, validates with the shared Zod schema and calls
 *                    audited service-role SQL functions.
 *  - IMAGE uploads : straight to the `site-media` Storage bucket (admin-only by Storage RLS) after
 *                    being checked (magic bytes), downscaled and re-encoded to WebP in the browser.
 */
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  HERO_MAX_UPLOAD_BYTES,
  HERO_STORAGE_BUCKET,
  HERO_STORAGE_PREFIX,
  isValidHeroImageUrl,
  type HeroAdminActionPayload,
  type HeroSettingsInput,
  type HeroSlideInput,
} from "@/lib/hero/schema";
import { mapHeroSettings, mapHeroSlides } from "@/lib/hero/content";
import type { HeroSettings, HeroSlide } from "@/types";
import { executeAdminActionViaEdgeApi } from "./supabaseSync";

const SLIDE_COLUMNS =
  "id, sort_order, is_active, image_url, image_alt, image_position, badge_text, badge_icon, title, subtitle, cta_text, cta_link, starts_at, ends_at, updated_at";
const SETTINGS_COLUMNS =
  "show_headline, headline, subheadline, show_guarantee, guarantee_text, show_counter, autoplay, autoplay_seconds, show_trust_items, trust_items, updated_at";

export type HeroFetchResult =
  | { status: "ok"; slides: HeroSlide[]; settings: HeroSettings | null }
  | { status: "unavailable"; reason: "not_configured" | "schema_missing" | "error"; message?: string };

async function fetchHero(): Promise<HeroFetchResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { status: "unavailable", reason: "not_configured" };

  try {
    const [slidesRes, settingsRes] = await Promise.all([
      supabase
        .from("hero_slides")
        .select(SLIDE_COLUMNS)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("hero_settings").select(SETTINGS_COLUMNS).eq("id", 1).maybeSingle(),
    ]);

    if (slidesRes.error) {
      const missing =
        slidesRes.error.code === "PGRST205" ||
        slidesRes.error.code === "42P01" ||
        /could not find the table|does not exist/i.test(slidesRes.error.message ?? "");
      return {
        status: "unavailable",
        reason: missing ? "schema_missing" : "error",
        message: slidesRes.error.message,
      };
    }

    return {
      status: "ok",
      slides: mapHeroSlides(slidesRes.data),
      settings:
        !settingsRes.error && settingsRes.data ? mapHeroSettings(settingsRes.data) : null,
    };
  } catch (err) {
    return {
      status: "unavailable",
      reason: "error",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** Storefront loader (anon). RLS already hides inactive/scheduled slides; callers re-check anyway. */
export const fetchPublicHero = fetchHero;

/** Admin loader: same query, but an admin session sees EVERY slide (hidden, scheduled, expired). */
export const fetchAdminHero = fetchHero;

// ---------------------------------------------------------------------------------------------
// Admin mutations (all go through the audited edge function)
// ---------------------------------------------------------------------------------------------
type ActionResult<T = Record<string, unknown>> = { success: true; result: T } | { success: false; error: string };

async function run<T = Record<string, unknown>>(payload: HeroAdminActionPayload): Promise<ActionResult<T>> {
  const res = await executeAdminActionViaEdgeApi(payload);
  if (!res.success) return { success: false, error: res.error || "Request failed" };
  return { success: true, result: (res.result ?? {}) as T };
}

export async function saveHeroSlide(slide: HeroSlideInput) {
  const res = await run<{ slide?: unknown }>({ action: "hero_save_slide", slide });
  if (!res.success) return res;
  const mapped = mapHeroSlides([res.result.slide])[0];
  return mapped
    ? ({ success: true, result: mapped } as const)
    : ({ success: false, error: "The server returned an unexpected response" } as const);
}

export const deleteHeroSlide = (id: string) => run({ action: "hero_delete_slide", id });
export const reorderHeroSlides = (ids: string[]) => run({ action: "hero_reorder", ids });
export const setHeroSlideActive = (id: string, isActive: boolean) =>
  run({ action: "hero_set_active", id, isActive });
export const saveHeroSettings = (settings: HeroSettingsInput) =>
  run({ action: "hero_save_settings", settings });
export const resetHeroDefaults = () => run({ action: "hero_reset_defaults", confirm: true });

// ---------------------------------------------------------------------------------------------
// Image upload
// ---------------------------------------------------------------------------------------------
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 1920;
const MIN_WIDTH = 640;

function sniffImageType(bytes: Uint8Array): "jpeg" | "png" | "webp" | "avif" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (bytes.length >= 12 && ascii(4, 8) === "ftyp" && /^avi[fs]$/.test(ascii(8, 12))) return "avif";
  return null;
}

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

export type HeroUploadResult =
  | { ok: true; url: string; bytes: number; width: number; height: number }
  | { ok: false; error: string };

export async function uploadHeroImage(file: File): Promise<HeroUploadResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured" };
  if (file.size === 0) return { ok: false, error: "That file is empty" };
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, error: "That image is larger than 15 MB. Please choose a smaller photo." };
  }

  // 1. Trust the bytes, not the file name / MIME type (blocks SVG, HTML, executables renamed to .jpg ...)
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!sniffImageType(head)) {
    return { ok: false, error: "Only JPG, PNG, WebP or AVIF photos are allowed." };
  }

  // 2. Decode, downscale and re-encode (also strips EXIF/GPS metadata and shrinks 1-5 MB photos to ~200-400 KB)
  let decoded;
  try {
    decoded = await decodeImage(file);
  } catch {
    return { ok: false, error: "This image could not be read. Try another photo." };
  }

  try {
    if (decoded.width < MIN_WIDTH) {
      return {
        ok: false,
        error: `The image is too small (${decoded.width}px wide). Use a photo at least ${MIN_WIDTH}px wide.`,
      };
    }
    const scale = Math.min(1, MAX_DIMENSION / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, error: "Your browser cannot process images." };
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, width, height);

    let blob: Blob | null = null;
    for (const quality of [0.82, 0.72, 0.62, 0.5]) {
      blob = await toBlob(canvas, "image/webp", quality);
      if (!blob || blob.type !== "image/webp") {
        blob = await toBlob(canvas, "image/jpeg", Math.min(0.88, quality + 0.05)); // older Safari: no WebP encoder
      }
      if (blob && blob.size <= HERO_MAX_UPLOAD_BYTES) break;
    }
    if (!blob || blob.size > HERO_MAX_UPLOAD_BYTES) {
      return { ok: false, error: "The image is still too large after compression. Try a simpler photo." };
    }

    // 3. Upload (Storage RLS: only an admin session can write to site-media/hero/)
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${HERO_STORAGE_PREFIX}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(HERO_STORAGE_BUCKET)
      .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
    if (error) {
      const msg = error.message ?? "";
      if (/bucket not found/i.test(msg)) {
        return {
          ok: false,
          error: "Image storage is not set up yet. Run migration 06 in Supabase (see docs/HERO_CMS.md).",
        };
      }
      if (/row-level security|unauthorized|not authorized|jwt/i.test(msg)) {
        return { ok: false, error: "Upload not allowed. Please sign in again as an admin." };
      }
      return { ok: false, error: `Upload failed: ${msg || "unknown error"}` };
    }

    const url = supabase.storage.from(HERO_STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    if (!isValidHeroImageUrl(url)) return { ok: false, error: "Unexpected image address returned by storage." };
    return { ok: true, url, bytes: blob.size, width, height };
  } finally {
    decoded.close();
  }
}

export interface HeroUploadedFile {
  name: string;
  url: string;
  bytes: number;
  createdAt: string | null;
}

/** Images already uploaded to the bucket (so admins can re-use them instead of uploading again). */
export async function listHeroUploads(): Promise<HeroUploadedFile[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.storage
    .from(HERO_STORAGE_BUCKET)
    .list(HERO_STORAGE_PREFIX, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error || !Array.isArray(data)) return [];
  return data
    .filter((f) => /^[A-Za-z0-9._-]+\.(webp|jpe?g|png|avif)$/i.test(f.name))
    .map((f) => {
      const path = `${HERO_STORAGE_PREFIX}/${f.name}`;
      return {
        name: f.name,
        url: supabase.storage.from(HERO_STORAGE_BUCKET).getPublicUrl(path).data.publicUrl,
        bytes: Number((f.metadata as { size?: number } | null)?.size ?? 0),
        createdAt: f.created_at ?? null,
      };
    })
    .filter((f) => isValidHeroImageUrl(f.url));
}

/** Built-in banner photos shipped with the site (always available, even before any upload). */
export const BUILT_IN_HERO_IMAGES: Array<{ label: string; url: string }> = [
  { label: "Jamuna river dawn", url: "/images/banners/hero-jamuna-river-dawn.jpg" },
  { label: "Gawa ghee & Bogura doi", url: "/images/banners/hero-gawa-ghee-bogura-doi.jpg" },
  { label: "Village deshi poultry", url: "/images/banners/hero-village-deshi-poultry.jpg" },
  { label: "Heritage golden rice", url: "/images/banners/hero-heritage-golden-rice.jpg" },
  { label: "Jamuna fisherman", url: "/images/banners/jamuna-fisherman-banner.jpg" },
  { label: "Ghee & Bogura doi (wide)", url: "/images/banners/ghee-bogura-doi-banner.jpg" },
  { label: "Village chicken (wide)", url: "/images/banners/village-chicken-banner.jpg" },
  { label: "Heritage rice (wide)", url: "/images/banners/heritage-rice-banner.jpg" },
];
