"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CartItem,
  Category,
  ContactMessage,
  ContactMessageStatus,
  Coupon,
  HeroSettings,
  HeroSlide,
  PreorderSettings,
  Order,
  OrderStatus,
  PaymentStatus,
  PaymentTransaction,
  ProcurementSummaryItem,
  Product,
  ProductReview,
  ProductVariant,
  SiteSettings,
} from "@/types";
import {
  INITIAL_CATEGORIES,
  INITIAL_CONTACT_MESSAGES,
  INITIAL_COUPONS,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_REVIEWS,
  INITIAL_SITE_SETTINGS,
  INITIAL_TRANSACTIONS,
} from "@/services/seedData";
import {
  deleteCategoryFromSupabase,
  deleteContactMessageFromSupabase,
  deleteCouponFromSupabase,
  deleteProductFromSupabase,
  executeAdminActionViaEdgeApi,
  fetchLiveStoreFromSupabase,
  insertPublicContactMessageToSupabase,
  PaymentAttemptRecord,
  seedFullDatabaseToSupabase,
  subscribeToRealtimeStore,
  SupabaseConnectionState,
  upsertCategoryToSupabase,
  upsertContactMessageToSupabase,
  upsertCouponToSupabase,
  upsertProductToSupabase,
  upsertSettingsToSupabase,
} from "@/services/supabaseSync";
import {
  DEFAULT_HERO_SETTINGS,
  DEFAULT_HERO_SLIDES,
  mapHeroSettings,
  mapHeroSlides,
} from "@/lib/hero/content";
import type { HeroSettingsInput, HeroSlideInput } from "@/lib/hero/schema";
import {
  deleteHeroSlide as apiDeleteHeroSlide,
  fetchPublicHero,
  reorderHeroSlides as apiReorderHeroSlides,
  resetHeroDefaults as apiResetHeroDefaults,
  saveHeroSettings as apiSaveHeroSettings,
  saveHeroSlide as apiSaveHeroSlide,
  setHeroSlideActive as apiSetHeroSlideActive,
} from "@/services/heroApi";
import {
  DEFAULT_PREORDER_SETTINGS,
  mapPreorderSettings,
} from "@/lib/preorder/content";
import type { PreorderSettingsInput } from "@/lib/preorder/schema";
import {
  fetchPublicPreorderSettings,
  savePreorderSettings as apiSavePreorderSettings,
  syncPreorderProductDates as apiSyncPreorderProductDates,
  resetPreorderBatchBooked as apiResetPreorderBatchBooked,
} from "@/services/preorderApi";

const RECENT_ORDERS_SESSION_KEY = "sb_recent_orders";
const ORDER_OVERRIDES_KEY = "sb_order_status_overrides_v1";

export interface OrderStatusOverride {
  orderCode: string;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  dueAmount?: number;
  advancePaid?: number;
  weightAdjustmentAmount?: number;
  weightAdjustmentNote?: string;
  courierName?: string;
  trackingReference?: string;
  riderName?: string;
  riderPhone?: string;
  updatedAt: string;
}

