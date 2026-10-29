"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Truck,
  Lock,
  ArrowLeft,
  Zap,
  AlertCircle,
  Loader2,
  CreditCard,
  Smartphone,
  Banknote,
  Tag,
  X,
} from "lucide-react";
import {
  rememberRecentOrderInSession,
  useStore,
} from "@/context/StoreContext";
import {
  ActiveCheckoutPaymentMethod,
  DeliveryZone,
  PaymentPlan,
} from "@/types";
import {
  calculateCouponDiscount,
  checkRateLimit,
  generateIdempotencyKey,
  normalizeBdPhone,
  sanitizeText,
  validateSubmissionVelocity,
} from "@/lib/security";
import { createOrderSchema } from "@/lib/validations/schemas";
import { createOrderViaEdgeApi } from "@/services/supabaseSync";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset?: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";

export default function CheckoutPage() {
  const router = useRouter();
  const {
    cart,
    cartSubtotal,
    coupons,
    settings,
    clearCart,
    registerNewOrder,
    showToast,
  } = useStore();

  // 1-Click Customer Fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryZone, setDeliveryZone] =
    useState<DeliveryZone>("inside_dhaka");
  const [customerDistrict, setCustomerDistrict] = useState("Dhaka City");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [websiteHoneypot, setWebsiteHoneypot] = useState("");
  const [renderedAt] = useState(() => Date.now());

  // Promo / Coupon Code State
  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>("");

  // Cloudflare Turnstile State
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  // Auto-apply bundle coupon if customer came from FamilyComboBuilder
  useEffect(() => {
    try {
      const autoCode = sessionStorage.getItem("sb_auto_coupon");
      if (autoCode) {
        setCouponInput(autoCode);
        setAppliedCouponCode(autoCode);
        sessionStorage.removeItem("sb_auto_coupon");
      }
    } catch {}
  }, []);

  // Load Cloudflare Turnstile script when site key is configured
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || typeof window === "undefined") return;

    const renderWidget = () => {
      if (
        !window.turnstile ||
        !turnstileContainerRef.current ||
        turnstileWidgetIdRef.current
      ) {
        return;
      }
      turnstileWidgetIdRef.current = window.turnstile.render(
        turnstileContainerRef.current,
        {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "light",
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
        }
      );
    };

    if (window.turnstile) {
      renderWidget();
      return;
    }

    const existingScript = document.querySelector(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", renderWidget);
      return () => existingScript.removeEventListener("load", renderWidget);
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, []);

  // Payment Selection (Active: bkash | nagad | cod; SSLCommerz kept on hold)
  const [paymentMethod, setPaymentMethod] =
    useState<ActiveCheckoutPaymentMethod>("bkash");
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>("full");

  // Submission & Gateway Redirect State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [redirectingGateway, setRedirectingGateway] = useState<
    "bkash" | "nagad" | null
  >(null);

  // Live Delivery, Coupon & Payable Preview (Recalculated authoritatively on Server)
  const { discountAmount, appliedCoupon } = calculateCouponDiscount(
    cartSubtotal,
    appliedCouponCode,
    coupons
  );

  const baseDeliveryFee =
    deliveryZone === "inside_dhaka"
      ? settings.insideDhakaFee
      : settings.outsideDhakaFee;

  const isFreeDelivery =
    settings.enableFreeDelivery &&
    cartSubtotal >= settings.freeDeliveryThreshold;

  const deliveryCharge =
    cart.length === 0 ? 0 : isFreeDelivery ? 0 : baseDeliveryFee;
  const totalAmount = Math.max(0, cartSubtotal - discountAmount + deliveryCharge);

  const discountedSubtotal = Math.max(0, cartSubtotal - discountAmount);
  const advanceAmount = Math.max(
    deliveryCharge,
    Math.round((discountedSubtotal * settings.preorderAdvancePercent) / 100)
  );

  const payableOnlineNow =
    paymentMethod === "cod"
      ? 0
      : paymentPlan === "full"
      ? totalAmount
      : advanceAmount;

  const dueOnDelivery = Math.max(0, totalAmount - payableOnlineNow);

  const handleZoneChange = (zone: DeliveryZone) => {
    setDeliveryZone(zone);
    if (zone === "inside_dhaka") {
      setCustomerDistrict("Dhaka City");
    } else if (customerDistrict === "Dhaka City") {
      setCustomerDistrict("");
    }
  };

  const handleApplyCoupon = (codeToApply?: string) => {
    const code = (codeToApply ?? couponInput).trim().toUpperCase();
    if (!code) return;
    setCouponInput(code);

    const check = calculateCouponDiscount(cartSubtotal, code, coupons);
    if (check.appliedCoupon && check.discountAmount > 0) {
      setAppliedCouponCode(code);
      showToast(
        `Promo "${code}" applied! You saved ৳${check.discountAmount}!`
      );
    } else {
      const match = coupons.find(
        (c) => c.isActive && c.code.toUpperCase() === code
      );
      if (match && cartSubtotal < match.minOrderAmount) {
        setErrorMsg(
          `Promo "${code}" requires a minimum order of ৳${match.minOrderAmount} (Current subtotal: ৳${cartSubtotal}).`
        );
      } else {
        setErrorMsg(`Promo code "${code}" is invalid or expired.`);
      }
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cart.length === 0) {
      setErrorMsg("Your basket is empty. Please add products first.");
      return;
    }

    const rl = checkRateLimit("checkout_submit", 6, 60_000);
    if (!rl.allowed) {
      setErrorMsg(
        "Too many order requests in a short window. Please wait a moment and try again."
      );
      return;
    }

    const velocity = validateSubmissionVelocity(renderedAt, 2.0);
    if (!velocity.valid) {
      setErrorMsg(
        "Automated rapid checkout detected. Please take a moment to verify your order details before confirming."
      );
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setErrorMsg(
        "Please complete the Cloudflare security verification before placing your order."
      );
      return;
    }

    const payload = {
      customerName: sanitizeText(customerName),
      customerPhone: normalizeBdPhone(customerPhone),
      deliveryZone,
      customerDistrict: sanitizeText(
        customerDistrict ||
          (deliveryZone === "inside_dhaka" ? "Dhaka City" : "Outside Dhaka")
      ),
      customerAddress: sanitizeText(customerAddress),
      customerNote: sanitizeText(customerNote),
      couponCode: appliedCoupon?.code || undefined,
      paymentMethod,
      paymentPlan: (paymentMethod === "cod" ? "cod" : paymentPlan) as PaymentPlan,
      websiteHoneypot,
      turnstileToken: turnstileToken || undefined,
      items: cart.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        cuttingPreference: item.cuttingPreference,
      })),
    };

    const parsed = createOrderSchema.safeParse(payload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMsg(firstIssue?.message || "Please check your checkout details.");
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = generateIdempotencyKey("ord");
      const orderPayload = {
        customerName: sanitizeText(parsed.data.customerName),
        customerPhone: normalizeBdPhone(parsed.data.customerPhone),
        deliveryZone: parsed.data.deliveryZone,
        customerDistrict: sanitizeText(
          parsed.data.customerDistrict ||
            (parsed.data.deliveryZone === "inside_dhaka"
              ? "Dhaka City"
              : "Outside Dhaka")
        ),
        customerAddress: sanitizeText(parsed.data.customerAddress),
        customerNote: sanitizeText(parsed.data.customerNote) || undefined,
        couponCode: appliedCoupon?.code || undefined,
        paymentMethod: parsed.data.paymentMethod,
        paymentPlan: (parsed.data.paymentMethod === "cod"
          ? "cod"
          : parsed.data.paymentPlan) as PaymentPlan,
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          cuttingPreference: item.cuttingPreference,
        })),
        idempotencyKey,
        turnstileToken: turnstileToken || undefined,
        websiteHoneypot,
      };

      // 1. Zero-Client-Trust: Create order on Server via /api/orders/create
      const rpcRes = await createOrderViaEdgeApi(orderPayload);
      if (!rpcRes.success || !rpcRes.order) {
        if (window.turnstile && turnstileWidgetIdRef.current) {
          window.turnstile.reset?.(turnstileWidgetIdRef.current);
          setTurnstileToken("");
        }
        throw new Error(
          rpcRes.error ||
            "Unable to verify and create order on server. Please check your connection and try again."
        );
      }

      const createdOrder = rpcRes.order;
      const payableNow = createdOrder.payableNow ?? payableOnlineNow;

      // Remember orderCode + phoneLast4 in sessionStorage so /track-order auto-loads after redirect
      rememberRecentOrderInSession(
        createdOrder.orderCode,
        orderPayload.customerPhone.slice(-4)
      );

      // 2. Initiate Official Merchant Gateway Session (bKash or Nagad) or complete COD
      if (parsed.data.paymentMethod === "bkash" && payableNow > 0) {
        setRedirectingGateway("bkash");
        try {
          const initRes = await fetch("/api/payment/bkash/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderCode: createdOrder.orderCode,
            }),
          });
          const initData = (await initRes.json()) as {
            ok?: boolean;
            success?: boolean;
            bkashURL?: string;
            error?: string | { message?: string };
          };

          if (initRes.ok && (initData.ok || initData.success) && initData.bkashURL) {
            registerNewOrder(createdOrder);
            clearCart();
            window.location.href = initData.bkashURL;
            return;
          }

          const errText =
            typeof initData.error === "string"
              ? initData.error
              : initData.error?.message;
          throw new Error(
            errText ||
              "bKash মার্চেন্ট গেটওয়ে সেশন তৈরি করতে সমস্যা হয়েছে।"
          );
        } catch (gwErr) {
          setRedirectingGateway(null);
          registerNewOrder(createdOrder);
          clearCart();
          showToast(
            gwErr instanceof Error
              ? gwErr.message
              : "bKash গেটওয়ে সংযোগে ত্রুটি। ট্র্যাক অর্ডার পেজ থেকে পেমেন্ট সম্পন্ন করতে পারবেন।"
          );
          router.push(
            `/track-order?code=${encodeURIComponent(
              createdOrder.orderCode
            )}&justOrdered=1&gatewayError=1`
          );
          return;
        }
      } else if (parsed.data.paymentMethod === "nagad" && payableNow > 0) {
        setRedirectingGateway("nagad");
        try {
          const initRes = await fetch("/api/payment/nagad/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderCode: createdOrder.orderCode,
            }),
          });
          const initData = (await initRes.json()) as {
            ok?: boolean;
            success?: boolean;
            callBackUrl?: string;
            error?: string | { message?: string };
          };

          if (initRes.ok && (initData.ok || initData.success) && initData.callBackUrl) {
            registerNewOrder(createdOrder);
            clearCart();
            window.location.href = initData.callBackUrl;
            return;
          }

          const errText =
            typeof initData.error === "string"
              ? initData.error
              : initData.error?.message;
          throw new Error(
            errText ||
              "Nagad মার্চেন্ট গেটওয়ে সেশন তৈরি করতে সমস্যা হয়েছে।"
          );
        } catch (gwErr) {
          setRedirectingGateway(null);
          registerNewOrder(createdOrder);
          clearCart();
          showToast(
            gwErr instanceof Error
              ? gwErr.message
              : "Nagad গেটওয়ে সংযোগে ত্রুটি। ট্র্যাক অর্ডার পেজ থেকে পেমেন্ট সম্পন্ন করতে পারবেন।"
          );
          router.push(
            `/track-order?code=${encodeURIComponent(
              createdOrder.orderCode
            )}&justOrdered=1&gatewayError=1`
          );
          return;
        }
      } else {
        // Cash on Delivery (COD)
        registerNewOrder(createdOrder);
        clearCart();
        router.push(
          `/track-order?code=${encodeURIComponent(
            createdOrder.orderCode
          )}&justOrdered=1`
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit order";
      setErrorMsg(msg);
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.length === 0 && !redirectingGateway) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#0F3D2E] flex items-center justify-center mx-auto">
          <Truck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
          Your Basket is Empty
        </h1>
        <p className="text-sm text-stone-600 max-w-md mx-auto">
          Add fresh Jamuna River fish, Sirajganj Gawa Ghee, or Bogura Shahi Doi
          to your basket to proceed with 1-Click Checkout.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#0F3D2E] text-white text-sm font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Explore Fresh Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Title */}
      <div className="mb-8">
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F3D2E] hover:underline mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Continue Shopping
        </Link>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-stone-900">
          1-Click Express Checkout
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-1">
          No account or password required. Enter your Name, Phone & Full
          Address to confirm your order immediately.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-500 hover:text-red-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmitOrder}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Left 7 Columns: Customer Delivery Details & Payment Choice */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Delivery Zone Selector (Inside Dhaka vs Outside Dhaka) */}
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-7 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-stone-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0F3D2E] text-white text-xs flex items-center justify-center">
                  1
                </span>
                Select Home Delivery Area
              </h2>
              <span className="text-xs font-semibold text-emerald-700">
                Free over ৳{settings.freeDeliveryThreshold.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => handleZoneChange("inside_dhaka")}
                className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer flex items-center justify-between ${
                  deliveryZone === "inside_dhaka"
                    ? "border-[#0F3D2E] bg-emerald-50/60"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div>
                  <p className="text-sm font-extrabold text-stone-900">
                    Inside Dhaka City
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Express Chilled Home Delivery
                  </p>
                </div>
                <span className="text-lg font-extrabold text-[#0F3D2E]">
                  ৳{settings.insideDhakaFee}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleZoneChange("outside_dhaka")}
                className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer flex items-center justify-between ${
                  deliveryZone === "outside_dhaka"
                    ? "border-[#0F3D2E] bg-emerald-50/60"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div>
                  <p className="text-sm font-extrabold text-stone-900">
                    Outside Dhaka (Nationwide)
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Insulated Thermal Box Delivery
                  </p>
                </div>
                <span className="text-lg font-extrabold text-[#0F3D2E]">
                  ৳{settings.outsideDhakaFee}
                </span>
              </button>
            </div>
          </div>

          {/* Step 2: Customer Name, Phone & Full Address */}
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-7 shadow-2xs space-y-4">
            <h2 className="text-base sm:text-lg font-extrabold text-stone-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0F3D2E] text-white text-xs flex items-center justify-center">
                2
              </span>
              Delivery Recipient Information
            </h2>

            {/* Honeypot anti-bot field (hidden from real humans) */}
            <input
              type="text"
              name="websiteHoneypot"
              value={websiteHoneypot}
              onChange={(e) => setWebsiteHoneypot(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Your Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g., Tanvir Ahmed"
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-[#0F3D2E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Mobile Number (11 Digits) *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g., 01713477780"
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-[#0F3D2E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                District / Area *
              </label>
              <input
                type="text"
                required
                value={customerDistrict}
                onChange={(e) => setCustomerDistrict(e.target.value)}
                placeholder={
                  deliveryZone === "inside_dhaka"
                    ? "e.g., Dhanmondi / Uttara / Mirpur, Dhaka"
                    : "e.g., Bogura Sadar / Chattogram / Rajshahi / Sylhet"
                }
                className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-[#0F3D2E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Full Home Delivery Address (House, Road, Block, Landmark) *
              </label>
              <textarea
                rows={3}
                required
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Enter your complete address so our rider can deliver smoothly..."
                className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-[#0F3D2E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Special Note for Fish Cutting / Delivery Time (Optional)
              </label>
              <input
                type="text"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="e.g., Please call before arriving, cut fish medium size..."
                className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-[#0F3D2E]"
              />
            </div>
          </div>

          {/* Step 3: Official Merchant Payment Gateway Selection (bKash / Nagad / COD + SSLCommerz On Hold) */}
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-7 shadow-2xs space-y-5">
            <h2 className="text-base sm:text-lg font-extrabold text-stone-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0F3D2E] text-white text-xs flex items-center justify-center">
                3
              </span>
              Select Payment Method
            </h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {/* bKash Merchant */}
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("bkash");
                  if (paymentPlan === "cod") setPaymentPlan("full");
                }}
                className={`p-2.5 sm:p-4 rounded-2xl border-2 text-left transition cursor-pointer space-y-1 sm:space-y-1.5 ${
                  paymentMethod === "bkash"
                    ? "border-pink-600 bg-pink-50/60 shadow-xs"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-[#E2136E] text-white text-[9px] sm:text-[10px] font-extrabold uppercase">
                    Merchant PGW
                  </span>
                  <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E2136E]" />
                </div>
                <p className="text-xs font-bold text-stone-900">
                  bKash (বিকাশ)
                </p>
                <p className="text-[10px] sm:text-[11px] text-stone-600 font-semibold truncate">
                  অফিসিয়াল টোকেনাইজড পেমেন্ট
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone-400 truncate">
                  অটোমেটিক সার্ভার ভেরিফাইড
                </p>
              </button>

              {/* Nagad Merchant */}
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("nagad");
                  if (paymentPlan === "cod") setPaymentPlan("full");
                }}
                className={`p-2.5 sm:p-4 rounded-2xl border-2 text-left transition cursor-pointer space-y-1 sm:space-y-1.5 ${
                  paymentMethod === "nagad"
                    ? "border-orange-500 bg-orange-50/60 shadow-xs"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-[#F7931E] text-white text-[9px] sm:text-[10px] font-extrabold uppercase">
                    Merchant PGW
                  </span>
                  <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F7931E]" />
                </div>
                <p className="text-xs font-bold text-stone-900">
                  Nagad (নগদ)
                </p>
                <p className="text-[10px] sm:text-[11px] text-stone-600 font-semibold truncate">
                  অফিসিয়াল মার্চেন্ট গেটওয়ে
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone-400 truncate">
                  RSA ক্রিপ্টোগ্রাফিক ভেরিফাইড
                </p>
              </button>

              {/* Cash on Delivery */}
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("cod");
                  setPaymentPlan("cod");
                }}
                className={`p-2.5 sm:p-4 rounded-2xl border-2 text-left transition cursor-pointer space-y-1 sm:space-y-1.5 ${
                  paymentMethod === "cod"
                    ? "border-[#0F3D2E] bg-emerald-50/60 shadow-xs"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-[#0F3D2E] text-white text-[9px] sm:text-[10px] font-extrabold uppercase">
                    COD
                  </span>
                  <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0F3D2E]" />
                </div>
                <p className="text-xs font-bold text-stone-900">
                  Cash on Delivery
                </p>
                <p className="text-[10px] sm:text-[11px] text-stone-500 truncate">
                  ডেলিভারিতে ক্যাশ পেমেন্ট
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone-400 truncate">
                  পণ্য বুঝে পেয়ে মূল্য পরিশোধ
                </p>
              </button>

              {/* SSLCommerz (Kept On Hold as requested) */}
              <div
                aria-disabled="true"
                title="SSLCommerz Card Gateway is currently on hold"
                className="p-2.5 sm:p-4 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/70 text-left opacity-60 cursor-not-allowed space-y-1 sm:space-y-1.5 select-none"
              >
                <div className="flex items-center justify-between">
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-stone-400 text-white text-[9px] sm:text-[10px] font-extrabold uppercase">
                    On Hold
                  </span>
                  <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                </div>
                <p className="text-xs font-bold text-stone-500">
                  SSLCommerz
                </p>
                <p className="text-[10px] sm:text-[11px] text-stone-400 truncate">
                  Visa / Master Cards
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone-400 truncate">
                  সাময়িকভাবে স্থগিত (On Hold)
                </p>
              </div>
            </div>

            {paymentMethod !== "cod" && (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-stone-600 block">
                  Choose Online Payment Plan:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentPlan("full")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                      paymentPlan === "full"
                        ? "border-2 border-[#0F3D2E] bg-white shadow-2xs"
                        : "border-stone-200 bg-white/60"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-extrabold text-stone-900">
                        Pay Full Amount Now (100%)
                      </p>
                      <p className="text-[11px] text-stone-500">
                        Zero cash hassle on delivery day
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-[#0F3D2E]">
                      ৳{totalAmount.toLocaleString()}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentPlan("advance")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                      paymentPlan === "advance"
                        ? "border-2 border-[#C83E2B] bg-white shadow-2xs"
                        : "border-stone-200 bg-white/60"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-extrabold text-stone-900">
                        Pay {settings.preorderAdvancePercent}% Pre-Order Advance
                      </p>
                      <p className="text-[11px] text-stone-500">
                        Rest ৳{(totalAmount - advanceAmount).toLocaleString()}{" "}
                        on Home Delivery
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-[#C83E2B]">
                      ৳{advanceAmount.toLocaleString()}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Order Summary, Promo Code Engine & 1-Click Submit */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-7 shadow-sm space-y-6 sticky top-24">
          <h2 className="text-lg font-extrabold text-stone-900 border-b border-stone-100 pb-3">
            Order Summary ({cart.length} Items)
          </h2>

          {/* Items */}
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {cart.map((item) => (
              <div
                key={item.cartItemId}
                className="flex items-center gap-3 pb-3 border-b border-stone-100 last:border-b-0"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-14 h-14 rounded-xl object-contain bg-stone-950 p-0.5 border border-stone-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-[#0F3D2E]">
                    {item.titleBn}
                  </p>
                  <p className="text-xs font-bold text-stone-900 truncate">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    {item.variantLabel} × {item.quantity}
                    {item.cuttingPreference
                      ? ` • ${item.cuttingPreference}`
                      : ""}
                  </p>
                </div>
                <span className="text-xs font-extrabold text-stone-900">
                  ৳{(item.unitPrice * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Server-Validated Promo / Coupon Code Input */}
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200/90 space-y-2.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#C83E2B]" />
              Have a Promo / Discount Code?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="e.g. SADHYER100 or FAMILYBOX8"
                className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-xs font-mono uppercase focus:outline-none focus:border-[#0F3D2E]"
              />
              <button
                type="button"
                onClick={() => handleApplyCoupon()}
                className="px-4 py-2 rounded-xl bg-[#0F3D2E] hover:bg-[#165b44] text-white text-xs font-extrabold transition cursor-pointer"
              >
                Apply
              </button>
            </div>

            {/* Quick Clickable Available Coupons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {coupons
                .filter((c) => c.isActive)
                .map((coup) => {
                  const isApplied = appliedCoupon?.code === coup.code;
                  return (
                    <button
                      key={coup.id}
                      type="button"
                      onClick={() => handleApplyCoupon(coup.code)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                        isApplied
                          ? "bg-emerald-700 text-white"
                          : "bg-stone-200/80 text-stone-700 hover:bg-stone-300"
                      }`}
                      title={coup.title}
                    >
                      {coup.code} (Min ৳{coup.minOrderAmount})
                    </button>
                  );
                })}
            </div>

            {appliedCoupon && discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 bg-emerald-100/80 px-3 py-1.5 rounded-xl">
                <span>
                  ✓ Promo {appliedCoupon.code} Applied (-৳{discountAmount})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCouponCode("");
                    setCouponInput("");
                  }}
                  className="text-stone-500 hover:text-red-600 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Pricing Breakdown */}
          <div className="space-y-2.5 pt-3 border-t border-stone-200 text-xs sm:text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Products Subtotal</span>
              <span className="font-bold text-stone-900">
                ৳{cartSubtotal.toLocaleString()}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Promo Discount ({appliedCoupon?.code})</span>
                <span>- ৳{discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-stone-600">
              <span>
                Home Delivery (
                {deliveryZone === "inside_dhaka"
                  ? "Inside Dhaka"
                  : "Outside Dhaka"}
                )
              </span>
              <span className="font-bold text-stone-900">
                {deliveryCharge === 0 ? (
                  <span className="text-emerald-700 font-extrabold">FREE</span>
                ) : (
                  `৳${deliveryCharge}`
                )}
              </span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-stone-900 pt-2 border-t border-stone-200">
              <span>Total Payable Bill</span>
              <span className="text-xl text-[#0F3D2E]">
                ৳{totalAmount.toLocaleString()}
              </span>
            </div>

            {paymentMethod !== "cod" && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1 text-xs">
                <div className="flex justify-between font-bold text-[#0F3D2E]">
                  <span>
                    Pay Now via{" "}
                    {paymentMethod === "bkash"
                      ? "bKash Merchant"
                      : "Nagad Merchant"}
                    :
                  </span>
                  <span>৳{payableOnlineNow.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Due on Home Delivery:</span>
                  <span className="font-bold">
                    ৳{dueOnDelivery.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Cloudflare Turnstile Bot Protection Widget */}
          {TURNSTILE_SITE_KEY && (
            <div className="flex justify-center pt-1">
              <div ref={turnstileContainerRef} />
            </div>
          )}

          {/* Sticky Error Notice right above Submit Button */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-bold flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-red-500 hover:text-red-800 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 rounded-2xl bg-[#C83E2B] hover:bg-[#ad3221] disabled:opacity-60 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-red-950/15 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Securing Order on Server...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 fill-current" />
                <span>
                  {paymentMethod === "cod"
                    ? `Confirm 1-Click Order (৳${totalAmount.toLocaleString()})`
                    : `Pay ৳${payableOnlineNow.toLocaleString()} via ${
                        paymentMethod === "bkash" ? "bKash" : "Nagad"
                      }`}
                </span>
              </>
            )}
          </button>

          <div className="text-[11px] text-stone-500 space-y-1.5 pt-1">
            <p className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              Zero-Client-Trust Server Price & Coupon Verification Active
            </p>
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              Official bKash & Nagad Merchant Server-to-Server Verification
            </p>
          </div>
        </div>
      </form>

      {/* Official bKash / Nagad Hosted Checkout Redirection Overlay */}
      {redirectingGateway && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-7 sm:p-9 max-w-md w-full shadow-2xl text-center space-y-4 border border-stone-200">
            <div
              className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-inner ${
                redirectingGateway === "bkash"
                  ? "bg-pink-50 text-[#E2136E]"
                  : "bg-orange-50 text-[#F7931E]"
              }`}
            >
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-extrabold text-stone-900">
                {redirectingGateway === "bkash"
                  ? "bKash অফিসিয়াল পেমেন্ট গেটওয়েতে নিয়ে যাওয়া হচ্ছে..."
                  : "Nagad অফিসিয়াল পেমেন্ট গেটওয়েতে নিয়ে যাওয়া হচ্ছে..."}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                অনুগ্রহ করে অপেক্ষা করুন। আপনাকে সরাসরি{" "}
                {redirectingGateway === "bkash" ? "বিকাশ" : "নগদ"}-এর সুরক্ষিত
                মার্চেন্ট পেমেন্ট পেজে রিডাইরেক্ট করা হচ্ছে।
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold">
              <Lock className="w-3.5 h-3.5 text-emerald-700" />
              <span>Zero-Client-Trust Server-to-Server Payment</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
