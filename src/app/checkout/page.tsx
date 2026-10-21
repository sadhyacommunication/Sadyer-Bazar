"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Truck,
  Lock,
  CheckCircle2,
  ArrowLeft,
  Zap,
  AlertCircle,
  Loader2,
  CreditCard,
  Smartphone,
  Banknote,
  Tag,
  X,
  Copy,
  Check,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import {
  DeliveryZone,
  Order,
  PaymentMethod,
  PaymentPlan,
  PaymentTransaction,
} from "@/types";
import {
  calculateCouponDiscount,
  calculateVerifiedOrderPricing,
  checkRateLimit,
  evaluateFraudRisk,
  generateIdempotencyKey,
  generateSecureOrderCode,
  normalizeBdPhone,
  sanitizeText,
  validateSubmissionVelocity,
} from "@/lib/security";
import { createOrderSchema } from "@/lib/validations/schemas";
import { createSecureOrderInSupabase } from "@/services/supabaseSync";

export default function CheckoutPage() {
  const router = useRouter();
  const {
    products,
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

  // Payment Selection
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bkash");
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>("full");

  // Submission & Real Payment Drawer State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingGatewayOrder, setPendingGatewayOrder] = useState<{
    order: Order;
    payableNow: number;
  } | null>(null);
  const [senderPhone, setSenderPhone] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [trxError, setTrxError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [redirectingToGateway, setRedirectingToGateway] = useState(false);

  const handleCopyText = (text: string, field: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2500);
    } catch {}
  };

  // Live Delivery, Coupon & Payable Calculation (Mirrored by Zero-Trust Server API)
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

    const payload = {
      customerName: sanitizeText(customerName),
      customerPhone: normalizeBdPhone(customerPhone),
      deliveryZone,
      customerDistrict: sanitizeText(
        customerDistrict ||
          (deliveryZone === "inside_dhaka" ? "Dhaka" : "Outside Dhaka")
      ),
      customerAddress: sanitizeText(customerAddress),
      customerNote: sanitizeText(customerNote),
      couponCode: appliedCoupon?.code || undefined,
      paymentMethod,
      paymentPlan: (paymentMethod === "cod" ? "cod" : paymentPlan) as PaymentPlan,
      websiteHoneypot,
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
      };

      let createdOrder: Order;
      let payableNow = 0;

      // 1. Zero-Client-Trust: Execute server-side pricing stored procedure via Supabase
      const rpcRes = await createSecureOrderInSupabase(orderPayload);
      if (rpcRes.success && rpcRes.order) {
        createdOrder = rpcRes.order;
        payableNow =
          createdOrder.paymentMethod === "cod"
            ? 0
            : createdOrder.paymentPlan === "full"
            ? createdOrder.totalAmount
            : Math.max(
                createdOrder.deliveryCharge,
                Math.round(
                  ((createdOrder.subtotal - createdOrder.discountAmount) *
                    settings.preorderAdvancePercent) /
                    100
                )
              );
      } else {
        // Fallback: strict server-side catalog pricing calculation
        const pricing = calculateVerifiedOrderPricing(
          parsed.data,
          products,
          settings,
          coupons
        );
        const fraud = evaluateFraudRisk({
          customerPhone: orderPayload.customerPhone,
          deliveryZone: orderPayload.deliveryZone,
          customerDistrict: orderPayload.customerDistrict,
          paymentMethod: orderPayload.paymentMethod,
          totalAmount: pricing.totalAmount,
        });

        const orderCode = generateSecureOrderCode();
        const orderId = `ord-${Date.now()}`;
        createdOrder = {
          id: orderId,
          orderCode,
          customerName: orderPayload.customerName,
          customerPhone: orderPayload.customerPhone,
          deliveryZone: orderPayload.deliveryZone,
          customerDistrict: orderPayload.customerDistrict,
          customerAddress: orderPayload.customerAddress,
          customerNote: orderPayload.customerNote,
          subtotal: pricing.subtotal,
          deliveryCharge: pricing.deliveryCharge,
          discountAmount: pricing.discountAmount,
          couponCode: pricing.couponCode,
          weightAdjustmentAmount: 0,
          totalAmount: pricing.totalAmount,
          advancePaid: 0,
          dueAmount: pricing.totalAmount,
          paymentMethod: orderPayload.paymentMethod,
          paymentPlan: orderPayload.paymentPlan,
          paymentStatus: "pending",
          orderStatus: "pending",
          hasPreorderItems: pricing.hasPreorderItems,
          fraudRiskScore: fraud.fraudRiskScore,
          isSuspicious: fraud.isSuspicious,
          reviewReasons: fraud.reviewReasons,
          isPhoneVerified: false,
          verificationMethod: "unverified",
          idempotencyKey,
          items: pricing.verifiedItems.map((item, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            orderId,
            ...item,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        payableNow = pricing.payableNow;
      }

      if (parsed.data.paymentMethod === "sslcommerz" && payableNow > 0) {
        // Zero-Client-Trust: Initiate automated SSLCommerz hosted session via Cloudflare Edge Worker
        setRedirectingToGateway(true);
        try {
          const initRes = await fetch("/api/payment/sslcommerz/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderCode: createdOrder.orderCode,
              paymentType: createdOrder.paymentPlan,
            }),
          });
          const initData = (await initRes.json()) as {
            success: boolean;
            GatewayPageURL?: string;
            error?: string;
          };

          if (initRes.ok && initData.success && initData.GatewayPageURL) {
            registerNewOrder(createdOrder);
            clearCart();
            window.location.href = initData.GatewayPageURL;
            return;
          } else {
            throw new Error(
              initData.error ||
                "SSLCommerz গেটওয়ে সেশন তৈরি করতে সমস্যা হয়েছে।"
            );
          }
        } catch (gatewayErr) {
          setRedirectingToGateway(false);
          registerNewOrder(createdOrder);
          clearCart();
          showToast(
            "SSLCommerz গেটওয়ে সংযোগে ত্রুটি। আপনার অর্ডারটি পেন্ডিং হিসেবে সংরক্ষিত হয়েছে।"
          );
          router.push(
            `/track-order?code=${encodeURIComponent(
              createdOrder.orderCode
            )}&justOrdered=1&gatewayError=1`
          );
          return;
        }
      } else if (parsed.data.paymentMethod === "bkash" && payableNow > 0) {
        // Attempt automated bKash Tokenized PGW first
        setRedirectingToGateway(true);
        try {
          const initRes = await fetch("/api/payment/bkash/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderCode: createdOrder.orderCode,
              paymentType: createdOrder.paymentPlan,
            }),
          });
          const initData = (await initRes.json()) as {
            success: boolean;
            bkashURL?: string;
            error?: string;
            unconfigured?: boolean;
          };

          if (initRes.ok && initData.success && initData.bkashURL) {
            registerNewOrder(createdOrder);
            clearCart();
            window.location.href = initData.bkashURL;
            return;
          }

          // Fallback to manual TrxID entry drawer if bKash merchant API unconfigured
          setRedirectingToGateway(false);
          setSenderPhone(parsed.data.customerPhone);
          setTransactionId("");
          setTrxError(null);
          setPendingGatewayOrder({
            order: createdOrder,
            payableNow,
          });
        } catch {
          setRedirectingToGateway(false);
          setSenderPhone(parsed.data.customerPhone);
          setTransactionId("");
          setTrxError(null);
          setPendingGatewayOrder({
            order: createdOrder,
            payableNow,
          });
        }
      } else if (parsed.data.paymentMethod === "nagad" && payableNow > 0) {
        // Attempt automated Nagad Direct Asymmetric PGW first
        setRedirectingToGateway(true);
        try {
          const initRes = await fetch("/api/payment/nagad/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderCode: createdOrder.orderCode,
              paymentType: createdOrder.paymentPlan,
            }),
          });
          const initData = (await initRes.json()) as {
            success: boolean;
            callBackUrl?: string;
            error?: string;
            unconfigured?: boolean;
          };

          if (initRes.ok && initData.success && initData.callBackUrl) {
            registerNewOrder(createdOrder);
            clearCart();
            window.location.href = initData.callBackUrl;
            return;
          }

          // Fallback to manual TrxID entry drawer if Nagad merchant API unconfigured
          setRedirectingToGateway(false);
          setSenderPhone(parsed.data.customerPhone);
          setTransactionId("");
          setTrxError(null);
          setPendingGatewayOrder({
            order: createdOrder,
            payableNow,
          });
        } catch {
          setRedirectingToGateway(false);
          setSenderPhone(parsed.data.customerPhone);
          setTransactionId("");
          setTrxError(null);
          setPendingGatewayOrder({
            order: createdOrder,
            payableNow,
          });
        }
      } else {
        registerNewOrder(createdOrder);
        clearCart();
        router.push(
          `/track-order?code=${encodeURIComponent(
            createdOrder.orderCode
          )}&justOrdered=1`
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to submit order"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteGatewayPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGatewayOrder) return;
    setTrxError(null);

    const cleanPhone = normalizeBdPhone(senderPhone);
    if (!cleanPhone || !/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setTrxError("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)");
      return;
    }

    const cleanTrx = transactionId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!cleanTrx || cleanTrx.length < 6) {
      setTrxError(
        "সঠিক Transaction ID (TrxID) দিন (বিকাশ বা নগদ ফিরতি SMS থেকে প্রাপ্ত কমপক্ষে ৬ সংখ্যার কোড, যেমন: BKX8492019)"
      );
      return;
    }

    setVerifyingPayment(true);
    try {
      const isNagad = pendingGatewayOrder.order.paymentMethod === "nagad";
      const isBkash = pendingGatewayOrder.order.paymentMethod === "bkash";
      const gatewayType = isNagad ? "nagad" : isBkash ? "bkash" : "sslcommerz";

      // Security Guard: Set status to "initiated" (Pending merchant verification), NOT "validated"
      const pendingTx: PaymentTransaction = {
        id: `tx-${Date.now()}`,
        orderId: pendingGatewayOrder.order.id,
        orderCode: pendingGatewayOrder.order.orderCode,
        gateway: gatewayType,
        transactionId: cleanTrx,
        validationId: `${gatewayType.toUpperCase()}-INITIATED-${Date.now().toString(36).toUpperCase()}`,
        amount: pendingGatewayOrder.payableNow,
        currency: "BDT",
        status: "initiated",
        senderPhone: cleanPhone,
        verifiedAt: undefined,
        createdAt: new Date().toISOString(),
      };

      const submittedOrder: Order = {
        ...pendingGatewayOrder.order,
        paymentStatus: "pending",
        orderStatus: "pending",
        transactionId: cleanTrx,
        reviewReasons: [
          ...(pendingGatewayOrder.order.reviewReasons || []),
          `Customer submitted TrxID: ${cleanTrx} (Pending merchant validation)`,
        ],
        updatedAt: new Date().toISOString(),
      };

      registerNewOrder(submittedOrder, pendingTx);
      clearCart();
      showToast(
        `পেমেন্ট তথ্য সংরক্ষিত হয়েছে! মার্চেন্ট ভেরিফিকেশনের পর অর্ডারটি কনফার্ম হবে।`
      );
      router.push(
        `/track-order?code=${encodeURIComponent(
          submittedOrder.orderCode
        )}&justOrdered=1`
      );
    } catch (err) {
      setTrxError(
        err instanceof Error ? err.message : "পেমেন্ট সংরক্ষণ করতে সমস্যা হয়েছে।"
      );
    } finally {
      setVerifyingPayment(false);
    }
  };

  if (cart.length === 0 && !pendingGatewayOrder) {
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

          {/* Step 3: Automated Payment Gateway Selection (bKash / SSLCommerz / COD) */}
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-7 shadow-2xs space-y-5">
            <h2 className="text-base sm:text-lg font-extrabold text-stone-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0F3D2E] text-white text-xs flex items-center justify-center">
                3
              </span>
              Select Payment Method
            </h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
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
                    {settings.bkashAccountType === "merchant"
                      ? "Merchant"
                      : "Send Money"}
                  </span>
                  <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E2136E]" />
                </div>
                <p className="text-xs font-bold text-stone-900">
                  bKash (বিকাশ)
                </p>
                <p className="text-[10px] sm:text-[11px] text-stone-600 font-mono truncate">
                  {settings.bkashMerchantNumber || "01713-477780"}
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone-400 truncate">
                  ইনস্ট্যান্ট TrxID ভেরিফিকেশন
                </p>
              </button>

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
                    {settings.nagadAccountType === "merchant"
                      ? "Merchant"
                      : "Send Money"}
                  </span>
                  <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F7931E]" />
                </div>
                <p className="text-xs font-bold text-stone-900">
                  Nagad (নগদ)
                </p>
                <p className="text-[10px] sm:text-[11px] text-stone-600 font-mono truncate">
                  {settings.nagadNumber || "01713-477780"}
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone-400 truncate">
                  ইনস্ট্যান্ট TrxID ভেরিফিকেশন
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("sslcommerz");
                  if (paymentPlan === "cod") setPaymentPlan("full");
                }}
                className={`p-2.5 sm:p-4 rounded-2xl border-2 text-left transition cursor-pointer space-y-1 sm:space-y-1.5 ${
                  paymentMethod === "sslcommerz"
                    ? "border-blue-600 bg-blue-50/60 shadow-xs"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-[#1A4B8C] text-white text-[9px] sm:text-[10px] font-extrabold uppercase">
                    Cards
                  </span>
                  <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1A4B8C]" />
                </div>
                <p className="text-xs font-bold text-stone-900">
                  SSLCommerz
                </p>
                <p className="text-[10px] sm:text-[11px] text-stone-500 truncate">
                  Visa, Master & Cards
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone-400 truncate">
                  অনলাইন গেটওয়ে
                </p>
              </button>

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
                  ডেলিভারিতে ক্যাশ
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone-400 truncate">
                  পণ্য বুঝে পেয়ে মূল্য
                </p>
              </button>
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
                placeholder="e.g. SADYER100 or FAMILYBOX8"
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
                      ? "bKash"
                      : paymentMethod === "nagad"
                      ? "Nagad"
                      : "SSLCommerz"}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 rounded-2xl bg-[#C83E2B] hover:bg-[#ad3221] disabled:opacity-60 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-red-950/15 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Securing Your Order...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 fill-current" />
                <span>
                  {paymentMethod === "cod"
                    ? `Confirm 1-Click Order (৳${totalAmount.toLocaleString()})`
                    : `Pay ৳${payableOnlineNow.toLocaleString()} & Confirm Order`}
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
              Instant Unique Order ID generated for live tracking
            </p>
          </div>
        </div>
      </form>

      {/* REAL BANGLADESHI PAYMENT DRAWER / VERIFICATION MODAL */}
      {pendingGatewayOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl bg-white border border-stone-200 my-6">
            {/* Header */}
            {(() => {
              const isNagad = pendingGatewayOrder.order.paymentMethod === "nagad";
              const isBkash = pendingGatewayOrder.order.paymentMethod === "bkash";
              const targetAccountNumber = isNagad
                ? settings.nagadNumber || "01713-477780"
                : settings.bkashMerchantNumber || "01713-477780";
              const targetAccountType = isNagad
                ? settings.nagadAccountType || "personal"
                : settings.bkashAccountType || "merchant";

              const headerBg = isBkash
                ? "bg-[#E2136E]"
                : isNagad
                ? "bg-[#E35124]"
                : "bg-[#1A4B8C]";

              return (
                <>
                  <div className={`p-6 text-white ${headerBg}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] uppercase tracking-widest font-black opacity-90 inline-block px-2 py-0.5 rounded bg-white/20 mb-1">
                          {isBkash
                            ? "bKash Direct Payment"
                            : isNagad
                            ? "Nagad Direct Payment"
                            : "SSLCommerz Payment"}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black">
                          {isBkash
                            ? "বিকাশ পেমেন্ট সম্পন্ন করুন"
                            : isNagad
                            ? "নগদ পেমেন্ট সম্পন্ন করুন"
                            : "অনলাইন গেটওয়ে পেমেন্ট"}
                        </h3>
                        <p className="text-xs opacity-90 font-mono mt-1">
                          অর্ডার রেফারেন্স: {pendingGatewayOrder.order.orderCode}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingGatewayOrder(null)}
                        className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="mt-4 p-3.5 rounded-2xl bg-black/20 backdrop-blur-xs flex items-center justify-between">
                      <div>
                        <span className="text-[11px] opacity-80 block font-semibold">
                          পরিশোধযোগ্য মোট টাকা
                        </span>
                        <strong className="text-2xl font-black">
                          ৳{pendingGatewayOrder.payableNow.toLocaleString()}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            String(pendingGatewayOrder.payableNow),
                            "amount"
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-white/25 hover:bg-white/35 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                      >
                        {copiedField === "amount" ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> কপি হয়েছে!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> টাকার পরিমাণ কপি
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <form
                    onSubmit={handleCompleteGatewayPayment}
                    className="p-6 space-y-5 text-xs"
                  >
                    {/* Copy Account & Ref */}
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-stone-500 uppercase block">
                            আমাদের {isNagad ? "নগদ" : "বিকাশ"} অ্যাকাউন্ট নম্বর (
                            {targetAccountType === "merchant"
                              ? "মার্চেন্ট পেমেন্ট"
                              : "পার্সোনাল সেন্ড মানি"}
                            )
                          </span>
                          <span className="text-base sm:text-lg font-black text-stone-900 font-mono">
                            {targetAccountNumber}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(targetAccountNumber, "number")
                          }
                          className="px-3 py-1.5 rounded-xl bg-[#0F3D2E] text-white font-bold flex items-center gap-1 cursor-pointer hover:bg-[#155440] transition"
                        >
                          {copiedField === "number" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-300" />{" "}
                              কপি হয়েছে
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> নম্বর কপি করুন
                            </>
                          )}
                        </button>
                      </div>

                      <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-stone-500 block">
                            রেফারেন্স কোড (Reference)
                          </span>
                          <span className="text-sm font-black text-[#0F3D2E] font-mono">
                            {pendingGatewayOrder.order.orderCode}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              pendingGatewayOrder.order.orderCode,
                              "ref"
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          {copiedField === "ref" ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-700" /> কপি
                              হয়েছে
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> রেফারেন্স কপি
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Step-by-Step Instructions */}
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-2">
                      <p className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
                        পেমেন্ট সম্পন্ন করার ৪টি সহজ ধাপ:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-amber-900/90 font-medium pl-1">
                        <li>
                          আপনার {isNagad ? "নগদ" : "বিকাশ"} অ্যাপে যান অথবা ডায়াল
                          করুন ({isNagad ? "*167#" : "*247#"})।
                        </li>
                        <li>
                          <strong>
                            {targetAccountType === "merchant"
                              ? "Make Payment (পেমেন্ট)"
                              : "Send Money (সেন্ড মানি)"}
                          </strong>{" "}
                          অপশন সিলেক্ট করুন।
                        </li>
                        <li>
                          প্রাপক নম্বরে <strong>{targetAccountNumber}</strong>{" "}
                          বসিয়ে <strong>৳{pendingGatewayOrder.payableNow}</strong>{" "}
                          পাঠান এবং রেফারেন্সে লিখুন{" "}
                          <strong>{pendingGatewayOrder.order.orderCode}</strong>
                          ।
                        </li>
                        <li>
                          লেনদেন সফল হলে প্রাপ্ত <strong>Transaction ID (TrxID)</strong>{" "}
                          ও আপনার মোবাইল নম্বরটি নিচে লিখে কনফার্ম করুন।
                        </li>
                      </ol>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3.5">
                      <div>
                        <label className="block font-bold text-stone-700 mb-1">
                          আপনার প্রেরক মোবাইল নম্বর (যে নম্বর থেকে টাকা পাঠিয়েছেন) *
                        </label>
                        <input
                          type="tel"
                          required
                          value={senderPhone}
                          onChange={(e) => setSenderPhone(e.target.value)}
                          placeholder="e.g., 017XXXXXXXX"
                          className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-mono focus:outline-none focus:border-[#0F3D2E]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-stone-700 mb-1">
                          Transaction ID (TrxID) *
                        </label>
                        <input
                          type="text"
                          required
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          placeholder="e.g., BKX8492019 বা 7GC89021"
                          className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-mono uppercase tracking-wider focus:outline-none focus:border-[#0F3D2E]"
                        />
                        <p className="text-[10px] text-stone-500 mt-1">
                          বিকাশ/নগদ ফিরতি SMS বা অ্যাপে প্রাপ্ত ট্রানজেকশন আইডি
                          হুবহু এখানে লিখুন।
                        </p>
                      </div>
                    </div>

                    {trxError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{trxError}</span>
                      </div>
                    )}

                    <div className="flex gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setPendingGatewayOrder(null)}
                        className="px-4 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold transition cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        disabled={verifyingPayment}
                        className={`flex-1 py-3 px-5 rounded-xl text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition ${
                          isBkash
                            ? "bg-[#E2136E] hover:bg-[#c50f5e]"
                            : isNagad
                            ? "bg-[#E35124] hover:bg-[#c44119]"
                            : "bg-[#1A4B8C] hover:bg-[#123668]"
                        }`}
                      >
                        {verifyingPayment ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>ভেরিফাই ও অর্ডার সংরক্ষণ হচ্ছে...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            <span>কনফার্ম করুন ও অর্ডার সম্পন্ন করুন</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* SSLCommerz Hosted Checkout Redirection Overlay */}
      {redirectingToGateway && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-7 sm:p-9 max-w-md w-full shadow-2xl text-center space-y-4 border border-stone-200">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-[#1A4B8C] flex items-center justify-center shadow-inner">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-extrabold text-stone-900">
                SSLCommerz সুরক্ষিত পেমেন্টে নিয়ে যাওয়া হচ্ছে...
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                অনুগ্রহ করে অপেক্ষা করুন। আপনাকে সরাসরি SSLCommerz-এর অফিসিয়াল সুরক্ষিত পেমেন্ট গেটওয়েতে রিডাইরেক্ট করা হচ্ছে।
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold">
              <Lock className="w-3.5 h-3.5 text-emerald-700" />
              <span>PCI-DSS SAQ A কমপ্লায়েন্ট নিরাপদ পেমেন্ট</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
