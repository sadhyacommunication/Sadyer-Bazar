/**
 * Section banner & department carousel CMS: browser-side data access.
 *
 *  - PUBLIC reads  : anon key + RLS (only visible slides). Every row is re-validated before use.
 *  - ADMIN reads   : the admin's own session (RLS lets them see hidden/scheduled slides).
 *  - ADMIN writes  : Dual-Path (Edge RPC via `/api/admin/action` -> direct Supabase RPC fallback).
 *  - IMAGE uploads : straight to the `site-media` Storage bucket under `section-banners/`
 *                    after being validated (magic bytes), downscaled and re-encoded to WebP in browser.
 */
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  SECTION_MAX_UPLOAD_BYTES,
  SECTION_STORAGE_BUCKET,
  SECTION_STORAGE_PREFIX,
  type DepartmentSectionKey,
  type SectionAdminActionPayload,
  type SectionSliderSettingsInput,
  type SectionSlideInput,
} from "@/lib/sections/schema";
import {
  DEFAULT_SECTION_SETTINGS,
  DEFAULT_SECTION_SLIDES,
  mapSectionSettings,
  mapSectionSlide,
  mapSectionSlides,
  type SectionSliderSettings,
  type SectionSlide,
} from "@/lib/sections/content";
import { executeAdminActionViaEdgeApi } from "./supabaseSync";

const SLIDE_COLUMNS =
  "id, section_id, sort_order, is_active, image_url, image_alt, badge_text_en, badge_text_bn, badge_icon, title_en, headline_bn, convincing_subtext_bn, description_en, origin_location, highlights, pairing_tip_text, pairing_target_href, pairing_target_label, cta_text, cta_link, banner_layout, starts_at, ends_at, updated_at";

const SETTINGS_COLUMNS =
  "section_id, autoplay, autoplay_seconds, show_counter, show_navigation, show_dots, updated_at";

export type SectionFetchResult =
  | {
      status: "ok";
      slides: SectionSlide[];
      settings: Record<DepartmentSectionKey, SectionSliderSettings>;
    }
  | {
      status: "unavailable";
      reason: "not_configured" | "schema_missing" | "error";
      message?: string;
    };

