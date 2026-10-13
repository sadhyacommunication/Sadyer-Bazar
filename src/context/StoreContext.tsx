"use client";

import React, {
  createContext,
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
  deleteContactMessageFromSupabase,
  deleteCouponFromSupabase,
  deleteProductFromSupabase,
  fetchLiveStoreFromSupabase,
  insertReviewToSupabase,
  seedFullDatabaseToSupabase,
  subscribeToRealtimeStore,
  SupabaseConnectionState,
  upsertContactMessageToSupabase,
  upsertCouponToSupabase,
  upsertOrderToSupabase,
  upsertProductToSupabase,
  upsertSettingsToSupabase,
} from "@/services/supabaseSync";

interface StoreContextValue {
  products: Product[];
  categories: Category[];
  coupons: Coupon[];
  reviews: ProductReview[];
  orders: Order[];
  transactions: PaymentTransaction[];
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
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateOrderPaymentStatus: (
    orderId: string,
    paymentStatus: PaymentStatus,
    advancePaid?: number,
    transactionId?: string
  ) => void;
  adjustOrderWeightAndBill: (
    orderId: string,
    weightAdjustmentAmount: number,
    weightAdjustmentNote: string
  ) => void;
  assignOrderLogistics: (
    orderId: string,
    courierName: string,
    trackingReference: string,
    riderName: string,
    riderPhone: string
  ) => void;

  // Admin Product Management Actions
  addProduct: (newProduct: Product) => void;
  updateProduct: (updatedProduct: Product) => void;
  deleteProduct: (productId: string) => void;

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
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const STORAGE_KEYS = {
  CART: "sb_cart_v2",
  PRODUCTS: "sb_products_v2",
  COUPONS: "sb_coupons_v2",
  REVIEWS: "sb_reviews_v2",
  ORDERS: "sb_orders_v2",
  TRANSACTIONS: "sb_transactions_v2",
  SETTINGS: "sb_settings_v2",
  CONTACT_MESSAGES: "sb_contact_messages_v1",
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [categories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [reviews, setReviews] = useState<ProductReview[]>(INITIAL_REVIEWS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [transactions, setTransactions] =
    useState<PaymentTransaction[]>(INITIAL_TRANSACTIONS);
  const [settings, setSettings] = useState<SiteSettings>(INITIAL_SITE_SETTINGS);
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

  useEffect(() => {
    try {
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

      const savedCoupons = localStorage.getItem(STORAGE_KEYS.COUPONS);
      if (savedCoupons) setCoupons(JSON.parse(savedCoupons));

      const savedReviews = localStorage.getItem(STORAGE_KEYS.REVIEWS);
      if (savedReviews) setReviews(JSON.parse(savedReviews));

      const savedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (savedOrders) setOrders(JSON.parse(savedOrders));

      const savedTransactions = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (savedTransactions) setTransactions(JSON.parse(savedTransactions));

      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) setSettings(JSON.parse(savedSettings));

      const savedMessages = localStorage.getItem(STORAGE_KEYS.CONTACT_MESSAGES);
      if (savedMessages) setMessages(JSON.parse(savedMessages));
    } catch {
      // Ignore storage parse issues
    }
    setHydrated(true);

    const loadFromSupabase = () => {
      fetchLiveStoreFromSupabase().then((live) => {
        setSupabaseStatus(live.status);
        if (live.status === "connected_live") {
          if (live.settings) setSettings(live.settings);
          if (live.products && live.products.length > 0)
            setProducts(live.products);
          if (live.coupons && live.coupons.length > 0) setCoupons(live.coupons);
          if (live.orders && live.orders.length > 0) setOrders(live.orders);
          if (live.transactions && live.transactions.length > 0)
            setTransactions(live.transactions);
          if (live.reviews && live.reviews.length > 0) setReviews(live.reviews);
          if (live.messages && live.messages.length > 0)
            setMessages(live.messages);
        }
      });
    };

    // Connect and hydrate live data from Supabase (https://uqyjtlndgnvfqjcdwbop.supabase.co)
    loadFromSupabase();

    // Subscribe to real-time Postgres changes across devices
    const unsubscribe = subscribeToRealtimeStore(() => {
      loadFromSupabase();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const syncDatabaseWithSupabase = async () => {
    setSupabaseStatus("checking");
    const res = await seedFullDatabaseToSupabase(
      products,
      orders,
      coupons,
      reviews,
      transactions,
      settings,
      messages
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
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    } catch {}
  }, [orders, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEYS.TRANSACTIONS,
        JSON.stringify(transactions)
      );
    } catch {}
  }, [transactions, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEYS.CONTACT_MESSAGES,
        JSON.stringify(messages)
      );
    } catch {}
  }, [messages, hydrated]);

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
    setOrders((prev) => [
      order,
      ...prev.filter((o) => o.orderCode !== order.orderCode),
    ]);
    if (transaction) {
      setTransactions((prev) => [transaction, ...prev]);
    }
    if (order.couponCode) {
      setCoupons((prev) =>
        prev.map((c) => {
          if (c.code.toUpperCase() === order.couponCode?.toUpperCase()) {
            const updatedCoupon = { ...c, usageCount: c.usageCount + 1 };
            upsertCouponToSupabase(updatedCoupon);
            return updatedCoupon;
          }
          return c;
        })
      );
    }
    setProducts((prev) =>
      prev.map((prod) => {
        const orderedQty = order.items
          .filter((i) => i.productId === prod.id)
          .reduce((acc, i) => acc + i.quantity, 0);
        if (orderedQty === 0) return prod;
        const updatedProd = {
          ...prod,
          batchBookedQty: Math.min(
            prod.batchTargetQty,
            prod.batchBookedQty + orderedQty
          ),
        };
        upsertProductToSupabase(updatedProd);
        return updatedProd;
      })
    );

    // Sync order & payment transaction to live Supabase
    upsertOrderToSupabase(order, transaction);
  };

