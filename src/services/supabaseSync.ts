import { getSupabaseClient } from "@/lib/supabase/client";
import type { HeroAdminActionPayload } from "@/lib/hero/schema";
import {
  Category,
  ContactMessage,
  Coupon,
  Order,
  OrderItem,
  PaymentTransaction,
  Product,
  ProductReview,
  SiteSettings,
} from "@/types";
import {
  INITIAL_CATEGORIES,
  INITIAL_CONTACT_MESSAGES,
  INITIAL_COUPONS,
  INITIAL_PRODUCTS,
  INITIAL_REVIEWS,
  INITIAL_SITE_SETTINGS,
} from "./seedData";

export type SupabaseConnectionState =
  | "checking"
  | "connected_live"
  | "schema_missing"
  | "offline";

/**
 * Explicit safe columns granted to `anon` and `authenticated` by Migration 05.
 * Never use `select("*")` on `site_settings` because secret columns are revoked from API roles.
 */
export const SAFE_SITE_SETTINGS_COLUMNS =
  "id, inside_dhaka_fee, outside_dhaka_fee, free_delivery_threshold, enable_free_delivery, preorder_advance_percent, support_phone, whatsapp_number, bkash_merchant_number, bkash_account_type, nagad_number, nagad_account_type, nagad_enabled, bkash_enabled, cod_enabled, announcement_en, announcement_bn, updated_at";