export async function fetchSectionData(): Promise<SectionFetchResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { status: "unavailable", reason: "not_configured" };

  try {
    const [slidesRes, settingsRes] = await Promise.all([
      supabase
        .from("section_slides")
        .select(SLIDE_COLUMNS)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("section_slider_settings").select(SETTINGS_COLUMNS),
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

    const slides = mapSectionSlides(slidesRes.data);

    const settingsMap: Record<DepartmentSectionKey, SectionSliderSettings> = {
      ...DEFAULT_SECTION_SETTINGS,
    };

    if (!settingsRes.error && Array.isArray(settingsRes.data)) {
      for (const row of settingsRes.data) {
        if (row && typeof row === "object" && "section_id" in row) {
          const mapped = mapSectionSettings(row as Record<string, unknown>);
          settingsMap[mapped.sectionId] = mapped;
        }
      }
    }

    return {
      status: "ok",
      slides,
      settings: settingsMap,
    };
  } catch (err) {
    return {
      status: "unavailable",
      reason: "error",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

export const fetchPublicSectionData = fetchSectionData;
export const fetchAdminSectionData = fetchSectionData;

// ---------------------------------------------------------------------------------------------
// Admin mutations (Dual-Path: Edge RPC -> Direct Supabase Fallback)
// ---------------------------------------------------------------------------------------------
type ActionResult<T = Record<string, unknown>> =
  | { success: true; result: T }
  | { success: false; error: string };

async function run<T = Record<string, unknown>>(
  payload: SectionAdminActionPayload
): Promise<ActionResult<T>> {
  const res = await executeAdminActionViaEdgeApi(payload);
  if (!res.success) return { success: false, error: res.error || "Request failed" };
  return { success: true, result: (res.result ?? {}) as T };
}

export async function saveSectionSlideDirect(
  slide: SectionSlideInput
): Promise<ActionResult<{ slide: SectionSlide }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Database client is not available" };

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase.rpc("admin_section_save_slide", {
      p_actor: user.id,
      p_slide: slide,
    });

    if (error) return { success: false, error: error.message };
    const saved = mapSectionSlide(data as Record<string, unknown>);
    return { success: true, result: { slide: saved } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}

export async function deleteSectionSlideDirect(id: string): Promise<ActionResult<{ deleted: boolean }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Database client is not available" };

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase.rpc("admin_section_delete_slide", {
      p_actor: user.id,
      p_id: id,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, result: { deleted: true } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Delete failed" };
  }
}

export async function reorderSectionSlidesDirect(
  sectionId: DepartmentSectionKey,
  ids: string[]
): Promise<ActionResult<{ reordered: boolean }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Database client is not available" };

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase.rpc("admin_section_reorder", {
      p_actor: user.id,
      p_section_id: sectionId,
      p_ids: ids,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, result: { reordered: true } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Reorder failed" };
  }
}

export async function setSectionSlideActiveDirect(
  id: string,
  isActive: boolean
): Promise<ActionResult<{ updated: boolean }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Database client is not available" };

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase.rpc("admin_section_set_active", {
      p_actor: user.id,
      p_id: id,
      p_active: isActive,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, result: { updated: true } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

export async function saveSectionSettingsDirect(
  settings: SectionSliderSettingsInput
): Promise<ActionResult<{ saved: boolean }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Database client is not available" };

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase.rpc("admin_section_save_settings", {
      p_actor: user.id,
      p_settings: settings,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, result: { saved: true } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Save settings failed" };
  }
}

export async function resetSectionDefaultsDirect(
  targetSection?: DepartmentSectionKey
): Promise<ActionResult<{ reset: boolean }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Database client is not available" };

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase.rpc("admin_section_reset_defaults", {
      p_actor: user.id,
      p_target_section: targetSection || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, result: { reset: true } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Reset failed" };
  }
}

// ---------------------------------------------------------------------------------------------
// Unified Callers (Edge API with Fallback)
// ---------------------------------------------------------------------------------------------
export async function saveSectionSlide(slide: SectionSlideInput) {
  const res = await run<{ slide?: unknown }>({ action: "section_save_slide", slide });
  if (res.success && res.result.slide) {
    const mapped = mapSectionSlide(res.result.slide as Record<string, unknown>);
    return { success: true, result: mapped } as const;
  }
  const direct = await saveSectionSlideDirect(slide);
  if (direct.success && direct.result.slide) {
    return { success: true, result: direct.result.slide } as const;
  }
  const errMsg = (!res.success ? res.error : "") || (!direct.success ? direct.error : "") || "Failed to save slide";
  return { success: false, error: errMsg } as const;
}

export async function deleteSectionSlide(id: string) {
  const res = await run({ action: "section_delete_slide", id });
  if (res.success) return res;
  return deleteSectionSlideDirect(id);
}

export async function reorderSectionSlides(sectionId: DepartmentSectionKey, ids: string[]) {
  const res = await run({ action: "section_reorder", sectionId, ids });
  if (res.success) return res;
  return reorderSectionSlidesDirect(sectionId, ids);
}

export async function setSectionSlideActive(id: string, isActive: boolean) {
  const res = await run({ action: "section_set_active", id, isActive });
  if (res.success) return res;
  return setSectionSlideActiveDirect(id, isActive);
}

export async function saveSectionSettings(settings: SectionSliderSettingsInput) {
  const res = await run({ action: "section_save_settings", settings });
  if (res.success) return res;
  const direct = await saveSectionSettingsDirect(settings);
  if (direct.success) return direct;
  const errMsg = (!res.success ? res.error : "") || (!direct.success ? direct.error : "") || "Failed to save settings";
  return { success: false, error: errMsg };
}

export async function resetSectionDefaults(targetSection?: DepartmentSectionKey) {
  const res = await run({ action: "section_reset_defaults", targetSection, confirm: true });
  if (res.success) return res;
  return resetSectionDefaultsDirect(targetSection);
}

// ---------------------------------------------------------------------------------------------
// Image upload with in-browser compression to WebP
// ---------------------------------------------------------------------------------------------
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 1920;
const MIN_WIDTH = 400;

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
      // Fall through to <img> decoding
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

export type SectionUploadResult =
  | { ok: true; url: string; bytes: number; width: number; height: number }
  | { ok: false; error: string };

export async function uploadSectionImage(file: File): Promise<SectionUploadResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured" };
  if (file.size === 0) return { ok: false, error: "That file is empty" };
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, error: "That image is larger than 15 MB. Please choose a smaller photo." };
  }

  // 1. Check magic bytes
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!sniffImageType(head)) {
    return { ok: false, error: "Only JPG, PNG, WebP or AVIF photos are allowed." };
  }

  // 2. Decode and downscale
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
    if (!ctx) return { ok: false, error: "Could not initialize image processing context." };

    ctx.drawImage(decoded.source, 0, 0, width, height);

    let blob: Blob | null = await toBlob(canvas, "image/webp", 0.88);
    if (!blob || blob.size > SECTION_MAX_UPLOAD_BYTES) {
      blob = await toBlob(canvas, "image/webp", 0.76);
    }
    if (!blob || blob.size > SECTION_MAX_UPLOAD_BYTES) {
      blob = await toBlob(canvas, "image/jpeg", 0.72);
    }
    if (!blob) return { ok: false, error: "Failed to encode photo." };
    if (blob.size > SECTION_MAX_UPLOAD_BYTES) {
      return {
        ok: false,
        error: `Compressed image is ${(blob.size / (1024 * 1024)).toFixed(1)} MB, exceeding the 3 MB limit.`,
      };
    }

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const rand = Math.random().toString(36).slice(2, 10);
    const objectPath = `${SECTION_STORAGE_PREFIX}/${Date.now()}-${rand}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(SECTION_STORAGE_BUCKET)
      .upload(objectPath, blob, {
        contentType: blob.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      return { ok: false, error: uploadError.message };
    }

    const { data: pubData } = supabase.storage
      .from(SECTION_STORAGE_BUCKET)
      .getPublicUrl(objectPath);

    return {
      ok: true,
      url: pubData.publicUrl,
      bytes: blob.size,
      width,
      height,
    };
  } finally {
    decoded.close();
  }
}
