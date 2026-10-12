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
  INITIAL_COUPONS,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_REVIEWS,
  INITIAL_SITE_SETTINGS,
  INITIAL_TRANSACTIONS,
} from "@/services/seedData";

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

  // Order, Scale Weight Adjustment, Logistics & Payment Actions
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

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
    } catch {
      // Ignore storage parse issues
    }
    setHydrated(true);
  }, []);

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

    showToast(`Added "${product.titleBn}" (${variant.label}) to your basket!`);
    if (openDrawer) {
      setIsCartOpen(true);
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
    return orders.find((o) => o.orderCode.toUpperCase() === clean);
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, orderStatus: status, updatedAt: new Date().toISOString() }
          : o
      )
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
        return {
          ...o,
          paymentStatus,
          advancePaid: nextAdvance,
          dueAmount: nextDue,
          transactionId: transactionId || o.transactionId,
          updatedAt: new Date().toISOString(),
        };
      })
    );
    showToast(`Payment status updated to "${paymentStatus.toUpperCase()}"`);
  };

  // Step 1: Dynamic Scale Weight & Final Bill Adjustment
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
        return {
          ...o,
          weightAdjustmentAmount,
          weightAdjustmentNote,
          totalAmount: nextTotal,
          dueAmount: nextDue,
          paymentStatus: nextPaymentStatus,
          updatedAt: new Date().toISOString(),
        };
      })
    );
    showToast(
      `Scale weight adjustment (${
        weightAdjustmentAmount >= 0 ? "+" : ""
      }৳${weightAdjustmentAmount}) applied to order!`
    );
  };

  // Step 4: Cold-Chain Logistics & Rider Assignment
  const assignOrderLogistics = (
    orderId: string,
    courierName: string,
    trackingReference: string,
    riderName: string,
    riderPhone: string
  ) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
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
            }
          : o
      )
    );
    showToast(`Assigned to "${courierName}" & updated tracking info!`);
  };

  const addProduct = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
    showToast(`Product "${newProduct.title}" published to store!`);
  };

  const updateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    showToast(`Product "${updatedProduct.title}" updated!`);
  };

  const deleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    showToast("Product removed from catalog.");
  };

  const addCoupon = (coupon: Coupon) => {
    setCoupons((prev) => [
      coupon,
      ...prev.filter((c) => c.code.toUpperCase() !== coupon.code.toUpperCase()),
    ]);
    showToast(`Promo code "${coupon.code.toUpperCase()}" created!`);
  };

  const toggleCouponStatus = (couponId: string) => {
    setCoupons((prev) =>
      prev.map((c) => (c.id === couponId ? { ...c, isActive: !c.isActive } : c))
    );
    showToast("Coupon status updated.");
  };

  const deleteCoupon = (couponId: string) => {
    setCoupons((prev) => prev.filter((c) => c.id !== couponId));
    showToast("Promo code deleted.");
  };

  const addProductReview = (review: ProductReview) => {
    setReviews((prev) => [review, ...prev]);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === review.productId
          ? { ...p, reviewCount: p.reviewCount + 1 }
          : p
      )
    );
    showToast("JazakAllah! Your verified review has been published!");
  };

  const updateSiteSettings = async (nextSettings: SiteSettings) => {
    setSettings(nextSettings);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
    } catch {
      // Local state still updated
    }
    showToast("Delivery charges & site settings saved!");
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