export interface PaymentAttemptRecord {
  id: string;
  orderId: string;
  orderCode: string;
  gateway: "bkash" | "nagad";
  purpose: "initial" | "due";
  expectedAmount: number;
  gatewayOrderRef: string;
  gatewayPaymentId?: string;
  gatewayTrxId?: string;
  status:
    | "created"
    | "redirected"
    | "executing"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "expired"
    | "needs_review";
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

// Row -> TypeScript Mappers
function mapSettingsFromRow(row: Record<string, unknown>): SiteSettings {
  return {
    id: 1,
    insideDhakaFee: Number(row.inside_dhaka_fee ?? 70),
    outsideDhakaFee: Number(row.outside_dhaka_fee ?? 130),
    freeDeliveryThreshold: Number(row.free_delivery_threshold ?? 3000),
    enableFreeDelivery: Boolean(row.enable_free_delivery ?? true),
    preorderAdvancePercent: Number(row.preorder_advance_percent ?? 25),
    supportPhone: String(row.support_phone || "01713477780-81"),
    whatsappNumber: String(row.whatsapp_number || "8801713477780"),
    bkashMerchantNumber: String(row.bkash_merchant_number || "01713-477780"),
    bkashAccountType:
      (row.bkash_account_type as SiteSettings["bkashAccountType"]) || "merchant",
    nagadNumber: String(row.nagad_number || "01713-477780"),
    nagadAccountType:
      (row.nagad_account_type as SiteSettings["nagadAccountType"]) || "merchant",
    nagadEnabled: Boolean(row.nagad_enabled ?? true),
    announcementEn: String(
      row.announcement_en || INITIAL_SITE_SETTINGS.announcementEn
    ),
    announcementBn: String(
      row.announcement_bn || INITIAL_SITE_SETTINGS.announcementBn
    ),
    sslcommerzEnabled: false,
    bkashEnabled: Boolean(row.bkash_enabled ?? true),
    codEnabled: Boolean(row.cod_enabled ?? true),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function mapCategoryFromRow(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    nameBn: String(row.name_bn || row.name || ""),
    slug: String(row.slug || ""),
    description: String(row.description || ""),
    imageUrl: String(row.image_url || "/images/products/jamuna-fish.jpg"),
    badgeText: row.badge_text ? String(row.badge_text) : undefined,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: row.is_active !== false,
  };
}

function mapProductFromRow(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    categoryId: String(row.category_id || "cat-river-fish"),
    categoryName: String(row.category_name || "Jamuna River Fish"),
    categorySlug: String(row.category_slug || "jamuna-river-fish"),
    title: String(row.title),
    titleBn: String(row.title_bn),
    slug: String(row.slug),
    shortDescription: String(row.short_description || ""),
    description: String(row.description || ""),
    originSource: String(row.origin_source || ""),
    primaryImage: String(row.primary_image || ""),
    galleryImages: Array.isArray(row.gallery_images)
      ? (row.gallery_images as string[])
      : [],
    isPreorder: Boolean(row.is_preorder),
    preorderCutoffAt: row.preorder_cutoff_at
      ? String(row.preorder_cutoff_at)
      : undefined,
    expectedDeliveryDate: row.expected_delivery_date
      ? String(row.expected_delivery_date)
      : undefined,
    batchTargetQty: Number(row.batch_target_qty ?? 50),
    batchBookedQty: Number(row.batch_booked_qty ?? 0),
    unitType: (row.unit_type as Product["unitType"]) || "kg",
    cuttingOptions: Array.isArray(row.cutting_options)
      ? (row.cutting_options as string[])
      : [],
    nutritionHighlights: Array.isArray(row.nutrition_highlights)
      ? (row.nutrition_highlights as string[])
      : [],
    seoTitle: String(row.seo_title || row.title || ""),
    seoDescription: String(row.seo_description || row.short_description || ""),
    searchKeywords: Array.isArray(row.search_keywords)
      ? (row.search_keywords as string[])
      : [],
    isFeatured: Boolean(row.is_featured ?? true),
    isActive: Boolean(row.is_active ?? true),
    rating: Number(row.rating ?? 4.95),
    reviewCount: Number(row.review_count ?? 25),
    variants: Array.isArray(row.variants)
      ? (row.variants as Product["variants"])
      : [],
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export function mapOrderFromRow(row: Record<string, unknown>): Order {
  return {
    id: String(row.id || row.orderId || ""),
    orderCode: String(row.order_code || row.orderCode || ""),
    customerName: String(row.customer_name || row.customerName || ""),
    customerPhone: String(row.customer_phone || row.customerPhone || row.maskedPhone || ""),
    deliveryZone:
      ((row.delivery_zone || row.deliveryZone) as Order["deliveryZone"]) ||
      "inside_dhaka",
    customerDistrict: String(
      row.customer_district || row.customerDistrict || "Dhaka"
    ),
    customerAddress: String(
      row.customer_address || row.customerAddress || row.maskedAddress || ""
    ),
    customerNote: row.customer_note
      ? String(row.customer_note)
      : row.customerNote
      ? String(row.customerNote)
      : undefined,
    subtotal: Number(row.subtotal ?? 0),
    deliveryCharge: Number(row.delivery_charge ?? row.deliveryCharge ?? 0),
    discountAmount: Number(row.discount_amount ?? row.discountAmount ?? 0),
    couponCode: row.coupon_code
      ? String(row.coupon_code)
      : row.couponCode
      ? String(row.couponCode)
      : undefined,
    weightAdjustmentAmount: Number(
      row.weight_adjustment_amount ?? row.weightAdjustmentAmount ?? 0
    ),
    weightAdjustmentNote: row.weight_adjustment_note
      ? String(row.weight_adjustment_note)
      : row.weightAdjustmentNote
      ? String(row.weightAdjustmentNote)
      : undefined,
    totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
    advancePaid: Number(row.advance_paid ?? row.advancePaid ?? 0),
    dueAmount: Number(row.due_amount ?? row.dueAmount ?? 0),
    paymentMethod:
      ((row.payment_method || row.paymentMethod) as Order["paymentMethod"]) ||
      "cod",
    paymentPlan:
      ((row.payment_plan || row.paymentPlan) as Order["paymentPlan"]) || "cod",
    paymentStatus:
      ((row.payment_status || row.paymentStatus) as Order["paymentStatus"]) ||
      "pending",
    orderStatus:
      ((row.order_status || row.orderStatus) as Order["orderStatus"]) ||
      "pending",
    hasPreorderItems: Boolean(
      row.has_preorder_items ?? row.hasPreorderItems ?? false
    ),
    transactionId: row.transaction_id
      ? String(row.transaction_id)
      : row.transactionId
      ? String(row.transactionId)
      : undefined,
    courierName: row.courier_name
      ? String(row.courier_name)
      : row.courierName
      ? String(row.courierName)
      : undefined,
    trackingReference: row.tracking_reference
      ? String(row.tracking_reference)
      : row.trackingReference
      ? String(row.trackingReference)
      : undefined,
    riderName: row.rider_name
      ? String(row.rider_name)
      : row.riderName
      ? String(row.riderName)
      : undefined,
    riderPhone: row.rider_phone
      ? String(row.rider_phone)
      : row.riderPhone
      ? String(row.riderPhone)
      : undefined,
    fraudRiskScore: Number(row.fraud_risk_score ?? row.fraudRiskScore ?? 0),
    isSuspicious: Boolean(row.is_suspicious ?? row.isSuspicious ?? false),
    reviewReasons: Array.isArray(row.review_reasons)
      ? (row.review_reasons as string[])
      : Array.isArray(row.reviewReasons)
      ? (row.reviewReasons as string[])
      : [],
    isPhoneVerified: Boolean(
      row.is_phone_verified ?? row.isPhoneVerified ?? false
    ),
    verificationMethod:
      ((row.verification_method ||
        row.verificationMethod) as Order["verificationMethod"]) || "unverified",
    idempotencyKey: row.idempotency_key
      ? String(row.idempotency_key)
      : undefined,
    items: Array.isArray(row.items)
      ? (row.items as Array<Record<string, unknown>>).map((i, idx) => ({
          id: String(i.id || `item-${idx}`),
          orderId: String(i.orderId || row.id || row.orderId || ""),
          productId: String(i.productId || i.product_id || ""),
          variantId: String(i.variantId || i.variant_id || ""),
          productTitle: String(i.productTitle || i.product_title || ""),
          productTitleBn: String(i.productTitleBn || i.product_title_bn || ""),
          productImage: String(i.productImage || i.product_image || ""),
          variantLabel: String(i.variantLabel || i.variant_label || ""),
          cuttingPreference:
            i.cuttingPreference || i.cutting_preference
              ? String(i.cuttingPreference || i.cutting_preference)
              : undefined,
          isPreorder: Boolean(i.isPreorder ?? i.is_preorder ?? false),
          quantity: Number(i.quantity ?? 1),
          unitPrice: Number(i.unitPrice ?? i.unit_price ?? 0),
          lineTotal: Number(i.lineTotal ?? i.line_total ?? 0),
        }))
      : [],
    createdAt: String(
      row.created_at || row.createdAt || new Date().toISOString()
    ),
    updatedAt: String(
      row.updated_at || row.updatedAt || new Date().toISOString()
    ),
  };
}

function mapCouponFromRow(row: Record<string, unknown>): Coupon {
  return {
    id: String(row.id),
    code: String(row.code),
    title: String(row.title),
    discountType: (row.discount_type as Coupon["discountType"]) || "flat",
    discountValue: Number(row.discount_value ?? 0),
    minOrderAmount: Number(row.min_order_amount ?? 0),
    maxDiscountAmount:
      row.max_discount_amount !== null && row.max_discount_amount !== undefined
        ? Number(row.max_discount_amount)
        : undefined,
    isActive: Boolean(row.is_active ?? true),
    usageCount: Number(row.usage_count ?? 0),
  };
}

function mapReviewFromRow(row: Record<string, unknown>): ProductReview {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    orderCode: String(row.order_code),
    customerName: String(row.customer_name),
    customerDistrict: String(row.customer_district || "Dhaka"),
    rating: Number(row.rating ?? 5),
    comment: String(row.comment || ""),
    isVerifiedPurchase: Boolean(row.is_verified_purchase ?? true),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function mapTxFromRow(row: Record<string, unknown>): PaymentTransaction {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    orderCode: String(row.order_code),
    gateway: (row.gateway as PaymentTransaction["gateway"]) || "bkash",
    transactionId: String(row.transaction_id),
    validationId: row.validation_id ? String(row.validation_id) : undefined,
    amount: Number(row.amount ?? 0),
    currency: "BDT",
    status: (row.status as PaymentTransaction["status"]) || "validated",
    senderPhone: row.sender_phone ? String(row.sender_phone) : undefined,
    verifiedAt: row.verified_at ? String(row.verified_at) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function mapAttemptFromRow(row: Record<string, unknown>): PaymentAttemptRecord {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    orderCode: String(row.order_code),
    gateway: (row.gateway as "bkash" | "nagad") || "bkash",
    purpose: (row.purpose as "initial" | "due") || "initial",
    expectedAmount: Number(row.expected_amount ?? 0),
    gatewayOrderRef: String(row.gateway_order_ref || ""),
    gatewayPaymentId: row.gateway_payment_id
      ? String(row.gateway_payment_id)
      : undefined,
    gatewayTrxId: row.gateway_trx_id ? String(row.gateway_trx_id) : undefined,
    status: (row.status as PaymentAttemptRecord["status"]) || "created",
    failureReason: row.failure_reason ? String(row.failure_reason) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function mapContactMessageFromRow(row: Record<string, unknown>): ContactMessage {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    phone: String(row.phone || ""),
    email: row.email ? String(row.email) : undefined,
    subject: String(row.subject || ""),
    message: String(row.message || ""),
    status: (row.status as ContactMessage["status"]) || "unread",
    adminReply: row.admin_reply ? String(row.admin_reply) : undefined,
    repliedAt: row.replied_at ? String(row.replied_at) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

/**
 * Updates safe `site_settings` columns (requires authenticated admin session under RLS).
 */
export async function upsertSettingsToSupabase(
  settings: SiteSettings
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const safePayload = {
    inside_dhaka_fee: settings.insideDhakaFee,
    outside_dhaka_fee: settings.outsideDhakaFee,
    free_delivery_threshold: settings.freeDeliveryThreshold,
    enable_free_delivery: settings.enableFreeDelivery,
    preorder_advance_percent: settings.preorderAdvancePercent,
    support_phone: settings.supportPhone,
    whatsapp_number: settings.whatsappNumber,
    bkash_merchant_number: settings.bkashMerchantNumber,
    bkash_account_type: settings.bkashAccountType || "merchant",
    nagad_number: settings.nagadNumber || "01713-477780",
    nagad_account_type: settings.nagadAccountType || "merchant",
    nagad_enabled: settings.nagadEnabled ?? true,
    bkash_enabled: settings.bkashEnabled ?? true,
    cod_enabled: settings.codEnabled ?? true,
    announcement_en: settings.announcementEn,
    announcement_bn: settings.announcementBn,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("site_settings")
    .update(safePayload)
    .eq("id", 1);

  return !error;
}

export async function upsertProductToSupabase(
  product: Product
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from("products").upsert({
    id: product.id,
    category_id: product.categoryId,
    category_name: product.categoryName,
    category_slug: product.categorySlug,
    title: product.title,
    title_bn: product.titleBn,
    slug: product.slug,
    short_description: product.shortDescription,
    description: product.description,
    origin_source: product.originSource,
    primary_image: product.primaryImage,
    gallery_images: product.galleryImages,
    is_preorder: product.isPreorder,
    preorder_cutoff_at: product.preorderCutoffAt || null,
    expected_delivery_date: product.expectedDeliveryDate || null,
    batch_target_qty: product.batchTargetQty,
    batch_booked_qty: product.batchBookedQty,
    unit_type: product.unitType,
    cutting_options: product.cuttingOptions,
    nutrition_highlights: product.nutritionHighlights,
    seo_title: product.seoTitle || null,
    seo_description: product.seoDescription || null,
    search_keywords: product.searchKeywords,
    is_featured: product.isFeatured,
    is_active: product.isActive,
    rating: product.rating,
    review_count: product.reviewCount,
    variants: product.variants,
    created_at: product.createdAt,
    updated_at: new Date().toISOString(),
  });

  if (product.variants.length > 0) {
    await supabase.from("product_variants").upsert(
      product.variants.map((v) => ({
        id: v.id,
        product_id: product.id,
        label: v.label,
        weight_grams: v.weightGrams,
        price: v.price,
        compare_at_price: v.compareAtPrice || null,
        stock_qty: v.stockQty,
        is_default: v.isDefault,
      }))
    );
  }

  return !error;
}

export async function deleteProductFromSupabase(
  productId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId);
  return !error;
}

export async function upsertCategoryToSupabase(
  category: Category
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from("categories").upsert({
    id: category.id,
    name: category.name,
    name_bn: category.nameBn,
    slug: category.slug,
    description: category.description || "",
    image_url: category.imageUrl || "/images/products/jamuna-fish.jpg",
    badge_text: category.badgeText || null,
    sort_order: category.sortOrder ?? 0,
    is_active: category.isActive !== false,
  });

  return !error;
}

export async function deleteCategoryFromSupabase(
  categoryId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId);

  return !error;
}

export async function upsertCouponToSupabase(coupon: Coupon): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const { error } = await supabase.from("coupons").upsert({
    id: coupon.id,
    code: coupon.code,
    title: coupon.title,
    title_bn: coupon.title,
    description: coupon.title,
    discount_type: coupon.discountType,
    discount_value: coupon.discountValue,
    min_order_amount: coupon.minOrderAmount,
    max_discount_amount: coupon.maxDiscountAmount ?? null,
    is_active: coupon.isActive,
    usage_count: coupon.usageCount,
  });
  return !error;
}

export async function deleteCouponFromSupabase(
  couponId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const { error } = await supabase.from("coupons").delete().eq("id", couponId);
  return !error;
}

/**
 * Public contact form submission (INSERT-only on the 6 granted columns; no SELECT read-back).
 */
export async function insertPublicContactMessageToSupabase(
  msg: Pick<ContactMessage, "id" | "name" | "phone" | "email" | "subject" | "message">
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("contact_messages").insert({
      id: msg.id,
      name: msg.name,
      phone: msg.phone.replace(/[^0-9+]/g, ""),
      email: msg.email || null,
      subject: msg.subject,
      message: msg.message,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Admin-only update for contact message status/reply (`public.is_admin()`).
 */
export async function upsertContactMessageToSupabase(
  msg: ContactMessage
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("contact_messages")
      .update({
        status: msg.status,
        admin_reply: msg.adminReply || null,
        replied_at: msg.repliedAt || null,
      })
      .eq("id", msg.id);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteContactMessageFromSupabase(
  id: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("contact_messages")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

// =============================================================================
// ZERO-CLIENT-TRUST EDGE API CALLERS (/api/orders/*, /api/reviews/*, /api/admin/*)
// =============================================================================

export interface CreateOrderEdgeInput {
  customerName: string;
  customerPhone: string;
  deliveryZone: Order["deliveryZone"];
  customerDistrict: string;
  customerAddress: string;
  customerNote?: string;
  couponCode?: string;
  paymentMethod: "bkash" | "nagad" | "cod";
  paymentPlan: "full" | "advance" | "cod";
  items: {
    productId: string;
    variantId: string;
    quantity: number;
    cuttingPreference?: string;
  }[];
  idempotencyKey?: string;
  turnstileToken?: string;
  websiteHoneypot?: string;
}

export interface CreateOrderEdgeResult {
  success: boolean;
  order?: Order & { payableNow: number };
  error?: string;
}

export async function createOrderViaEdgeApi(
  input: CreateOrderEdgeInput
): Promise<CreateOrderEdgeResult> {
  try {
    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      order?: Record<string, unknown>;
      error?: { code?: string; message?: string } | string;
    };

    if (!res.ok || !data.success || !data.order) {
      const msg =
        typeof data.error === "string"
          ? data.error
          : data.error?.message || "Failed to place order. Please check your details and try again.";
      return { success: false, error: msg };
    }

    const mapped = mapOrderFromRow({
      ...data.order,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      deliveryZone: input.deliveryZone,
      customerDistrict: input.customerDistrict,
      customerAddress: input.customerAddress,
      customerNote: input.customerNote,
      couponCode: input.couponCode,
    });

    return {
      success: true,
      order: {
        ...mapped,
        payableNow: Number(data.order.payableNow ?? 0),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error while placing order.",
    };
  }
}

export async function quoteOrderViaEdgeApi(input: {
  items: {
    productId: string;
    variantId: string;
    quantity: number;
    cuttingPreference?: string;
  }[];
  deliveryZone: Order["deliveryZone"];
  couponCode?: string;
  paymentMethod: "bkash" | "nagad" | "cod";
  paymentPlan: "full" | "advance" | "cod";
}): Promise<{
  success: boolean;
  quote?: {
    subtotal: number;
    deliveryCharge: number;
    discountAmount: number;
    couponCode?: string;
    totalAmount: number;
    payableNow: number;
    dueAfterPayable: number;
    hasPreorder: boolean;
  };
  error?: string;
}> {
  try {
    const res = await fetch("/api/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      quote?: {
        subtotal: number;
        deliveryCharge: number;
        discountAmount: number;
        couponCode?: string;
        totalAmount: number;
        payableNow: number;
        dueAfterPayable: number;
        hasPreorder: boolean;
      };
      error?: { message?: string } | string;
    };
    if (!res.ok || !data.success || !data.quote) {
      const msg =
        typeof data.error === "string"
          ? data.error
          : data.error?.message || "Invalid coupon or basket";
      return { success: false, error: msg };
    }
    return { success: true, quote: data.quote };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not calculate quote",
    };
  }
}

export async function trackOrderViaEdgeApi(
  orderCode: string,
  phoneLast4: string
): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const res = await fetch("/api/orders/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderCode: orderCode.trim().toUpperCase(),
        phoneLast4: phoneLast4.trim(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      order?: Record<string, unknown>;
      error?: { message?: string } | string;
    };
    if (!res.ok || !data.success || !data.order) {
      const msg =
        typeof data.error === "string"
          ? data.error
          : data.error?.message || "No order found matching that Order ID and phone last 4 digits.";
      return { success: false, error: msg };
    }
    return { success: true, order: mapOrderFromRow(data.order) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not look up order",
    };
  }
}

export async function submitReviewViaEdgeApi(input: {
  orderCode: string;
  phoneLast4: string;
  productId: string;
  rating: number;
  comment: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/reviews/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: { message?: string } | string;
    };
    if (!res.ok || !data.success) {
      const msg =
        typeof data.error === "string"
          ? data.error
          : data.error?.message || "Could not submit review";
      return { success: false, error: msg };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to submit review",
    };
  }
}

export type AdminEdgeActionPayload =
  | HeroAdminActionPayload
  | {
      action: "set_order_status";
      orderId: string;
      newStatus: Order["orderStatus"];
    }
  | {
      action: "mark_order_paid";
      orderId: string;
      amount: number;
      reference: string;
      note?: string;
    }
  | {
      action: "verify_cod_phone";
      orderId: string;
      method?: "manual_call" | "sms_otp";
    }
  | {
      action: "adjust_order_weight";
      orderId: string;
      adjustment: number;
      note: string;
    }
  | {
      action: "assign_logistics";
      orderId: string;
      courierName: string;
      trackingReference?: string;
      riderName?: string;
      riderPhone?: string;
    }
  | {
      action: "resolve_attempt";
      attemptId: string;
      resolution: "refunded" | "dismissed";
      note?: string;
    };

export async function executeAdminActionViaEdgeApi(
  payload: AdminEdgeActionPayload
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Supabase client is not initialized" };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return {
      success: false,
      error: "Admin session expired. Please sign in with your admin email and password.",
    };
  }

  try {
    const res = await fetch("/api/admin/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      result?: Record<string, unknown>;
      error?: { message?: string } | string;
    };

    if (!res.ok || !data.success) {
      const msg =
        typeof data.error === "string"
          ? data.error
          : data.error?.message || "Admin action failed";
      return { success: false, error: msg };
    }

    return { success: true, result: data.result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error executing admin action",
    };
  }
}

/**
 * Verifies the currently signed-in Supabase Auth user is in `public.admins`
 * and loads all admin-only tables (`orders`, `payment_transactions`, `payment_attempts`, `coupons`, `contact_messages`).
 */
export async function fetchAuthenticatedAdminDataFromSupabase(): Promise<{
  authorized: boolean;
  email?: string;
  orders: Order[];
  transactions: PaymentTransaction[];
  paymentAttempts: PaymentAttemptRecord[];
  coupons: Coupon[];
  messages: ContactMessage[];
  error?: string;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      authorized: false,
      orders: [],
      transactions: [],
      paymentAttempts: [],
      coupons: [],
      messages: [],
      error: "Supabase is not configured",
    };
  }

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return {
      authorized: false,
      orders: [],
      transactions: [],
      paymentAttempts: [],
      coupons: [],
      messages: [],
    };
  }

  // Check membership in public.admins (RLS policy `admins_self_read` allows reading own row)
  const { data: adminRow, error: adminErr } = await supabase
    .from("admins")
    .select("user_id, email")
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (adminErr || !adminRow) {
    return {
      authorized: false,
      email: userRes.user.email,
      orders: [],
      transactions: [],
      paymentAttempts: [],
      coupons: [],
      messages: [],
      error: "This account is not listed in public.admins.",
    };
  }

  const [ordRes, txRes, attRes, cpnRes, msgRes] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase
      .from("payment_transactions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_attempts")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("coupons").select("*"),
    supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return {
    authorized: true,
    email: String(adminRow.email || userRes.user.email || ""),
    orders: Array.isArray(ordRes.data)
      ? ordRes.data.map((r) => mapOrderFromRow(r as Record<string, unknown>))
      : [],
    transactions: Array.isArray(txRes.data)
      ? txRes.data.map((r) => mapTxFromRow(r as Record<string, unknown>))
      : [],
    paymentAttempts: Array.isArray(attRes.data)
      ? attRes.data.map((r) => mapAttemptFromRow(r as Record<string, unknown>))
      : [],
    coupons: Array.isArray(cpnRes.data)
      ? cpnRes.data.map((r) => mapCouponFromRow(r as Record<string, unknown>))
      : [],
    messages: Array.isArray(msgRes.data)
      ? msgRes.data.map((r) =>
          mapContactMessageFromRow(r as Record<string, unknown>)
        )
      : [],
  };
}

/**
 * Seeds catalog/coupons/settings (requires authenticated admin session).
 */
export async function seedFullDatabaseToSupabase(
  currentProducts: Product[] = INITIAL_PRODUCTS,
  currentCoupons: Coupon[] = INITIAL_COUPONS,
  currentSettings: SiteSettings = INITIAL_SITE_SETTINGS
): Promise<{ ok: boolean; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Supabase client not configured" };
  }