  const findOrderByCode = (code: string): Order | undefined => {
    const clean = code.trim().toUpperCase();
    return orders.find((o) => o.orderCode.toUpperCase() === clean);
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const updated = {
          ...o,
          orderStatus: status,
          updatedAt: new Date().toISOString(),
        };
        upsertOrderToSupabase(updated);
        return updated;
      })
    );
    showToast(`Order status updated to "${status.toUpperCase()}"`);
  };

  const updateOrderPaymentStatus = (
    orderId: string,
    paymentStatus: PaymentStatus,
    advancePaid?: number,
    transactionId?: string
  ) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const nextAdvance =
          advancePaid !== undefined
            ? advancePaid
            : paymentStatus === "paid"
            ? o.totalAmount
            : o.advancePaid;
        const nextDue = Math.max(0, o.totalAmount - nextAdvance);
        const updated: Order = {
          ...o,
          paymentStatus,
          advancePaid: nextAdvance,
          dueAmount: nextDue,
          transactionId: transactionId || o.transactionId,
          updatedAt: new Date().toISOString(),
        };
        upsertOrderToSupabase(updated);
        return updated;
      })
    );
    showToast(`Payment status updated to "${paymentStatus.toUpperCase()}"`);
  };

  const adjustOrderWeightAndBill = (
    orderId: string,
    weightAdjustmentAmount: number,
    weightAdjustmentNote: string
  ) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const baseTotal = Math.max(
          0,
          o.subtotal - o.discountAmount + o.deliveryCharge
        );
        const nextTotal = Math.max(0, baseTotal + weightAdjustmentAmount);
        const nextDue = Math.max(0, nextTotal - o.advancePaid);
        const nextPaymentStatus: PaymentStatus =
          nextDue === 0
            ? "paid"
            : o.advancePaid > 0
            ? "advance_paid"
            : o.paymentStatus;
        const updated: Order = {
          ...o,
          weightAdjustmentAmount,
          weightAdjustmentNote,
          totalAmount: nextTotal,
          dueAmount: nextDue,
          paymentStatus: nextPaymentStatus,
          updatedAt: new Date().toISOString(),
        };
        upsertOrderToSupabase(updated);
        return updated;
      })
    );
    showToast(
      `Scale weight adjustment (${
        weightAdjustmentAmount >= 0 ? "+" : ""
      }৳${weightAdjustmentAmount}) applied to order!`
    );
  };

  const assignOrderLogistics = (
    orderId: string,
    courierName: string,
    trackingReference: string,
    riderName: string,
    riderPhone: string
  ) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const updated: Order = {
          ...o,
          courierName,
          trackingReference,
          riderName,
          riderPhone,
          orderStatus:
            o.orderStatus === "pending" || o.orderStatus === "confirmed"
              ? "shipped"
              : o.orderStatus,
          updatedAt: new Date().toISOString(),
        };
        upsertOrderToSupabase(updated);
        return updated;
      })
    );
    showToast(`Assigned to "${courierName}" & updated tracking info!`);
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
    insertReviewToSupabase(review);
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== review.productId) return p;
        const updated = { ...p, reviewCount: p.reviewCount + 1 };
        upsertProductToSupabase(updated);
        return updated;
      })
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
    showToast("আপনার বার্তা সফলভাবে গৃহীত হয়েছে! শীঘ্রই আমাদের প্রতিনিধি যোগাযোগ করবেন।");
    await upsertContactMessageToSupabase(newMsg);
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
            repliedAt: status === "replied" ? new Date().toISOString() : m.repliedAt,
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

  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        coupons,
        reviews,
        orders,
        transactions,
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
        addProduct,
        updateProduct,
        deleteProduct,
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
