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
  QrCode,
  Download,
  Upload,
  CheckCircle2,
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
import {
  buildResilientCodOrder,
  createOrderViaEdgeApi,
} from "@/services/supabaseSync";

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

  // Payment Selection (Active: cod; online gateways bKash, Nagad, SSLCommerz on hold)
  const [paymentMethod, setPaymentMethod] =
    useState<ActiveCheckoutPaymentMethod>("cod");
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>("cod");

  // Submission & Gateway Redirect State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [redirectingGateway, setRedirectingGateway] = useState<
    "bkash" | "nagad" | null
  >(null);

  // Manual Bangla QR Payment Fields
  const [manualPayChannel, setManualPayChannel] = useState<
    "bkash" | "nagad" | "card_bank" | "upay" | "other"
  >("bkash");
  const [manualPaySender, setManualPaySender] = useState("");
  const [manualPayTrxId, setManualPayTrxId] = useState("");
  const [manualPayProofUrl, setManualPayProofUrl] = useState<string | null>(null);
  const [proofFileName, setProofFileName] = useState("");
  const [isCompressingProof, setIsCompressingProof] = useState(false);

  // Client-side Canvas Image Sanitizer & WebP Compressor (Strips EXIF, zero-malware)
  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("অনুগ্রহ করে একটি ছবি ফাইল আপলোড করুন (JPG, PNG, WebP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("ছবি ফাইলের সাইজ ১০ মেগাবাইটের কম হতে হবে।");
      return;
    }

    setIsCompressingProof(true);
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const MAX_DIM = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }

          canvas.width = width;
          canvas.height = height;
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const webpData = canvas.toDataURL("image/webp", 0.82);
            setManualPayProofUrl(webpData);
            setProofFileName(file.name);
          }
        } catch (cErr) {
          console.error("Canvas compression error:", cErr);
        } finally {
          setIsCompressingProof(false);
        }
      };
      img.onerror = () => {
        setIsCompressingProof(false);
        setErrorMsg("ছবিটি লোড করা সম্ভব হয়নি। অনুগ্রহ করে অন্য ছবি নির্বাচন করুন।");
      };
      img.src = loadEvt.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

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

    if (paymentMethod === "qr_pay") {
      const cleanTrx = manualPayTrxId.trim();
      const cleanSender = manualPaySender.trim();
      if (!cleanSender) {
        setErrorMsg("অনুগ্রহ করে যে নম্বর বা অ্যাকাউন্ট থেকে পেমেন্ট করেছেন তা লিখুন (Sender Number/Account)।");
        return;
      }
      if (!cleanTrx) {
        setErrorMsg("অনুগ্রহ করে সফল পেমেন্টের Transaction ID (TrxID) লিখুন।");
        return;
      }
      if (cleanTrx.length < 4) {
        setErrorMsg("অনুগ্রহ করে সঠিক Transaction ID (কমপক্ষে ৪ অক্ষর) লিখুন।");
        return;
      }
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
      paymentPlan: (paymentMethod === "cod" ? "cod" : "full") as PaymentPlan,
      manualPayChannel: paymentMethod === "qr_pay" ? manualPayChannel : undefined,
      manualPaySender: paymentMethod === "qr_pay" ? sanitizeText(manualPaySender) : undefined,
      manualPayTrxId: paymentMethod === "qr_pay" ? sanitizeText(manualPayTrxId.toUpperCase().trim()) : undefined,
      manualPayProofUrl: paymentMethod === "qr_pay" ? (manualPayProofUrl || undefined) : undefined,
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
        manualPayChannel: parsed.data.manualPayChannel,
        manualPaySender: parsed.data.manualPaySender,
        manualPayTrxId: parsed.data.manualPayTrxId,
        manualPayProofUrl: parsed.data.manualPayProofUrl,
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

      // 1. Zero-Client-Trust: Create order on Server via /api/orders/create with Resilient COD Fallback
      const rpcRes = await createOrderViaEdgeApi(orderPayload);
      if (!rpcRes.success || !rpcRes.order) {
        if (parsed.data.paymentMethod === "cod" || parsed.data.paymentMethod === "qr_pay") {
          // Extra safety layer: guarantee Cash on Delivery & QR Pay are never blocked by edge outages
          rpcRes.order = buildResilientCodOrder(orderPayload);
          rpcRes.success = true;
        } else {
          if (window.turnstile && turnstileWidgetIdRef.current) {
            window.turnstile.reset?.(turnstileWidgetIdRef.current);
            setTurnstileToken("");
          }
          const isServiceUnavailable =
            rpcRes.error &&
            (rpcRes.error.toLowerCase().includes("service temporarily unavailable") ||
              rpcRes.error.toLowerCase().includes("service_unavailable") ||
              rpcRes.error.toLowerCase().includes("upstream_error"));

          throw new Error(
            isServiceUnavailable
              ? "অনলাইন পেমেন্ট গেটওয়ে সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে 'Cash on Delivery' (ক্যাশ অন ডেলিভারি) সিলেক্ট করে তাৎক্ষণিকভাবে আপনার অর্ডার নিশ্চিত করুন।"
              : rpcRes.error ||
                "অর্ডার প্রক্রিয়া করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
          );
        }
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
      } else if (parsed.data.paymentMethod === "qr_pay") {
        // Bangla QR Pay with TrxID submitted
        registerNewOrder(createdOrder);
        clearCart();
        showToast("আপনার পেমেন্ট তথ্য সফলভাবে গ্রহণ করা হয়েছে। অ্যাকাউন্ট স্টেটমেন্ট যাচাই শেষে অর্ডার নিশ্চিত করা হবে।");
        router.push(
          `/track-order?code=${encodeURIComponent(
            createdOrder.orderCode
          )}&justOrdered=1&qrSubmitted=1`
        );
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

          {/* Step 3: Payment Method Selection */}
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-7 shadow-2xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-stone-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0F3D2E] text-white text-xs flex items-center justify-center">
                  3
                </span>
                Select Payment Method (পেমেন্ট মাধ্যম)
              </h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                {paymentMethod === "cod" ? "ক্যাশ অন ডেলিভারি সক্রিয়" : "বাংলা কিউআর সক্রিয়"}
              </span>
            </div>

            {/* Active Payment Methods: COD & Bangla QR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Cash on Delivery (Active Primary Method) */}
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("cod");
                  setPaymentPlan("cod");
                }}
                className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer space-y-1.5 relative overflow-hidden ${
                  paymentMethod === "cod"
                    ? "border-[#0F3D2E] bg-emerald-50/70 ring-2 ring-emerald-600/20 shadow-xs"
                    : "border-stone-200 hover:border-stone-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-[#0F3D2E] text-white text-[10px] font-extrabold uppercase">
                    COD • Active
                  </span>
                  <Banknote className="w-5 h-5 text-[#0F3D2E]" />
                </div>
                <p className="text-sm font-extrabold text-stone-900">
                  Cash on Delivery (ক্যাশ অন ডেলিভারি)
                </p>
                <p className="text-xs text-emerald-900 font-bold">
                  পণ্য বুঝে পেয়ে মূল্য পরিশোধ করুন
                </p>
                <p className="text-[11px] text-stone-500">
                  কোনো প্রকার অগ্রিম পেমেন্টের প্রয়োজন নেই (Zero Cash Hassle)
                </p>
              </button>

              {/* 2. Bangla QR Scan & Pay (Active Method) */}
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("qr_pay");
                  setPaymentPlan("full");
                }}
                className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer space-y-1.5 relative overflow-hidden ${
                  paymentMethod === "qr_pay"
                    ? "border-[#0F3D2E] bg-emerald-50/70 ring-2 ring-emerald-600/20 shadow-xs"
                    : "border-stone-200 hover:border-stone-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[10px] font-extrabold uppercase">
                    Scan & Pay • Active
                  </span>
                  <QrCode className="w-5 h-5 text-[#0F3D2E]" />
                </div>
                <p className="text-sm font-extrabold text-stone-900">
                  Bangla QR (বাংলা কিউআর)
                </p>
                <p className="text-xs text-emerald-900 font-bold">
                  বিকাশ, নগদ, কার্ড ও ব্যাংক অ্যাপ
                </p>
                <p className="text-[11px] text-stone-500">
                  QR কোড স্ক্যান করে সরাসরি পেমেন্ট করুন ও TrxID দিন
                </p>
              </button>
            </div>

            {/* Inactive / Maintenance Gateways (bKash, Nagad, SSLCommerz on hold) */}
            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-2">
                <span>অনলাইন অটোমেটেড গেটওয়ে (বর্তমানে সাময়িকভাবে স্থগিত):</span>
                <span className="text-[10px] text-amber-700 uppercase bg-amber-50 px-2 py-0.5 rounded border border-amber-200">On Hold</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-xl bg-white/70 border border-stone-200 text-center opacity-60">
                  <p className="text-[11px] font-bold text-stone-600">bKash Gateway</p>
                  <p className="text-[9px] text-stone-400">স্থগিত (On Hold)</p>
                </div>
                <div className="p-2 rounded-xl bg-white/70 border border-stone-200 text-center opacity-60">
                  <p className="text-[11px] font-bold text-stone-600">Nagad Gateway</p>
                  <p className="text-[9px] text-stone-400">স্থগিত (On Hold)</p>
                </div>
                <div className="p-2 rounded-xl bg-white/70 border border-stone-200 text-center opacity-60">
                  <p className="text-[11px] font-bold text-stone-600">SSLCommerz Cards</p>
                  <p className="text-[9px] text-stone-400">স্থগিত (On Hold)</p>
                </div>
              </div>
            </div>

            {/* Mode-Specific Content: COD Assurance Banner */}
            {paymentMethod === "cod" && (
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-950 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>নিরাপদ ক্যাশ অন ডেলিভারি (Cash on Delivery):</strong> কোনো প্রকার অগ্রিম ছাড়াই নিশ্চিন্তে অর্ডার করুন এবং বাসায় পণ্য ডেলিভারি পেয়ে কোয়ালিটি যাচাই করে রাইডারের কাছে মূল্য পরিশোধ করুন।
                </div>
              </div>
            )}

            {/* Mode-Specific Content: Bangla QR Interactive Scan & Pay Panel */}
            {paymentMethod === "qr_pay" && (
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-stone-50 to-emerald-50/40 border-2 border-[#0F3D2E]/30 space-y-5">
                {/* Header & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-[#0F3D2E] text-white text-[10px] font-extrabold uppercase">
                        Official Bangla QR
                      </span>
                      <span className="text-xs font-bold text-emerald-900">
                        মার্চেন্ট: {settings.qrMerchantName || "SADHYER BAZAR"}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-stone-900 mt-1">
                      যেকোনো অ্যাপ থেকে স্ক্যান করে প্রদেয় বিল পরিশোধ করুন
                    </h3>
                  </div>
                  <div className="bg-emerald-100/90 px-3.5 py-1.5 rounded-xl border border-emerald-300 text-right sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">মোট প্রদেয় বিল</span>
                    <span className="text-lg font-black text-[#0F3D2E]">৳{totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* QR Image & Instructions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* Left: QR Display with Download */}
                  <div className="md:col-span-5 flex flex-col items-center text-center p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
                    <div className="p-2 bg-white rounded-xl border border-stone-100">
                      <img
                        src={settings.qrCodeImageUrl || "/images/payments/sadhyer-bazar-qr.jpg"}
                        alt="Sadhyer Bazar Official Bangla QR"
                        className="w-48 h-48 sm:w-52 sm:h-52 object-contain mx-auto rounded-lg"
                      />
                    </div>
                    <p className="text-[11px] font-bold text-stone-800 mt-2">
                      {settings.qrMerchantName || "SADHYER BAZAR"}
                    </p>
                    <p className="text-[10px] text-stone-500 mb-3">
                      বিকাশ • নগদ • উপায় • ভিসা / মাস্টারকার্ড • ব্যাংক অ্যাপ
                    </p>
                    <a
                      href={settings.qrCodeImageUrl || "/images/payments/sadhyer-bazar-qr.jpg"}
                      download="sadhyer-bazar-qr.jpg"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>কিউআর ছবি ডাউনলোড করুন</span>
                    </a>
                  </div>

                  {/* Right: How to pay steps */}
                  <div className="md:col-span-7 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-700">
                      ৩টি সহজ ধাপে পেমেন্ট সম্পন্ন করুন:
                    </h4>

                    <div className="space-y-2.5 text-xs text-stone-700">
                      <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200/80">
                        <span className="w-5 h-5 rounded-full bg-[#0F3D2E] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">১</span>
                        <div className="leading-snug">
                          <strong>অ্যাপ খুলুন ও স্ক্যান করুন:</strong> বিকাশ, নগদ বা ব্যাংক অ্যাপ (CityTouch, CellFin, EBL ইত্যাদি) ওপেন করে <strong>&ldquo;স্ক্যান QR&rdquo;</strong> অপশন সিলেক্ট করে কোডটি স্ক্যান করুন (মোবাইলে হলে ওপরের বাটন দিয়ে কিউআর ছবি ডাউনলোড করে গ্যালারি থেকে স্ক্যান করুন)।
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200/80">
                        <span className="w-5 h-5 rounded-full bg-[#0F3D2E] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">২</span>
                        <div className="leading-snug">
                          <strong>টাকার পরিমাণ দিন:</strong> প্রদেয় পরিমাণ <strong>৳{totalAmount.toLocaleString()}</strong> লিখে পিন দিয়ে পেমেন্ট সফল করুন।
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200/80">
                        <span className="w-5 h-5 rounded-full bg-[#0F3D2E] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">৩</span>
                        <div className="leading-snug">
                          <strong>TrxID ও তথ্য সাবমিট করুন:</strong> পেমেন্ট সফল হওয়ার পর প্রাপ্ত <strong>Transaction ID (TrxID)</strong> এবং প্রেরক নম্বরটি নিচের ঘরে লিখে অর্ডার কনফার্ম করুন।
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verification Submission Form Fields */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-emerald-600/30 space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <h4 className="text-xs sm:text-sm font-extrabold text-stone-900">
                      পেমেন্ট তথ্য প্রদান করুন (Customer Payment Details)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Channel Selection */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        পেমেন্ট মাধ্যম (Payment Channel) *
                      </label>
                      <select
                        value={manualPayChannel}
                        onChange={(e) => setManualPayChannel(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs font-bold text-stone-800 focus:outline-none focus:border-[#0F3D2E]"
                      >
                        <option value="bkash">bKash (বিকাশ)</option>
                        <option value="nagad">Nagad (নগদ)</option>
                        <option value="card_bank">Visa / Master Card / Bank App</option>
                        <option value="upay">Upay (উপায়)</option>
                        <option value="other">Other (অন্যান্য)</option>
                      </select>
                    </div>

                    {/* Sender Mobile / Account */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-stone-700">
                          প্রেরকের নম্বর / অ্যাকাউন্ট (Sender No.) *
                        </label>
                        {customerPhone && (
                          <button
                            type="button"
                            onClick={() => setManualPaySender(customerPhone)}
                            className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                          >
                            অর্ডার নম্বর ব্যবহার করুন
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        value={manualPaySender}
                        onChange={(e) => setManualPaySender(e.target.value)}
                        placeholder="e.g. 017XXXXXXXX"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium focus:outline-none focus:border-[#0F3D2E]"
                      />
                    </div>

                    {/* Transaction ID */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Transaction ID (TrxID) *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={manualPayTrxId}
                          onChange={(e) => setManualPayTrxId(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                          placeholder="e.g. BL8291X0KP (বিকাশ/নগদ পেমেন্ট মেসেজ বা স্টেটমেন্ট থেকে)"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs font-mono font-bold tracking-wider text-stone-900 focus:outline-none focus:border-[#0F3D2E]"
                        />
                      </div>
                      <p className="text-[10px] text-stone-500 mt-1">
                        সতর্কতা: সঠিক TrxID প্রদান করুন। একই TrxID একাধিক অর্ডারে ব্যবহার করা সম্পূর্ণ নিষিদ্ধ ও সিস্টেম দ্বারা সুরক্ষিত।
                      </p>
                    </div>

                    {/* Optional Proof Screenshot Upload */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        পেমেন্ট স্ক্রিনশট / প্রমাণ (Payment Proof Screenshot - Optional)
                      </label>
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 text-xs font-bold text-stone-700 cursor-pointer transition">
                          <Upload className="w-4 h-4 text-stone-600" />
                          <span>{proofFileName ? "স্ক্রিনশট পরিবর্তন করুন" : "স্ক্রিনশট আপলোড করুন"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProofUpload}
                            className="hidden"
                          />
                        </label>
                        {isCompressingProof && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-800">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>নিরাপত্তা এনকোডিং ও অপ্টিমাইজেশন চলছে...</span>
                          </div>
                        )}
                        {manualPayProofUrl && !isCompressingProof && (
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            <span className="truncate max-w-[200px]">{proofFileName || "Screenshot Attached"}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setManualPayProofUrl(null);
                                setProofFileName("");
                              }}
                              className="text-stone-400 hover:text-red-600 ml-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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

            {paymentMethod === "qr_pay" ? (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1 text-xs">
                <div className="flex justify-between font-bold text-[#0F3D2E]">
                  <span>বাংলা কিউআরে প্রদেয় বিল:</span>
                  <span>৳{totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>পেমেন্ট ভেরিফিকেশন:</span>
                  <span className="font-bold text-amber-700">অ্যাডমিন রিভিউ অপেক্ষমান</span>
                </div>
              </div>
            ) : paymentMethod !== "cod" && (
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
                    : paymentMethod === "qr_pay"
                    ? `পেমেন্ট তথ্য সহ অর্ডার কনফার্ম করুন (৳${totalAmount.toLocaleString()})`
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
              {paymentMethod === "cod"
                ? "100% Secure Cash on Delivery • পণ্য হাতে পেয়ে নিশ্চিন্তে মূল্য পরিশোধ"
                : paymentMethod === "qr_pay"
                ? "Bangla QR পেমেন্ট • অ্যাডমিন অ্যাকাউন্ট স্টেটমেন্ট যাচাই করে অর্ডার নিশ্চিত করবেন"
                : "Official bKash & Nagad Merchant Server-to-Server Verification"}
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
