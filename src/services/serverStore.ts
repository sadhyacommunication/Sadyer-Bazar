import {
  Category,
  Coupon,
  Order,
  OrderStatus,
  PaymentStatus,
  PaymentTransaction,
  Product,
  SiteSettings,
} from "@/types";
import {
  INITIAL_CATEGORIES,
  INITIAL_COUPONS,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_SITE_SETTINGS,
  INITIAL_TRANSACTIONS,
} from "@/services/seedData";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

// Global singleton in-memory store for immediate zero-latency fallback when Supabase env vars are not yet set
const globalForStore = globalThis as unknown as {
  __sadyerStore?: {
    settings: SiteSettings;
    categories: Category[];
    products: Product[];
    coupons: Coupon[];
    orders: Order[];
    transactions: PaymentTransaction[];
  };
};

if (!globalForStore.__sadyerStore) {
  globalForStore.__sadyerStore = {
    settings: structuredClone(INITIAL_SITE_SETTINGS),
    categories: structuredClone(INITIAL_CATEGORIES),
    products: structuredClone(INITIAL_PRODUCTS),
    coupons: structuredClone(INITIAL_COUPONS),
    orders: structuredClone(INITIAL_ORDERS),
    transactions: structuredClone(INITIAL_TRANSACTIONS),
  };
}

const memStore = globalForStore.__sadyerStore;

export async function getServerSettings(): Promise<SiteSettings> {
  const supabase = getSupabaseAdminClient();
  if (supabase && isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (!error && data) {
      return {
        id: data.id,
        insideDhakaFee: Number(data.inside_dhaka_fee),
        outsideDhakaFee: Number(data.outside_dhaka_fee),
        freeDeliveryThreshold: Number(data.free_delivery_threshold),
        enableFreeDelivery: Boolean(data.enable_free_delivery),
        preorderAdvancePercent: Number(data.preorder_advance_percent),
        supportPhone: data.support_phone,
        whatsappNumber: data.whatsapp_number,
        bkashMerchantNumber: data.bkash_merchant_number,
        announcementEn: data.announcement_en,
        announcementBn: data.announcement_bn,
        sslcommerzEnabled: Boolean(data.sslcommerz_enabled),
        bkashEnabled: Boolean(data.bkash_enabled),
        codEnabled: Boolean(data.cod_enabled),
        updatedAt: data.updated_at,
      };
    }
  }
  return memStore.settings;
}

export async function updateServerSettings(
  nextSettings: Partial<SiteSettings>
): Promise<SiteSettings> {
  memStore.settings = {
    ...memStore.settings,
    ...nextSettings,
    updatedAt: new Date().toISOString(),
  };

  const supabase = getSupabaseAdminClient();
  if (supabase && isSupabaseConfigured()) {
    await supabase.from("site_settings").upsert({
      id: 1,
      inside_dhaka_fee: memStore.settings.insideDhakaFee,
      outside_dhaka_fee: memStore.settings.outsideDhakaFee,
      free_delivery_threshold: memStore.settings.freeDeliveryThreshold,
      enable_free_delivery: memStore.settings.enableFreeDelivery,
      preorder_advance_percent: memStore.settings.preorderAdvancePercent,
      support_phone: memStore.settings.supportPhone,
      whatsapp_number: memStore.settings.whatsappNumber,
      bkash_merchant_number: memStore.settings.bkashMerchantNumber,
      announcement_en: memStore.settings.announcementEn,
      announcement_bn: memStore.settings.announcementBn,
      sslcommerz_enabled: memStore.settings.sslcommerzEnabled,
      bkash_enabled: memStore.settings.bkashEnabled,
      cod_enabled: memStore.settings.codEnabled,
      updated_at: memStore.settings.updatedAt,
    });
  }

  return memStore.settings;
}

export async function getServerProducts(): Promise<Product[]> {
  return memStore.products;
}

export async function getServerCoupons(): Promise<Coupon[]> {
  return memStore.coupons;
}

export async function getServerCategories(): Promise<Category[]> {
  return memStore.categories;
}

export async function getServerOrders(): Promise<Order[]> {
  return memStore.orders;
}

