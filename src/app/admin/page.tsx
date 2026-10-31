"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  Settings,
  ClipboardList,
  Plus,
  Trash2,
  Printer,
  CheckCircle2,
  Flame,
  Truck,
  ExternalLink,
  Search,
  Lock,
  ShieldCheck,
  TrendingUp,
  Edit3,
  X,
  Leaf,
  Scale,
  Tag,
  Download,
  Copy,
  Check,
  MessageSquare,
  Phone,
  Mail,
  AlertCircle,
  Loader2,
  LogOut,
  RefreshCw,
  Layers,
  Sparkles,
} from "lucide-react";
import { rememberRecentOrderInSession, useStore } from "@/context/StoreContext";
import { checkRateLimit } from "@/lib/security";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAuthenticatedAdminDataFromSupabase } from "@/services/supabaseSync";
import HeroCmsManager from "@/components/admin/HeroCmsManager";
import PreorderManager from "@/components/admin/PreorderManager";
import {
  Category,
  ContactMessage,
  Coupon,
  Order,
  OrderStatus,
  Product,
  SiteSettings,
} from "@/types";

const PRESET_PRODUCT_IMAGES = [
  {
    label: "Jamuna Mixed Fish (যমুনা নদীর মাছ)",
    value: "/images/products/jamuna-fish.jpg",
  },
  {
    label: "Jamuna Big Fish (যমুনার বড় মাছ)",
    value: "/images/products/jamuna-big-fish.jpg",
  },
  {
    label: "Gawa Ghee (গাওয়া ঘি)",
    value: "/images/products/gawa-ghee.jpg",
  },
  {
    label: "Bogura Shahi Doi (বগুড়ার শাহী দই)",
    value: "/images/products/bogura-doi.jpg",
  },
  {
    label: "Deshi Chicken (দেশি মুরগি)",
    value: "/images/products/deshi-chicken.jpg",
  },
  {
    label: "Deshi Eggs (দেশি মুরগির ডিম)",
    value: "/images/products/deshi-eggs.jpg",
  },
  {
    label: "Full Fiber Red Rice (লাল চাল)",
    value: "/images/products/red-rice.jpg",
  },
  {
    label: "Pure Honey (খাঁটি প্রাকৃতিক মধু)",
    value: "/images/products/sundarban-honey.jpg",
  },
];

const PRESET_CATEGORY_IMAGES = [
  {
    label: "Jamuna Mixed Fish (যমুনার মাছ)",
    value: "/images/products/jamuna-fish.jpg",
  },
  {
    label: "Jamuna Big Fish (যমুনার বড় মাছ)",
    value: "/images/products/jamuna-big-fish.jpg",
  },
  {
    label: "Pure Gawa Ghee (গাওয়া ঘি)",
    value: "/images/products/gawa-ghee.jpg",
  },
  {
    label: "Bogura Shahi Doi (বগুড়ার শাহী দই)",
    value: "/images/products/bogura-doi.jpg",
  },
  {
    label: "Deshi Meat & Poultry (মাংস ও মুরগি)",
    value: "/images/products/deshi-chicken.jpg",
  },
  {
    label: "Deshi Chicken Eggs (দেশি ডিম)",
    value: "/images/products/deshi-eggs.jpg",
  },
  {
    label: "Full Fiber Red Rice (লাল চাল)",
    value: "/images/products/red-rice.jpg",
  },
  {
    label: "Pure Honey (খাঁটি প্রাকৃতিক মধু)",
    value: "/images/products/sundarban-honey.jpg",
  },
];

const getOrderStatusBadgeClass = (status: OrderStatus) => {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "confirmed":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    case "processing":
      return "bg-indigo-100 text-indigo-800 border border-indigo-200";
    case "shipped":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "delivered":
      return "bg-green-100 text-green-800 border border-green-200";
    case "cancelled":
      return "bg-rose-100 text-rose-800 border border-rose-200";
    default:
      return "bg-stone-100 text-stone-800 border border-stone-200";
  }
};

type AdminTab =
  | "overview"
  | "orders"
  | "procurement"
  | "products"
  | "categories"
  | "hero"
  | "preorders"
  | "coupons"
  | "payments"
  | "messages"
  | "settings";