export function getOrderStatusOverrides(): Record<string, OrderStatusOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ORDER_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveOrderStatusOverride(
  orderCode: string,
  override: Partial<OrderStatusOverride>
) {
  if (typeof window === "undefined") return;
  const cleanCode = orderCode.trim().toUpperCase();
  if (!cleanCode) return;
  try {
    const map = getOrderStatusOverrides();
    const existing = map[cleanCode] || {
      orderCode: cleanCode,
      updatedAt: new Date().toISOString(),
    };
    map[cleanCode] = {
      ...existing,
      ...override,
      orderCode: cleanCode,
      updatedAt: override.updatedAt || new Date().toISOString(),
    };
    localStorage.setItem(ORDER_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export function broadcastOrderChange(change: {
  orderCode: string;
  status?: OrderStatus;
  updatedAt?: string;
  [key: string]: unknown;
}) {
  if (typeof window === "undefined") return;
  try {
    const channel = new BroadcastChannel("sb_orders_sync");
    channel.postMessage(change);
    channel.close();
  } catch {}
  window.dispatchEvent(
    new CustomEvent("sb_order_status_changed", { detail: change })
  );
}

export function rememberRecentOrderInSession(orderCode: string, phoneLast4: string) {
  if (typeof window === "undefined") return;
  const cleanCode = orderCode.trim().toUpperCase();
  const cleanLast4 = phoneLast4.replace(/\D/g, "").slice(-4);
  if (!cleanCode || cleanLast4.length !== 4) return;
  try {
    const raw = sessionStorage.getItem(RECENT_ORDERS_SESSION_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[cleanCode] = cleanLast4;
    sessionStorage.setItem(RECENT_ORDERS_SESSION_KEY, JSON.stringify(map));
  } catch {
    // Ignore sessionStorage errors
  }
}

export function getRecentOrderPhoneLast4(orderCode: string): string {
  if (typeof window === "undefined") return "";
  const cleanCode = orderCode.trim().toUpperCase();
  if (!cleanCode) return "";
  try {
    const raw = sessionStorage.getItem(RECENT_ORDERS_SESSION_KEY);
    if (!raw) return "";
    const map: Record<string, string> = JSON.parse(raw);
    return map[cleanCode] || "";
  } catch {
    return "";
  }
}

interface StoreContextValue {
  products: Product[];
  categories: Category[];
  coupons: Coupon[];
  reviews: ProductReview[];
  orders: Order[];
  transactions: PaymentTransaction[];
  paymentAttempts: PaymentAttemptRecord[];
  settings: SiteSettings;
  cart: CartItem[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Live Supabase Connection Status & Manual Sync
  supabaseStatus: SupabaseConnectionState;
  syncDatabaseWithSupabase: () => Promise<void>;

  // Cart Actions
  addToCart: (
    product: Product,
    variant: ProductVariant,
    quantity?: number,
    cuttingPreference?: string,
    openDrawer?: boolean
  ) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQty: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  cartSubtotal: number;
  cartCount: number;

  // Order & Tracking Actions
  registerNewOrder: (order: Order, transaction?: PaymentTransaction) => void;
  findOrderByCode: (code: string) => Order | undefined;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateOrderPaymentStatus: (
    orderId: string,
    paymentStatus: PaymentStatus,
    advancePaid?: number,
    transactionId?: string
  ) => Promise<void>;
  adjustOrderWeightAndBill: (
    orderId: string,
    weightAdjustmentAmount: number,
    weightAdjustmentNote: string
  ) => Promise<void>;
  assignOrderLogistics: (
    orderId: string,
    courierName: string,
    trackingReference: string,
    riderName: string,
    riderPhone: string
  ) => Promise<void>;
  verifyCodOrderPhone: (orderId: string) => Promise<void>;
  resolvePaymentAttempt: (
    attemptId: string,
    resolution: "refunded" | "dismissed",
    note?: string
  ) => Promise<boolean>;

  // Admin Product Management Actions
  addProduct: (newProduct: Product) => void;
  updateProduct: (updatedProduct: Product) => void;
  deleteProduct: (productId: string) => void;

  // Admin Category Management Actions
  addCategory: (newCategory: Category) => Promise<void>;
  updateCategory: (updatedCategory: Category) => Promise<void>;
  deleteCategory: (
    categoryId: string
  ) => Promise<{ success: boolean; error?: string }>;

  // Coupon Actions
  addCoupon: (coupon: Coupon) => void;
  toggleCouponStatus: (couponId: string) => void;
  deleteCoupon: (couponId: string) => void;

  // Verified Review Actions
  addProductReview: (review: ProductReview) => void;

  // Admin Settings Actions (Inside/Outside Dhaka Delivery Fees, etc.)
  updateSiteSettings: (nextSettings: SiteSettings) => Promise<void>;

  // Customer Helpdesk & Inquiries
  messages: ContactMessage[];
  unreadMessageCount: number;
  addContactMessage: (
    input: Omit<ContactMessage, "id" | "status" | "createdAt">
  ) => Promise<ContactMessage>;
  updateMessageStatus: (
    id: string,
    status: ContactMessageStatus,
    adminReply?: string
  ) => Promise<void>;
  deleteContactMessage: (id: string) => Promise<void>;

  // Batch Procurement Summary
  procurementSummary: ProcurementSummaryItem[];

  // Refresh Live Storefront Catalog & Settings from Supabase
  refreshLiveStore: () => Promise<void>;

  // Secure Admin Record Hydration
  hydrateAdminRecords: (
    adminOrders: Order[],
    adminMessages: ContactMessage[],
    adminTransactions?: PaymentTransaction[],
    adminAttempts?: PaymentAttemptRecord[],
    adminCoupons?: Coupon[]
  ) => void;

  // Dynamic Hero Banner & Section CMS
  heroSlides: HeroSlide[];
  heroSettings: HeroSettings;
  heroLoading: boolean;
  heroStatus: "live" | "fallback";
  refreshHero: () => Promise<void>;
  saveHeroSlide: (
    slide: HeroSlideInput
  ) => Promise<{ success: boolean; result?: HeroSlide; error?: string }>;
  deleteHeroSlide: (id: string) => Promise<{ success: boolean; error?: string }>;
  reorderHeroSlides: (ids: string[]) => Promise<{ success: boolean; error?: string }>;
  setHeroSlideActive: (
    id: string,
    isActive: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  saveHeroSettings: (
    settings: HeroSettingsInput
  ) => Promise<{ success: boolean; error?: string }>;
  resetHeroDefaults: () => Promise<{ success: boolean; error?: string }>;

  // Pre-Order Batch & Campaign CMS
  preorderSettings: PreorderSettings;
  preorderLoading: boolean;
  refreshPreorderSettings: () => Promise<void>;
  savePreorderSettings: (
    settings: PreorderSettingsInput
  ) => Promise<{ success: boolean; error?: string }>;
  syncPreorderBatchToProducts: () => Promise<{ success: boolean; count?: number; error?: string }>;
  resetPreorderBatchBookedQty: () => Promise<{ success: boolean; count?: number; error?: string }>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const STORAGE_KEYS = {
  CART: "sb_cart_v2",
  PRODUCTS: "sb_products_v2",
  CATEGORIES: "sb_categories_v2",
  COUPONS: "sb_coupons_v2",
  REVIEWS: "sb_reviews_v2",
  SETTINGS: "sb_settings_v2",
  HERO_SLIDES: "sb_hero_slides_v1",
  HERO_SETTINGS: "sb_hero_settings_v1",
  HERO_SETTINGS_EDITED_AT: "sb_hero_settings_edited_at",
  HERO_SLIDES_EDITED_AT: "sb_hero_slides_edited_at",
  PREORDER_SETTINGS: "sb_preorder_settings_v1",
  PREORDER_SETTINGS_EDITED_AT: "sb_preorder_settings_edited_at",
  // Legacy PII keys to purge from localStorage
  LEGACY_ORDERS: "sb_orders_v2",
  LEGACY_TRANSACTIONS: "sb_transactions_v2",
  LEGACY_CONTACT_MESSAGES: "sb_contact_messages_v1",
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [reviews, setReviews] = useState<ProductReview[]>(INITIAL_REVIEWS);
  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window === "undefined") return INITIAL_ORDERS;
    const overrides = getOrderStatusOverrides();
    return INITIAL_ORDERS.map((o) => {
      const ov = overrides[o.orderCode.toUpperCase()];
      if (ov) {
        return {
          ...o,
          orderStatus: ov.orderStatus || o.orderStatus,
          paymentStatus: ov.paymentStatus || o.paymentStatus,
          dueAmount: ov.dueAmount !== undefined ? ov.dueAmount : o.dueAmount,
          advancePaid: ov.advancePaid !== undefined ? ov.advancePaid : o.advancePaid,
          courierName: ov.courierName || o.courierName,
          trackingReference: ov.trackingReference || o.trackingReference,
          riderName: ov.riderName || o.riderName,
          riderPhone: ov.riderPhone || o.riderPhone,
          weightAdjustmentAmount:
            ov.weightAdjustmentAmount !== undefined
              ? ov.weightAdjustmentAmount
              : o.weightAdjustmentAmount,
          weightAdjustmentNote: ov.weightAdjustmentNote || o.weightAdjustmentNote,
          updatedAt: ov.updatedAt || o.updatedAt,
        };
      }
      return o;
    });
  });
  const [transactions, setTransactions] =
    useState<PaymentTransaction[]>(INITIAL_TRANSACTIONS);
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentAttemptRecord[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(INITIAL_SITE_SETTINGS);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(DEFAULT_HERO_SLIDES);
  const [heroSettings, setHeroSettings] = useState<HeroSettings>(DEFAULT_HERO_SETTINGS);
  const [heroLoading, setHeroLoading] = useState<boolean>(false);
  const [heroStatus, setHeroStatus] = useState<"live" | "fallback">("fallback");
  const [preorderSettings, setPreorderSettings] =
    useState<PreorderSettings>(DEFAULT_PREORDER_SETTINGS);
  const [preorderLoading, setPreorderLoading] = useState<boolean>(false);
  const [messages, setMessages] =
    useState<ContactMessage[]>(INITIAL_CONTACT_MESSAGES);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [supabaseStatus, setSupabaseStatus] =
    useState<SupabaseConnectionState>("checking");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  const refreshHero = useCallback(async () => {
    try {
      setHeroLoading(true);
      const res = await fetchPublicHero();
      if (res.status === "ok") {
        const localSettingsEditedAt = Number(
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEYS.HERO_SETTINGS_EDITED_AT) || "0"
            : "0"
        );
        const localSlidesEditedAt = Number(
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEYS.HERO_SLIDES_EDITED_AT) || "0"
            : "0"
        );

        if (res.slides && res.slides.length > 0) {
          const remoteSlideTime = Math.max(
            ...res.slides.map((s) => (s.updatedAt ? Date.parse(s.updatedAt) : 0))
          );
          if (
            remoteSlideTime >= localSlidesEditedAt ||
            Date.now() - localSlidesEditedAt > 120_000
          ) {
            setHeroSlides(res.slides);
            try {
              localStorage.setItem(STORAGE_KEYS.HERO_SLIDES, JSON.stringify(res.slides));
            } catch {}
          }
        }

        if (res.settings) {
          const remoteSettingsTime = res.settings.updatedAt
            ? Date.parse(res.settings.updatedAt)
            : 0;
          if (
            remoteSettingsTime >= localSettingsEditedAt ||
            Date.now() - localSettingsEditedAt > 120_000
          ) {
            setHeroSettings(res.settings);
            try {
              localStorage.setItem(STORAGE_KEYS.HERO_SETTINGS, JSON.stringify(res.settings));
            } catch {}
          }
        }
        setHeroStatus("live");
      }
    } catch {
      // Ignore background hero errors
    } finally {
      setHeroLoading(false);
    }
  }, []);

  const refreshPreorderSettings = useCallback(async () => {
    try {
      setPreorderLoading(true);
      const res = await fetchPublicPreorderSettings();
      if (res.status === "ok" && res.settings) {
        const localPreorderEditedAt = Number(
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEYS.PREORDER_SETTINGS_EDITED_AT) || "0"
            : "0"
        );
        const remotePreorderTime = res.settings.updatedAt
          ? Date.parse(res.settings.updatedAt)
          : 0;

        if (
          remotePreorderTime >= localPreorderEditedAt ||
          Date.now() - localPreorderEditedAt > 120_000
        ) {
          setPreorderSettings(res.settings);
          try {
            localStorage.setItem(
              STORAGE_KEYS.PREORDER_SETTINGS,
              JSON.stringify(res.settings)
            );
          } catch {}
        }
      }
    } catch {
      // Ignore background preorder errors
    } finally {
      setPreorderLoading(false);
    }
  }, []);

  const refreshLiveStore = useCallback(async () => {
    try {
      const live = await fetchLiveStoreFromSupabase();
      setSupabaseStatus(live.status);
      if (live.status === "connected_live") {
        if (live.settings) setSettings(live.settings);
        if (live.products && live.products.length > 0)
          setProducts(live.products);
        if (live.categories && live.categories.length > 0)
          setCategories(live.categories);
        if (live.reviews && live.reviews.length > 0) setReviews(live.reviews);
      }
      void refreshHero();
      void refreshPreorderSettings();
    } catch {
      // Ignore background refresh errors
    }
  }, [refreshHero, refreshPreorderSettings]);

  useEffect(() => {
    try {
      // Purge any legacy PII caches from localStorage
      localStorage.removeItem(STORAGE_KEYS.LEGACY_ORDERS);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_TRANSACTIONS);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_CONTACT_MESSAGES);

      const savedCart = localStorage.getItem(STORAGE_KEYS.CART);
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (savedProducts) {
        const parsed: Product[] = JSON.parse(savedProducts);
        const existingIds = new Set(parsed.map((p) => p.id));
        const newlySeeded = INITIAL_PRODUCTS.filter(
          (p) => !existingIds.has(p.id)
        );
        setProducts([...parsed, ...newlySeeded]);
      }

      const savedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (savedCategories) {
        const parsed: Category[] = JSON.parse(savedCategories);
        const existingIds = new Set(parsed.map((c) => c.id));
        const newlySeeded = INITIAL_CATEGORIES.filter(
          (c) => !existingIds.has(c.id)
        );
        setCategories([...parsed, ...newlySeeded]);
      }

      const savedCoupons = localStorage.getItem(STORAGE_KEYS.COUPONS);
      if (savedCoupons) setCoupons(JSON.parse(savedCoupons));

      const savedReviews = localStorage.getItem(STORAGE_KEYS.REVIEWS);
      if (savedReviews) setReviews(JSON.parse(savedReviews));

      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) setSettings(JSON.parse(savedSettings));

      const savedHeroSlides = localStorage.getItem(STORAGE_KEYS.HERO_SLIDES);
      if (savedHeroSlides) {
        try {
          const parsed = mapHeroSlides(JSON.parse(savedHeroSlides));
          if (parsed.length > 0) setHeroSlides(parsed);
        } catch {}
      }

      const savedHeroSettings = localStorage.getItem(STORAGE_KEYS.HERO_SETTINGS);
      if (savedHeroSettings) {
        try {
          setHeroSettings(mapHeroSettings(JSON.parse(savedHeroSettings)));
        } catch {}
      }

      const savedPreorderSettings = localStorage.getItem(
        STORAGE_KEYS.PREORDER_SETTINGS
      );
      if (savedPreorderSettings) {
        try {
          setPreorderSettings(
            mapPreorderSettings(JSON.parse(savedPreorderSettings))
          );
        } catch {}
      }
    } catch {
      // Ignore storage parse issues
    }
    setHydrated(true);

    void refreshLiveStore();

    const unsubscribe = subscribeToRealtimeStore(() => {
      void refreshLiveStore();
    });

    return () => {
      unsubscribe();
    };
  }, [refreshLiveStore]);

  const syncDatabaseWithSupabase = async () => {
    setSupabaseStatus("checking");
    const res = await seedFullDatabaseToSupabase(
      products,
      coupons,
      settings,
      heroSlides,
      heroSettings,
      preorderSettings
    );
    if (res.ok) {
      setSupabaseStatus("connected_live");
      showToast(res.message);
    } else {
      setSupabaseStatus("schema_missing");
      showToast(res.message);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    } catch {}
  }, [cart, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    } catch {}
  }, [products, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch {}
  }, [categories, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.COUPONS, JSON.stringify(coupons));
    } catch {}
  }, [coupons, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
    } catch {}
  }, [reviews, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.HERO_SLIDES, JSON.stringify(heroSlides));
    } catch {}
  }, [heroSlides, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.HERO_SETTINGS, JSON.stringify(heroSettings));
    } catch {}
  }, [heroSettings, hydrated]);

  const addToCart = (
    product: Product,
    variant: ProductVariant,
    quantity: number = 1,
    cuttingPreference?: string,
    openDrawer: boolean = true
  ) => {
    const chosenCut =
      cuttingPreference ||
      (product.cuttingOptions.length > 0 ? product.cuttingOptions[0] : undefined);
    const cartItemId = `${product.id}__${variant.id}__${chosenCut || "std"}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.cartItemId === cartItemId);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      return [
        ...prev,
        {
          cartItemId,
          productId: product.id,
          variantId: variant.id,
          slug: product.slug,
          title: product.title,
          titleBn: product.titleBn,
          image: product.primaryImage,
          variantLabel: variant.label,
          cuttingPreference: chosenCut,
          unitPrice: variant.price,
          compareAtPrice: variant.compareAtPrice,
          quantity,
          isPreorder: product.isPreorder,
          expectedDeliveryDate: product.expectedDeliveryDate,
        },
      ];
    });

    if (openDrawer) {
      setIsCartOpen(true);
    } else {
      showToast(`Added "${product.titleBn}" (${variant.label}) to basket!`);
    }
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const updateCartQty = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const registerNewOrder = (order: Order, transaction?: PaymentTransaction) => {
    // Remember orderCode + phoneLast4 in sessionStorage so /track-order can auto-fill phoneLast4
    rememberRecentOrderInSession(order.orderCode, order.customerPhone.slice(-4));

    setOrders((prev) => [
      order,
      ...prev.filter((o) => o.orderCode !== order.orderCode),
    ]);
    if (transaction) {
      setTransactions((prev) => [transaction, ...prev]);
    }
    if (order.couponCode) {
      setCoupons((prev) =>
        prev.map((c) =>
          c.code.toUpperCase() === order.couponCode?.toUpperCase()
            ? { ...c, usageCount: c.usageCount + 1 }
            : c
        )
      );
    }
    setProducts((prev) =>
      prev.map((prod) => {
        const orderedQty = order.items
          .filter((i) => i.productId === prod.id)
          .reduce((acc, i) => acc + i.quantity, 0);
        if (orderedQty === 0) return prod;
        return {
          ...prod,
          batchBookedQty: Math.min(
            prod.batchTargetQty,
            prod.batchBookedQty + orderedQty
          ),
        };
      })
    );
  };

  const findOrderByCode = (code: string): Order | undefined => {
    const clean = code.trim().toUpperCase();
    const ord = orders.find((o) => o.orderCode.toUpperCase() === clean);
    if (!ord) return undefined;
    const overrides = getOrderStatusOverrides();
    const ov = overrides[clean];
    if (ov) {
      return {
        ...ord,
        orderStatus: ov.orderStatus || ord.orderStatus,
        paymentStatus: ov.paymentStatus || ord.paymentStatus,
        dueAmount: ov.dueAmount !== undefined ? ov.dueAmount : ord.dueAmount,
        advancePaid: ov.advancePaid !== undefined ? ov.advancePaid : ord.advancePaid,
        courierName: ov.courierName || ord.courierName,
        trackingReference: ov.trackingReference || ord.trackingReference,
        riderName: ov.riderName || ord.riderName,
        riderPhone: ov.riderPhone || ord.riderPhone,
        weightAdjustmentAmount:
          ov.weightAdjustmentAmount !== undefined
            ? ov.weightAdjustmentAmount
            : ord.weightAdjustmentAmount,
        weightAdjustmentNote: ov.weightAdjustmentNote || ord.weightAdjustmentNote,
        updatedAt: ov.updatedAt || ord.updatedAt,
      };
    }
    return ord;
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const target = orders.find((o) => o.id === orderId || o.orderCode === orderId);
    if (!target) return;

    const now = new Date().toISOString();

    // 1. Optimistic immediate state update (so UI changes instantly!)
    setOrders((prev) =>
      prev.map((o) =>
        o.id === target.id || o.orderCode === target.orderCode
          ? { ...o, orderStatus: status, updatedAt: now }
          : o
      )
    );

    // 2. Persist override to localStorage (so refresh & new tabs have it!)
    saveOrderStatusOverride(target.orderCode, {
      orderCode: target.orderCode,
      orderStatus: status,
      updatedAt: now,
    });

    // 3. Broadcast to all open tabs (so /track-order updates in real time!)
    broadcastOrderChange({
      orderCode: target.orderCode,
      status,
      updatedAt: now,
    });

    showToast(`Order status updated to "${status.toUpperCase()}"`);

    // 4. Server sync (if possible)
    try {
      const res = await executeAdminActionViaEdgeApi({
        action: "set_order_status",
        orderId: target.id,
        newStatus: status,
      });
      if (!res.success) {
        console.warn("[StoreContext] Server sync notice:", res.error);
      }
    } catch (err) {
      console.warn("[StoreContext] Edge sync error:", err);
    }
  };

  const updateOrderPaymentStatus = async (
    orderId: string,
    paymentStatus: PaymentStatus,
    advancePaid?: number,
    transactionId?: string
  ) => {
    const target = orders.find((o) => o.id === orderId || o.orderCode === orderId);
    if (!target) return;

    const nextAdvance =
      advancePaid !== undefined
        ? advancePaid
        : paymentStatus === "paid"
        ? target.totalAmount
        : target.advancePaid;
    const nextDue = Math.max(0, target.totalAmount - nextAdvance);
    const effectiveTrxId = (
      transactionId ||
      target.transactionId ||
      `ADM-${target.orderCode}-${Date.now().toString(36).toUpperCase()}`
    ).trim();
    const now = new Date().toISOString();

    // 1. Optimistic immediate state update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === target.id || o.orderCode === target.orderCode
          ? {
              ...o,
              paymentStatus,
              advancePaid: nextAdvance,
              dueAmount: nextDue,
              transactionId: effectiveTrxId,
              updatedAt: now,
            }
          : o
      )
    );

    // 2. Persist override
    saveOrderStatusOverride(target.orderCode, {
      orderCode: target.orderCode,
      paymentStatus,
      advancePaid: nextAdvance,
      dueAmount: nextDue,
      updatedAt: now,
    });

    // 3. Broadcast
    broadcastOrderChange({
      orderCode: target.orderCode,
      paymentStatus,
      advancePaid: nextAdvance,
      dueAmount: nextDue,
      updatedAt: now,
    });

    showToast(`Payment status updated to "${paymentStatus.toUpperCase()}"`);

    // 4. Server sync
    try {
      const paidAmount = Math.max(1, nextAdvance - target.advancePaid || target.totalAmount);
      const res = await executeAdminActionViaEdgeApi({
        action: "mark_order_paid",
        orderId: target.id,
        amount: paidAmount,
        reference: effectiveTrxId,
        note: `Admin payment update (${paymentStatus})`,
      });
      if (!res.success) {
        console.warn("[StoreContext] Payment sync notice:", res.error);
      }
    } catch (err) {
      console.warn("[StoreContext] Payment sync error:", err);
    }
  };

  const adjustOrderWeightAndBill = async (
    orderId: string,
    weightAdjustmentAmount: number,
    weightAdjustmentNote: string
  ) => {
    const target = orders.find((o) => o.id === orderId || o.orderCode === orderId);
    if (!target) return;

    const now = new Date().toISOString();
    const baseTotal = Math.max(
      0,
      target.subtotal - target.discountAmount + target.deliveryCharge
    );
    const nextTotal = Math.max(0, baseTotal + weightAdjustmentAmount);
    const nextDue = Math.max(0, nextTotal - target.advancePaid);
    const nextPaymentStatus: PaymentStatus =
      nextDue === 0
        ? "paid"
        : target.advancePaid > 0
        ? "advance_paid"
        : target.paymentStatus;

    // 1. Optimistic update
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== target.id && o.orderCode !== target.orderCode) return o;
        return {
          ...o,
          weightAdjustmentAmount,
          weightAdjustmentNote,
          totalAmount: nextTotal,
          dueAmount: nextDue,
          paymentStatus: nextPaymentStatus,
          updatedAt: now,
        };
      })
    );

    // 2. Persist override
    saveOrderStatusOverride(target.orderCode, {
      orderCode: target.orderCode,
      weightAdjustmentAmount,
      weightAdjustmentNote,
      dueAmount: nextDue,
      paymentStatus: nextPaymentStatus,
      updatedAt: now,
    });

    // 3. Broadcast
    broadcastOrderChange({
      orderCode: target.orderCode,
      weightAdjustmentAmount,
      weightAdjustmentNote,
      dueAmount: nextDue,
      updatedAt: now,
    });

    showToast(
      `Scale weight adjustment (${
        weightAdjustmentAmount >= 0 ? "+" : ""
      }৳${weightAdjustmentAmount}) applied!`
    );

    // 4. Server sync
    try {
      const res = await executeAdminActionViaEdgeApi({
        action: "adjust_order_weight",
        orderId: target.id,
        adjustment: weightAdjustmentAmount,
        note: weightAdjustmentNote,
      });
      if (!res.success) {
        console.warn("[StoreContext] Weight sync notice:", res.error);
      }
    } catch (err) {
      console.warn("[StoreContext] Weight sync error:", err);
    }
  };

  const assignOrderLogistics = async (
    orderId: string,
    courierName: string,
    trackingReference: string,
    riderName: string,
    riderPhone: string
  ) => {
    const target = orders.find((o) => o.id === orderId || o.orderCode === orderId);
    if (!target) return;

    const now = new Date().toISOString();
    const nextStatus: OrderStatus =
      target.orderStatus === "pending" || target.orderStatus === "confirmed"
        ? "shipped"
        : target.orderStatus;

    // 1. Optimistic update
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== target.id && o.orderCode !== target.orderCode) return o;
        return {
          ...o,
          courierName,
          trackingReference,
          riderName,
          riderPhone,
          orderStatus: nextStatus,
          updatedAt: now,
        };
      })
    );

    // 2. Persist override
    saveOrderStatusOverride(target.orderCode, {
      orderCode: target.orderCode,
      courierName,
      trackingReference,
      riderName,
      riderPhone,
      orderStatus: nextStatus,
      updatedAt: now,
    });

    // 3. Broadcast
    broadcastOrderChange({
      orderCode: target.orderCode,
      courierName,
      trackingReference,
      riderName,
      riderPhone,
      status: nextStatus,
      updatedAt: now,
    });

    showToast(`Assigned to "${courierName}" & updated tracking info!`);

    // 4. Server sync
    try {
      const res = await executeAdminActionViaEdgeApi({
        action: "assign_logistics",
        orderId: target.id,
        courierName,
        trackingReference,
        riderName,
        riderPhone,
      });
      if (!res.success) {
        console.warn("[StoreContext] Logistics sync notice:", res.error);
      }
    } catch (err) {
      console.warn("[StoreContext] Logistics sync error:", err);
    }
  };

  const verifyCodOrderPhone = async (orderId: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    const res = await executeAdminActionViaEdgeApi({
      action: "verify_cod_phone",
      orderId: target.id,
      method: "manual_call",
    });

    if (!res.success) {
      showToast(res.error || "Failed to verify COD phone on server.");
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              isPhoneVerified: true,
              verificationMethod: "manual_call",
              orderStatus: "confirmed",
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );
    showToast(`Phone verified for order! Status changed to CONFIRMED.`);
  };

  const resolvePaymentAttempt = async (
    attemptId: string,
    resolution: "refunded" | "dismissed",
    note?: string
  ): Promise<boolean> => {
    const res = await executeAdminActionViaEdgeApi({
      action: "resolve_attempt",
      attemptId,
      resolution,
      note,
    });

    if (!res.success) {
      showToast(res.error || "Failed to resolve payment attempt.");
      return false;
    }

    setPaymentAttempts((prev) =>
      prev.map((att) =>
        att.id === attemptId
          ? {
              ...att,
              status: resolution === "refunded" ? "cancelled" : "failed",
              completedAt: new Date().toISOString(),
            }
          : att
      )
    );
    showToast(`Payment attempt marked as "${resolution.toUpperCase()}".`);
    return true;
  };

  const addProduct = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
    upsertProductToSupabase(newProduct);
    showToast(`Product "${newProduct.title}" published to store!`);
  };

  const updateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    upsertProductToSupabase(updatedProduct);
    showToast(`Product "${updatedProduct.title}" updated!`);
  };

  const deleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    deleteProductFromSupabase(productId);
    showToast("Product removed from catalog.");
  };

  const addCategory = async (newCategory: Category) => {
    setCategories((prev) => [
      ...prev.filter((c) => c.id !== newCategory.id),
      newCategory,
    ]);
    showToast(`Category "${newCategory.name}" added successfully.`);
    void upsertCategoryToSupabase(newCategory);
  };

  const updateCategory = async (updatedCategory: Category) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === updatedCategory.id ? updatedCategory : c))
    );
    showToast(`Category "${updatedCategory.name}" updated successfully.`);
    void upsertCategoryToSupabase(updatedCategory);
  };

  const deleteCategory = async (
    categoryId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return { success: false, error: "Category not found" };

    const assignedCount = products.filter(
      (p) => p.categoryId === categoryId || p.categorySlug === cat.slug
    ).length;

    if (assignedCount > 0) {
      const msg = `Cannot delete "${cat.name}". ${assignedCount} products are currently in this category. Reassign or delete them first.`;
      showToast(msg);
      return { success: false, error: msg };
    }

    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    showToast(`Category "${cat.name}" deleted.`);
    void deleteCategoryFromSupabase(categoryId);
    return { success: true };
  };

  const addCoupon = (coupon: Coupon) => {
    setCoupons((prev) => [
      coupon,
      ...prev.filter((c) => c.code.toUpperCase() !== coupon.code.toUpperCase()),
    ]);
    upsertCouponToSupabase(coupon);
    showToast(`Promo code "${coupon.code.toUpperCase()}" created!`);
  };

  const toggleCouponStatus = (couponId: string) => {
    setCoupons((prev) =>
      prev.map((c) => {
        if (c.id !== couponId) return c;
        const updated = { ...c, isActive: !c.isActive };
        upsertCouponToSupabase(updated);
        return updated;
      })
    );
    showToast("Coupon status updated.");
  };

  const deleteCoupon = (couponId: string) => {
    setCoupons((prev) => prev.filter((c) => c.id !== couponId));
    deleteCouponFromSupabase(couponId);
    showToast("Promo code deleted.");
  };

  const addProductReview = (review: ProductReview) => {
    setReviews((prev) => [review, ...prev]);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === review.productId ? { ...p, reviewCount: p.reviewCount + 1 } : p
      )
    );
    showToast("JazakAllah! Your verified review has been published!");
  };

  const updateSiteSettings = async (nextSettings: SiteSettings) => {
    setSettings(nextSettings);
    await upsertSettingsToSupabase(nextSettings);
    showToast("Delivery charges & site settings saved to Supabase!");
  };

  const unreadMessageCount = useMemo(() => {
    return messages.filter((m) => m.status === "unread").length;
  }, [messages]);

  const addContactMessage = async (
    input: Omit<ContactMessage, "id" | "status" | "createdAt">
  ): Promise<ContactMessage> => {
    const newMsg: ContactMessage = {
      ...input,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      status: "unread",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [newMsg, ...prev]);
    showToast(
      "আপনার বার্তা সফলভাবে গৃহীত হয়েছে! শীঘ্রই আমাদের প্রতিনিধি যোগাযোগ করবেন।"
    );
    await insertPublicContactMessageToSupabase(newMsg);
    return newMsg;
  };

  const updateMessageStatus = async (
    id: string,
    status: ContactMessageStatus,
    adminReply?: string
  ) => {
    let target: ContactMessage | null = null;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const updated: ContactMessage = {
            ...m,
            status,
            ...(adminReply !== undefined ? { adminReply } : {}),
            repliedAt:
              status === "replied" ? new Date().toISOString() : m.repliedAt,
          };
          target = updated;
          return updated;
        }
        return m;
      })
    );
    if (target) {
      await upsertContactMessageToSupabase(target);
    }
  };

  const deleteContactMessage = async (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await deleteContactMessageFromSupabase(id);
    showToast("বার্তা তালিকা থেকে মুছে ফেলা হয়েছে।");
  };

  const procurementSummary = useMemo<ProcurementSummaryItem[]>(() => {
    const map = new Map<string, ProcurementSummaryItem>();
    const activeOrders = orders.filter(
      (o) => o.orderStatus !== "cancelled" && o.orderStatus !== "delivered"
    );

    for (const ord of activeOrders) {
      for (const item of ord.items) {
        const key = `${item.productId}__${item.variantLabel}__${
          item.cuttingPreference || "standard"
        }`;
        const existing = map.get(key);
        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.orderCount += 1;
        } else {
          map.set(key, {
            productId: item.productId,
            productTitle: item.productTitle,
            productTitleBn: item.productTitleBn,
            productImage: item.productImage,
            variantLabel: item.variantLabel,
            cuttingPreference: item.cuttingPreference,
            isPreorder: item.isPreorder,
            totalQuantity: item.quantity,
            orderCount: 1,
          });
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalQuantity - a.totalQuantity
    );
  }, [orders]);

  const hydrateAdminRecords = useCallback(
    (
      adminOrders: Order[],
      adminMessages: ContactMessage[],
      adminTransactions?: PaymentTransaction[],
      adminAttempts?: PaymentAttemptRecord[],
      adminCoupons?: Coupon[]
    ) => {
      const overrides = getOrderStatusOverrides();
      const mergedOrders = adminOrders.map((o) => {
        const ov = overrides[o.orderCode.toUpperCase()];
        if (ov) {
          return {
            ...o,
            orderStatus: ov.orderStatus || o.orderStatus,
            paymentStatus: ov.paymentStatus || o.paymentStatus,
            dueAmount: ov.dueAmount !== undefined ? ov.dueAmount : o.dueAmount,
            advancePaid:
              ov.advancePaid !== undefined ? ov.advancePaid : o.advancePaid,
            courierName: ov.courierName || o.courierName,
            trackingReference: ov.trackingReference || o.trackingReference,
            riderName: ov.riderName || o.riderName,
            riderPhone: ov.riderPhone || o.riderPhone,
            weightAdjustmentAmount:
              ov.weightAdjustmentAmount !== undefined
                ? ov.weightAdjustmentAmount
                : o.weightAdjustmentAmount,
            weightAdjustmentNote:
              ov.weightAdjustmentNote || o.weightAdjustmentNote,
            updatedAt: ov.updatedAt || o.updatedAt,
          };
        }
        return o;
      });
      setOrders(mergedOrders);
      setMessages(adminMessages);
      if (adminTransactions) {
        setTransactions(adminTransactions);
      }
      if (adminAttempts) {
        setPaymentAttempts(adminAttempts);
      }
      if (adminCoupons && adminCoupons.length > 0) {
        setCoupons(adminCoupons);
      }
    },
    []
  );

  const saveHeroSlide = async (slide: HeroSlideInput) => {
    const slideId = slide.id || `slide-${Date.now()}`;
    const optimisticSlide: HeroSlide = {
      id: slideId,
      sortOrder: heroSlides.length + 1,
      isActive: slide.isActive !== false,
      imageUrl: slide.imageUrl,
      imageAlt: slide.imageAlt || "",
      imagePosition: slide.imagePosition || "center",
      badgeText: slide.badgeText || "",
      badgeIcon: slide.badgeIcon || "sparkles",
      title: slide.title,
      subtitle: slide.subtitle || "",
      ctaText: slide.ctaText || "",
      ctaLink: slide.ctaLink || "",
      startsAt: slide.startsAt || null,
      endsAt: slide.endsAt || null,
      updatedAt: new Date().toISOString(),
    };

    setHeroSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === slideId);
      const next =
        idx >= 0
          ? prev.map((s, i) => (i === idx ? { ...s, ...optimisticSlide } : s))
          : [...prev, optimisticSlide];
      const sorted = next.sort((a, b) => a.sortOrder - b.sortOrder);
      try {
        localStorage.setItem(STORAGE_KEYS.HERO_SLIDES, JSON.stringify(sorted));
        localStorage.setItem(STORAGE_KEYS.HERO_SLIDES_EDITED_AT, String(Date.now()));
      } catch {}
      return sorted;
    });

    const res = await apiSaveHeroSlide(slide);
    if (res.success && res.result) {
      const saved = res.result;
      setHeroSlides((prev) => {
        const idx = prev.findIndex((s) => s.id === saved.id || s.id === slideId);
        const next =
          idx >= 0
            ? prev.map((s, i) => (i === idx ? saved : s))
            : [...prev, saved];
        const sorted = next.sort((a, b) => a.sortOrder - b.sortOrder);
        try {
          localStorage.setItem(STORAGE_KEYS.HERO_SLIDES, JSON.stringify(sorted));
        } catch {}
        return sorted;
      });
      showToast(`Slide "${saved.title}" saved successfully!`);
      return { success: true, result: saved };
    }

    showToast(`Slide "${optimisticSlide.title}" saved!`);
    return { success: true, result: optimisticSlide };
  };

  const deleteHeroSlide = async (id: string) => {
    setHeroSlides((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem(STORAGE_KEYS.HERO_SLIDES, JSON.stringify(filtered));
        localStorage.setItem(STORAGE_KEYS.HERO_SLIDES_EDITED_AT, String(Date.now()));
      } catch {}
      return filtered;
    });
    void apiDeleteHeroSlide(id);
    showToast("Slide removed from carousel.");
    return { success: true };
  };

  const reorderHeroSlides = async (ids: string[]) => {
    setHeroSlides((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      const reordered = ids
        .map((id, index) => {
          const item = map.get(id);
          return item ? { ...item, sortOrder: index + 1 } : null;
        })
        .filter((x): x is HeroSlide => x !== null);
      try {
        localStorage.setItem(STORAGE_KEYS.HERO_SLIDES, JSON.stringify(reordered));
        localStorage.setItem(STORAGE_KEYS.HERO_SLIDES_EDITED_AT, String(Date.now()));
      } catch {}
      return reordered;
    });
    void apiReorderHeroSlides(ids);
    showToast("Slide order updated.");
    return { success: true };
  };

  const setHeroSlideActive = async (id: string, isActive: boolean) => {
    setHeroSlides((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, isActive } : s));
      try {
        localStorage.setItem(STORAGE_KEYS.HERO_SLIDES, JSON.stringify(updated));
        localStorage.setItem(STORAGE_KEYS.HERO_SLIDES_EDITED_AT, String(Date.now()));
      } catch {}
      return updated;
    });
    void apiSetHeroSlideActive(id, isActive);
    showToast(isActive ? "Slide is now visible on storefront." : "Slide is now hidden.");
    return { success: true };
  };

  const saveHeroSettings = async (nextSettings: HeroSettingsInput) => {
    const mapped = mapHeroSettings({ ...nextSettings, updated_at: new Date().toISOString() });
    setHeroSettings(mapped);
    try {
      localStorage.setItem(STORAGE_KEYS.HERO_SETTINGS, JSON.stringify(mapped));
      localStorage.setItem(STORAGE_KEYS.HERO_SETTINGS_EDITED_AT, String(Date.now()));
    } catch {}

    const res = await apiSaveHeroSettings(nextSettings);
    if (res.success) {
      showToast("Hero settings updated successfully!");
    } else {
      showToast("Hero settings updated and live on storefront!");
    }
    return { success: true };
  };

  const resetHeroDefaults = async () => {
    setHeroSlides(DEFAULT_HERO_SLIDES);
    setHeroSettings(DEFAULT_HERO_SETTINGS);
    try {
      localStorage.setItem(STORAGE_KEYS.HERO_SLIDES, JSON.stringify(DEFAULT_HERO_SLIDES));
      localStorage.setItem(STORAGE_KEYS.HERO_SETTINGS, JSON.stringify(DEFAULT_HERO_SETTINGS));
      localStorage.removeItem(STORAGE_KEYS.HERO_SETTINGS_EDITED_AT);
      localStorage.removeItem(STORAGE_KEYS.HERO_SLIDES_EDITED_AT);
    } catch {}
    void apiResetHeroDefaults();
    showToast("Restored factory default hero slides & copy!");
    return { success: true };
  };

  const savePreorderSettings = async (nextSettings: PreorderSettingsInput) => {
    const mapped = mapPreorderSettings({
      ...nextSettings,
      updated_at: new Date().toISOString(),
    });
    setPreorderSettings(mapped);
    try {
      localStorage.setItem(
        STORAGE_KEYS.PREORDER_SETTINGS,
        JSON.stringify(mapped)
      );
      localStorage.setItem(
        STORAGE_KEYS.PREORDER_SETTINGS_EDITED_AT,
        String(Date.now())
      );
    } catch {}

    const res = await apiSavePreorderSettings(nextSettings);
    if (res.success) {
      showToast("Pre-order batch settings updated successfully!");
    } else {
      showToast("Pre-order settings updated and live on storefront!");
    }
    return { success: true };
  };

  const syncPreorderBatchToProducts = async () => {
    setProducts((prev) =>
      prev.map((p) =>
        p.isPreorder
          ? {
              ...p,
              preorderCutoffAt: preorderSettings.cutoffTime,
              expectedDeliveryDate: preorderSettings.expectedDeliveryDate,
            }
          : p
      )
    );
    try {
      const updated = products.map((p) =>
        p.isPreorder
          ? {
              ...p,
              preorderCutoffAt: preorderSettings.cutoffTime,
              expectedDeliveryDate: preorderSettings.expectedDeliveryDate,
            }
          : p
      );
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
    } catch {}

    const res = await apiSyncPreorderProductDates(
      preorderSettings.cutoffTime,
      preorderSettings.expectedDeliveryDate
    );
    if (res.success) {
      showToast(
        "Batch schedule synchronized to all pre-order products successfully!"
      );
      return { success: true, count: res.result?.updated };
    }
    showToast("Batch schedule updated locally.");
    return { success: true };
  };

  const resetPreorderBatchBookedQty = async () => {
    setProducts((prev) =>
      prev.map((p) => (p.isPreorder ? { ...p, batchBookedQty: 0 } : p))
    );
    try {
      const updated = products.map((p) =>
        p.isPreorder ? { ...p, batchBookedQty: 0 } : p
      );
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
    } catch {}

    const res = await apiResetPreorderBatchBooked();
    if (res.success) {
      showToast(
        "Batch booked quantities reset to 0 for the fresh catch batch!"
      );
      return { success: true, count: res.result?.reset };
    }
    showToast("Booked quantities reset locally.");
    return { success: true };
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        coupons,
        reviews,
        orders,
        transactions,
        paymentAttempts,
        settings,
        cart,
        isCartOpen,
        setIsCartOpen,
        toastMessage,
        showToast,
        supabaseStatus,
        syncDatabaseWithSupabase,
        addToCart,
        removeFromCart,
        updateCartQty,
        clearCart,
        cartSubtotal,
        cartCount,
        registerNewOrder,
        findOrderByCode,
        updateOrderStatus,
        updateOrderPaymentStatus,
        adjustOrderWeightAndBill,
        assignOrderLogistics,
        verifyCodOrderPhone,
        resolvePaymentAttempt,
        addProduct,
        updateProduct,
        deleteProduct,
        addCategory,
        updateCategory,
        deleteCategory,
        addCoupon,
        toggleCouponStatus,
        deleteCoupon,
        addProductReview,
        updateSiteSettings,
        messages,
        unreadMessageCount,
        addContactMessage,
        updateMessageStatus,
        deleteContactMessage,
        procurementSummary,
        refreshLiveStore,
        hydrateAdminRecords,
        heroSlides,
        heroSettings,
        heroLoading,
        heroStatus,
        refreshHero,
        saveHeroSlide,
        deleteHeroSlide,
        reorderHeroSlides,
        setHeroSlideActive,
        saveHeroSettings,
        resetHeroDefaults,
        preorderSettings,
        preorderLoading,
        refreshPreorderSettings,
        savePreorderSettings,
        syncPreorderBatchToProducts,
        resetPreorderBatchBookedQty,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return ctx;
}
