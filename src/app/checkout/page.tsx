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
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { DeliveryZone, Order, PaymentMethod, PaymentPlan } from "@/types";
import { calculateCouponDiscount } from "@/lib/security";

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

  // Submission & Gateway Modal State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingGatewayOrder, setPendingGatewayOrder] = useState<{
    order: Order;
    payableNow: number;
  } | null>(null);
  const [gatewayPhone, setGatewayPhone] = useState("01713477780");
  const [gatewayOtp, setGatewayOtp] = useState("482910");
  const [verifyingPayment, setVerifyingPayment] = useState(false);

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

    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          deliveryZone,
          customerDistrict:
            customerDistrict ||
            (deliveryZone === "inside_dhaka" ? "Dhaka" : "Outside Dhaka"),
          customerAddress,
          customerNote,
          couponCode: appliedCoupon?.code || undefined,
          paymentMethod,
          paymentPlan: paymentMethod === "cod" ? "cod" : paymentPlan,
          websiteHoneypot,
          items: cart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            cuttingPreference: item.cuttingPreference,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not place order");
      }

      const createdOrder: Order = data.order;

      if (data.gatewayRequired && data.payableNow > 0) {
        setGatewayPhone(customerPhone);
        setPendingGatewayOrder({
          order: createdOrder,
          payableNow: data.payableNow,
        });
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

    setVerifyingPayment(true);
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: pendingGatewayOrder.order.orderCode,
          gateway:
            pendingGatewayOrder.order.paymentMethod === "bkash"
              ? "bkash"
              : "sslcommerz",
          amount: pendingGatewayOrder.payableNow,
          senderPhone: gatewayPhone,
          gatewayToken: gatewayOtp || "VERIFIED-TOKEN",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Payment verification failed");
      }

      const verifiedOrder: Order = data.order || {
        ...pendingGatewayOrder.order,
        advancePaid: pendingGatewayOrder.payableNow,
        dueAmount: Math.max(
          0,
          pendingGatewayOrder.order.totalAmount - pendingGatewayOrder.payableNow
        ),
        paymentStatus:
          pendingGatewayOrder.payableNow >=
          pendingGatewayOrder.order.totalAmount
            ? "paid"
            : "advance_paid",
        orderStatus: "confirmed",
        transactionId: data.transactionId,
      };

      registerNewOrder(verifiedOrder, data.transaction);
      clearCart();
      router.push(
        `/track-order?code=${encodeURIComponent(
          verifiedOrder.orderCode
        )}&justOrdered=1`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gateway verification error"
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("bkash");
                  if (paymentPlan === "cod") setPaymentPlan("full");
                }}
                className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer space-y-1.5 ${
                  paymentMethod === "bkash"
                    ? "border-pink-600 bg-pink-50/50"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-pink-600 text-white text-xs font-extrabold">
                    bKash AutoPay
                  </span>
                  <Smartphone className="w-4 h-4 text-pink-600" />
                </div>
                <p className="text-xs font-bold text-stone-900">
                  Instant bKash Checkout
                </p>
                <p className="text-[11px] text-stone-500">
                  Automated tokenized popup verification
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("sslcommerz");
                  if (paymentPlan === "cod") setPaymentPlan("full");
                }}
                className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer space-y-1.5 ${
                  paymentMethod === "sslcommerz"
                    ? "border-blue-600 bg-blue-50/50"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-xs font-extrabold">
                    SSLCommerz
                  </span>
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xs font-bold text-stone-900">
                  bKash, Nagad, Rocket & Cards
                </p>
                <p className="text-[11px] text-stone-500">
                  All BD mobile banking & Visa/Mastercard
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("cod");
                  setPaymentPlan("cod");
                }}
                className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer space-y-1.5 ${
                  paymentMethod === "cod"
                    ? "border-[#0F3D2E] bg-emerald-50/50"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#0F3D2E] text-white text-xs font-extrabold">
                    Cash on Delivery
                  </span>
                  <Banknote className="w-4 h-4 text-[#0F3D2E]" />
                </div>
                <p className="text-xs font-bold text-stone-900">
                  Pay at Your Doorstep
                </p>
                <p className="text-[11px] text-stone-500">
                  Pay cash when receiving fresh items
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
                  className="w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0"
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
                    {paymentMethod === "bkash" ? "bKash" : "SSLCommerz"}:
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

      {/* AUTOMATED BKASH / SSLCOMMERZ GATEWAY CHECKOUT MODAL */}
      {pendingGatewayOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl bg-white border border-stone-200">
            <div
              className={`p-6 text-white ${
                pendingGatewayOrder.order.paymentMethod === "bkash"
                  ? "bg-[#E2136E]"
                  : "bg-[#1A4B8C]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-widest font-bold opacity-85">
                    {pendingGatewayOrder.order.paymentMethod === "bkash"
                      ? "bKash Tokenized Checkout"
                      : "SSLCommerz Secure Gateway"}
                  </span>
                  <h3 className="text-xl font-extrabold mt-0.5">
                    Sadyer Bazar (সাধ্যের বাজার)
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs opacity-85 block">Payable Now</span>
                  <strong className="text-2xl font-black">
                    ৳{pendingGatewayOrder.payableNow.toLocaleString()}
                  </strong>
                </div>
              </div>
              <p className="text-xs mt-2 opacity-90 font-mono">
                Order ID: {pendingGatewayOrder.order.orderCode}
              </p>
            </div>

            <form
              onSubmit={handleCompleteGatewayPayment}
              className="p-6 space-y-4"
            >
              {pendingGatewayOrder.order.paymentMethod === "sslcommerz" && (
                <div className="flex items-center gap-2 pb-2 border-b border-stone-100 text-xs font-bold text-stone-600">
                  <span className="px-2.5 py-1 rounded bg-pink-100 text-pink-700">
                    bKash
                  </span>
                  <span className="px-2.5 py-1 rounded bg-orange-100 text-orange-700">
                    Nagad
                  </span>
                  <span className="px-2.5 py-1 rounded bg-purple-100 text-purple-700">
                    Rocket
                  </span>
                  <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-700">
                    Visa / Master
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Your bKash / Mobile Wallet Account Number
                </label>
                <input
                  type="tel"
                  required
                  value={gatewayPhone}
                  onChange={(e) => setGatewayPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  One-Time Verification Code (Sandbox Auto-Filled)
                </label>
                <input
                  type="text"
                  required
                  value={gatewayOtp}
                  onChange={(e) => setGatewayOtp(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm font-mono tracking-widest focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-stone-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Server-to-Server IPN validation will automatically verify and
                  update your Order Ledger.
                </span>
              </div>

              <button
                type="submit"
                disabled={verifyingPayment}
                className={`w-full py-3.5 px-5 rounded-2xl text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                  pendingGatewayOrder.order.paymentMethod === "bkash"
                    ? "bg-[#E2136E] hover:bg-[#c40f5e]"
                    : "bg-[#1A4B8C] hover:bg-[#133869]"
                }`}
              >
                {verifyingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Transaction with Gateway...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>
                      Authorize & Pay ৳
                      {pendingGatewayOrder.payableNow.toLocaleString()}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
