import { getSupabaseClient } from "@/lib/supabase/client";
import {
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
  INITIAL_COUPONS,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_REVIEWS,
  INITIAL_SITE_SETTINGS,
  INITIAL_TRANSACTIONS,
} from "./seedData";

export type SupabaseConnectionState =
  | "checking"
  | "connected_live"
  | "schema_missing"
  | "offline";

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
      (row.nagad_account_type as SiteSettings["nagadAccountType"]) || "personal",
    nagadEnabled: Boolean(row.nagad_enabled ?? true),
    announcementEn: String(
      row.announcement_en || INITIAL_SITE_SETTINGS.announcementEn
    ),
    announcementBn: String(
      row.announcement_bn || INITIAL_SITE_SETTINGS.announcementBn
    ),
    sslcommerzEnabled: Boolean(row.sslcommerz_enabled ?? true),
    sslcommerzStoreId: row.sslcommerz_store_id
      ? String(row.sslcommerz_store_id)
      : undefined,
    sslcommerzStorePassword: row.sslcommerz_store_password
      ? String(row.sslcommerz_store_password)
      : undefined,
    sslcommerzIsLive: Boolean(row.sslcommerz_is_live ?? false),
    bkashEnabled: Boolean(row.bkash_enabled ?? true),
    bkashAppKey: row.bkash_app_key ? String(row.bkash_app_key) : undefined,
    bkashAppSecret: row.bkash_app_secret
      ? String(row.bkash_app_secret)
      : undefined,
    codEnabled: Boolean(row.cod_enabled ?? true),
    updatedAt: String(row.updated_at || new Date().toISOString()),
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