export default function AdminDashboardPage() {
  const {
    products,
    categories,
    coupons,
    orders,
    transactions,
    paymentAttempts,
    settings,
    procurementSummary,
    messages,
    unreadMessageCount,
    updateMessageStatus,
    deleteContactMessage,
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
    updateSiteSettings,
    supabaseStatus,
    syncDatabaseWithSupabase,
    refreshLiveStore,
    showToast,
    hydrateAdminRecords,
    heroSlides,
    refreshHero,
    preorderSettings,
  } = useStore();

  // Supabase Auth + public.admins Allow-List Gate
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [refreshingAdminData, setRefreshingAdminData] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [resolveTrxInput, setResolveTrxInput] = useState<Record<string, string>>({});

  const loadAdminRecords = useCallback(async () => {
    setRefreshingAdminData(true);
    try {
      const [adminData] = await Promise.all([
        fetchAuthenticatedAdminDataFromSupabase(),
        refreshLiveStore(),
        refreshHero(),
      ]);
      if (adminData.authorized) {
        hydrateAdminRecords(
          adminData.orders,
          adminData.messages,
          adminData.transactions,
          adminData.paymentAttempts,
          adminData.coupons
        );
        return true;
      }
      return false;
    } finally {
      setRefreshingAdminData(false);
    }
  }, [hydrateAdminRecords, refreshLiveStore, refreshHero]);

  useEffect(() => {
    let active = true;

    // Safety timeout: Never leave user stuck on verifying session screen for > 5 seconds
    const timeoutTimer = setTimeout(() => {
      if (active) {
        setCheckingSession(false);
      }
    }, 5000);

    const checkSession = async () => {
      try {
        // Purge any legacy client-side passkey session keys
        sessionStorage.removeItem("sb_admin_session_token");
        sessionStorage.removeItem("sb_admin_hash");
        sessionStorage.removeItem("sb_admin_auth_v2");

        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          if (active) setCheckingSession(false);
          return;
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          if (active) setCheckingSession(false);
          return;
        }

        // If local session exists, unlock immediately so the dashboard renders instantly
        if (active) {
          setIsUnlocked(true);
          setLoggedInEmail(session.user.email || "Authorized Admin");
          setCheckingSession(false);
        }

        // Verify public.admins membership and load fresh records in background
        const ok = await loadAdminRecords();
        if (active && !ok) {
          await supabase.auth.signOut();
          setIsUnlocked(false);
          setPinError(
            "Your account is not listed in public.admins. Please add your User ID to public.admins in Supabase."
          );
        }
      } catch (err) {
        console.error("Admin session verification error:", err);
        if (active) setCheckingSession(false);
      } finally {
        clearTimeout(timeoutTimer);
        if (active) setCheckingSession(false);
      }
    };

    void checkSession();

    return () => {
      active = false;
      clearTimeout(timeoutTimer);
    };
  }, [loadAdminRecords]);

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] =
    useState<Order | null>(null);

  // Messages Inbox State
  const [messageSearch, setMessageSearch] = useState("");
  const [messageStatusFilter, setMessageStatusFilter] = useState<string>("all");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState("");

  // Scale Weight Adjustment Modal State (Step 1)
  const [scaleOrder, setScaleOrder] = useState<Order | null>(null);
  const [scaleDeltaAmount, setScaleDeltaAmount] = useState<number>(0);
  const [scaleNote, setScaleNote] = useState<string>("");

  // Cold-Chain Courier & Rider Assignment Modal State (Step 4)
  const [logisticsOrder, setLogisticsOrder] = useState<Order | null>(null);
  const [courierName, setCourierName] = useState(
    "Sadhyer Bazar Chilled Rider (Dhaka Express)"
  );
  const [trackingRef, setTrackingRef] = useState("");
  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("01713477780");

  // Coupon Creation Form State (Step 3)
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponTitle, setNewCouponTitle] = useState("");
  const [newCouponType, setNewCouponType] = useState<"flat" | "percentage">(
    "flat"
  );
  const [newCouponValue, setNewCouponValue] = useState(100);
  const [newCouponMinOrder, setNewCouponMinOrder] = useState(1000);

  // Product Modal State (Create / Edit)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodTitle, setProdTitle] = useState("");
  const [prodTitleBn, setProdTitleBn] = useState("");
  const [prodCategorySlug, setProdCategorySlug] =
    useState("jamuna-river-fish");
  const [prodImage, setProdImage] = useState("/images/products/jamuna-fish.jpg");
  const [prodImageMode, setProdImageMode] = useState<"preset" | "custom">(
    "preset"
  );
  const [prodImageError, setProdImageError] = useState(false);
  const [prodShortDesc, setProdShortDesc] = useState("");
  const [prodOrigin, setProdOrigin] = useState("Sirajganj / Jamuna Basin");
  const [prodIsPreorder, setProdIsPreorder] = useState(true);
  const [prodDeliveryDate, setProdDeliveryDate] = useState(
    "Friday Morning Batch"
  );
  const [prodTargetQty, setProdTargetQty] = useState(50);
  const [var1Label, setVar1Label] = useState("500g Pack");
  const [var1Price, setVar1Price] = useState(550);
  const [var2Label, setVar2Label] = useState("1kg Pack");
  const [var2Price, setVar2Price] = useState(1050);

  // Category Modal State (Create / Edit)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catNameBn, setCatNameBn] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catImageUrl, setCatImageUrl] = useState(
    "/images/products/jamuna-fish.jpg"
  );
  const [catImageMode, setCatImageMode] = useState<"preset" | "custom">(
    "preset"
  );
  const [catImageError, setCatImageError] = useState(false);
  const [catBadgeText, setCatBadgeText] = useState("");
  const [catSortOrder, setCatSortOrder] = useState<number>(1);
  const [catIsActive, setCatIsActive] = useState<boolean>(true);

  // Settings Form State (Synced live with Supabase settings)
  const [settingsForm, setSettingsForm] = useState<SiteSettings>(settings);
  const [copiedTrxId, setCopiedTrxId] = useState<string | null>(null);

  const handleCopyTrx = (trxId: string) => {
    try {
      navigator.clipboard.writeText(trxId);
      setCopiedTrxId(trxId);
      setTimeout(() => setCopiedTrxId(null), 2000);
    } catch {}
  };

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  // Executive KPIs
  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.orderStatus !== "cancelled");
    const totalRevenue = validOrders.reduce((s, o) => s + o.totalAmount, 0);
    const totalCollected = validOrders.reduce((s, o) => s + o.advancePaid, 0);
    const totalDueCod = validOrders.reduce((s, o) => s + o.dueAmount, 0);
    const pendingCount = orders.filter(
      (o) => o.orderStatus === "pending"
    ).length;
    const preorderOrdersCount = validOrders.filter(
      (o) => o.hasPreorderItems
    ).length;

    return {
      totalOrders: orders.length,
      totalRevenue,
      totalCollected,
      totalDueCod,
      pendingCount,
      preorderOrdersCount,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (orderStatusFilter === "suspicious") {
        const isUnverifiedCod = ord.paymentMethod === "cod" && !ord.isPhoneVerified;
        if (!ord.isSuspicious && !isUnverifiedCod) return false;
      } else if (
        orderStatusFilter !== "all" &&
        ord.orderStatus !== orderStatusFilter
      ) {
        return false;
      }
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        return (
          ord.orderCode.toLowerCase().includes(q) ||
          ord.customerName.toLowerCase().includes(q) ||
          ord.customerPhone.toLowerCase().includes(q) ||
          ord.customerDistrict.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (messageStatusFilter !== "all" && m.status !== messageStatusFilter) {
        return false;
      }
      if (messageSearch.trim()) {
        const q = messageSearch.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.phone.toLowerCase().includes(q) ||
          (m.email && m.email.toLowerCase().includes(q)) ||
          m.subject.toLowerCase().includes(q) ||
          m.message.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [messages, messageStatusFilter, messageSearch]);

  // Step 6: 1-Click CSV Export Helper (Courier Bulk Upload & Accounting)
  const downloadCsv = (filename: string, rows: string[][]) => {
    const csvContent = rows
      .map((r) =>
        r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportOrdersCsv = () => {
    const headers = [
      "Order ID",
      "Recipient Name",
      "Phone",
      "Zone",
      "District",
      "Full Address",
      "Items",
      "Total Bill (BDT)",
      "Advance Paid (BDT)",
      "COD Collectible (BDT)",
      "Payment Status",
      "Order Status",
      "Courier",
      "Tracking Ref",
    ];
    const rows = filteredOrders.map((o) => [
      o.orderCode,
      o.customerName,
      o.customerPhone,
      o.deliveryZone,
      o.customerDistrict,
      o.customerAddress,
      o.items
        .map((i) => `${i.productTitleBn} (${i.variantLabel}) x${i.quantity}`)
        .join(" | "),
      String(o.totalAmount),
      String(o.advancePaid),
      String(o.dueAmount),
      o.paymentStatus,
      o.orderStatus,
      o.courierName || "",
      o.trackingReference || "",
    ]);
    downloadCsv(`sadhyer-bazar-orders-${new Date().toISOString().slice(0, 10)}.csv`, [
      headers,
      ...rows,
    ]);
  };

  const handleExportProcurementCsv = () => {
    const headers = [
      "Product (Bangla)",
      "Product (English)",
      "Pack / Variant",
      "Preparation / Cut",
      "Total Units Needed",
      "Customer Orders Count",
    ];
    const rows = procurementSummary.map((item) => [
      item.productTitleBn,
      item.productTitle,
      item.variantLabel,
      item.cuttingPreference || "Standard",
      String(item.totalQuantity),
      String(item.orderCount),
    ]);
    downloadCsv(
      `sadhyer-bazar-procurement-${new Date().toISOString().slice(0, 10)}.csv`,
      [headers, ...rows]
    );
  };

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProdTitle("");
    setProdTitleBn("");
    setProdCategorySlug(categories[0]?.slug || "jamuna-river-fish");
    setProdImage(PRESET_PRODUCT_IMAGES[0].value);
    setProdImageMode("preset");
    setProdImageError(false);
    setProdShortDesc("");
    setProdOrigin("Sirajganj / Jamuna River Basin");
    setProdIsPreorder(true);
    setProdDeliveryDate("Friday Morning Batch");
    setProdTargetQty(50);
    setVar1Label("500g Jar / Pack");
    setVar1Price(550);
    setVar2Label("1kg Family Pack");
    setVar2Price(1050);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProdTitle(product.title);
    setProdTitleBn(product.titleBn);
    setProdCategorySlug(product.categorySlug);
    setProdImage(product.primaryImage);
    const isPreset = PRESET_PRODUCT_IMAGES.some(
      (p) => p.value === product.primaryImage
    );
    setProdImageMode(isPreset ? "preset" : "custom");
    setProdImageError(false);
    setProdShortDesc(product.shortDescription);
    setProdOrigin(product.originSource);
    setProdIsPreorder(product.isPreorder);
    setProdDeliveryDate(product.expectedDeliveryDate || "Friday Morning Batch");
    setProdTargetQty(product.batchTargetQty);
    setVar1Label(product.variants[0]?.label || "500g Pack");
    setVar1Price(product.variants[0]?.price || 500);
    setVar2Label(product.variants[1]?.label || "1kg Pack");
    setVar2Price(product.variants[1]?.price || 950);
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = (prod: Product) => {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        `Are you sure you want to delete "${prod.title}" (${prod.titleBn}) from the catalog?\n\nThis will remove it from the active storefront.`
      )
    ) {
      deleteProduct(prod.id);
    }
  };

  // Category Actions
  const openCreateCategoryModal = () => {
    setEditingCategory(null);
    setCatName("");
    setCatNameBn("");
    setCatSlug("");
    setCatDescription("");
    setCatImageUrl(PRESET_CATEGORY_IMAGES[0].value);
    setCatImageMode("preset");
    setCatImageError(false);
    setCatBadgeText("");
    setCatSortOrder(categories.length + 1);
    setCatIsActive(true);
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatNameBn(cat.nameBn);
    setCatSlug(cat.slug);
    setCatDescription(cat.description || "");
    setCatImageUrl(cat.imageUrl || PRESET_CATEGORY_IMAGES[0].value);
    const isPreset = PRESET_CATEGORY_IMAGES.some(
      (p) => p.value === cat.imageUrl
    );
    setCatImageMode(isPreset ? "preset" : "custom");
    setCatImageError(false);
    setCatBadgeText(cat.badgeText || "");
    setCatSortOrder(cat.sortOrder ?? 1);
    setCatIsActive(cat.isActive !== false);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catNameBn.trim()) {
      showToast("Please provide both English and Bengali category names.");
      return;
    }

    const autoSlug = (catSlug || catName)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const categoryObj: Category = {
      id: editingCategory ? editingCategory.id : `cat-${Date.now()}`,
      name: catName.trim(),
      nameBn: catNameBn.trim(),
      slug: autoSlug || `cat-${Date.now().toString().slice(-4)}`,
      description:
        catDescription.trim() ||
        `${catName.trim()} (${catNameBn.trim()}) available at Sadhyer Bazar.`,
      imageUrl: catImageUrl.trim() || PRESET_CATEGORY_IMAGES[0].value,
      badgeText: catBadgeText.trim() || undefined,
      sortOrder: Number(catSortOrder) || 1,
      isActive: catIsActive,
    };

    if (editingCategory) {
      await updateCategory(categoryObj);
    } else {
      await addCategory(categoryObj);
    }
    setIsCategoryModalOpen(false);
  };

  const handleDeleteCategory = async (cat: Category) => {
    const assignedCount = products.filter(
      (p) => p.categoryId === cat.id || p.categorySlug === cat.slug
    ).length;

    if (assignedCount > 0) {
      alert(
        `Cannot delete "${cat.name}".\n\nThere are ${assignedCount} products currently assigned to this category.\n\nPlease reassign or delete those products before removing this category.`
      );
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.confirm(
        `Are you sure you want to delete category "${cat.name}" (${cat.nameBn})?\n\nThis will remove it from the catalog and store navigation.`
      )
    ) {
      await deleteCategory(cat.id);
    }
  };

  const handleDeleteCoupon = (coup: Coupon) => {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        `Are you sure you want to delete promo code "${coup.code}"?\n\nCustomers will no longer be able to use this discount.`
      )
    ) {
      deleteCoupon(coup.id);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const cat =
      categories.find((c) => c.slug === prodCategorySlug) ||
      categories[0] || {
        id: "cat-general",
        name: "General",
        slug: prodCategorySlug || "general",
      };
    const slug = prodTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const newProductObj: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      categoryId: cat.id,
      categoryName: cat.name,
      categorySlug: cat.slug,
      title: prodTitle,
      titleBn: prodTitleBn,
      slug: editingProduct
        ? editingProduct.slug
        : `${slug}-${Date.now().toString().slice(-3)}`,
      shortDescription:
        prodShortDesc ||
        `100% pure & chemical-free ${prodTitle} (${prodTitleBn}) from Sadhyer Bazar.`,
      description:
        prodShortDesc ||
        `Authentic ${prodTitle} (${prodTitleBn}) sourced directly from rural producers and dispatched fresh across Bangladesh.`,
      originSource: prodOrigin,
      primaryImage: prodImage,
      galleryImages: [prodImage],
      isPreorder: prodIsPreorder,
      expectedDeliveryDate: prodDeliveryDate,
      batchTargetQty: Number(prodTargetQty) || 50,
      batchBookedQty: editingProduct ? editingProduct.batchBookedQty : 12,
      unitType: "kg",
      cuttingOptions:
        prodCategorySlug === "jamuna-river-fish" ||
        prodCategorySlug === "deshi-meat-poultry"
          ? ["Standard Bengali Curry Cut", "Whole Uncut (Fresh on Ice)"]
          : [],
      nutritionHighlights: [
        "100% Chemical & Formalin Free",
        "Direct Source Harvest",
        "Insulated Nationwide Home Delivery",
      ],
      seoTitle: `${prodTitle} (${prodTitleBn}) | Sadhyer Bazar`,
      seoDescription: prodShortDesc,
      searchKeywords: [
        prodTitle.toLowerCase(),
        prodTitleBn,
        cat.name.toLowerCase(),
      ],
      isFeatured: true,
      isActive: true,
      rating: 4.95,
      reviewCount: editingProduct ? editingProduct.reviewCount : 18,
      variants: [
        {
          id: editingProduct?.variants[0]?.id || `var-${Date.now()}-1`,
          productId: editingProduct ? editingProduct.id : "new",
          label: var1Label,
          weightGrams: 500,
          price: Number(var1Price),
          compareAtPrice: Math.round(Number(var1Price) * 1.12),
          stockQty: 40,
          isDefault: true,
        },
        ...(var2Label && Number(var2Price) > 0
          ? [
              {
                id: editingProduct?.variants[1]?.id || `var-${Date.now()}-2`,
                productId: editingProduct ? editingProduct.id : "new",
                label: var2Label,
                weightGrams: 1000,
                price: Number(var2Price),
                compareAtPrice: Math.round(Number(var2Price) * 1.12),
                stockQty: 30,
                isDefault: false,
              },
            ]
          : []),
      ],
      createdAt: editingProduct
        ? editingProduct.createdAt
        : new Date().toISOString(),
    };

    if (editingProduct) {
      updateProduct(newProductObj);
    } else {
      addProduct(newProductObj);
    }
    setIsProductModalOpen(false);
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    const coup: Coupon = {
      id: `coup-${Date.now()}`,
      code: newCouponCode.trim().toUpperCase(),
      title:
        newCouponTitle ||
        `${
          newCouponType === "flat"
            ? `৳${newCouponValue}`
            : `${newCouponValue}%`
        } Discount (Min ৳${newCouponMinOrder})`,
      discountType: newCouponType,
      discountValue: Number(newCouponValue),
      minOrderAmount: Number(newCouponMinOrder),
      isActive: true,
      usageCount: 0,
    };
    addCoupon(coup);
    setNewCouponCode("");
    setNewCouponTitle("");
  };

  const handleSaveDeliverySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSiteSettings(settingsForm);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0F3D2E] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#0F3D2E] mx-auto" />
          <p className="text-sm font-bold text-stone-700">
            Verifying Supabase Admin Session...
          </p>
          <button
            type="button"
            onClick={() => setCheckingSession(false)}
            className="text-xs text-stone-400 hover:text-stone-700 hover:underline cursor-pointer pt-2"
          >
            Taking too long? Open Login Form →
          </button>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#0F3D2E] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#0F3D2E] flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold text-stone-900">
              Sadhyer Bazar Admin Security Gate
            </h1>
            <p className="text-xs text-stone-500">
              Supabase Auth + <code className="font-mono">public.admins</code>{" "}
              Allow-List Verification
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPinError(null);

              const rl = checkRateLimit("admin_login_gate", 5, 60_000);
              if (!rl.allowed) {
                setPinError("Rate limit reached. Please wait 60 seconds.");
                return;
              }

              const supabase = getSupabaseBrowserClient();
              if (!supabase) {
                setPinError(
                  "Supabase client is not configured. Check NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY."
                );
                return;
              }

              setLoginLoading(true);
              try {
                const { data, error } = await supabase.auth.signInWithPassword({
                  email: adminEmail.trim(),
                  password: adminPassword,
                });

                if (error || !data.session) {
                  setPinError(
                    error?.message || "Invalid admin email or password."
                  );
                  return;
                }

                const isAllowedAdmin = await loadAdminRecords();
                if (!isAllowedAdmin) {
                  await supabase.auth.signOut();
                  setPinError(
                    `Authenticated as ${data.user?.email}, but user ID (${data.user?.id}) is not in public.admins. Run: INSERT INTO public.admins (user_id, email) VALUES ('${data.user?.id}', '${data.user?.email}');`
                  );
                  return;
                }

                setLoggedInEmail(data.user?.email || adminEmail.trim());
                setIsUnlocked(true);
                setAdminPassword("");
                showToast("Welcome back! Admin session verified via Supabase Auth.");
              } catch (err) {
                setPinError(
                  err instanceof Error
                    ? err.message
                    : "Failed to authenticate with Supabase."
                );
              } finally {
                setLoginLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Admin Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@sadyerbazar.com"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-[#0F3D2E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-[#0F3D2E]"
                />
              </div>
            </div>

            {pinError && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold break-words">
                {pinError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 rounded-2xl bg-[#0F3D2E] hover:bg-[#15533f] disabled:opacity-60 text-white font-bold text-sm transition cursor-pointer flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Admin Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sign In to Merchant Portal</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F4] flex flex-col lg:flex-row">
      {/* Left Admin Sidebar */}
      <aside className="w-full lg:w-68 bg-[#0F3D2E] text-white shrink-0 flex flex-col justify-between no-print">
        <div className="p-6 space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex flex-col items-center justify-center">
                <Leaf className="w-3 h-3 text-emerald-600 -mb-0.5" />
                <span className="text-[9px] font-extrabold text-[#0F3D2E] leading-none">
                  সাধ্যের
                </span>
                <span className="text-[8px] font-bold text-[#C83E2B] leading-tight">
                  বাজার
                </span>
              </div>
              <div>
                <span className="text-base font-extrabold text-white block leading-none">
                  Sadhyer Bazar
                </span>
                <span className="text-[11px] text-emerald-300 font-medium truncate max-w-[140px] block">
                  {loggedInEmail || "Admin Session"}
                </span>
              </div>
            </Link>
            <button
              onClick={async () => {
                const supabase = getSupabaseBrowserClient();
                await supabase?.auth.signOut();
                setIsUnlocked(false);
                setLoggedInEmail(null);
                setAdminPassword("");
              }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 text-xs cursor-pointer"
              title="Sign Out of Admin Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
            {[
              {
                id: "overview",
                label: "Dashboard Overview",
                icon: LayoutDashboard,
              },
              {
                id: "orders",
                label: `Orders & Scale (${orders.length})`,
                icon: ShoppingCart,
              },
              {
                id: "procurement",
                label: "Batch Buying List",
                icon: ClipboardList,
              },
              {
                id: "products",
                label: `Products (${products.length})`,
                icon: Package,
              },
              {
                id: "categories",
                label: `Categories (${categories.length})`,
                icon: Layers,
              },
              {
                id: "hero",
                label: `Hero & Slider (${heroSlides.length})`,
                icon: Sparkles,
              },
              {
                id: "preorders",
                label: "Pre-Order Batches",
                icon: Flame,
                badge: preorderSettings.isBatchActive ? "LIVE" : null,
              },
              {
                id: "coupons",
                label: `Promo Codes (${coupons.length})`,
                icon: Tag,
              },
              {
                id: "payments",
                label: "bKash & Nagad Ledger",
                icon: CreditCard,
                badge:
                  paymentAttempts.filter((a) => a.status === "needs_review")
                    .length || null,
              },
              {
                id: "messages",
                label: `Messages & Helpdesk (${messages.length})`,
                icon: MessageSquare,
                badge: unreadMessageCount > 0 ? unreadMessageCount : null,
              },
              {
                id: "settings",
                label: "Delivery Fees & Config",
                icon: Settings,
              },
            ].map((item) => {
              const IconComp = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as AdminTab);
                    if (item.id === "settings") setSettingsForm(settings);
                  }}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer text-left ${
                    active
                      ? "bg-amber-400 text-stone-950 shadow-md"
                      : "text-emerald-100/85 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <IconComp className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Storefront Link & Live Delivery Fee Badge */}
        <div className="p-6 border-t border-emerald-800/80 space-y-3 hidden lg:block">
          <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-xs space-y-1">
            <span className="text-emerald-300 font-semibold block">
              Active Delivery Rates:
            </span>
            <p className="text-white font-bold">
              Inside Dhaka: ৳{settings.insideDhakaFee}
            </p>
            <p className="text-white font-bold">
              Outside Dhaka: ৳{settings.outsideDhakaFee}
            </p>
          </div>
          <Link
            href="/"
            className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <span>View Live Storefront</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-8 no-print">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-stone-200/80 shadow-2xs">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F3D2E] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Supabase Project:
                sadhyarbazar (uqyjtlndgnvfqjcdwbop)
              </span>
              {supabaseStatus === "connected_live" && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-extrabold">
                  ● LIVE DATABASE SYNCED
                </span>
              )}
              {supabaseStatus === "schema_missing" && (
                <a
                  href="https://supabase.com/dashboard/project/uqyjtlndgnvfqjcdwbop/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[11px] font-extrabold underline"
                >
                  ⚠ Run supabase/migrations in SQL Editor →
                </a>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 mt-0.5">
              {activeTab === "overview" && "Executive Business Overview"}
              {activeTab === "orders" &&
                "Orders, Digital Scale Weight Adjuster & Courier Dispatch"}
              {activeTab === "procurement" &&
                "Automated Pre-Order Batch Buying / Procurement List"}
              {activeTab === "products" &&
                "Product, Variant & Pre-Order Batch Manager"}
              {activeTab === "categories" &&
                "Store Category & Department Manager"}
              {activeTab === "hero" &&
                "Hero Banners, Carousel Slider & Homepage Highlights CMS"}
              {activeTab === "preorders" &&
                "Live Pre-Order Batch Booking & Catch Schedule CMS"}
              {activeTab === "coupons" &&
                "Promo Code & Campaign Discount Manager"}
              {activeTab === "payments" &&
                "Payment Ledger & Gateway Attempts (bKash, Nagad & COD)"}
              {activeTab === "messages" &&
                "Customer Inquiries & Helpdesk Messages"}
              {activeTab === "settings" &&
                "Inside / Outside Dhaka Delivery Charges & Site Settings"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => void loadAdminRecords()}
              disabled={refreshingAdminData}
              className="px-3.5 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
              title="Refresh Orders, Payment Attempts, Catalog & Settings from Supabase"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  refreshingAdminData ? "animate-spin" : ""
                }`}
              />
              <span>Refresh Live</span>
            </button>
            <button
              onClick={syncDatabaseWithSupabase}
              className="px-3.5 py-2.5 rounded-2xl bg-[#0F3D2E] hover:bg-[#165b44] text-amber-300 text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
              title="Push Catalog, Coupons & Safe Settings to Supabase"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Sync Catalog</span>
            </button>
            <button
              onClick={handleExportOrdersCsv}
              className="px-3.5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#0F3D2E] border border-emerald-200 text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
              title="Export Orders for Steadfast/Pathao/Excel"
            >
              <Download className="w-4 h-4" />
              <span>Export Orders CSV</span>
            </button>
            <button
              onClick={openCreateProductModal}
              className="px-4 py-2.5 rounded-2xl bg-[#C83E2B] hover:bg-[#b03221] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </button>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white p-6 rounded-3xl border border-stone-200/90 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                  <span>TOTAL ORDER VALUE</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-3xl font-black text-stone-900">
                  ৳{metrics.totalRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-emerald-700 font-semibold">
                  Across {metrics.totalOrders} total orders
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-stone-200/90 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                  <span>COLLECTED ONLINE (BKASH/SSL)</span>
                  <CreditCard className="w-4 h-4 text-pink-600" />
                </div>
                <p className="text-3xl font-black text-[#0F3D2E]">
                  ৳{metrics.totalCollected.toLocaleString()}
                </p>
                <p className="text-xs text-stone-500">
                  Verified advance & full payments
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-stone-200/90 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                  <span>DUE ON DELIVERY (COD)</span>
                  <Truck className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-3xl font-black text-[#C83E2B]">
                  ৳{metrics.totalDueCod.toLocaleString()}
                </p>
                <p className="text-xs text-stone-500">
                  Collectible by delivery riders
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-stone-200/90 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                  <span>PRE-ORDER BATCH ORDERS</span>
                  <Flame className="w-4 h-4 text-[#C83E2B] fill-current" />
                </div>
                <p className="text-3xl font-black text-stone-900">
                  {metrics.preorderOrdersCount}
                </p>
                <p className="text-xs text-amber-800 font-semibold">
                  {metrics.pendingCount} orders awaiting confirmation
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-white rounded-3xl border border-stone-200/90 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#C83E2B]">
                      Auto-Calculated Sourcing List
                    </span>
                    <h3 className="text-lg font-extrabold text-stone-900">
                      Total Items Needed for Active Orders
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab("procurement")}
                    className="text-xs font-bold text-[#0F3D2E] hover:underline cursor-pointer"
                  >
                    Full List →
                  </button>
                </div>

                <div className="divide-y divide-stone-100">
                  {procurementSummary.slice(0, 5).map((item, idx) => (
                    <div
                      key={idx}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.productImage}
                          alt={item.productTitle}
                          className="w-11 h-11 rounded-xl object-contain bg-stone-950 p-0.5 border border-stone-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0F3D2E] truncate">
                            {item.productTitleBn}
                          </p>
                          <p className="text-xs font-semibold text-stone-800 truncate">
                            {item.variantLabel}
                            {item.cuttingPreference
                              ? ` • ${item.cuttingPreference}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-xl bg-emerald-100 text-[#0F3D2E] text-xs font-black shrink-0">
                        {item.totalQuantity} Units
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7 bg-white rounded-3xl border border-stone-200/90 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0F3D2E]">
                      Live Incoming Orders
                    </span>
                    <h3 className="text-lg font-extrabold text-stone-900">
                      Recent Customer Orders
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab("orders")}
                    className="text-xs font-bold text-[#0F3D2E] hover:underline cursor-pointer"
                  >
                    Manage All Orders →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 uppercase">
                        <th className="py-2.5 pr-3">Order ID</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Total / Due</th>
                        <th className="py-2.5 px-3">Payment</th>
                        <th className="py-2.5 pl-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {orders.slice(0, 5).map((ord) => (
                        <tr key={ord.id} className="hover:bg-stone-50/80">
                          <td className="py-3 pr-3 font-mono font-bold text-stone-900">
                            {ord.orderCode}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-stone-900">
                              {ord.customerName}
                            </p>
                            <p className="text-stone-500">
                              {ord.customerPhone} • {ord.customerDistrict}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-extrabold text-stone-900">
                              ৳{ord.totalAmount.toLocaleString()}
                            </p>
                            <p className="text-[#C83E2B] font-semibold">
                              Due: ৳{ord.dueAmount.toLocaleString()}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                ord.paymentStatus === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : ord.paymentStatus === "advance_paid"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-stone-100 text-stone-700"
                              }`}
                            >
                              {ord.paymentStatus.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3 pl-3">
                            <select
                              value={ord.orderStatus}
                              onChange={(e) =>
                                updateOrderStatus(
                                  ord.id,
                                  e.target.value as OrderStatus
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 font-bold text-stone-800 text-xs"
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="processing">Processing</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ORDERS, SCALE WEIGHT ADJUSTER & COURIER DISPATCH */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "pending", label: "Pending" },
                  { key: "confirmed", label: "Confirmed" },
                  { key: "processing", label: "Processing" },
                  { key: "shipped", label: "Shipped" },
                  { key: "delivered", label: "Delivered" },
                  { key: "suspicious", label: "⚠️ Security & COD Verify" },
                ].map((st) => (
                  <button
                    key={st.key}
                    onClick={() => setOrderStatusFilter(st.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer ${
                      orderStatusFilter === st.key
                        ? st.key === "suspicious"
                          ? "bg-red-700 text-white"
                          : "bg-[#0F3D2E] text-white"
                        : st.key === "suspicious"
                        ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search Order ID, Name, Phone..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                  />
                </div>
                <button
                  onClick={handleExportOrdersCsv}
                  className="px-3.5 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {filteredOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-5 rounded-2xl border border-stone-200/90 hover:border-[#0F3D2E]/40 transition space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-stone-100">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-black font-mono text-stone-900">
                          {ord.orderCode}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${getOrderStatusBadgeClass(
                            ord.orderStatus
                          )}`}
                        >
                          {ord.orderStatus}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            ord.deliveryZone === "inside_dhaka"
                              ? "bg-emerald-100 text-[#0F3D2E]"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {ord.deliveryZone === "inside_dhaka"
                            ? "Inside Dhaka"
                            : "Outside Dhaka"}
                        </span>
                        {ord.hasPreorderItems && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                            Pre-Order Batch
                          </span>
                        )}
                        {ord.couponCode && (
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-mono font-bold">
                            Promo: {ord.couponCode} (-৳{ord.discountAmount})
                          </span>
                        )}
                        {ord.isSuspicious && (
                          <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-extrabold flex items-center gap-1">
                            ⚠️ Suspicious Risk ({ord.fraudRiskScore || 35})
                          </span>
                        )}
                        {ord.paymentMethod === "cod" && (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              ord.isPhoneVerified
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-900 border border-amber-300"
                            }`}
                          >
                            {ord.isPhoneVerified
                              ? "✓ COD Phone Verified"
                              : "📞 COD Unverified"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-stone-800 mt-1">
                        {ord.customerName} •{" "}
                        <span className="font-mono text-[#0F3D2E]">
                          {ord.customerPhone}
                        </span>
                      </p>
                      <p className="text-xs text-stone-500">
                        Address: {ord.customerAddress} ({ord.customerDistrict})
                      </p>
                      {/* COD Phone Verification Actions */}
                      {ord.paymentMethod === "cod" && !ord.isPhoneVerified && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200">
                          <span className="text-[11px] font-bold text-amber-900">
                            COD ডেলিভারি ভেরিফিকেশন:
                          </span>
                          <a
                            href={`https://wa.me/88${ord.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `আসসালামু আলাইকুম ${ord.customerName}, সাধ্যের বাজার (Sadhyer Bazar) থেকে আপনার অর্ডার ${ord.orderCode} কনফার্ম করার জন্য যোগাযোগ করছি।`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" /> WhatsApp
                          </a>
                          <a
                            href={`tel:${ord.customerPhone}`}
                            className="px-2.5 py-1 rounded-lg bg-stone-700 hover:bg-stone-800 text-white text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" /> Call Customer
                          </a>
                          <button
                            onClick={() => verifyCodOrderPhone(ord.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#0F3D2E] hover:bg-[#15533F] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Verify & Confirm
                          </button>
                        </div>
                      )}

                      {/* Suspicious Order Review Reasons */}
                      {ord.isSuspicious && ord.reviewReasons && ord.reviewReasons.length > 0 && (
                        <div className="mt-2 p-2 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-0.5">
                          <span className="font-bold flex items-center gap-1 text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                            সন্দেহজনক অর্ডারের কারণ:
                          </span>
                          <ul className="list-disc list-inside text-[11px] text-red-800 pl-1">
                            {ord.reviewReasons.map((reason, idx) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {ord.courierName && (
                        <p className="text-xs text-blue-700 font-bold mt-1">
                          🚚 Courier: {ord.courierName} (Ref:{" "}
                          {ord.trackingReference || "N/A"}) • Rider:{" "}
                          {ord.riderName || "Assigned"} ({ord.riderPhone})
                        </p>
                      )}
                      {ord.weightAdjustmentAmount !== undefined &&
                        ord.weightAdjustmentAmount !== 0 && (
                          <p className="text-xs text-amber-800 font-bold mt-1">
                            ⚖️ Scale Weight Adj:{" "}
                            {ord.weightAdjustmentAmount > 0 ? "+" : ""}৳
                            {ord.weightAdjustmentAmount} (
                            {ord.weightAdjustmentNote})
                          </p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={ord.orderStatus}
                        onChange={(e) =>
                          updateOrderStatus(
                            ord.id,
                            e.target.value as OrderStatus
                          )
                        }
                        className="px-3 py-2 rounded-xl bg-stone-100 border border-stone-200 text-xs font-bold text-stone-900"
                      >
                        <option value="pending">Status: Pending</option>
                        <option value="confirmed">Status: Confirmed</option>
                        <option value="processing">
                          Status: Processing / Catch
                        </option>
                        <option value="shipped">Status: Shipped</option>
                        <option value="delivered">Status: Delivered</option>
                        <option value="cancelled">Status: Cancelled</option>
                      </select>

                      {/* Scale Weight Adjust Button (Step 1) */}
                      <button
                        onClick={() => {
                          setScaleOrder(ord);
                          setScaleDeltaAmount(ord.weightAdjustmentAmount || 0);
                          setScaleNote(
                            ord.weightAdjustmentNote ||
                              "Actual digital scale fish/meat weight adjustment"
                          );
                        }}
                        className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Adjust Final Fish/Meat Scale Weight & Bill"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>Scale Weight</span>
                      </button>

                      {/* Assign Courier / Rider Button (Step 4) */}
                      <button
                        onClick={() => {
                          setLogisticsOrder(ord);
                          setCourierName(
                            ord.courierName ||
                              (ord.deliveryZone === "inside_dhaka"
                                ? "Sadhyer Bazar Chilled Rider (Dhaka Express)"
                                : "Steadfast Cold-Chain Express")
                          );
                          setTrackingRef(
                            ord.trackingReference ||
                              `SBR-${Math.floor(1000 + Math.random() * 9000)}`
                          );
                          setRiderName(ord.riderName || "Md. Rafiqul Islam");
                          setRiderPhone(ord.riderPhone || "01713477780");
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Assign Cold-Chain Rider or Courier"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Dispatch</span>
                      </button>

                      <a
                        href={`/track-order?code=${encodeURIComponent(ord.orderCode)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          rememberRecentOrderInSession(
                            ord.orderCode,
                            ord.customerPhone.slice(-4)
                          );
                        }}
                        className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        title="Open Customer Tracking Page in New Tab (Pre-authenticated)"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-stone-600" />
                        <span>Track View</span>
                      </a>

                      <button
                        onClick={() => setSelectedInvoiceOrder(ord)}
                        className="px-3 py-2 rounded-xl bg-[#0F3D2E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Label</span>
                      </button>
                    </div>
                  </div>

                  {/* Order Items & Payment Ledger Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    <div className="lg:col-span-7 flex flex-wrap gap-2">
                      {ord.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2.5 bg-stone-50 px-3 py-2 rounded-xl border border-stone-200/80 text-xs"
                        >
                          <img
                            src={item.productImage}
                            alt={item.productTitle}
                            className="w-9 h-9 rounded-lg object-contain bg-stone-950 p-0.5"
                          />
                          <div>
                            <p className="font-bold text-stone-900">
                              {item.productTitleBn} ({item.variantLabel}) ×{" "}
                              {item.quantity}
                            </p>
                            {item.cuttingPreference && (
                              <p className="text-[10px] text-stone-500">
                                {item.cuttingPreference}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="lg:col-span-5 flex flex-wrap items-center justify-end gap-4 text-xs">
                      <div>
                        <span className="text-stone-400 block">Final Bill</span>
                        <strong className="text-sm text-stone-900">
                          ৳{ord.totalAmount.toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-stone-400 block">
                          Paid ({ord.paymentMethod.toUpperCase()})
                        </span>
                        <strong className="text-sm text-emerald-700">
                          ৳{ord.advancePaid.toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-stone-400 block">COD Due</span>
                        <strong className="text-sm text-[#C83E2B]">
                          ৳{ord.dueAmount.toLocaleString()}
                        </strong>
                      </div>
                      {ord.dueAmount > 0 && (
                        <button
                          onClick={() =>
                            updateOrderPaymentStatus(
                              ord.id,
                              "paid",
                              ord.totalAmount
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-[#0F3D2E] font-extrabold text-xs cursor-pointer"
                        >
                          Mark Full Paid
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: AUTOMATED PROCUREMENT / BUYING SUMMARY */}
        {activeTab === "procurement" && (
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#C83E2B]">
                  Zero-Math Sourcing Aggregator (বাজারের মোট তালিকা)
                </span>
                <h2 className="text-xl font-extrabold text-stone-900 mt-0.5">
                  Total Quantity to Collect from Jamuna River, Bogura & Farms
                </h2>
                <p className="text-xs text-stone-500">
                  Calculated automatically across all active (non-delivered /
                  non-cancelled) orders.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportProcurementCsv}
                  className="px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 rounded-2xl bg-[#0F3D2E] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Buying Sheet</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {procurementSummary.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={item.productImage}
                      alt={item.productTitle}
                      className="w-14 h-14 rounded-xl object-contain bg-stone-950 p-0.5 border border-stone-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-[#C83E2B] truncate">
                        {item.productTitleBn}
                      </p>
                      <p className="text-sm font-bold text-stone-900 truncate">
                        {item.variantLabel}
                      </p>
                      {item.cuttingPreference && (
                        <p className="text-[11px] text-stone-600 truncate">
                          Cut: {item.cuttingPreference}
                        </p>
                      )}
                      <p className="text-[11px] text-stone-400">
                        Across {item.orderCount} customer order(s)
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-black text-[#0F3D2E] block">
                      {item.totalQuantity}
                    </span>
                    <span className="text-[11px] font-bold text-stone-500 uppercase">
                      Packs
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PRODUCTS & PRE-ORDER BATCH MANAGEMENT */}
        {activeTab === "products" && (
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-stone-900">
                  Active Store Catalog ({products.length} Products)
                </h2>
                <p className="text-xs text-stone-500">
                  Click &ldquo;Edit&rdquo; on any product to update 500g / 1kg
                  prices, toggle Pre-Order mode, or change batch dates.
                </p>
              </div>
              <button
                onClick={openCreateProductModal}
                className="px-4 py-2.5 rounded-2xl bg-[#0F3D2E] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  className="p-4 rounded-2xl border border-stone-200 flex items-start gap-4 bg-[#FAF8F5]/60"
                >
                  <img
                    src={prod.primaryImage}
                    alt={prod.title}
                    className="w-24 h-24 rounded-2xl object-contain bg-stone-950 p-1 border border-stone-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#C83E2B]">
                        {prod.titleBn}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          prod.isPreorder
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-[#0F3D2E]"
                        }`}
                      >
                        {prod.isPreorder ? "Pre-Order Batch" : "Ready Stock"}
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-stone-900 truncate">
                      {prod.title}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {prod.variants.map((v) => (
                        <span
                          key={v.id}
                          className="px-2.5 py-0.5 rounded-lg bg-white border border-stone-200 text-xs font-bold text-stone-800"
                        >
                          {v.label}: ৳{v.price}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => openEditProductModal(prod)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-[#0F3D2E] text-xs font-bold text-stone-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Price / Batch
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod)}
                        className="p-1.5 rounded-xl text-stone-400 hover:text-red-600 cursor-pointer"
                        title="Delete product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: STORE CATEGORY & DEPARTMENT MANAGER */}
        {activeTab === "categories" && (
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-stone-900">
                  Store Categories & Departments ({categories.length})
                </h2>
                <p className="text-xs text-stone-500">
                  Manage store product groupings, bilingual titles, banners, display badges, and ordering.
                </p>
              </div>
              <button
                onClick={openCreateCategoryModal}
                className="px-4 py-2.5 rounded-2xl bg-[#0F3D2E] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs hover:bg-[#165640] transition"
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categories.map((cat) => {
                const assignedProducts = products.filter(
                  (p) => p.categoryId === cat.id || p.categorySlug === cat.slug
                );
                return (
                  <div
                    key={cat.id}
                    className="p-5 rounded-2xl border border-stone-200/90 bg-[#FAF8F5]/80 hover:bg-[#FAF8F5] transition flex flex-col justify-between space-y-4 shadow-2xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3.5">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-950 p-0.5 border border-stone-200 shrink-0">
                          <img
                            src={cat.imageUrl}
                            alt={cat.name}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "/images/products/jamuna-fish.jpg";
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-black text-[#C83E2B] truncate">
                              {cat.nameBn}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                cat.isActive
                                  ? "bg-emerald-100 text-[#0F3D2E] border border-emerald-200"
                                  : "bg-stone-200 text-stone-600 border border-stone-300"
                              }`}
                            >
                              {cat.isActive ? "Active" : "Hidden"}
                            </span>
                          </div>
                          <h3 className="text-sm font-extrabold text-stone-900 truncate mt-0.5">
                            {cat.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-mono border border-stone-200 truncate max-w-[140px]">
                              {cat.slug}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold">
                              Order #{cat.sortOrder ?? 1}
                            </span>
                          </div>
                        </div>
                      </div>

                      {cat.description && (
                        <p className="text-xs text-stone-600 line-clamp-2">
                          {cat.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-200/60 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-stone-500" />
                          <span className="font-bold text-stone-700">
                            {assignedProducts.length} Product{assignedProducts.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {cat.badgeText && (
                          <span className="px-2 py-0.5 rounded-full bg-[#0F3D2E]/10 text-[#0F3D2E] text-[10px] font-extrabold border border-[#0F3D2E]/20">
                            ★ {cat.badgeText}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200">
                      <button
                        onClick={() => openEditCategoryModal(cat)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-white border border-stone-200 hover:border-[#0F3D2E] hover:text-[#0F3D2E] text-xs font-bold text-stone-800 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Category
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        disabled={assignedProducts.length > 0}
                        className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                          assignedProducts.length > 0
                            ? "bg-stone-100 text-stone-300 cursor-not-allowed"
                            : "bg-stone-100 hover:bg-rose-50 text-stone-400 hover:text-rose-600 cursor-pointer"
                        }`}
                        title={
                          assignedProducts.length > 0
                            ? `Cannot delete while ${assignedProducts.length} products belong to this category`
                            : "Delete category"
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: HERO CAROUSEL, BANNERS & HOMEPAGE CMS */}
        {activeTab === "hero" && <HeroCmsManager />}

        {/* TAB: PRE-ORDER BATCH BOOKING & SCHEDULE CMS */}
        {activeTab === "preorders" && <PreorderManager />}

        {/* TAB 5: PROMO CODES & COUPON MANAGER (Step 3 Upgrade) */}
        {activeTab === "coupons" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 5 Cols: Create New Promo Code */}
            <form
              onSubmit={handleCreateCoupon}
              className="lg:col-span-5 bg-white rounded-3xl border border-stone-200/90 p-6 space-y-4"
            >
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#C83E2B]">
                  Campaign Marketing Engine
                </span>
                <h2 className="text-lg font-extrabold text-stone-900">
                  Create New Promo / Discount Code
                </h2>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Promo Code (Uppercase) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCouponCode}
                    onChange={(e) =>
                      setNewCouponCode(e.target.value.toUpperCase())
                    }
                    placeholder="e.g., EIDSPECIAL or JAMUNA150"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-mono uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Discount Type
                    </label>
                    <select
                      value={newCouponType}
                      onChange={(e) =>
                        setNewCouponType(
                          e.target.value as "flat" | "percentage"
                        )
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-bold"
                    >
                      <option value="flat">Flat Amount (৳ BDT)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Discount Value ({newCouponType === "flat" ? "৳" : "%"})
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={newCouponValue}
                      onChange={(e) =>
                        setNewCouponValue(Number(e.target.value))
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Minimum Order Subtotal (৳ BDT)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newCouponMinOrder}
                    onChange={(e) =>
                      setNewCouponMinOrder(Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Campaign Title / Description
                  </label>
                  <input
                    type="text"
                    value={newCouponTitle}
                    onChange={(e) => setNewCouponTitle(e.target.value)}
                    placeholder="e.g., Friday Pre-Order Special Discount"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#0F3D2E] hover:bg-[#165b44] text-white font-extrabold cursor-pointer"
                >
                  Publish Promo Code
                </button>
              </div>
            </form>

            {/* Right 7 Cols: Active Promo Codes List */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-stone-200/90 p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-stone-900">
                Active & Scheduled Promo Codes ({coupons.length})
              </h2>
              <div className="space-y-3">
                {coupons.map((coup) => (
                  <div
                    key={coup.id}
                    className="p-4 rounded-2xl border border-stone-200 flex items-center justify-between gap-4 bg-[#FAF8F5]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-[#0F3D2E] text-amber-300 font-mono text-xs font-black">
                          {coup.code}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            coup.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          {coup.isActive ? "ACTIVE" : "PAUSED"}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-stone-900 mt-1.5">
                        {coup.title}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        Min Order: ৳{coup.minOrderAmount} • Used{" "}
                        {coup.usageCount} times
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleCouponStatus(coup.id)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-700 cursor-pointer"
                      >
                        {coup.isActive ? "Pause" : "Enable"}
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(coup)}
                        className="p-1.5 text-stone-400 hover:text-red-600 cursor-pointer"
                        title="Delete promo code"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PAYMENTS & BKASH / NAGAD LEDGER + GATEWAY ATTEMPTS QUEUE */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            {/* Gateway Payment Attempts & Needs Review Triage */}
            <div className="bg-white rounded-3xl border border-stone-200/90 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#C83E2B]">
                    Server-to-Server Gateway Audit Log
                  </span>
                  <h2 className="text-lg font-extrabold text-stone-900">
                    bKash & Nagad Payment Attempts ({paymentAttempts.length})
                  </h2>
                  <p className="text-xs text-stone-500">
                    If a gateway callback is delayed or ambiguous, it is marked{" "}
                    <code className="font-mono font-bold text-amber-800">
                      needs_review
                    </code>{" "}
                    so an admin can verify the bank/MFS portal and settle or reject it safely.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                    Needs Review:{" "}
                    {
                      paymentAttempts.filter((a) => a.status === "needs_review")
                        .length
                    }
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadAdminRecords()}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 uppercase">
                      <th className="py-3 pr-3">Gateway Ref</th>
                      <th className="py-3 px-3">Gateway</th>
                      <th className="py-3 px-3">Payment ID / TrxID</th>
                      <th className="py-3 px-3">Expected</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 pl-3 text-right">Admin Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {paymentAttempts.map((att) => {
                      const isReview =
                        att.status === "needs_review" ||
                        att.status === "executing" ||
                        att.status === "created" ||
                        att.status === "redirected";
                      return (
                        <tr
                          key={att.id}
                          className={`hover:bg-stone-50 transition ${
                            att.status === "needs_review"
                              ? "bg-amber-50/50"
                              : ""
                          }`}
                        >
                          <td className="py-3.5 pr-3 font-mono font-bold text-stone-900">
                            {att.gatewayOrderRef}
                            <span className="block text-[10px] text-stone-400">
                              {new Date(att.createdAt).toLocaleString("en-BD", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`px-2.5 py-1 rounded-md text-white font-extrabold uppercase text-[10px] ${
                                att.gateway === "bkash"
                                  ? "bg-[#E2136E]"
                                  : "bg-[#E35124]"
                              }`}
                            >
                              {att.gateway} ({att.purpose})
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-mono text-stone-700">
                            <div>ID: {att.gatewayPaymentId || "—"}</div>
                            {att.gatewayTrxId && (
                              <div className="text-emerald-800 font-bold">
                                TrxID: {att.gatewayTrxId}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3 font-extrabold text-[#0F3D2E]">
                            ৳{att.expectedAmount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-[11px] uppercase ${
                                att.status === "succeeded"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : att.status === "needs_review"
                                  ? "bg-amber-200 text-amber-950"
                                  : att.status === "failed" ||
                                    att.status === "cancelled"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {att.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3.5 pl-3 text-right">
                            {isReview ? (
                              <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                                <input
                                  type="text"
                                  value={resolveTrxInput[att.id] || ""}
                                  onChange={(e) =>
                                    setResolveTrxInput((prev) => ({
                                      ...prev,
                                      [att.id]: e.target.value.toUpperCase(),
                                    }))
                                  }
                                  placeholder="Verified TrxID"
                                  className="px-2.5 py-1 rounded-lg bg-white border border-stone-300 font-mono text-[11px] w-28"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const trx = (
                                      resolveTrxInput[att.id] ||
                                      att.gatewayTrxId ||
                                      ""
                                    ).trim();
                                    if (!trx) {
                                      showToast(
                                        "Please enter the verified gateway TrxID before approving."
                                      );
                                      return;
                                    }
                                    await updateOrderPaymentStatus(
                                      att.orderId,
                                      "paid",
                                      undefined,
                                      trx
                                    );
                                    const ok = await resolvePaymentAttempt(
                                      att.id,
                                      "dismissed",
                                      `Approved & settled by admin (${trx})`
                                    );
                                    if (ok) void loadAdminRecords();
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[#0F3D2E] hover:bg-[#165a44] text-white font-bold text-[11px] cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ok = await resolvePaymentAttempt(
                                      att.id,
                                      "dismissed",
                                      "Dismissed by admin"
                                    );
                                    if (ok) void loadAdminRecords();
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 font-bold text-[11px] cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-stone-400 text-[11px]">
                                Settled
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {paymentAttempts.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-6 text-center text-stone-400"
                        >
                          No gateway payment attempts recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Verified Payment Transactions Ledger */}
            <div className="bg-white rounded-3xl border border-stone-200/90 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-stone-900">
                    Verified bKash, Nagad & COD Settlement Ledger
                  </h2>
                  <p className="text-xs text-stone-500">
                    Every server-verified gateway transaction and admin settlement is recorded with anti-replay uniqueness on TrxID.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    Total Verified Transactions: {transactions.length}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 uppercase">
                      <th className="py-3 pr-4">Transaction ID (TrxID)</th>
                      <th className="py-3 px-4">Order Code</th>
                      <th className="py-3 px-4">Gateway / MFS</th>
                      <th className="py-3 px-4">Sender Phone</th>
                      <th className="py-3 px-4">Paid Amount</th>
                      <th className="py-3 px-4">Order Payment Status</th>
                      <th className="py-3 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {transactions.map((trx) => {
                      const linkedOrder = orders.find(
                        (o) =>
                          o.id === trx.orderId || o.orderCode === trx.orderCode
                      );
                      const isFullyPaid =
                        linkedOrder?.paymentStatus === "paid" ||
                        linkedOrder?.dueAmount === 0;

                      return (
                        <tr
                          key={trx.id}
                          className="hover:bg-stone-50 transition"
                        >
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-1.5 font-mono font-black text-stone-900">
                              <span>{trx.transactionId}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyTrx(trx.transactionId)}
                                className="p-1 rounded hover:bg-stone-200 text-stone-500 cursor-pointer"
                                title="Copy TrxID"
                              >
                                {copiedTrxId === trx.transactionId ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#0F3D2E]">
                            <button
                              type="button"
                              onClick={() => {
                                setOrderSearch(trx.orderCode);
                                setActiveTab("orders");
                              }}
                              className="hover:underline cursor-pointer"
                              title="View this order"
                            >
                              {trx.orderCode}
                            </button>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-md text-white font-extrabold uppercase text-[10px] ${
                                trx.gateway === "bkash"
                                  ? "bg-[#E2136E]"
                                  : trx.gateway === "nagad"
                                  ? "bg-[#E35124]"
                                  : trx.gateway === "sslcommerz"
                                  ? "bg-[#1A4B8C]"
                                  : "bg-[#0F3D2E]"
                              }`}
                            >
                              {trx.gateway}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-stone-600">
                            {trx.senderPhone || "Verified Wallet"}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-sm text-[#0F3D2E]">
                            ৳{trx.amount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                                isFullyPaid
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {linkedOrder
                                ? linkedOrder.paymentStatus.toUpperCase()
                                : trx.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3.5 pl-4 text-right">
                            {linkedOrder && !isFullyPaid && (
                              <button
                                type="button"
                                onClick={() => {
                                  void updateOrderPaymentStatus(
                                    linkedOrder.id,
                                    "paid",
                                    linkedOrder.totalAmount,
                                    trx.transactionId
                                  );
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-[#0F3D2E] hover:bg-[#165a44] text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
                              >
                                Verify & Mark Paid
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {transactions.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-stone-400"
                        >
                          No transactions recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CUSTOMER INQUIRIES & HELPDESK MESSAGES */}
        {activeTab === "messages" && (
          <div className="space-y-6">
            {/* Header & Stats Banner */}
            <div className="bg-white rounded-3xl border border-stone-200/90 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F3D2E]">
                    কাস্টমার ইনবক্স ও অনুসন্ধান
                  </span>
                  {unreadMessageCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white">
                      {unreadMessageCount}টি নতুন অপঠিত
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      সব বার্তা পর্যালোচিত
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-black text-stone-900">
                  Customer Messages & Inquiries
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  ওয়েবসাইটের কন্টাক্ট পেজ থেকে আসা বার্তা, নদীর মাছ কাটিং ও বাল্ক অর্ডারের জিজ্ঞাসা।
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/contact"
                  target="_blank"
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 transition flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>লাইভ কন্টাক্ট পেজ</span>
                </Link>
              </div>
            </div>

            {/* Quick Stats Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-stone-200/80">
                <span className="text-[11px] font-bold text-stone-400 block uppercase">
                  মোট বার্তা
                </span>
                <span className="text-2xl font-black text-stone-900 mt-1 block">
                  {messages.length}
                </span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-amber-200/80 bg-amber-50/20">
                <span className="text-[11px] font-bold text-amber-700 block uppercase">
                  অপঠিত / অপেক্ষমাণ
                </span>
                <span className="text-2xl font-black text-amber-900 mt-1 block">
                  {unreadMessageCount}
                </span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20">
                <span className="text-[11px] font-bold text-emerald-700 block uppercase">
                  উত্তর দেওয়া হয়েছে
                </span>
                <span className="text-2xl font-black text-emerald-900 mt-1 block">
                  {messages.filter((m) => m.status === "replied").length}
                </span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-blue-200/80 bg-blue-50/20">
                <span className="text-[11px] font-bold text-blue-700 block uppercase">
                  পঠিত বার্তা
                </span>
                <span className="text-2xl font-black text-blue-900 mt-1 block">
                  {messages.filter((m) => m.status === "read").length}
                </span>
              </div>
            </div>

            {/* Search & Status Filter Controls */}
            <div className="bg-white rounded-3xl border border-stone-200/90 p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  placeholder="নাম, ফোন, বিষয় বা মেসেজ দিয়ে খুঁজুন..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:border-[#0F3D2E]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {[
                  { id: "all", label: `সব (${messages.length})` },
                  { id: "unread", label: `অপঠিত (${unreadMessageCount})` },
                  {
                    id: "read",
                    label: `পঠিত (${
                      messages.filter((m) => m.status === "read").length
                    })`,
                  },
                  {
                    id: "replied",
                    label: `উত্তর দেওয়া (${
                      messages.filter((m) => m.status === "replied").length
                    })`,
                  },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setMessageStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      messageStatusFilter === f.id
                        ? "bg-[#0F3D2E] text-white shadow-xs"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages Table */}
            <div className="bg-white rounded-3xl border border-stone-200/90 overflow-hidden shadow-xs">
              {filteredMessages.length === 0 ? (
                <div className="p-12 text-center text-stone-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-bold text-stone-600">
                    কোনো মেসেজ পাওয়া যায়নি
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    সার্চ বা ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">তারিখ ও সময়</th>
                        <th className="py-3 px-4">প্রেরক (নাম ও ফোন)</th>
                        <th className="py-3 px-4">বিষয়</th>
                        <th className="py-3 px-4">বার্তার বিবরণ</th>
                        <th className="py-3 px-4">স্ট্যাটাস</th>
                        <th className="py-3 px-4 text-right">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-medium text-stone-800">
                      {filteredMessages.map((msg) => {
                        const cleanP = msg.phone.replace(/[^0-9]/g, "");
                        return (
                          <tr
                            key={msg.id}
                            className={`hover:bg-stone-50/80 transition ${
                              msg.status === "unread"
                                ? "bg-amber-50/20 font-semibold"
                                : ""
                            }`}
                          >
                            <td className="py-3.5 px-4 whitespace-nowrap text-stone-500 text-[11px]">
                              {new Date(msg.createdAt).toLocaleDateString(
                                "bn-BD",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                              <span className="block text-[10px] text-stone-400">
                                {new Date(msg.createdAt).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="font-bold text-stone-900 block">
                                {msg.name}
                              </span>
                              <a
                                href={`tel:${cleanP}`}
                                className="text-emerald-700 font-mono text-[11px] hover:underline inline-flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3 inline" />
                                {msg.phone}
                              </a>
                              {msg.email && (
                                <span className="block text-[10px] text-stone-400">
                                  {msg.email}
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-700">
                                {msg.subject}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                              <p className="line-clamp-2 text-stone-700 text-xs">
                                {msg.message}
                              </p>
                              {msg.adminReply && (
                                <p className="text-[11px] text-emerald-800 mt-1 line-clamp-1 italic bg-emerald-50 px-2 py-0.5 rounded">
                                  রিপ্লাই: {msg.adminReply}
                                </p>
                              )}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {msg.status === "unread" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                  নতুন অপঠিত
                                </span>
                              )}
                              {msg.status === "read" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                                  পঠিত
                                </span>
                              )}
                              {msg.status === "replied" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                  <Check className="w-3 h-3" />
                                  উত্তর সম্পন্ন
                                </span>
                              )}
                              {msg.status === "archived" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600">
                                  আর্কাইভ
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {/* 1-Click WhatsApp Reply */}
                                <a
                                  href={`https://wa.me/${cleanP}?text=${encodeURIComponent(
                                    `আসসালামু আলাইকুম ${msg.name},\nসাধ্যের বাজার কাস্টমার কেয়ার থেকে আপনার বার্তার প্রেক্ষিতে জানাচ্ছি...`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition"
                                  title="WhatsApp-এ রিপ্লাই দিন"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>

                                {/* Direct Call */}
                                <a
                                  href={`tel:${cleanP}`}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                                  title="সরাসরি কল দিন"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>

                                {/* View & Reply Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMessage(msg);
                                    setReplyText(msg.adminReply || "");
                                    if (msg.status === "unread") {
                                      updateMessageStatus(msg.id, "read");
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#0F3D2E] text-white hover:bg-emerald-950 font-bold text-[11px] transition cursor-pointer"
                                >
                                  পড়ুন
                                </button>

                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `আপনি কি নিশ্চিত যে "${msg.name}" এর বার্তাটি মুছে ফেলতে চান?`
                                      )
                                    ) {
                                      deleteContactMessage(msg.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                  title="বার্তা ডিলিট করুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: DYNAMIC INSIDE / OUTSIDE DHAKA DELIVERY FEES & SETTINGS */}
        {activeTab === "settings" && (
          <form
            onSubmit={handleSaveDeliverySettings}
            className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 space-y-8 max-w-4xl"
          >
            {/* Delivery Fees & Policies */}
            <div>
              <div className="border-b border-stone-200 pb-3 mb-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F3D2E]">
                  1. Delivery Charges & Thresholds
                </span>
                <h2 className="text-lg font-extrabold text-stone-900 mt-0.5">
                  হোম ডেলিভারি চার্জ ও ফ্রি ডেলিভারি শর্ত
                </h2>
                <p className="text-xs text-stone-500">
                  এখানে পরিবর্তন করলে তাৎক্ষণিকভাবে স্টোরফ্রন্ট, কার্ট ও চেকআউটে আপডেট হবে।
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <label className="block text-xs font-extrabold uppercase text-[#0F3D2E] mb-1.5">
                    Inside Dhaka Delivery Charge (৳ BDT) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={settingsForm.insideDhakaFee}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        insideDhakaFee: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-lg font-extrabold text-stone-900"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <label className="block text-xs font-extrabold uppercase text-amber-900 mb-1.5">
                    Outside Dhaka Nationwide Charge (৳ BDT) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={settingsForm.outsideDhakaFee}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        outsideDhakaFee: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-amber-300 text-lg font-extrabold text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Free Home Delivery Threshold (৳ BDT)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={settingsForm.freeDeliveryThreshold}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        freeDeliveryThreshold: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Pre-Order Advance Percentage (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settingsForm.preorderAdvancePercent}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        preorderAdvancePercent: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold"
                  />
                </div>
              </div>
            </div>

            {/* bKash MFS Gateway Configuration */}
            <div>
              <div className="border-b border-pink-200 pb-3 mb-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#E2136E]">
                  2. bKash Configuration (বিকাশ পেমেন্ট সেটিংস)
                </span>
                <h3 className="text-lg font-extrabold text-stone-900 mt-0.5">
                  বিকাশ অ্যাকাউন্ট ও গেটওয়ে সেটিংস
                </h3>
                <p className="text-xs text-stone-500">
                  চেকআউটে গ্রাহকদের এই নম্বরটি প্রদর্শিত হবে এবং ১-ক্লিকে কপি করতে পারবে।
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    bKash Account Number (বিকাশ নম্বর) *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.bkashMerchantNumber}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        bkashMerchantNumber: e.target.value,
                      })
                    }
                    placeholder="e.g. 01713-477780"
                    className="w-full px-4 py-2.5 rounded-xl bg-pink-50/50 border border-pink-200 text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    bKash Account Type (অ্যাকাউন্টের ধরন)
                  </label>
                  <select
                    value={settingsForm.bkashAccountType || "merchant"}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        bkashAccountType: e.target.value as "merchant" | "personal",
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold cursor-pointer"
                  >
                    <option value="merchant">
                      Merchant Account (গ্রাহক “Make Payment” করবেন)
                    </option>
                    <option value="personal">
                      Personal Account (গ্রাহক “Send Money” করবেন)
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Zero-Leakage Secret Vault:</span>{" "}
                    bKash Merchant API credentials (<code className="font-mono">BKASH_APP_KEY</code>,{" "}
                    <code className="font-mono">BKASH_APP_SECRET</code>,{" "}
                    <code className="font-mono">BKASH_USERNAME</code>,{" "}
                    <code className="font-mono">BKASH_PASSWORD</code>) are stored
                    exclusively in <code className="font-mono">.env</code> /{" "}
                    <code className="font-mono">.dev.vars</code> / Cloudflare
                    Secrets and never saved in the public database.
                  </div>
                </div>
              </div>
            </div>

            {/* Nagad MFS Gateway Configuration */}
            <div>
              <div className="border-b border-orange-200 pb-3 mb-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#E35124]">
                  3. Nagad Configuration (নগদ পেমেন্ট সেটিংস)
                </span>
                <h3 className="text-lg font-extrabold text-stone-900 mt-0.5">
                  নগদ মার্চেন্ট অ্যাকাউন্ট ও গেটওয়ে সেটিংস
                </h3>
                <p className="text-xs text-stone-500">
                  চেকআউটে নগদ মার্চেন্ট পেমেন্ট অপশন ও ডিসপ্লে নম্বর কনফিগারেশন।
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Nagad Account Number (নগদ নম্বর) *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.nagadNumber || "01713-477780"}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        nagadNumber: e.target.value,
                      })
                    }
                    placeholder="e.g. 01713-477780"
                    className="w-full px-4 py-2.5 rounded-xl bg-orange-50/50 border border-orange-200 text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Nagad Account Type (অ্যাকাউন্টের ধরন)
                  </label>
                  <select
                    value={settingsForm.nagadAccountType || "merchant"}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        nagadAccountType: e.target.value as "merchant" | "personal",
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold cursor-pointer"
                  >
                    <option value="merchant">
                      Merchant Account (গ্রাহক “Merchant Pay” করবেন)
                    </option>
                    <option value="personal">
                      Personal Account (গ্রাহক “Send Money” করবেন)
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.nagadEnabled ?? true}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          nagadEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-[#E35124]"
                    />
                    <span className="text-xs font-bold text-stone-800">
                      Enable Nagad in Checkout (চেকআউট পেজে নগদ পেমেন্ট অপশন চালু রাখুন)
                    </span>
                  </label>
                </div>

                <div className="sm:col-span-2 bg-orange-50 border border-orange-200 rounded-xl p-3.5 text-xs text-orange-950 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#E35124] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">RSA Asymmetric Security:</span>{" "}
                    Nagad Merchant keys (<code className="font-mono">NAGAD_MERCHANT_ID</code>,{" "}
                    <code className="font-mono">NAGAD_PG_PUBLIC_KEY</code>,{" "}
                    <code className="font-mono">NAGAD_MERCHANT_PRIVATE_KEY</code>)
                    are stored strictly in <code className="font-mono">.env</code>{" "}
                    / <code className="font-mono">.dev.vars</code> / Cloudflare
                    Secrets.
                  </div>
                </div>
              </div>
            </div>

            {/* SSLCommerz Gateway Status (On Hold) */}
            <div>
              <div className="border-b border-stone-200 pb-3 mb-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-stone-500">
                  4. SSLCommerz Official Gateway (On Hold)
                </span>
                <h3 className="text-lg font-extrabold text-stone-900 mt-0.5">
                  SSLCommerz গেটওয়ে স্ট্যাটাস (সাময়িকভাবে স্থগিত)
                </h3>
              </div>

              <div className="bg-stone-50 border border-dashed border-stone-300 rounded-2xl p-4 text-xs text-stone-600 flex items-start gap-3">
                <Lock className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-800">
                    SSLCommerz ইন্টিগ্রেশন অন হোল্ড (On Hold):
                  </span>{" "}
                  সার্ভার কোড (<code className="font-mono">functions/api/payment/sslcommerz/*</code>) সুরক্ষিতভাবে সংরক্ষিত আছে এবং মিডলওয়্যারে সাময়িকভাবে হোল্ডে রাখা হয়েছে। সক্রিয় পেমেন্ট মাধ্যম হিসেবে বর্তমানে{" "}
                  <strong>bKash Merchant, Nagad Merchant এবং Cash on Delivery (COD)</strong> চালু রয়েছে।
                </div>
              </div>
            </div>

            {/* Store Contact & Banner */}
            <div>
              <div className="border-b border-stone-200 pb-3 mb-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F3D2E]">
                  5. Customer Support & Announcement
                </span>
                <h3 className="text-lg font-extrabold text-stone-900 mt-0.5">
                  সাপোর্ট ফোন নম্বর ও অ্যানাউন্সমেন্ট ব্যানার
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Customer Hotline / Support Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.supportPhone}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        supportPhone: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Top Bar Live Announcement Banner
                  </label>
                  <input
                    type="text"
                    value={settingsForm.announcementEn}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        announcementEn: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200">
              <button
                type="submit"
                className="px-8 py-4 rounded-2xl bg-[#0F3D2E] hover:bg-[#165b44] text-white font-black text-sm shadow-xl transition cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Save All Store & Payment Settings</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* MODAL 1: DIGITAL SCALE WEIGHT & BILL ADJUSTER (Step 1 Upgrade) */}
      {scaleOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-extrabold text-stone-900">
                  Digital Scale Weight Adjuster ({scaleOrder.orderCode})
                </h3>
              </div>
              <button
                onClick={() => setScaleOrder(null)}
                className="p-1 rounded-full hover:bg-stone-100 text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Use this when wild river fish or village Deshi chicken weighs
              slightly more or less than the booked estimate on harvest morning.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                adjustOrderWeightAndBill(
                  scaleOrder.id,
                  Number(scaleDeltaAmount),
                  scaleNote
                );
                setScaleOrder(null);
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Bill Adjustment Amount in ৳ BDT (Use + or -) *
                </label>
                <input
                  type="number"
                  required
                  value={scaleDeltaAmount}
                  onChange={(e) => setScaleDeltaAmount(Number(e.target.value))}
                  placeholder="e.g., 140 or -90"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-base font-extrabold"
                />
                <div className="flex gap-1.5 mt-1.5">
                  {[-120, -60, 0, 85, 150, 220].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setScaleDeltaAmount(val)}
                      className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 font-mono font-bold text-[11px] cursor-pointer"
                    >
                      {val >= 0 ? `+৳${val}` : `-৳${Math.abs(val)}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Scale Verification Note (Shown on Customer Invoice) *
                </label>
                <input
                  type="text"
                  required
                  value={scaleNote}
                  onChange={(e) => setScaleNote(e.target.value)}
                  placeholder="e.g., Jamuna Ayer fish weighed 1.65kg on digital scale (+150g)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setScaleOrder(null)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white font-extrabold cursor-pointer"
                >
                  Apply Weight Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: COLD-CHAIN COURIER & RIDER ASSIGNMENT (Step 4 Upgrade) */}
      {logisticsOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-stone-900">
                  Assign Cold-Chain Dispatch ({logisticsOrder.orderCode})
                </h3>
              </div>
              <button
                onClick={() => setLogisticsOrder(null)}
                className="p-1 rounded-full hover:bg-stone-100 text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                assignOrderLogistics(
                  logisticsOrder.id,
                  courierName,
                  trackingRef,
                  riderName,
                  riderPhone
                );
                setLogisticsOrder(null);
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Courier / Cold-Chain Method
                </label>
                <select
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-bold"
                >
                  <option value="Sadhyer Bazar Chilled Rider (Dhaka Express)">
                    Sadhyer Bazar Chilled Rider (Dhaka Express)
                  </option>
                  <option value="Steadfast Cold-Chain Express">
                    Steadfast Cold-Chain Express
                  </option>
                  <option value="Pathao Parcel Express">
                    Pathao Parcel Express
                  </option>
                  <option value="Inter-District AC Bus Thermal Box">
                    Inter-District AC Bus Thermal Box
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Consignment / Tracking Reference ID
                </label>
                <input
                  type="text"
                  required
                  value={trackingRef}
                  onChange={(e) => setTrackingRef(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Rider / Supervisor Name
                  </label>
                  <input
                    type="text"
                    required
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Rider Contact Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={riderPhone}
                    onChange={(e) => setRiderPhone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLogisticsOrder(null)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-extrabold cursor-pointer"
                >
                  Dispatch & Notify Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD / EDIT PRODUCT */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-950/70 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 md:p-10 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#C83E2B]">
                  Catalog Management
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-stone-900">
                  {editingProduct
                    ? "Edit Product & Pricing Details"
                    : "Add New Organic Product to Store"}
                </h3>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-2 rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition cursor-pointer"
                title="Close Window"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: Core Details & Pricing (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200 space-y-3.5">
                    <h4 className="text-xs font-black uppercase text-stone-700 tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#0F3D2E]" />
                      Product Information
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block font-bold text-stone-700 mb-1">
                          Product Title (English) *
                        </label>
                        <input
                          type="text"
                          required
                          value={prodTitle}
                          onChange={(e) => setProdTitle(e.target.value)}
                          placeholder="e.g., Jamuna River Fresh Pabda Fish"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 focus:border-[#0F3D2E] focus:outline-none font-semibold text-xs text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-stone-700 mb-1">
                          Product Title (বাংলা) *
                        </label>
                        <input
                          type="text"
                          required
                          value={prodTitleBn}
                          onChange={(e) => setProdTitleBn(e.target.value)}
                          placeholder="e.g., যমুনার তাজা পাবদা মাছ"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 focus:border-[#0F3D2E] focus:outline-none font-semibold text-xs text-stone-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-bold text-stone-700">
                            Category *
                          </label>
                          <button
                            type="button"
                            onClick={() => openCreateCategoryModal()}
                            className="text-[10px] font-extrabold text-[#0F3D2E] hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            New Category
                          </button>
                        </div>
                        <select
                          value={prodCategorySlug}
                          onChange={(e) => setProdCategorySlug(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 font-semibold focus:border-[#0F3D2E] focus:outline-none text-xs text-stone-900"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.slug}>
                              {c.name} ({c.nameBn})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-stone-700 mb-1">
                          Harvest / Origin Source
                        </label>
                        <input
                          type="text"
                          value={prodOrigin}
                          onChange={(e) => setProdOrigin(e.target.value)}
                          placeholder="e.g., Sirajganj, Jamuna River Basin"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 focus:border-[#0F3D2E] focus:outline-none text-xs text-stone-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing & Weight Variants */}
                  <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200 space-y-3.5">
                    <h4 className="text-xs font-black uppercase text-stone-700 tracking-wider flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-[#0F3D2E]" />
                      Weight Packs & Pricing
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-2">
                        <label className="block font-bold text-stone-700">
                          Variant 1 (Default Pack) *
                        </label>
                        <input
                          type="text"
                          required
                          value={var1Label}
                          onChange={(e) => setVar1Label(e.target.value)}
                          placeholder="e.g. 500g Pack / Jar"
                          className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-500">Price: ৳</span>
                          <input
                            type="number"
                            required
                            min={1}
                            value={var1Price}
                            onChange={(e) => setVar1Price(Number(e.target.value))}
                            className="flex-1 px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 font-black text-sm text-[#0F3D2E]"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-2">
                        <label className="block font-bold text-stone-700">
                          Variant 2 (Family Pack - Optional)
                        </label>
                        <input
                          type="text"
                          value={var2Label}
                          onChange={(e) => setVar2Label(e.target.value)}
                          placeholder="e.g. 1kg Family Pack"
                          className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-500">Price: ৳</span>
                          <input
                            type="number"
                            min={0}
                            value={var2Price}
                            onChange={(e) => setVar2Price(Number(e.target.value))}
                            className="flex-1 px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 font-black text-sm text-[#0F3D2E]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pre-Order Batch Mode Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200">
                    <label className="flex items-center gap-2.5 font-bold text-amber-950 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={prodIsPreorder}
                        onChange={(e) => setProdIsPreorder(e.target.checked)}
                        className="w-4 h-4 accent-[#C83E2B]"
                      />
                      <span>Enable Pre-Order Batch Sourcing Mode</span>
                    </label>
                    {prodIsPreorder && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-amber-900 shrink-0">Batch Date:</span>
                        <input
                          type="text"
                          value={prodDeliveryDate}
                          onChange={(e) => setProdDeliveryDate(e.target.value)}
                          placeholder="e.g. Friday Morning Batch"
                          className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-950"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Short Description / Sourcing Highlights
                    </label>
                    <textarea
                      rows={2}
                      value={prodShortDesc}
                      onChange={(e) => setProdShortDesc(e.target.value)}
                      placeholder="e.g., Harvested fresh early morning from Jamuna river fishermen, shipped on ice..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-[#0F3D2E] focus:outline-none text-xs text-stone-900"
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN: Media & Image Preview (5 Cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-stone-800 text-xs flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-[#0F3D2E]" />
                        Product Poster Image *
                      </label>
                      <div className="flex items-center gap-1 bg-stone-200/80 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setProdImageMode("preset");
                            setProdImageError(false);
                            if (
                              !PRESET_PRODUCT_IMAGES.some(
                                (p) => p.value === prodImage
                              )
                            ) {
                              setProdImage(PRESET_PRODUCT_IMAGES[0].value);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                            prodImageMode === "preset"
                              ? "bg-white text-stone-900 shadow-xs"
                              : "text-stone-500 hover:text-stone-800"
                          }`}
                        >
                          Preset
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProdImageMode("custom");
                            setProdImageError(false);
                          }}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                            prodImageMode === "custom"
                              ? "bg-white text-stone-900 shadow-xs"
                              : "text-stone-500 hover:text-stone-800"
                          }`}
                        >
                          Custom URL
                        </button>
                      </div>
                    </div>

                    {prodImageMode === "preset" ? (
                      <select
                        value={prodImage}
                        onChange={(e) => {
                          setProdImage(e.target.value);
                          setProdImageError(false);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 font-semibold focus:border-[#0F3D2E] focus:outline-none text-xs text-stone-900"
                      >
                        {PRESET_PRODUCT_IMAGES.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-1">
                        <input
                          type="url"
                          required
                          value={prodImage}
                          onChange={(e) => {
                            setProdImage(e.target.value);
                            setProdImageError(false);
                          }}
                          placeholder="https://ik.imagekit.io/... or https://..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 font-mono text-[11px] focus:border-[#0F3D2E] focus:outline-none"
                        />
                        <p className="text-[10px] text-stone-500">
                          Supports ImageKit, Cloudinary, Supabase Storage, and all HTTPS image CDNs.
                        </p>
                      </div>
                    )}

                    {/* EXPANDED LIVE POSTER PREVIEW */}
                    <div className="rounded-2xl border border-stone-200 bg-white p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-stone-700">
                          Live Poster Preview
                        </span>
                        {!prodImageError ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Image Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            Load Failed
                          </span>
                        )}
                      </div>

                      {/* Large Canvas Preview */}
                      <div className="relative w-full h-52 rounded-xl overflow-hidden bg-stone-950/5 border border-stone-200 flex items-center justify-center">
                        {!prodImageError ? (
                          <img
                            key={prodImage}
                            src={prodImage}
                            alt="Product Poster"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain p-2"
                            onLoad={() => setProdImageError(false)}
                            onError={() => setProdImageError(true)}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-6 text-center space-y-2 text-rose-600 bg-rose-50/50 w-full h-full">
                            <AlertCircle className="w-8 h-8 text-rose-500" />
                            <div className="space-y-0.5">
                              <p className="text-xs font-extrabold text-rose-700">
                                Image Load Failed
                              </p>
                              <p className="text-[10px] text-stone-500 max-w-xs">
                                Could not display image from this URL. Make sure the URL is public and direct.
                              </p>
                            </div>
                            {prodImage.startsWith("http") && (
                              <a
                                href={prodImage}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-bold hover:bg-rose-200 transition"
                              >
                                <ExternalLink className="w-3 h-3" /> Test Link in New Tab
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* URL Display & External Quick Test */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 text-[10px]">
                        <span className="font-mono text-stone-400 truncate flex-1">
                          {prodImage}
                        </span>
                        {!prodImageError && prodImage.startsWith("http") && (
                          <a
                            href={prodImage}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#0F3D2E] hover:underline flex items-center gap-1 font-bold shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" /> Open Full Image
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Batch Target Inventory / Booking */}
                  <div className="p-4 rounded-2xl bg-stone-50/70 border border-stone-200 flex items-center justify-between gap-3">
                    <div>
                      <label className="block font-bold text-stone-700 text-xs">
                        Target Sourcing Quantity (Units)
                      </label>
                      <span className="text-[10px] text-stone-500">
                        Maximum capacity before batch shows as &quot;Fully Booked&quot;.
                      </span>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={prodTargetQty}
                      onChange={(e) => setProdTargetQty(Number(e.target.value))}
                      className="w-24 px-3 py-2 rounded-xl bg-white border border-stone-200 font-black text-sm text-center text-stone-900"
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200">
                <span className="text-stone-400 text-[11px]">
                  All catalog updates are synchronized live with Supabase &amp; edge CDN.
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-[#0F3D2E] hover:bg-[#165640] text-white font-extrabold cursor-pointer transition shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {editingProduct ? "Save Product Changes" : "Publish Product"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD / EDIT CATEGORY */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-950/70 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-2xl sm:max-w-3xl w-full p-6 sm:p-8 md:p-10 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#C83E2B]">
                  Department Manager
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-stone-900">
                  {editingCategory ? "Edit Category Details" : "Add New Store Category"}
                </h3>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-2 rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Category Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => {
                      setCatName(e.target.value);
                      if (!editingCategory && !catSlug) {
                        setCatSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/(^-|-$)/g, "")
                        );
                      }
                    }}
                    placeholder="e.g., Jamuna River Fish"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-[#0F3D2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Category Name (বাংলা) *
                  </label>
                  <input
                    type="text"
                    required
                    value={catNameBn}
                    onChange={(e) => setCatNameBn(e.target.value)}
                    placeholder="e.g., যমুনা নদীর মাছ"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-[#0F3D2E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Slug / URL Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    value={catSlug}
                    onChange={(e) =>
                      setCatSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                      )
                    }
                    placeholder="e.g., jamuna-river-fish"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-mono text-[11px] focus:border-[#0F3D2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Badge Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={catBadgeText}
                    onChange={(e) => setCatBadgeText(e.target.value)}
                    placeholder="e.g., Best Seller, Pre-Order Catch"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-[#0F3D2E] focus:outline-none"
                  />
                </div>
              </div>

              {/* Category Image Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-stone-700">
                    Category Banner Image *
                  </label>
                  <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setCatImageMode("preset");
                        setCatImageError(false);
                        if (
                          !PRESET_CATEGORY_IMAGES.some(
                            (p) => p.value === catImageUrl
                          )
                        ) {
                          setCatImageUrl(PRESET_CATEGORY_IMAGES[0].value);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                        catImageMode === "preset"
                          ? "bg-white text-stone-900 shadow-xs"
                          : "text-stone-500 hover:text-stone-800"
                      }`}
                    >
                      Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCatImageMode("custom");
                        setCatImageError(false);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                        catImageMode === "custom"
                          ? "bg-white text-stone-900 shadow-xs"
                          : "text-stone-500 hover:text-stone-800"
                      }`}
                    >
                      Custom URL
                    </button>
                  </div>
                </div>

                {catImageMode === "preset" ? (
                  <select
                    value={catImageUrl}
                    onChange={(e) => {
                      setCatImageUrl(e.target.value);
                      setCatImageError(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-semibold focus:border-[#0F3D2E] focus:outline-none"
                  >
                    {PRESET_CATEGORY_IMAGES.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="url"
                    required
                    value={catImageUrl}
                    onChange={(e) => {
                      setCatImageUrl(e.target.value);
                      setCatImageError(false);
                    }}
                    placeholder="https://ik.imagekit.io/... or https://..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-mono text-[11px] focus:border-[#0F3D2E] focus:outline-none"
                  />
                )}

                {/* Live Preview for Category */}
                {catImageUrl && (
                  <div className="mt-2 p-3 rounded-2xl bg-stone-100 border border-stone-200">
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white shrink-0 border border-stone-200 flex items-center justify-center">
                        {!catImageError ? (
                          <img
                            key={catImageUrl}
                            src={catImageUrl}
                            alt="Category Preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onLoad={() => setCatImageError(false)}
                            onError={() => setCatImageError(true)}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 text-rose-500 text-[9px] font-bold">
                            <AlertCircle className="w-5 h-5 mb-0.5" />
                            Error
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[11px] font-bold text-stone-700 truncate">
                            Live Banner Preview
                          </p>
                          {!catImageError ? (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              Load Failed
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-stone-500 truncate font-mono mt-0.5">
                          {catImageUrl}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  placeholder="Short description of this product department..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-[#0F3D2E] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5 items-center p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={catSortOrder}
                    onChange={(e) => setCatSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 font-bold"
                  />
                </div>
                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={catIsActive}
                      onChange={(e) => setCatIsActive(e.target.checked)}
                      className="w-4 h-4 text-[#0F3D2E] rounded accent-[#0F3D2E]"
                    />
                    <span className="font-bold text-stone-800 text-xs">
                      Active / Visible in Store
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 font-bold cursor-pointer hover:bg-stone-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white font-extrabold cursor-pointer hover:bg-[#165640] transition shadow-xs"
                >
                  {editingCategory ? "Save Category Changes" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PRINTABLE DELIVERY SLIP / INVOICE */}
      {selectedInvoiceOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-[#0F3D2E]">
                  Sadhyer Bazar (সাধ্যের বাজার) — Delivery Label
                </h3>
                <p className="text-xs text-stone-500">
                  Hotline: {settings.supportPhone}
                </p>
              </div>
              <span className="font-mono text-base font-black px-3 py-1 rounded-xl bg-stone-100">
                {selectedInvoiceOrder.orderCode}
              </span>
            </div>

            <div className="space-y-1.5 text-xs bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <p className="text-sm font-extrabold text-stone-900">
                Recipient: {selectedInvoiceOrder.customerName}
              </p>
              <p className="font-mono font-bold text-[#0F3D2E]">
                Phone: {selectedInvoiceOrder.customerPhone}
              </p>
              <p className="text-stone-700">
                Address: {selectedInvoiceOrder.customerAddress} (
                {selectedInvoiceOrder.customerDistrict})
              </p>
              {selectedInvoiceOrder.courierName && (
                <p className="text-blue-800 font-bold pt-1">
                  Courier: {selectedInvoiceOrder.courierName} (Ref:{" "}
                  {selectedInvoiceOrder.trackingReference})
                </p>
              )}
            </div>

            <div className="divide-y divide-stone-100 text-xs border border-stone-200 rounded-2xl p-3">
              {selectedInvoiceOrder.items.map((item) => (
                <div
                  key={item.id}
                  className="py-2 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-stone-900">
                      {item.productTitleBn} ({item.variantLabel}) ×{" "}
                      {item.quantity}
                    </p>
                    {item.cuttingPreference && (
                      <p className="text-[11px] text-stone-500">
                        Prep: {item.cuttingPreference}
                      </p>
                    )}
                  </div>
                  <span className="font-bold">
                    ৳{item.lineTotal.toLocaleString()}
                  </span>
                </div>
              ))}
              {selectedInvoiceOrder.weightAdjustmentAmount !== undefined &&
                selectedInvoiceOrder.weightAdjustmentAmount !== 0 && (
                  <div className="py-2 flex items-center justify-between text-amber-900 font-bold">
                    <span>
                      Scale Weight Adjustment (
                      {selectedInvoiceOrder.weightAdjustmentNote})
                    </span>
                    <span>
                      {selectedInvoiceOrder.weightAdjustmentAmount > 0
                        ? "+"
                        : ""}
                      ৳{selectedInvoiceOrder.weightAdjustmentAmount}
                    </span>
                  </div>
                )}
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950 text-white flex items-center justify-between">
              <div className="text-xs">
                <p>
                  Final Bill: ৳
                  {selectedInvoiceOrder.totalAmount.toLocaleString()}
                </p>
                <p className="text-emerald-300">
                  Paid Online: ৳
                  {selectedInvoiceOrder.advancePaid.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] uppercase text-amber-300 font-bold block">
                  Collect on Delivery (COD)
                </span>
                <strong className="text-2xl font-black text-amber-300">
                  ৳{selectedInvoiceOrder.dueAmount.toLocaleString()}
                </strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 no-print">
              <button
                onClick={() => setSelectedInvoiceOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MESSAGE DETAIL & REPLIER */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#0F3D2E]" />
                <h3 className="text-base font-extrabold text-stone-900">
                  গ্রাহক বার্তা ও ফলো-আপ
                </h3>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-1 rounded-full hover:bg-stone-100 text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sender Details Box */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">
                    প্রেরকের নাম
                  </span>
                  <span className="text-sm font-extrabold text-stone-900">
                    {selectedMessage.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">
                    তারিখ ও সময়
                  </span>
                  <span className="text-stone-600 font-mono text-[11px]">
                    {new Date(selectedMessage.createdAt).toLocaleString("bn-BD")}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200/60">
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">
                    মোবাইল নম্বর
                  </span>
                  <a
                    href={`tel:${selectedMessage.phone.replace(/[^0-9]/g, "")}`}
                    className="text-emerald-700 font-mono font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3 inline" />
                    {selectedMessage.phone}
                  </a>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">
                    ইমেইল
                  </span>
                  <span className="text-stone-700 font-mono">
                    {selectedMessage.email || "উল্লেখ নেই"}
                  </span>
                </div>
              </div>
            </div>

            {/* Inquiry Content */}
            <div>
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                বার্তার বিষয়: <span className="text-stone-800">{selectedMessage.subject}</span>
              </span>
              <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/60 text-xs text-stone-800 leading-relaxed whitespace-pre-wrap">
                {selectedMessage.message}
              </div>
            </div>

            {/* Quick Action Channels */}
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={`https://wa.me/${selectedMessage.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `আসসালামু আলাইকুম ${selectedMessage.name},\nসাধ্যের বাজার কাস্টমার কেয়ার থেকে আপনার বার্তার প্রেক্ষিতে জানাচ্ছি...`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp-এ সরাসরি রিপ্লাই</span>
              </a>

              <a
                href={`tel:${selectedMessage.phone.replace(/[^0-9]/g, "")}`}
                className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>সরাসরি কল</span>
              </a>
            </div>

            {/* Admin Reply & Internal Notes */}
            <div className="space-y-2 pt-2 border-t border-stone-200">
              <label className="block text-xs font-bold text-stone-700">
                অ্যাডমিন নোট / দেওয়া উত্তরের বিবরণ (Internal Log & Status)
              </label>
              <textarea
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="গ্রাহকের সাথে ফোনে বা হোয়াটসঅ্যাপে কী কথা হয়েছে বা উত্তর কী দেওয়া হয়েছে তা লিখে রাখুন..."
                className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:border-[#0F3D2E] resize-none"
              />
              <div className="flex justify-between items-center gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await updateMessageStatus(
                        selectedMessage.id,
                        "replied",
                        replyText
                      );
                      setSelectedMessage(null);
                    }}
                    className="px-4 py-2 bg-[#0F3D2E] text-white rounded-xl text-xs font-bold hover:bg-emerald-950 transition cursor-pointer"
                  >
                    উত্তর সম্পন্ন মার্ক করুন
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateMessageStatus(selectedMessage.id, "unread");
                      setSelectedMessage(null);
                    }}
                    className="px-3 py-2 bg-stone-100 text-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-200 transition cursor-pointer"
                  >
                    অপঠিত রাখুন
                  </button>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("বার্তাটি সম্পূর্ণরূপে মুছে ফেলতে চান?")) {
                      await deleteContactMessage(selectedMessage.id);
                      setSelectedMessage(null);
                    }
                  }}
                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                  title="ডিলিট করুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
