"use client";

import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { checkRateLimit } from "@/lib/security";
import {
  Coupon,
  Order,
  OrderStatus,
  Product,
  SiteSettings,
} from "@/types";

type AdminTab =
  | "overview"
  | "orders"
  | "procurement"
  | "products"
  | "coupons"
  | "payments"
  | "settings";

export default function AdminDashboardPage() {
  const {
    products,
    categories,
    coupons,
    orders,
    transactions,
    settings,
    procurementSummary,
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
    updateSiteSettings,
    supabaseStatus,
    syncDatabaseWithSupabase,
  } = useStore();

  // Admin Passkey Gate (Locked by Default + Session Token Persistence)
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("sb_admin_auth_v2") === "verified") {
        setIsUnlocked(true);
      }
    } catch {}
  }, []);

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] =
    useState<Order | null>(null);

  // Scale Weight Adjustment Modal State (Step 1)
  const [scaleOrder, setScaleOrder] = useState<Order | null>(null);
  const [scaleDeltaAmount, setScaleDeltaAmount] = useState<number>(0);
  const [scaleNote, setScaleNote] = useState<string>("");

  // Cold-Chain Courier & Rider Assignment Modal State (Step 4)
  const [logisticsOrder, setLogisticsOrder] = useState<Order | null>(null);
  const [courierName, setCourierName] = useState(
    "Sadyer Bazar Chilled Rider (Dhaka Express)"
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

  // Settings Form State (Synced live with Supabase settings)
  const [settingsForm, setSettingsForm] = useState<SiteSettings>(settings);

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
      if (
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
    downloadCsv(`sadyer-bazar-orders-${new Date().toISOString().slice(0, 10)}.csv`, [
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
      `sadyer-bazar-procurement-${new Date().toISOString().slice(0, 10)}.csv`,
      [headers, ...rows]
    );
  };

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProdTitle("");
    setProdTitleBn("");
    setProdCategorySlug("jamuna-river-fish");
    setProdImage("/images/products/jamuna-fish.jpg");
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

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const cat =
      categories.find((c) => c.slug === prodCategorySlug) || categories[0];
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
        `100% pure & chemical-free ${prodTitle} (${prodTitleBn}) from Sadyer Bazar.`,
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
      seoTitle: `${prodTitle} (${prodTitleBn}) | Sadyer Bazar`,
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

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#0F3D2E] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#0F3D2E] flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold text-stone-900">
              Sadyer Bazar Admin Security Gate
            </h1>
            <p className="text-xs text-stone-500">
              Protected Merchant Portal • Enter Authorized Admin Passkey
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const rl = checkRateLimit("admin_login_gate", 5, 60_000);
              if (!rl.allowed) {
                setPinError(
                  "Too many failed attempts. Please wait 60 seconds."
                );
                return;
              }
              if (pinInput === "2026" || pinInput === "SadyerBazar@2026!") {
                setIsUnlocked(true);
                setPinError(null);
                try {
                  sessionStorage.setItem("sb_admin_auth_v2", "verified");
                } catch {}
              } else {
                setPinError(
                  `Invalid Passkey (${rl.remaining} attempts remaining).`
                );
              }
            }}
            className="space-y-4"
          >
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter Admin Passkey"
              autoFocus
              className="w-full px-4 py-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-[#0F3D2E]"
            />
            {pinError && (
              <p className="text-xs text-red-600 text-center font-bold">
                {pinError}
              </p>
            )}
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-[#0F3D2E] hover:bg-[#15533f] text-white font-bold text-sm transition cursor-pointer"
            >
              Unlock Merchant Portal
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
                  Sadyer Bazar
                </span>
                <span className="text-[11px] text-emerald-300 font-medium">
                  Enterprise Portal v2.0
                </span>
              </div>
            </Link>
            <button
              onClick={() => {
                setIsUnlocked(false);
                setPinInput("");
                try {
                  sessionStorage.removeItem("sb_admin_auth_v2");
                } catch {}
              }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 text-xs cursor-pointer"
              title="Lock Admin Session"
            >
              <Lock className="w-4 h-4" />
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
                id: "coupons",
                label: `Promo Codes (${coupons.length})`,
                icon: Tag,
              },
              {
                id: "payments",
                label: "bKash & SSL Ledger",
                icon: CreditCard,
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer text-left ${
                    active
                      ? "bg-amber-400 text-stone-950 shadow-md"
                      : "text-emerald-100/85 hover:bg-white/10"
                  }`}
                >
                  <IconComp className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
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
                  ⚠ Run supabase/schema.sql in SQL Editor →
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
              {activeTab === "coupons" &&
                "Promo Code & Campaign Discount Manager"}
              {activeTab === "payments" &&
                "Payment Ledger (bKash, SSLCommerz & COD)"}
              {activeTab === "settings" &&
                "Inside / Outside Dhaka Delivery Charges & Site Settings"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={syncDatabaseWithSupabase}
              className="px-3.5 py-2.5 rounded-2xl bg-[#0F3D2E] hover:bg-[#165b44] text-amber-300 text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
              title="Push & Sync All Products, Orders, Coupons & Settings to Supabase"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Sync to Supabase</span>
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
                  "all",
                  "pending",
                  "confirmed",
                  "processing",
                  "shipped",
                  "delivered",
                ].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer ${
                      orderStatusFilter === st
                        ? "bg-[#0F3D2E] text-white"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    {st}
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
                                ? "Sadyer Bazar Chilled Rider (Dhaka Express)"
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
                        onClick={() => deleteProduct(prod.id)}
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
                        onClick={() => deleteCoupon(coup.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 cursor-pointer"
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

        {/* TAB 6: PAYMENTS & BKASH / SSLCOMMERZ LEDGER */}
        {activeTab === "payments" && (
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-extrabold text-stone-900">
                Automated bKash & SSLCommerz Transaction Logs
              </h2>
              <p className="text-xs text-stone-500">
                Every online full or advance payment verified by our
                server-to-server IPN webhook is logged below.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 uppercase">
                    <th className="py-3 pr-4">Transaction ID</th>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Gateway</th>
                    <th className="py-3 px-4">Sender Phone</th>
                    <th className="py-3 px-4">Verified Amount</th>
                    <th className="py-3 pl-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {transactions.map((trx) => (
                    <tr key={trx.id} className="hover:bg-stone-50">
                      <td className="py-3.5 pr-4 font-mono font-bold text-stone-900">
                        {trx.transactionId}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0F3D2E]">
                        {trx.orderCode}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-white font-extrabold uppercase text-[10px] ${
                            trx.gateway === "bkash"
                              ? "bg-pink-600"
                              : "bg-blue-600"
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
                      <td className="py-3.5 pl-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> {trx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: DYNAMIC INSIDE / OUTSIDE DHAKA DELIVERY FEES & SETTINGS */}
        {activeTab === "settings" && (
          <form
            onSubmit={handleSaveDeliverySettings}
            className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 space-y-6 max-w-3xl"
          >
            <div className="border-b border-stone-200 pb-4">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F3D2E]">
                Dynamic Store Configuration
              </span>
              <h2 className="text-xl font-extrabold text-stone-900 mt-0.5">
                Update Inside Dhaka & Outside Dhaka Delivery Charges
              </h2>
              <p className="text-xs text-stone-500">
                Changes saved here immediately update the Storefront top bar,
                Slide Cart, Product pages, and Server-Side Checkout calculator.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                  className="w-full px-4 py-3 rounded-xl bg-white border border-emerald-300 text-lg font-extrabold text-stone-900"
                />
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                <label className="block text-xs font-extrabold uppercase text-amber-900 mb-1.5">
                  Outside Dhaka / Nationwide Charge (৳ BDT) *
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
                  className="w-full px-4 py-3 rounded-xl bg-white border border-amber-300 text-lg font-extrabold text-stone-900"
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
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Pre-Order Advance Payment Percentage (%)
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
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Customer Hotline Number
                </label>
                <input
                  type="text"
                  value={settingsForm.supportPhone}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      supportPhone: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  bKash Merchant Account Number
                </label>
                <input
                  type="text"
                  value={settingsForm.bkashMerchantNumber}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      bkashMerchantNumber: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Top Bar Live Announcement Banner (English)
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
                className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-3.5 rounded-2xl bg-[#0F3D2E] hover:bg-[#165b44] text-white font-extrabold text-sm shadow-lg transition cursor-pointer"
            >
              Save Delivery Charges & Settings
            </button>
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
                  <option value="Sadyer Bazar Chilled Rider (Dhaka Express)">
                    Sadyer Bazar Chilled Rider (Dhaka Express)
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-lg font-extrabold text-stone-900">
                {editingProduct
                  ? "Edit Product & Pricing"
                  : "Add New Organic Product"}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200"
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Category
                  </label>
                  <select
                    value={prodCategorySlug}
                    onChange={(e) => setProdCategorySlug(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-semibold"
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
                    Product Poster Image
                  </label>
                  <select
                    value={prodImage}
                    onChange={(e) => setProdImage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-semibold"
                  >
                    <option value="/images/products/jamuna-fish.jpg">
                      Jamuna Mixed Fish Poster (যমুনা নদীর মাছ)
                    </option>
                    <option value="/images/products/jamuna-big-fish.jpg">
                      Jamuna Big Fish Poster (যমুনার বড় মাছ)
                    </option>
                    <option value="/images/products/gawa-ghee.jpg">
                      Gawa Ghee Poster (গাওয়া ঘি)
                    </option>
                    <option value="/images/products/bogura-doi.jpg">
                      Bogura Shahi Doi Poster (বগুড়ার শাহী দই)
                    </option>
                    <option value="/images/products/deshi-chicken.jpg">
                      Deshi Chicken Poster (দেশি মুরগি)
                    </option>
                    <option value="/images/products/deshi-eggs.jpg">
                      Deshi Eggs Poster (দেশি মুরগির ডিম)
                    </option>
                    <option value="/images/products/red-rice.jpg">
                      Full Fiber Red Rice Poster (লাল চাল)
                    </option>
                    <option value="/images/products/sundarban-honey.jpg">
                      Pure Honey Poster (খাঁটি প্রাকৃতিক মধু)
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Variant 1 Label
                  </label>
                  <input
                    type="text"
                    required
                    value={var1Label}
                    onChange={(e) => setVar1Label(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-stone-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Variant 1 Price (৳)
                  </label>
                  <input
                    type="number"
                    required
                    value={var1Price}
                    onChange={(e) => setVar1Price(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-stone-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Variant 2 Label
                  </label>
                  <input
                    type="text"
                    value={var2Label}
                    onChange={(e) => setVar2Label(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-stone-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Variant 2 Price (৳)
                  </label>
                  <input
                    type="number"
                    value={var2Price}
                    onChange={(e) => setVar2Price(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-stone-200 font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                <label className="flex items-center gap-2 font-bold text-amber-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prodIsPreorder}
                    onChange={(e) => setProdIsPreorder(e.target.checked)}
                    className="w-4 h-4 accent-[#C83E2B]"
                  />
                  <span>Enable Pre-Order Batch Mode</span>
                </label>
                {prodIsPreorder && (
                  <input
                    type="text"
                    value={prodDeliveryDate}
                    onChange={(e) => setProdDeliveryDate(e.target.value)}
                    placeholder="e.g. Friday Morning Batch"
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold"
                  />
                )}
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Short Description
                </label>
                <textarea
                  rows={2}
                  value={prodShortDesc}
                  onChange={(e) => setProdShortDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white font-extrabold cursor-pointer"
                >
                  {editingProduct ? "Save Product Changes" : "Publish Product"}
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
                  Sadyer Bazar (সাধ্যের বাজার) — Delivery Label
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
    </div>
  );
}
