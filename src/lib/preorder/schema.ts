/**
 * Pre-Order Batch CMS: Shared constants, validators and Zod schemas.
 *
 * Runs in:
 *  - Admin UI (real-time validation)
 *  - Cloudflare Edge function /api/admin/action
 *  - Mirrors PostgreSQL CHECK constraints in supabase/migrations/*_07_preorder_settings.sql
 */
import { z } from "zod";

export const PREORDER_BATCH_STATUSES = [
  "booking_open",
  "paused",
  "booking_closed",
  "sold_out",
] as const;

export type PreorderBatchStatus = (typeof PREORDER_BATCH_STATUSES)[number];

export const PREORDER_LIMITS = {
  badge: 80,
  headline: 160,
  subheadline: 300,
  deliveryDate: 120,
  dispatchLocation: 120,
  closedMessage: 300,
  bannerAlert: 200,
  maxBatchCapacity: 10000,
} as const;

export function cleanPreorderText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\r\n\t]+/g, " ");
}

export const preorderSettingsInputSchema = z.object({
  isBatchActive: z.boolean().default(true),
  batchStatus: z.enum(PREORDER_BATCH_STATUSES).default("booking_open"),
  badgeText: z
    .string()
    .trim()
    .min(1, "Badge text is required")
    .max(PREORDER_LIMITS.badge, `Badge text must be under ${PREORDER_LIMITS.badge} chars`),
  headline: z
    .string()
    .trim()
    .min(1, "Headline is required")
    .max(PREORDER_LIMITS.headline, `Headline must be under ${PREORDER_LIMITS.headline} chars`),
  subheadline: z
    .string()
    .trim()
    .max(PREORDER_LIMITS.subheadline, `Subheadline must be under ${PREORDER_LIMITS.subheadline} chars`)
    .default(""),
  cutoffTime: z.string().min(1, "Cutoff time is required"),
  expectedDeliveryDate: z
    .string()
    .trim()
    .min(1, "Expected delivery date description is required")
    .max(PREORDER_LIMITS.deliveryDate, `Delivery text must be under ${PREORDER_LIMITS.deliveryDate} chars`),
  dispatchLocation: z
    .string()
    .trim()
    .max(PREORDER_LIMITS.dispatchLocation, `Dispatch location must be under ${PREORDER_LIMITS.dispatchLocation} chars`)
    .default(""),
  closedMessage: z
    .string()
    .trim()
    .max(PREORDER_LIMITS.closedMessage, `Closed message must be under ${PREORDER_LIMITS.closedMessage} chars`)
    .default(""),
  showCountdown: z.boolean().default(true),
  requireAdvancePayment: z.boolean().default(true),
  advancePercent: z
    .number()
    .int()
    .min(0, "Advance percentage must be at least 0%")
    .max(100, "Advance percentage cannot exceed 100%")
    .default(25),
  bannerAlert: z
    .string()
    .trim()
    .max(PREORDER_LIMITS.bannerAlert, `Alert banner text must be under ${PREORDER_LIMITS.bannerAlert} chars`)
    .default(""),
  showBannerAlert: z.boolean().default(false),
  maxBatchCapacity: z
    .number()
    .int()
    .min(0, "Batch capacity cannot be negative")
    .max(PREORDER_LIMITS.maxBatchCapacity, "Batch capacity exceeds limit")
    .default(200),
});

export type PreorderSettingsInput = z.infer<typeof preorderSettingsInputSchema>;

export type PreorderAdminActionPayload =
  | { action: "preorder_save_settings"; settings: PreorderSettingsInput }
  | { action: "preorder_sync_product_dates"; cutoffTime: string; expectedDeliveryDate: string }
  | { action: "preorder_reset_batch_booked" };
