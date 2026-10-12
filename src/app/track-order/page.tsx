"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PackageSearch,
  CheckCircle2,
  Truck,
  Printer,
  Copy,
  Check,
  PhoneCall,
  Lock,
  Sparkles,
  Scale,
  CreditCard,
  Loader2,
  X,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { Order, OrderStatus, PaymentTransaction } from "@/types";
import { checkRateLimit, maskAddress, maskPhoneNumber } from "@/lib/security";
import { fetchOrderByCodeFromSupabase } from "@/services/supabaseSync";

const STATUS_STEPS: {
  key: OrderStatus;
  label: string;
  labelBn: string;
  desc: string;
}[] = [
  {
    key: "pending",
    label: "Order Placed",
    labelBn: "অর্ডার গৃহীত",
    desc: "Order received in our queue",
  },
  {
    key: "confirmed",
    label: "Confirmed",
    labelBn: "কনফার্মড",
    desc: "Verified & allocated in batch",
  },
  {
    key: "processing",
    label: "Fresh Catch & Packing",
    labelBn: "সংগ্রহ ও প্যাকিং",
    desc: "Weighed & packed in ice box",
  },
  {
    key: "shipped",
    label: "Out for Delivery",
    labelBn: "ডেলিভারির পথে",
    desc: "Dispatched with courier/rider",
  },
  {
    key: "delivered",
    label: "Delivered",
    labelBn: "ডেলিভারি সম্পন্ন",
    desc: "Handed over at doorstep",
  },
];

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";
  const justOrdered = searchParams.get("justOrdered") === "1";

  const {
    findOrderByCode,
    orders,
    settings,
    updateOrderPaymentStatus,
    registerNewOrder,
  } = useStore();

  const [orderCodeInput, setOrderCodeInput] = useState(initialCode);
  const [phoneLast4, setPhoneLast4] = useState("");
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pay Remaining Due Online Modal State
  const [isPayDueModalOpen, setIsPayDueModalOpen] = useState(false);
  const [selectedDueGateway, setSelectedDueGateway] = useState<
    "bkash" | "sslcommerz"
  >("bkash");
  const [walletPhone, setWalletPhone] = useState("01713477780");
  const [walletOtp, setWalletOtp] = useState("583920");
  const [payingDue, setPayingDue] = useState(false);

  useEffect(() => {
    if (initialCode) {
      const found = findOrderByCode(initialCode);
      if (found) {
        setActiveOrder(found);
        setNotFound(false);
      } else {
        fetchOrderByCodeFromSupabase(initialCode)
          .then((liveOrder) => {
            if (liveOrder) {
              setActiveOrder(liveOrder);
              setNotFound(false);
            } else {
              setNotFound(true);
            }
          })
          .catch(() => setNotFound(true));
      }
    }
  }, [initialCode, orders, findOrderByCode]);

  // Keep activeOrder synced when orders update in context
  useEffect(() => {
    if (activeOrder) {
      const updated = findOrderByCode(activeOrder.orderCode);
      if (updated) setActiveOrder(updated);
    }
  }, [orders, activeOrder, findOrderByCode]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = orderCodeInput.trim().toUpperCase();
    if (!clean) return;

    const rl = checkRateLimit(`track_${clean}`, 15, 60_000);
    if (!rl.allowed) return;

    const localMatch = findOrderByCode(clean);
    if (localMatch) {
      setActiveOrder(localMatch);
      setNotFound(false);
      return;
    }

    try {
      const liveOrder = await fetchOrderByCodeFromSupabase(clean);
      if (liveOrder) {
        setActiveOrder(liveOrder);
        setNotFound(false);
      } else {
        setActiveOrder(null);
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    }
  };

  const handlePayRemainingDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || activeOrder.dueAmount <= 0) return;

    setPayingDue(true);
    try {
      const generatedTxId =
        selectedDueGateway === "bkash"
          ? `BKX${Date.now().toString(36).toUpperCase().slice(-7)}`
          : `SSL-${Date.now().toString(36).toUpperCase().slice(-8)}`;

      const dueTx: PaymentTransaction = {
        id: `tx-${Date.now()}`,
        orderId: activeOrder.id,
        orderCode: activeOrder.orderCode,
        gateway: selectedDueGateway,
        transactionId: generatedTxId,
        validationId: walletOtp || "DUE-SETTLEMENT",
        amount: activeOrder.dueAmount,
        currency: "BDT",
        status: "validated",
        senderPhone: walletPhone,
        verifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const settledOrder: Order = {
        ...activeOrder,
        paymentStatus: "paid",
        advancePaid: activeOrder.totalAmount,
        dueAmount: 0,
        transactionId: generatedTxId,
        updatedAt: new Date().toISOString(),
      };

      updateOrderPaymentStatus(
        activeOrder.id,
        "paid",
        activeOrder.totalAmount,
        generatedTxId
      );
      registerNewOrder(settledOrder, dueTx);
      setActiveOrder(settledOrder);
      setIsPayDueModalOpen(false);
    } finally {
      setPayingDue(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentStepIndex = activeOrder
    ? STATUS_STEPS.findIndex((s) => s.key === activeOrder.orderStatus)
    : 0;

  const isPhoneUnlocked =
    justOrdered ||
    (activeOrder &&
      phoneLast4.length === 4 &&
      activeOrder.customerPhone.endsWith(phoneLast4));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Search Box Header */}
      <div className="bg-[#0F3D2E] text-white rounded-3xl p-7 sm:p-10 shadow-xl space-y-6 no-print">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-300">
            <PackageSearch className="w-4 h-4" /> Real-Time Order Tracking
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold">
            Track Your Order by Order ID
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/85 max-w-2xl">
            Enter your non-guessable Order ID (e.g.,{" "}
            <code className="px-2 py-0.5 rounded bg-white/15 font-mono text-amber-300">
              SB-2610-5P9R7
            </code>
            ) to check live harvest, digital scale weight verification, courier
            rider info, and payment ledger.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 sm:grid-cols-12 gap-3"
        >
          <input
            type="text"
            value={orderCodeInput}
            onChange={(e) => setOrderCodeInput(e.target.value.toUpperCase())}
            placeholder="Order ID (e.g. SB-2610-5P9R7)"
            className="sm:col-span-6 px-4 py-3.5 rounded-2xl bg-white text-stone-900 text-sm font-mono uppercase focus:outline-none"
          />
          <input
            type="text"
            maxLength={4}
            value={phoneLast4}
            onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ""))}
            placeholder="Last 4 digits of Phone (Optional for full address)"
            className="sm:col-span-4 px-4 py-3.5 rounded-2xl bg-white/95 text-stone-900 text-xs sm:text-sm focus:outline-none"
          />
          <button
            type="submit"
            className="sm:col-span-2 py-3.5 px-5 rounded-2xl bg-[#C83E2B] hover:bg-[#b03221] text-white font-extrabold text-sm transition cursor-pointer"
          >
            Track Now
          </button>
        </form>

        {/* Demo Quick Links */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-200">
          <span>Quick Demo Order IDs:</span>
          {["SB-2610-8K4M2", "SB-2610-5P9R7", "SB-2610-3W7H4"].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setOrderCodeInput(code);
                const found = findOrderByCode(code);
                if (found) {
                  setActiveOrder(found);
                  setNotFound(false);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 font-mono text-amber-300 font-bold transition cursor-pointer"
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {/* Just Ordered Confirmation Banner */}
      {justOrdered && activeOrder && (
        <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-600/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#0F3D2E] text-amber-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#0F3D2E]">
                Alhamdulillah! Your Order is Confirmed!
              </h2>
              <p className="text-xs sm:text-sm text-stone-700 mt-0.5">
                Save your Order ID{" "}
                <strong className="font-mono text-[#C83E2B]">
                  {activeOrder.orderCode}
                </strong>{" "}
                to track your delivery anytime.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleCopyCode(activeOrder.orderCode)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-xs font-extrabold text-[#0F3D2E] hover:bg-emerald-100 transition cursor-pointer self-start sm:self-center"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" /> Copied Order ID!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy Order ID
              </>
            )}
          </button>
        </div>
      )}

      {/* Not Found State */}
      {notFound && (
        <div className="bg-white rounded-3xl border border-stone-200 p-10 text-center space-y-3">
          <h3 className="text-lg font-bold text-stone-900">
            No Order Found for &ldquo;{orderCodeInput}&rdquo;
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Please verify that your Order ID matches the format{" "}
            <code className="font-mono font-bold">SB-YYMM-XXXXX</code> or call
            our hotline at {settings.supportPhone}.
          </p>
        </div>
      )}

      {/* Active Order Tracking Card & Printable Invoice */}
      {activeOrder && (
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-sm overflow-hidden">
          {/* Top Invoice Header */}
          <div className="p-6 sm:p-8 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F3D2E]">
                  Official Order & Delivery Receipt
                </span>
                {activeOrder.hasPreorderItems && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                    Pre-Order Batch
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <h2 className="text-2xl sm:text-3xl font-black font-mono text-stone-900">
                  {activeOrder.orderCode}
                </h2>
                <button
                  onClick={() => handleCopyCode(activeOrder.orderCode)}
                  className="p-1.5 rounded-lg bg-stone-200/70 hover:bg-stone-300 text-stone-700 no-print cursor-pointer"
                  title="Copy Order ID"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Ordered on{" "}
                {new Date(activeOrder.createdAt).toLocaleString("en-BD", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>

            <div className="flex items-center gap-3 no-print">
              {activeOrder.dueAmount > 0 && (
                <button
                  onClick={() => setIsPayDueModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#E2136E] hover:bg-[#c20f5d] text-white text-xs font-extrabold shadow-md transition cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    Pay Due ৳{activeOrder.dueAmount.toLocaleString()} Online
                  </span>
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0F3D2E] hover:bg-[#165b44] text-white text-xs font-bold transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>

          {/* 5-Stage Visual Delivery Progress Tracker */}
          <div className="p-6 sm:p-8 border-b border-stone-200 space-y-6">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-500">
              Live Fulfilment & Delivery Timeline
            </h3>

            {activeOrder.orderStatus === "cancelled" ? (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm font-bold">
                This order has been cancelled. Contact {settings.supportPhone}{" "}
                for assistance.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {STATUS_STEPS.map((step, index) => {
                  const completed = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  return (
                    <div
                      key={step.key}
                      className={`p-4 rounded-2xl border transition ${
                        isCurrent
                          ? "border-2 border-[#0F3D2E] bg-emerald-50/70 shadow-xs"
                          : completed
                          ? "border-emerald-200 bg-emerald-50/30"
                          : "border-stone-200 bg-stone-50/60 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center ${
                            completed
                              ? "bg-[#0F3D2E] text-white"
                              : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          {completed ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-[#C83E2B] text-white text-[10px] font-bold">
                            CURRENT
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[#0F3D2E]">
                        {step.labelBn}
                      </p>
                      <p className="text-sm font-extrabold text-stone-900">
                        {step.label}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {step.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cold-Chain Courier & Assigned Rider Banner (Step 4 Upgrade) */}
            {activeOrder.courierName && (
              <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/80 border border-blue-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700">
                      Assigned Cold-Chain Courier & Dispatch Info
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-stone-900">
                      {activeOrder.courierName}{" "}
                      {activeOrder.trackingReference && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-blue-200 text-blue-900 ml-1">
                          Ref: {activeOrder.trackingReference}
                        </span>
                      )}
                    </h4>
                    {activeOrder.riderName && (
                      <p className="text-xs text-stone-600">
                        Assigned Rider / Supervisor:{" "}
                        <strong>{activeOrder.riderName}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {activeOrder.riderPhone && (
                  <a
                    href={`tel:${activeOrder.riderPhone}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition no-print"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call Rider: {activeOrder.riderPhone}</span>
                  </a>
                )}
              </div>
            )}

            {/* Digital Scale Weight Verification Transparency Banner (Step 1 Upgrade) */}
            {activeOrder.weightAdjustmentAmount !== undefined &&
              activeOrder.weightAdjustmentAmount !== 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                  <Scale className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-extrabold text-amber-950">
                      Digital Scale Weight Adjustment Applied:{" "}
                      {activeOrder.weightAdjustmentAmount > 0 ? "+" : ""}৳
                      {activeOrder.weightAdjustmentAmount}
                    </p>
                    <p className="text-amber-900">
                      {activeOrder.weightAdjustmentNote ||
                        "Adjusted according to exact net harvest weight on our digital scale prior to ice-box sealing."}
                    </p>
                  </div>
                </div>
              )}
          </div>

          {/* Customer Info & Payment Ledger Grid */}
          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-stone-200">
            {/* Customer Delivery Details (with PII Privacy Masking) */}
            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-stone-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-500">
                  Delivery Recipient Details
                </h4>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                  <Lock className="w-3 h-3" /> PII Protected
                </span>
              </div>
              <p className="text-base font-extrabold text-stone-900">
                {activeOrder.customerName}
              </p>
              <p className="text-xs text-stone-700 font-mono">
                Phone:{" "}
                <strong>
                  {isPhoneUnlocked
                    ? activeOrder.customerPhone
                    : maskPhoneNumber(activeOrder.customerPhone)}
                </strong>
              </p>
              <p className="text-xs text-stone-700">
                Zone:{" "}
                <strong className="uppercase">
                  {activeOrder.deliveryZone === "inside_dhaka"
                    ? "Inside Dhaka"
                    : "Outside Dhaka"}
                </strong>{" "}
                ({activeOrder.customerDistrict})
              </p>
              <p className="text-xs text-stone-700">
                Address:{" "}
                <strong>
                  {isPhoneUnlocked
                    ? activeOrder.customerAddress
                    : maskAddress(
                        activeOrder.customerAddress,
                        activeOrder.customerDistrict
                      )}
                </strong>
              </p>
              {!isPhoneUnlocked && (
                <p className="text-[11px] text-stone-400 pt-1 no-print">
                  * Enter the last 4 digits of your phone number above to reveal
                  full street address.
                </p>
              )}
            </div>

            {/* Payment Ledger Card */}
            <div className="p-5 rounded-2xl bg-emerald-950 text-white space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                  Verified Payment Ledger
                </h4>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                    activeOrder.paymentStatus === "paid"
                      ? "bg-emerald-400 text-stone-950"
                      : activeOrder.paymentStatus === "advance_paid"
                      ? "bg-amber-400 text-stone-950"
                      : "bg-white/15 text-white"
                  }`}
                >
                  {activeOrder.paymentStatus.replace("_", " ")}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-emerald-200">
                  <span>Items Subtotal:</span>
                  <span>৳{activeOrder.subtotal.toLocaleString()}</span>
                </div>
                {activeOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-300 font-semibold">
                    <span>
                      Promo Discount{" "}
                      {activeOrder.couponCode
                        ? `(${activeOrder.couponCode})`
                        : ""}
                      :
                    </span>
                    <span>- ৳{activeOrder.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-200">
                  <span>Home Delivery Charge:</span>
                  <span>৳{activeOrder.deliveryCharge.toLocaleString()}</span>
                </div>
                {activeOrder.weightAdjustmentAmount !== undefined &&
                  activeOrder.weightAdjustmentAmount !== 0 && (
                    <div className="flex justify-between text-amber-300 font-semibold">
                      <span>Scale Weight Adjustment:</span>
                      <span>
                        {activeOrder.weightAdjustmentAmount > 0 ? "+" : ""}৳
                        {activeOrder.weightAdjustmentAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-emerald-800">
                  <span>Final Order Bill:</span>
                  <span>৳{activeOrder.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-300 font-bold">
                  <span>
                    Paid Online ({activeOrder.paymentMethod.toUpperCase()}):
                  </span>
                  <span>- ৳{activeOrder.advancePaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-amber-300 pt-1.5 border-t border-emerald-800">
                  <span>Due on Home Delivery (COD):</span>
                  <span>৳{activeOrder.dueAmount.toLocaleString()}</span>
                </div>
              </div>

              {activeOrder.transactionId && (
                <p className="text-[11px] font-mono text-emerald-300 pt-1">
                  Verified TrxID: {activeOrder.transactionId}
                </p>
              )}
            </div>
          </div>

          {/* Ordered Items Table */}
          <div className="p-6 sm:p-8 space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-stone-700">
              Ordered Organic Items ({activeOrder.items.length})
            </h3>
            <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden">
              {activeOrder.items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex items-center justify-between gap-4 bg-white"
                >
                  <div className="flex items-center gap-3.5">
                    <img
                      src={item.productImage}
                      alt={item.productTitle}
                      className="w-14 h-14 rounded-xl object-contain bg-stone-950 p-0.5 border border-stone-200 shrink-0"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#0F3D2E]">
                        {item.productTitleBn}
                      </p>
                      <p className="text-sm font-extrabold text-stone-900">
                        {item.productTitle}
                      </p>
                      <p className="text-xs text-stone-500">
                        Pack: <strong>{item.variantLabel}</strong> ×{" "}
                        {item.quantity}
                        {item.cuttingPreference
                          ? ` • Prep: ${item.cuttingPreference}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-stone-900">
                      ৳{item.lineTotal.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      ৳{item.unitPrice} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PAY REMAINING DUE ONLINE VIA BKASH / SSLCOMMERZ */}
      {isPayDueModalOpen && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs no-print">
          <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl bg-white border border-stone-200">
            <div
              className={`p-6 text-white flex items-center justify-between ${
                selectedDueGateway === "bkash" ? "bg-[#E2136E]" : "bg-[#1A4B8C]"
              }`}
            >
              <div>
                <span className="text-[11px] uppercase tracking-widest font-bold opacity-90">
                  Instant Due Settlement
                </span>
                <h3 className="text-lg font-extrabold">
                  Order {activeOrder.orderCode}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs opacity-85 block">Remaining Due</span>
                <strong className="text-2xl font-black">
                  ৳{activeOrder.dueAmount.toLocaleString()}
                </strong>
              </div>
            </div>

            <form onSubmit={handlePayRemainingDue} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedDueGateway("bkash")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border-2 cursor-pointer ${
                    selectedDueGateway === "bkash"
                      ? "border-[#E2136E] bg-pink-50 text-[#E2136E]"
                      : "border-stone-200 text-stone-600"
                  }`}
                >
                  bKash AutoPay
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDueGateway("sslcommerz")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border-2 cursor-pointer ${
                    selectedDueGateway === "sslcommerz"
                      ? "border-[#1A4B8C] bg-blue-50 text-[#1A4B8C]"
                      : "border-stone-200 text-stone-600"
                  }`}
                >
                  SSLCommerz
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Your Wallet / Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  value={walletPhone}
                  onChange={(e) => setWalletPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Verification OTP (Sandbox Auto-Filled)
                </label>
                <input
                  type="text"
                  required
                  value={walletOtp}
                  onChange={(e) => setWalletOtp(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm font-mono tracking-widest"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayDueModalOpen(false)}
                  className="px-4 py-3 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  disabled={payingDue}
                  className={`flex-1 py-3 px-5 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer ${
                    selectedDueGateway === "bkash"
                      ? "bg-[#E2136E] hover:bg-[#c20f5d]"
                      : "bg-[#1A4B8C] hover:bg-[#123564]"
                  }`}
                >
                  {payingDue ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>
                        Authorize ৳{activeOrder.dueAmount.toLocaleString()} Now
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-sm text-stone-500">
          Loading Order Tracker...
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