function mapOrderFromRow(row: Record<string, unknown>): Order {
  return {
    id: String(row.id),
    orderCode: String(row.order_code),
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    deliveryZone:
      (row.delivery_zone as Order["deliveryZone"]) || "inside_dhaka",
    customerDistrict: String(row.customer_district || "Dhaka"),
    customerAddress: String(row.customer_address || ""),
    customerNote: row.customer_note ? String(row.customer_note) : undefined,
    subtotal: Number(row.subtotal ?? 0),
    deliveryCharge: Number(row.delivery_charge ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    couponCode: row.coupon_code ? String(row.coupon_code) : undefined,
    weightAdjustmentAmount: Number(row.weight_adjustment_amount ?? 0),
    weightAdjustmentNote: row.weight_adjustment_note
      ? String(row.weight_adjustment_note)
      : undefined,
    totalAmount: Number(row.total_amount ?? 0),
    advancePaid: Number(row.advance_paid ?? 0),
    dueAmount: Number(row.due_amount ?? 0),
    paymentMethod: (row.payment_method as Order["paymentMethod"]) || "cod",
    paymentPlan: (row.payment_plan as Order["paymentPlan"]) || "cod",
    paymentStatus: (row.payment_status as Order["paymentStatus"]) || "pending",
    orderStatus: (row.order_status as Order["orderStatus"]) || "pending",
    hasPreorderItems: Boolean(row.has_preorder_items),
    transactionId: row.transaction_id ? String(row.transaction_id) : undefined,
    courierName: row.courier_name ? String(row.courier_name) : undefined,
    trackingReference: row.tracking_reference
      ? String(row.tracking_reference)
      : undefined,
    riderName: row.rider_name ? String(row.rider_name) : undefined,
    riderPhone: row.rider_phone ? String(row.rider_phone) : undefined,
    items: Array.isArray(row.items) ? (row.items as OrderItem[]) : [],
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
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

export async function upsertSettingsToSupabase(
  settings: SiteSettings
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  // Try upserting full payment configuration
  const fullPayload: Record<string, unknown> = {
    id: 1,
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
    nagad_account_type: settings.nagadAccountType || "personal",
    nagad_enabled: settings.nagadEnabled ?? true,
    announcement_en: settings.announcementEn,
    announcement_bn: settings.announcementBn,
    sslcommerz_enabled: settings.sslcommerzEnabled,
    sslcommerz_store_id: settings.sslcommerzStoreId || null,
    sslcommerz_store_password: settings.sslcommerzStorePassword || null,
    sslcommerz_is_live: settings.sslcommerzIsLive ?? false,
    bkash_enabled: settings.bkashEnabled,
    bkash_app_key: settings.bkashAppKey || null,
    bkash_app_secret: settings.bkashAppSecret || null,
    cod_enabled: settings.codEnabled,
    updated_at: new Date().toISOString(),
  };

  const { error: fullError } = await supabase
    .from("site_settings")
    .upsert(fullPayload);

  if (!fullError) return true;

  // Graceful fallback to baseline columns if schema migration hasn't been executed
  const { error: fallbackError } = await supabase.from("site_settings").upsert({
    id: 1,
    inside_dhaka_fee: settings.insideDhakaFee,
    outside_dhaka_fee: settings.outsideDhakaFee,
    free_delivery_threshold: settings.freeDeliveryThreshold,
    enable_free_delivery: settings.enableFreeDelivery,
    preorder_advance_percent: settings.preorderAdvancePercent,
    support_phone: settings.supportPhone,
    whatsapp_number: settings.whatsappNumber,
    bkash_merchant_number: settings.bkashMerchantNumber,
    announcement_en: settings.announcementEn,
    announcement_bn: settings.announcementBn,
    sslcommerz_enabled: settings.sslcommerzEnabled,
    bkash_enabled: settings.bkashEnabled,
    cod_enabled: settings.codEnabled,
    updated_at: new Date().toISOString(),
  });

  return !fallbackError;
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

export async function upsertOrderToSupabase(
  order: Order,
  transaction?: PaymentTransaction
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const orderPayload = {
    id: order.id,
    order_code: order.orderCode,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    delivery_zone: order.deliveryZone,
    customer_district: order.customerDistrict,
    customer_address: order.customerAddress,
    customer_note: order.customerNote || null,
    subtotal: order.subtotal,
    delivery_charge: order.deliveryCharge,
    discount_amount: order.discountAmount,
    coupon_code: order.couponCode || null,
    weight_adjustment_amount: order.weightAdjustmentAmount || 0,
    weight_adjustment_note: order.weightAdjustmentNote || null,
    total_amount: order.totalAmount,
    advance_paid: order.advancePaid,
    due_amount: order.dueAmount,
    payment_method: order.paymentMethod,
    payment_plan: order.paymentPlan,
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
    has_preorder_items: order.hasPreorderItems,
    transaction_id: order.transactionId || null,
    courier_name: order.courierName || null,
    tracking_reference: order.trackingReference || null,
    rider_name: order.riderName || null,
    rider_phone: order.riderPhone || null,
    items: order.items,
    created_at: order.createdAt,
    updated_at: order.updatedAt || new Date().toISOString(),
  };

  let { error } = await supabase.from("orders").upsert(orderPayload);

  // If check constraint fails on 'nagad', retry with fallback method
  if (error && order.paymentMethod === "nagad") {
    const fallbackPayload = {
      ...orderPayload,
      payment_method: "bkash",
      weight_adjustment_note:
        (order.weightAdjustmentNote ? order.weightAdjustmentNote + " | " : "") +
        "Paid via Nagad",
    };
    const retry = await supabase.from("orders").upsert(fallbackPayload);
    error = retry.error;
  }

  if (order.items.length > 0) {
    await supabase.from("order_items").upsert(
      order.items.map((item) => ({
        id: item.id,
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        product_title: item.productTitle,
        product_title_bn: item.productTitleBn,
        product_image: item.productImage,
        variant_label: item.variantLabel,
        cutting_preference: item.cuttingPreference || null,
        is_preorder: item.isPreorder,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
      }))
    );
  }

  if (transaction) {
    const txPayload = {
      id: transaction.id,
      order_id: transaction.orderId,
      order_code: transaction.orderCode,
      gateway: transaction.gateway,
      transaction_id: transaction.transactionId,
      validation_id: transaction.validationId || null,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      sender_phone: transaction.senderPhone || null,
      verified_at: transaction.verifiedAt || null,
      created_at: transaction.createdAt,
    };

    let { error: txError } = await supabase
      .from("payment_transactions")
      .upsert(txPayload);

    // If constraint fails on nagad gateway, fallback to manual_verify
    if (txError && transaction.gateway === "nagad") {
      await supabase.from("payment_transactions").upsert({
        ...txPayload,
        gateway: "manual_verify",
        validation_id: "NAGAD-" + (transaction.validationId || "DIRECT"),
      });
    }
  }

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

export async function insertReviewToSupabase(
  review: ProductReview
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const { error } = await supabase.from("product_reviews").upsert({
    id: review.id,
    product_id: review.productId,
    order_code: review.orderCode,
    customer_name: review.customerName,
    customer_district: review.customerDistrict,
    rating: review.rating,
    comment: review.comment,
    is_verified_purchase: review.isVerifiedPurchase,
    created_at: review.createdAt,
  });
  return !error;
}

export async function seedFullDatabaseToSupabase(
  currentProducts: Product[] = INITIAL_PRODUCTS,
  currentOrders: Order[] = INITIAL_ORDERS,
  currentCoupons: Coupon[] = INITIAL_COUPONS,
  currentReviews: ProductReview[] = INITIAL_REVIEWS,
  currentTransactions: PaymentTransaction[] = INITIAL_TRANSACTIONS,
  currentSettings: SiteSettings = INITIAL_SITE_SETTINGS
): Promise<{ ok: boolean; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Supabase client not configured" };
  }

  // 1. Upsert site_settings
  const { error: settingsErr } = await supabase.from("site_settings").upsert({
    id: 1,
    inside_dhaka_fee: currentSettings.insideDhakaFee,
    outside_dhaka_fee: currentSettings.outsideDhakaFee,
    free_delivery_threshold: currentSettings.freeDeliveryThreshold,
    enable_free_delivery: currentSettings.enableFreeDelivery,
    preorder_advance_percent: currentSettings.preorderAdvancePercent,
    support_phone: currentSettings.supportPhone,
    whatsapp_number: currentSettings.whatsappNumber,
    bkash_merchant_number: currentSettings.bkashMerchantNumber,
    announcement_en: currentSettings.announcementEn,
    announcement_bn: currentSettings.announcementBn,
    sslcommerz_enabled: currentSettings.sslcommerzEnabled,
    bkash_enabled: currentSettings.bkashEnabled,
    cod_enabled: currentSettings.codEnabled,
    updated_at: new Date().toISOString(),
  });

  if (settingsErr) {
    return {
      ok: false,
      message: `Schema tables not created yet (${settingsErr.message}). Please run supabase/schema.sql in Supabase SQL Editor first.`,
    };
  }

  // 2. Upsert categories
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

  // 3. Upsert products & variants
  for (const prod of currentProducts) {
    await upsertProductToSupabase(prod);
  }

  // 4. Upsert coupons
  for (const cpn of currentCoupons) {
    await upsertCouponToSupabase(cpn);
  }

  // 5. Upsert orders & transactions
  for (const ord of currentOrders) {
    await upsertOrderToSupabase(ord);
  }
  for (const tx of currentTransactions) {
    await supabase.from("payment_transactions").upsert({
      id: tx.id,
      order_id: tx.orderId,
      order_code: tx.orderCode,
      gateway: tx.gateway,
      transaction_id: tx.transactionId,
      validation_id: tx.validationId || null,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      sender_phone: tx.senderPhone || null,
      verified_at: tx.verifiedAt || null,
      created_at: tx.createdAt,
    });
  }

  // 6. Upsert product reviews
  for (const rev of currentReviews) {
    await insertReviewToSupabase(rev);
  }

  return {
    ok: true,
    message: `Synced ${currentProducts.length} products, ${currentOrders.length} orders, ${currentCoupons.length} coupons & settings to Supabase!`,
  };
}

export async function fetchLiveStoreFromSupabase(): Promise<{
  status: SupabaseConnectionState;
  settings?: SiteSettings;
  products?: Product[];
  coupons?: Coupon[];
  orders?: Order[];
  transactions?: PaymentTransaction[];
  reviews?: ProductReview[];
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { status: "offline" };
  }

  try {
    const { data: settingsData, error: settingsErr } = await supabase
      .from("site_settings")
      .select("*")
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

    const [prodRes, cpnRes, ordRes, txRes, revRes] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase.from("coupons").select("*"),
      supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_transactions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("product_reviews")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    // If tables exist in Supabase but products table is completely empty, auto-seed initial catalog!
    if (prodRes.data && prodRes.data.length === 0) {
      await seedFullDatabaseToSupabase();
      return {
        status: "connected_live",
        settings: INITIAL_SITE_SETTINGS,
        products: INITIAL_PRODUCTS,
        coupons: INITIAL_COUPONS,
        orders: INITIAL_ORDERS,
        transactions: INITIAL_TRANSACTIONS,
        reviews: INITIAL_REVIEWS,
      };
    }

    const loadedProducts =
      prodRes.data && prodRes.data.length > 0
        ? prodRes.data.map((r) => mapProductFromRow(r as Record<string, unknown>))
        : undefined;

    // Ensure any newly added seed products (e.g. from code updates) are also synced
    if (loadedProducts) {
      const existingIds = new Set(loadedProducts.map((p) => p.id));
      const missingProducts = INITIAL_PRODUCTS.filter(
        (p) => !existingIds.has(p.id)
      );
      if (missingProducts.length > 0) {
        for (const mp of missingProducts) {
          await upsertProductToSupabase(mp);
          loadedProducts.push(mp);
        }
      }
    }

    return {
      status: "connected_live",
      settings: settingsData
        ? mapSettingsFromRow(settingsData as Record<string, unknown>)
        : undefined,
      products: loadedProducts,
      coupons: cpnRes.data
        ? cpnRes.data.map((r) => mapCouponFromRow(r as Record<string, unknown>))
        : undefined,
      orders: ordRes.data
        ? ordRes.data.map((r) => mapOrderFromRow(r as Record<string, unknown>))
        : undefined,
      transactions: txRes.data
        ? txRes.data.map((r) => mapTxFromRow(r as Record<string, unknown>))
        : undefined,
      reviews: revRes.data
        ? revRes.data.map((r) => mapReviewFromRow(r as Record<string, unknown>))
        : undefined,
    };
  } catch {
    return { status: "offline" };
  }
}

export async function fetchOrderByCodeFromSupabase(
  orderCode: string
): Promise<Order | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const clean = orderCode.trim().toUpperCase();
  if (!clean) return null;

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .ilike("order_code", clean)
      .maybeSingle();

    if (error || !data) return null;
    return mapOrderFromRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function subscribeToRealtimeStore(onUpdate: () => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel("sadyer-bazar-realtime-sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "products" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "site_settings" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "coupons" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "product_reviews" },
      () => onUpdate()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