  await upsertSettingsToSupabase(currentSettings);

  await supabase.from("categories").upsert(
    INITIAL_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      name_bn: c.nameBn,
      slug: c.slug,
      description: c.description,
      image_url: c.imageUrl,
      badge_text: c.badgeText || null,
      sort_order: c.sortOrder,
      is_active: c.isActive,
    }))
  );

  for (const prod of currentProducts) {
    await upsertProductToSupabase(prod);
  }

  for (const cpn of currentCoupons) {
    await upsertCouponToSupabase(cpn);
  }

  return {
    ok: true,
    message: `Synced ${currentProducts.length} products, ${currentCoupons.length} coupons & settings to Supabase!`,
  };
}

/**
 * Public Storefront Loader (reads ONLY public-granted tables and explicit safe columns).
 */
export async function fetchLiveStoreFromSupabase(): Promise<{
  status: SupabaseConnectionState;
  settings?: SiteSettings;
  products?: Product[];
  categories?: Category[];
  reviews?: ProductReview[];
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { status: "offline" };
  }

  try {
    const { data: settingsData, error: settingsErr } = await supabase
      .from("site_settings")
      .select(SAFE_SITE_SETTINGS_COLUMNS)
      .eq("id", 1)
      .maybeSingle();

    if (settingsErr) {
      if (
        settingsErr.code === "PGRST205" ||
        settingsErr.message?.includes("Could not find the table")
      ) {
        return { status: "schema_missing" };
      }
      return { status: "offline" };
    }

    const [prodRes, revRes, catRes] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("product_reviews")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

    const loadedProducts =
      prodRes.data && prodRes.data.length > 0
        ? prodRes.data.map((r) => mapProductFromRow(r as Record<string, unknown>))
        : INITIAL_PRODUCTS;

    const loadedCategories =
      catRes.data && catRes.data.length > 0
        ? catRes.data.map((r) => mapCategoryFromRow(r as Record<string, unknown>))
        : INITIAL_CATEGORIES;

    return {
      status: "connected_live",
      settings: settingsData
        ? mapSettingsFromRow(settingsData as unknown as Record<string, unknown>)
        : INITIAL_SITE_SETTINGS,
      products: loadedProducts,
      categories: loadedCategories,
      reviews:
        revRes.data && revRes.data.length > 0
          ? revRes.data.map((r) => mapReviewFromRow(r as Record<string, unknown>))
          : INITIAL_REVIEWS,
    };
  } catch {
    return { status: "offline" };
  }
}

export function subscribeToRealtimeStore(onUpdate: () => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel("sadhyer-bazar-realtime-sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "products" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "categories" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "site_settings" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "product_reviews" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "hero_slides" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "hero_settings" },
      () => onUpdate()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