export async function findServerOrderByCode(
  orderCode: string
): Promise<Order | undefined> {
  const normalized = orderCode.trim().toUpperCase();
  const supabase = getSupabaseAdminClient();
  if (supabase && isSupabaseConfigured()) {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("order_code", normalized)
      .single();
    if (data) {
      return {
        id: data.id,
        orderCode: data.order_code,
        customerName: data.customer_name,
        customerPhone: data.customer_phone,
        deliveryZone: data.delivery_zone,
        customerDistrict: data.customer_district,
        customerAddress: data.customer_address,
        customerNote: data.customer_note,
        subtotal: Number(data.subtotal),
        deliveryCharge: Number(data.delivery_charge),
        discountAmount: Number(data.discount_amount),
        couponCode: data.coupon_code || undefined,
        weightAdjustmentAmount: Number(data.weight_adjustment_amount || 0),
        weightAdjustmentNote: data.weight_adjustment_note || undefined,
        totalAmount: Number(data.total_amount),
        advancePaid: Number(data.advance_paid),
        dueAmount: Number(data.due_amount),
        paymentMethod: data.payment_method,
        paymentPlan: data.payment_plan,
        paymentStatus: data.payment_status,
        orderStatus: data.order_status,
        hasPreorderItems: Boolean(data.has_preorder_items),
        transactionId: data.transaction_id,
        courierName: data.courier_name || undefined,
        trackingReference: data.tracking_reference || undefined,
        riderName: data.rider_name || undefined,
        riderPhone: data.rider_phone || undefined,
        items: (data.order_items || []).map(
          (item: Record<string, unknown>) => ({
            id: String(item.id),
            orderId: String(item.order_id),
            productId: String(item.product_id),
            variantId: String(item.variant_id),
            productTitle: String(item.product_title),
            productTitleBn: String(item.product_title_bn),
            productImage: String(item.product_image),
            variantLabel: String(item.variant_label),
            cuttingPreference: item.cutting_preference
              ? String(item.cutting_preference)
              : undefined,
            isPreorder: Boolean(item.is_preorder),
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            lineTotal: Number(item.line_total),
          })
        ),
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }
  }

  return memStore.orders.find((o) => o.orderCode.toUpperCase() === normalized);
}

export async function saveServerOrder(order: Order): Promise<Order> {
  memStore.orders = [order, ...memStore.orders];

  // Update booked quantities on products
  for (const item of order.items) {
    const product = memStore.products.find((p) => p.id === item.productId);
    if (product) {
      product.batchBookedQty = Math.min(
        product.batchTargetQty,
        product.batchBookedQty + item.quantity
      );
    }
  }

  // Increment coupon usage count if applied
  if (order.couponCode) {
    const coup = memStore.coupons.find(
      (c) => c.code.toUpperCase() === order.couponCode?.toUpperCase()
    );
    if (coup) {
      coup.usageCount += 1;
    }
  }

  const supabase = getSupabaseAdminClient();
  if (supabase && isSupabaseConfigured()) {
    const { data: insertedOrder } = await supabase
      .from("orders")
      .insert({
        order_code: order.orderCode,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        delivery_zone: order.deliveryZone,
        customer_district: order.customerDistrict,
        customer_address: order.customerAddress,
        customer_note: order.customerNote,
        subtotal: order.subtotal,
        delivery_charge: order.deliveryCharge,
        discount_amount: order.discountAmount,
        coupon_code: order.couponCode,
        total_amount: order.totalAmount,
        advance_paid: order.advancePaid,
        due_amount: order.dueAmount,
        payment_method: order.paymentMethod,
        payment_plan: order.paymentPlan,
        payment_status: order.paymentStatus,
        order_status: order.orderStatus,
        has_preorder_items: order.hasPreorderItems,
        transaction_id: order.transactionId,
      })
      .select("id")
      .single();

    if (insertedOrder?.id) {
      await supabase.from("order_items").insert(
        order.items.map((item) => ({
          order_id: insertedOrder.id,
          product_title: item.productTitle,
          product_title_bn: item.productTitleBn,
          product_image: item.productImage,
          variant_label: item.variantLabel,
          cutting_preference: item.cuttingPreference,
          is_preorder: item.isPreorder,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.lineTotal,
        }))
      );
    }
  }

  return order;
}

export async function recordServerPaymentVerification(params: {
  orderCode: string;
  gateway: "bkash" | "sslcommerz" | "manual_verify";
  transactionId: string;
  validationId: string;
  amount: number;
  senderPhone?: string;
}): Promise<{ order?: Order; transaction: PaymentTransaction }> {
  const normalizedCode = params.orderCode.trim().toUpperCase();
  const order = memStore.orders.find(
    (o) => o.orderCode.toUpperCase() === normalizedCode
  );

  const transaction: PaymentTransaction = {
    id: `trx-${Date.now()}`,
    orderId: order?.id || "ord-online",
    orderCode: normalizedCode,
    gateway: params.gateway,
    transactionId: params.transactionId,
    validationId: params.validationId,
    amount: params.amount,
    currency: "BDT",
    status: "validated",
    senderPhone: params.senderPhone,
    verifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  memStore.transactions = [transaction, ...memStore.transactions];

  if (order) {
    const newAdvancePaid = Math.min(
      order.totalAmount,
      order.advancePaid + params.amount
    );
    const newDueAmount = Math.max(0, order.totalAmount - newAdvancePaid);
    const newPaymentStatus: PaymentStatus =
      newDueAmount === 0 ? "paid" : "advance_paid";
    const newOrderStatus: OrderStatus =
      order.orderStatus === "pending" ? "confirmed" : order.orderStatus;

    order.advancePaid = newAdvancePaid;
    order.dueAmount = newDueAmount;
    order.paymentStatus = newPaymentStatus;
    order.orderStatus = newOrderStatus;
    order.transactionId = params.transactionId;
    order.updatedAt = new Date().toISOString();
  }

  const supabase = getSupabaseAdminClient();
  if (supabase && isSupabaseConfigured() && order) {
    await supabase
      .from("orders")
      .update({
        advance_paid: order.advancePaid,
        due_amount: order.dueAmount,
        payment_status: order.paymentStatus,
        order_status: order.orderStatus,
        transaction_id: params.transactionId,
        updated_at: order.updatedAt,
      })
      .eq("order_code", normalizedCode);
  }

  return { order, transaction };
}
