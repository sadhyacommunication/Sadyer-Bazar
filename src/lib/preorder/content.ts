/**
 * Pre-Order Batch CMS: Content defaults, mappers, and live countdown utilities.
 */
import type { PreorderSettings, PreorderBatchStatus } from "@/types";
import {
  PREORDER_BATCH_STATUSES,
  PREORDER_LIMITS,
  cleanPreorderText,
} from "./schema";

export function getDefaultCutoffIso(): string {
  // Target: Next upcoming Wednesday at 22:00 (10:00 PM) Dhaka time (UTC+6)
  // or 2 days from current time as sensible dynamic default
  const target = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return target.toISOString();
}

export const DEFAULT_PREORDER_SETTINGS: PreorderSettings = {
  id: 1,
  isBatchActive: true,
  batchStatus: "booking_open",
  badgeText: "LIVE PRE-ORDER BATCH BOOKING",
  headline: "Next Jamuna River Catch & Bogura Doi Dispatch",
  subheadline:
    "Reserve your share before the batch closes. Caught at dawn and delivered straight to your home in thermal boxes.",
  cutoffTime: "2026-11-04T16:00:00.000Z", // Wednesday 10:00 PM BST
  expectedDeliveryDate: "Friday Morning Batch (শুক্রবার সকালের ডেলিভারি)",
  dispatchLocation: "যমুনা নদীর ঘাট (সিরাজগঞ্জ) ও শেরপুর, বগুড়া",
  closedMessage:
    "বর্তমান ব্যাচের বুকিং সম্পন্ন হয়েছে। পরবর্তী ব্যাচের বুকিং শিগগিরই শুরু হবে।",
  showCountdown: true,
  requireAdvancePayment: true,
  advancePercent: 25,
  bannerAlert: "সীমিত কোটা: তাজা নদীর মাছ ও বগুড়ার শাহী দইয়ের অগ্রিম বুকিং চলছে।",
  showBannerAlert: true,
  maxBatchCapacity: 250,
  updatedAt: new Date().toISOString(),
};

export function mapPreorderSettings(row: Record<string, unknown> | null | undefined): PreorderSettings {
  if (!row || typeof row !== "object") return DEFAULT_PREORDER_SETTINGS;

  const rawStatus = String(row.batch_status || row.batchStatus || "booking_open");
  const batchStatus: PreorderBatchStatus = (PREORDER_BATCH_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as PreorderBatchStatus)
    : "booking_open";

  const rawCutoff = row.cutoff_time || row.cutoffTime;
  let cutoffTime = typeof rawCutoff === "string" && rawCutoff.trim() ? rawCutoff.trim() : DEFAULT_PREORDER_SETTINGS.cutoffTime;
  // Ensure valid parseable date
  if (isNaN(Date.parse(cutoffTime))) {
    cutoffTime = DEFAULT_PREORDER_SETTINGS.cutoffTime;
  }

  const advanceRaw = Number(row.advance_percent ?? row.advancePercent);
  const advancePercent = Number.isFinite(advanceRaw) && advanceRaw >= 0 && advanceRaw <= 100 ? advanceRaw : 25;

  const capacityRaw = Number(row.max_batch_capacity ?? row.maxBatchCapacity);
  const maxBatchCapacity = Number.isFinite(capacityRaw) && capacityRaw >= 0 ? capacityRaw : 250;

  return {
    id: 1,
    isBatchActive: (row.is_batch_active ?? row.isBatchActive) !== false,
    batchStatus,
    badgeText: cleanPreorderText(row.badge_text ?? row.badgeText) || DEFAULT_PREORDER_SETTINGS.badgeText,
    headline: cleanPreorderText(row.headline) || DEFAULT_PREORDER_SETTINGS.headline,
    subheadline: cleanPreorderText(row.subheadline ?? row.subHeadline) || DEFAULT_PREORDER_SETTINGS.subheadline,
    cutoffTime,
    expectedDeliveryDate:
      cleanPreorderText(row.expected_delivery_date ?? row.expectedDeliveryDate) ||
      DEFAULT_PREORDER_SETTINGS.expectedDeliveryDate,
    dispatchLocation:
      cleanPreorderText(row.dispatch_location ?? row.dispatchLocation) ||
      DEFAULT_PREORDER_SETTINGS.dispatchLocation,
    closedMessage:
      cleanPreorderText(row.closed_message ?? row.closedMessage) ||
      DEFAULT_PREORDER_SETTINGS.closedMessage,
    showCountdown: (row.show_countdown ?? row.showCountdown) !== false,
    requireAdvancePayment: (row.require_advance_payment ?? row.requireAdvancePayment) !== false,
    advancePercent,
    bannerAlert: cleanPreorderText(row.banner_alert ?? row.bannerAlert) || "",
    showBannerAlert: Boolean(row.show_banner_alert ?? row.showBannerAlert),
    maxBatchCapacity,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : typeof row.updatedAt === "string" ? row.updatedAt : undefined,
  };
}

export interface PreorderCountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  totalSeconds: number;
}

export function calculatePreorderCountdown(cutoffIso: string): PreorderCountdownResult {
  const targetMs = Date.parse(cutoffIso);
  if (isNaN(targetMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0 };
  }

  const diffMs = targetMs - Date.now();
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0 };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    isExpired: false,
    totalSeconds,
  };
}
