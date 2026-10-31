/**
 * Pre-Order Batch CMS: Browser-side data access & mutations.
 *
 * Architecture:
 *  - Public reads: anon key + RLS (id = 1). Re-validated before use.
 *  - Admin writes: Dual-Path:
 *      1. Cloudflare Pages Edge Gateway (/api/admin/action -> audited RPC)
 *      2. Direct Supabase Client fallback (authenticated session under RLS public.is_admin())
 *  - Optimistic updates + localStorage backup so storefront updates immediately.
 */
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  PreorderAdminActionPayload,
  PreorderSettingsInput,
} from "@/lib/preorder/schema";
import {
  DEFAULT_PREORDER_SETTINGS,
  mapPreorderSettings,
} from "@/lib/preorder/content";
import type { PreorderSettings } from "@/types";
import { executeAdminActionViaEdgeApi } from "./supabaseSync";

export const PREORDER_SETTINGS_COLUMNS =
  "id, is_batch_active, batch_status, badge_text, headline, subheadline, cutoff_time, expected_delivery_date, dispatch_location, closed_message, show_countdown, require_advance_payment, advance_percent, banner_alert, show_banner_alert, max_batch_capacity, updated_at";

export type PreorderFetchResult =
  | { status: "ok"; settings: PreorderSettings }
  | {
      status: "unavailable";
      reason: "not_configured" | "schema_missing" | "error";
      message?: string;
      settings: PreorderSettings;
    };

export async function fetchPreorderSettings(): Promise<PreorderFetchResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      status: "unavailable",
      reason: "not_configured",
      settings: DEFAULT_PREORDER_SETTINGS,
    };
  }

  try {
    const { data, error } = await supabase
      .from("preorder_settings")
      .select(PREORDER_SETTINGS_COLUMNS)
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      const missing =
        error.code === "PGRST205" ||
        error.code === "42P01" ||
        /could not find the table|does not exist/i.test(error.message ?? "");
      return {
        status: "unavailable",
        reason: missing ? "schema_missing" : "error",
        message: error.message,
        settings: DEFAULT_PREORDER_SETTINGS,
      };
    }

    return {
      status: "ok",
      settings: data ? mapPreorderSettings(data) : DEFAULT_PREORDER_SETTINGS,
    };
  } catch (err) {
    return {
      status: "unavailable",
      reason: "error",
      message: err instanceof Error ? err.message : "Network error",
      settings: DEFAULT_PREORDER_SETTINGS,
    };
  }
}

export const fetchPublicPreorderSettings = fetchPreorderSettings;
export const fetchAdminPreorderSettings = fetchPreorderSettings;

// -----------------------------------------------------------------------------
// Admin Mutations (Dual-Path)
// -----------------------------------------------------------------------------
type ActionResult<T = Record<string, unknown>> =
  | { success: true; result: T }
  | { success: false; error: string };

async function run<T = Record<string, unknown>>(
  payload: PreorderAdminActionPayload
): Promise<ActionResult<T>> {
  const res = await executeAdminActionViaEdgeApi(
    payload as unknown as import("@/services/supabaseSync").AdminEdgeActionPayload
  );
  if (!res.success) {
    return { success: false, error: res.error || "Request failed" };
  }
  return { success: true, result: (res.result ?? {}) as T };
}

export async function savePreorderSettingsDirect(
  settings: PreorderSettingsInput
): Promise<ActionResult<{ settings: PreorderSettings }>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client is not available" };
  }

  try {
    const row = {
      id: 1,
      is_batch_active: settings.isBatchActive,
      batch_status: settings.batchStatus,
      badge_text: settings.badgeText,
      headline: settings.headline,
      subheadline: settings.subheadline || "",
      cutoff_time: settings.cutoffTime,
      expected_delivery_date: settings.expectedDeliveryDate,
      dispatch_location: settings.dispatchLocation || "",
      closed_message: settings.closedMessage || "",
      show_countdown: settings.showCountdown,
      require_advance_payment: settings.requireAdvancePayment,
      advance_percent: settings.advancePercent,
      banner_alert: settings.bannerAlert || "",
      show_banner_alert: settings.showBannerAlert,
      max_batch_capacity: settings.maxBatchCapacity,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("preorder_settings")
      .upsert(row, { onConflict: "id" })
      .select(PREORDER_SETTINGS_COLUMNS)
      .maybeSingle();

    if (error) {
      console.warn("[preorderApi] direct savePreorderSettings error:", error.message);
      return { success: false, error: error.message };
    }

    const mapped = data ? mapPreorderSettings(data) : mapPreorderSettings(row);
    return { success: true, result: { settings: mapped } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Save failed",
    };
  }
}

export async function savePreorderSettings(
  settings: PreorderSettingsInput
): Promise<ActionResult<{ settings: PreorderSettings }>> {
  // 1. Try Edge API
  const res = await run<{ settings?: unknown }>({
    action: "preorder_save_settings",
    settings,
  });

  if (res.success && res.result.settings) {
    const mapped = mapPreorderSettings(res.result.settings as Record<string, unknown>);
    return { success: true, result: { settings: mapped } };
  }

  // 2. Direct Supabase fallback
  const direct = await savePreorderSettingsDirect(settings);
  if (direct.success) {
    return direct;
  }

  const errMsg =
    (!res.success ? res.error : "") ||
    (!direct.success ? direct.error : "") ||
    "Failed to save pre-order settings";
  return { success: false, error: errMsg };
}

export async function syncPreorderProductDatesDirect(
  cutoffTime: string,
  expectedDeliveryDate: string
): Promise<ActionResult<{ updated: number }>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client is not available" };
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .update({
        preorder_cutoff_at: cutoffTime,
        expected_delivery_date: expectedDeliveryDate,
      })
      .eq("is_preorder", true)
      .select("id");

    if (error) {
      console.warn("[preorderApi] direct syncPreorderProductDates error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, result: { updated: data ? data.length : 0 } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Sync failed",
    };
  }
}

export async function syncPreorderProductDates(
  cutoffTime: string,
  expectedDeliveryDate: string
): Promise<ActionResult<{ updated: number }>> {
  const res = await run<{ updated: number }>({
    action: "preorder_sync_product_dates",
    cutoffTime,
    expectedDeliveryDate,
  });
  if (res.success) return res;
  return syncPreorderProductDatesDirect(cutoffTime, expectedDeliveryDate);
}

export async function resetPreorderBatchBookedDirect(): Promise<
  ActionResult<{ reset: number }>
> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client is not available" };
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .update({ batch_booked_qty: 0 })
      .eq("is_preorder", true)
      .select("id");

    if (error) {
      console.warn("[preorderApi] direct resetPreorderBatchBooked error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, result: { reset: data ? data.length : 0 } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Reset failed",
    };
  }
}

export async function resetPreorderBatchBooked(): Promise<
  ActionResult<{ reset: number }>
> {
  const res = await run<{ reset: number }>({
    action: "preorder_reset_batch_booked",
  });
  if (res.success) return res;
  return resetPreorderBatchBookedDirect();
}
