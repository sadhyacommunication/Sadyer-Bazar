"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
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
  Smartphone,
  AlertCircle,
} from "lucide-react";
import {
  getRecentOrderPhoneLast4,
  rememberRecentOrderInSession,
  useStore,
} from "@/context/StoreContext";
import { Order, OrderStatus } from "@/types";
import { checkRateLimit, maskAddress, maskPhoneNumber } from "@/lib/security";
import { trackOrderViaEdgeApi } from "@/services/supabaseSync";

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
  const initialCode = (searchParams.get("code") || "").trim().toUpperCase();
  const justOrdered = searchParams.get("justOrdered") === "1";
  const gatewayError = searchParams.get("gatewayError") === "1";
  const paymentStatusParam = searchParams.get("payment");
  const gatewayParam = searchParams.get("gateway");

  const { findOrderByCode, orders, settings } = useStore();

  const [orderCodeInput, setOrderCodeInput] = useState(initialCode);
  const [phoneLast4, setPhoneLast4] = useState("");
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [needsPhonePrompt, setNeedsPhonePrompt] = useState(false);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Pay Online / Pay Remaining Due Modal State (Official bKash & Nagad Merchant Gateways)
  const [isPayDueModalOpen, setIsPayDueModalOpen] = useState(false);
  const [selectedDueGateway, setSelectedDueGateway] = useState<
    "bkash" | "nagad"
  >("bkash");
  const [dueTrxError, setDueTrxError] = useState<string | null>(null);
  const [payingDue, setPayingDue] = useState(false);

  const performLookup = useCallback(
    async (codeToTrack: string, last4ToTrack: string) => {
      const cleanCode = codeToTrack.trim().toUpperCase();
      const cleanLast4 = last4ToTrack.replace(/\D/g, "").slice(-4);
      if (!cleanCode) return;

      if (cleanLast4.length !== 4) {
        // Check if order is already in current memory session (e.g. just ordered)
        const inMemory = findOrderByCode(cleanCode);
        if (inMemory) {
          const derivedLast4 = inMemory.customerPhone.replace(/\D/g, "").slice(-4);
          if (derivedLast4.length === 4) {
            setPhoneLast4(derivedLast4);
            rememberRecentOrderInSession(cleanCode, derivedLast4);
          }
          setActiveOrder(inMemory);
          setNotFound(false);
          setNeedsPhonePrompt(false);
          return;
        }
        setNeedsPhonePrompt(true);
        return;
      }

      setLoadingTrack(true);
      setTrackError(null);
      setNeedsPhonePrompt(false);

      try {
        const res = await trackOrderViaEdgeApi(cleanCode, cleanLast4);
        if (res.success && res.order) {
          rememberRecentOrderInSession(cleanCode, cleanLast4);
          setActiveOrder(res.order);
          setNotFound(false);
          return;
        }

        // Fallback to in-memory seed order only if matching code + last4
        const localMatch = findOrderByCode(cleanCode);
        if (
          localMatch &&
          localMatch.customerPhone.replace(/\D/g, "").endsWith(cleanLast4)
        ) {
          setActiveOrder(localMatch);
          setNotFound(false);
          return;
        }

        setActiveOrder(null);
        setNotFound(true);
        if (res.error) setTrackError(res.error);
      } catch {
        setActiveOrder(null);
        setNotFound(true);
      } finally {
        setLoadingTrack(false);
      }
    },
    [findOrderByCode]
  );

  useEffect(() => {
    if (!initialCode) return;
    setOrderCodeInput(initialCode);
    const savedLast4 = getRecentOrderPhoneLast4(initialCode);
    if (savedLast4) {
      setPhoneLast4(savedLast4);
      void performLookup(initialCode, savedLast4);
    } else {
      const inMemory = findOrderByCode(initialCode);
      if (inMemory) {
        const derivedLast4 = inMemory.customerPhone.replace(/\D/g, "").slice(-4);
        setPhoneLast4(derivedLast4);
        void performLookup(initialCode, derivedLast4);
      } else {
        setNeedsPhonePrompt(true);
      }
    }
  }, [initialCode, findOrderByCode, performLookup]);

  // Keep activeOrder synced when orders update in context (e.g. admin action in same tab)
  useEffect(() => {
    if (activeOrder) {
      const updated = findOrderByCode(activeOrder.orderCode);
      if (updated && updated.updatedAt > activeOrder.updatedAt) {
        setActiveOrder(updated);
      }
    }
  }, [orders, activeOrder, findOrderByCode]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = orderCodeInput.trim().toUpperCase();
    const cleanLast4 = phoneLast4.replace(/\D/g, "").slice(-4);
    if (!clean) return;

    if (cleanLast4.length !== 4) {
      setTrackError(
        "নিরাপত্তার স্বার্থে আপনার অর্ডারের মোবাইল নম্বরের শেষ ৪টি ডিজিট লিখুন।"
      );
      setNeedsPhonePrompt(true);
      return;
    }

    const rl = checkRateLimit(`track_${clean}`, 15, 60_000);
    if (!rl.allowed) {
      setTrackError("অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।");
      return;
    }

    await performLookup(clean, cleanLast4);
  };

  const handlePayDueWithBkash = async () => {
    if (!activeOrder || activeOrder.dueAmount <= 0) return;
    setPayingDue(true);
    setDueTrxError(null);
    try {
      const res = await fetch("/api/payment/bkash/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: activeOrder.orderCode,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        success?: boolean;
        bkashURL?: string;
        error?: string | { message?: string };
      };

      if (res.ok && (data.ok || data.success) && data.bkashURL) {
        window.location.href = data.bkashURL;
      } else {
        const errText =
          typeof data.error === "string" ? data.error : data.error?.message;
        throw new Error(
          errText ||
            "bKash মার্চেন্ট গেটওয়ে সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
        );
      }
    } catch (err) {
      setDueTrxError(
        err instanceof Error
          ? err.message
          : "bKash গেটওয়েতে সংযোগ করতে সমস্যা হয়েছে।"
      );
      setPayingDue(false);
    }
  };

  const handlePayDueWithNagad = async () => {
    if (!activeOrder || activeOrder.dueAmount <= 0) return;
    setPayingDue(true);
    setDueTrxError(null);
    try {
      const res = await fetch("/api/payment/nagad/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: activeOrder.orderCode,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        success?: boolean;
        callBackUrl?: string;
        error?: string | { message?: string };
      };

      if (res.ok && (data.ok || data.success) && data.callBackUrl) {
        window.location.href = data.callBackUrl;
      } else {
        const errText =
          typeof data.error === "string" ? data.error : data.error?.message;
        throw new Error(
          errText ||
            "Nagad মার্চেন্ট গেটওয়ে সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
        );
      }
    } catch (err) {
      setDueTrxError(
        err instanceof Error
          ? err.message
          : "Nagad গেটওয়েতে সংযোগ করতে সমস্যা হয়েছে।"
      );
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

  const gatewayDisplayName =
    gatewayParam === "bkash"
      ? "bKash (বিকাশ)"
      : gatewayParam === "nagad"
      ? "Nagad (নগদ)"
      : "অনলাইন পেমেন্ট গেটওয়ে";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Search Box Header */}
      <div className="bg-[#0F3D2E] text-white rounded-3xl p-7 sm:p-10 shadow-xl space-y-6 no-print">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-300">
            <PackageSearch className="w-4 h-4" /> Real-Time Order & Cold-Chain
            Delivery Tracking
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold">
            Track Your Order by Order ID
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/85 max-w-2xl">
            Enter your Order ID (e.g.{" "}
            <code className="px-2 py-0.5 rounded bg-white/15 font-mono text-amber-300">
              SB-YYMM-XXXXXXXXXX
            </code>
            ) and the last 4 digits of your mobile number to check live harvest,
            digital scale weight verification, courier rider info, and payment
            ledger.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 sm:grid-cols-12 gap-3"
        >
          <input
            type="text"
            required
            value={orderCodeInput}
            onChange={(e) => setOrderCodeInput(e.target.value.toUpperCase())}
            placeholder="Order ID (e.g. SB-2610-XXXXXXXXXX)"
            className="sm:col-span-6 px-4 py-3.5 rounded-2xl bg-white text-stone-900 text-sm font-mono uppercase focus:outline-none"
          />
          <input
            type="text"
            required
            maxLength={4}
            value={phoneLast4}
            onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ""))}
            placeholder="Last 4 digits of Phone *"
            className="sm:col-span-4 px-4 py-3.5 rounded-2xl bg-white/95 text-stone-900 text-xs sm:text-sm font-mono focus:outline-none"
          />
          <button
            type="submit"
            disabled={loadingTrack}
            className="sm:col-span-2 py-3.5 px-5 rounded-2xl bg-[#C83E2B] hover:bg-[#b03221] disabled:opacity-60 text-white font-extrabold text-sm transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            {loadingTrack ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Track Now"
            )}
          </button>
        </form>

        {/* Security & Anti-Harvesting Privacy Notice */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-200/90 pt-1">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>
              Zero-Leakage Privacy Guard: Both your unique Order ID and last 4
              digits of your mobile number are verified on our server.
            </span>
          </span>
        </div>
      </div>

      {/* Prompt for 4 digits if opened on a new device with ?code= */}
      {needsPhonePrompt && !activeOrder && (
        <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200 text-amber-950 text-xs sm:text-sm font-semibold flex items-center gap-3 no-print">
          <Lock className="w-5 h-5 text-amber-700 shrink-0" />
          <span>
            অর্ডার{" "}
            <strong className="font-mono">{orderCodeInput}</strong>-এর বিস্তারিত
            দেখতে উপরে আপনার মোবাইল নম্বরের শেষ ৪টি ডিজিট লিখে{" "}
            <strong>Track Now</strong> বাটনে ক্লিক করুন।
          </span>
        </div>
      )}

      {/* Official bKash / Nagad Gateway Status Banners */}
      {paymentStatusParam === "success" && (
        <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-600/40 flex items-start gap-3.5 no-print shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#0F3D2E] text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-[#0F3D2E]">
              আলহামদুলিল্লাহ! আপনার {gatewayDisplayName} পেমেন্ট সফলভাবে সার্ভার থেকে ভেরিফাই ও রেকর্ড হয়েছে!
            </h2>
            <p className="text-xs sm:text-sm text-stone-700">
              গেটওয়ে থেকে আপনার লেনদেন নিশ্চিত করা হয়েছে এবং অর্ডারের পেমেন্ট লেজার আপডেট করা হয়েছে। নিচের অর্ডারের রসিদ ও ডেলিভারি ট্র্যাকিং দেখুন।
            </p>
          </div>
        </div>
      )}

      {(paymentStatusParam === "failed" || gatewayError) && (
        <div className="p-6 rounded-3xl bg-red-50 border-2 border-red-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#C83E2B] text-white flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold text-[#C83E2B]">
                অনলাইন পেমেন্ট সম্পন্ন করা যায়নি
              </h2>
              <p className="text-xs sm:text-sm text-stone-700">
                গেটওয়ে থেকে অর্থ কর্তন করা হয়নি। আপনার অর্ডারটি পেন্ডিং হিসেবে সুরক্ষিত আছে। আপনি নিচের বাটনে ক্লিক করে বিকাশ বা নগদের মাধ্যমে পেমেন্ট সম্পন্ন করতে পারেন।
              </p>
            </div>
          </div>
          {activeOrder && activeOrder.dueAmount > 0 && (
            <button
              type="button"
              onClick={() => {
                setDueTrxError(null);
                setIsPayDueModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-[#E2136E] hover:bg-[#c20f5d] text-white text-xs font-extrabold shrink-0 cursor-pointer transition"
            >
              Pay Online Now (৳{activeOrder.dueAmount.toLocaleString()})
            </button>
          )}
        </div>
      )}

      {paymentStatusParam === "cancelled" && (
        <div className="p-6 rounded-3xl bg-amber-50 border-2 border-amber-500/40 flex items-start gap-3.5 no-print shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-amber-950">
              পেমেন্ট প্রক্রিয়াটি বাতিল করা হয়েছে
            </h2>
            <p className="text-xs sm:text-sm text-stone-700">
              আপনি পেমেন্ট উইন্ডো বাতিল করেছেন। আপনার অর্ডারটি পেন্ডিং রয়েছে, আপনি যেকোনো সময় &ldquo;Pay Due Online&rdquo; বাটনে ক্লিক করে পেমেন্ট সম্পন্ন করতে পারবেন।
            </p>
          </div>
        </div>
      )}

      {paymentStatusParam === "processing" && (
        <div className="p-6 rounded-3xl bg-blue-50 border-2 border-blue-500/40 flex items-start gap-3.5 no-print shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-blue-950">
              পেমেন্ট গেটওয়েতে প্রক্রিয়াধীন রয়েছে
            </h2>
            <p className="text-xs sm:text-sm text-stone-700">
              আপনার পেমেন্টটি বর্তমানে গেটওয়েতে যাচাই করা হচ্ছে। কিছুক্ষণের মধ্যে স্ট্যাটাস আপডেট হবে।
            </p>
          </div>
        </div>
      )}

      {paymentStatusParam === "review" && (
        <div className="p-6 rounded-3xl bg-amber-50 border-2 border-amber-500/40 flex items-start gap-3.5 no-print shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-amber-950">
              পেমেন্ট যাচাইকরণ প্রক্রিয়াধীন (Under Verification)
            </h2>
            <p className="text-xs sm:text-sm text-stone-700">
              গেটওয়ে থেকে ধীর গতির রেসপন্স পাওয়ায় আমাদের টিম আপনার পেমেন্টটি ম্যানুয়ালি যাচাই করছে। অনুগ্রহ করে দ্বিতীয়বার পেমেন্ট করবেন না; প্রয়োজনে কল করুন: {settings.supportPhone}।
            </p>
          </div>
        </div>
      )}

      {/* Just Ordered Confirmation Banner */}
      {justOrdered && activeOrder && (
        <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-600/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#0F3D2E] text-amber-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#0F3D2E]">
                Alhamdulillah! Your Order is Registered!
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
            No Matching Order Found for &ldquo;{orderCodeInput}&rdquo;
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            {trackError ||
              `Please verify both your Order ID (e.g. SB-YYMM-XXXXXXXXXX) and the last 4 digits of the phone number used during checkout, or call our hotline at ${settings.supportPhone}.`}
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
              {activeOrder.dueAmount > 0 &&
                activeOrder.orderStatus !== "cancelled" && (
                  <button
                    onClick={() => {
                      setSelectedDueGateway(
                        activeOrder.paymentMethod === "nagad" ? "nagad" : "bkash"
                      );
                      setDueTrxError(null);
                      setIsPayDueModalOpen(true);
                    }}
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

            {/* Cold-Chain Courier & Assigned Rider Banner */}
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

            {/* Digital Scale Weight Verification Transparency Banner */}
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
            {/* Customer Delivery Details (with Server-Side PII Privacy Masking) */}
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
                  {activeOrder.customerPhone.includes("*")
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
                  {activeOrder.customerAddress.includes("*")
                    ? activeOrder.customerAddress
                    : maskAddress(
                        activeOrder.customerAddress,
                        activeOrder.customerDistrict
                      )}
                </strong>
              </p>
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
                    {item.productImage && (
                      <img
                        src={item.productImage}
                        alt={item.productTitle}
                        className="w-14 h-14 rounded-xl object-contain bg-stone-950 p-0.5 border border-stone-200 shrink-0"
                      />
                    )}
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

      {/* MODAL: PAY REMAINING DUE ONLINE VIA OFFICIAL BKASH OR NAGAD MERCHANT GATEWAY */}
      {isPayDueModalOpen && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs no-print overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl bg-white border border-stone-200 my-6">
            {(() => {
              const isNagad = selectedDueGateway === "nagad";
              const isBkash = selectedDueGateway === "bkash";
              const headerBg = isBkash ? "bg-[#E2136E]" : "bg-[#E35124]";

              return (
                <>
                  <div className={`p-6 text-white ${headerBg}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] uppercase tracking-widest font-black opacity-90 inline-block px-2 py-0.5 rounded bg-white/20 mb-1">
                          Official Merchant Payment
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black">
                          {isBkash
                            ? "বিকাশ মার্চেন্ট গেটওয়ে পেমেন্ট"
                            : "নগদ মার্চেন্ট গেটওয়ে পেমেন্ট"}
                        </h3>
                        <p className="text-xs opacity-90 font-mono mt-1">
                          অর্ডার রেফারেন্স: {activeOrder.orderCode}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPayDueModalOpen(false)}
                        className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="mt-4 p-3.5 rounded-2xl bg-black/20 backdrop-blur-xs flex items-center justify-between">
                      <div>
                        <span className="text-[11px] opacity-80 block font-semibold">
                          পরিশোধযোগ্য টাকা (Server Verified)
                        </span>
                        <strong className="text-2xl font-black">
                          ৳{activeOrder.dueAmount.toLocaleString()}
                        </strong>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-white/20 text-[11px] font-bold">
                        Zero-Trust Verified
                      </span>
                    </div>
                  </div>

                  <div className="p-6 space-y-5 text-xs">
                    {/* Method Selector */}
                    <div>
                      <label className="block font-bold text-stone-700 mb-2">
                        পেমেন্ট মাধ্যম বেছে নিন:
                      </label>
                      <div className="grid grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDueGateway("bkash")}
                          className={`py-3 px-3 rounded-xl font-bold border-2 transition cursor-pointer flex flex-col items-center gap-1 ${
                            selectedDueGateway === "bkash"
                              ? "border-[#E2136E] bg-pink-50 text-[#E2136E]"
                              : "border-stone-200 text-stone-600 hover:border-stone-300"
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                          <span className="text-xs">bKash (বিকাশ)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDueGateway("nagad")}
                          className={`py-3 px-3 rounded-xl font-bold border-2 transition cursor-pointer flex flex-col items-center gap-1 ${
                            selectedDueGateway === "nagad"
                              ? "border-orange-500 bg-orange-50 text-orange-700"
                              : "border-stone-200 text-stone-600 hover:border-stone-300"
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                          <span className="text-xs">Nagad (নগদ)</span>
                        </button>
                        <div
                          aria-disabled="true"
                          className="py-3 px-3 rounded-xl font-bold border-2 border-dashed border-stone-200 bg-stone-50 text-stone-400 flex flex-col items-center gap-1 opacity-60 cursor-not-allowed"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span className="text-[11px]">SSLCommerz (Hold)</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-stone-700 leading-relaxed">
                      <p className="font-extrabold text-stone-900 flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
                        ১০০% স্বয়ংক্রিয় ও নিরাপদ মার্চেন্ট পেমেন্ট:
                      </p>
                      <p>
                        নিচের বাটনে ক্লিক করলে আপনাকে সরাসরি{" "}
                        <strong>
                          {isBkash
                            ? "bKash Tokenized Checkout"
                            : "Nagad Official Merchant Gateway"}
                        </strong>{" "}
                        পেজে নিয়ে যাওয়া হবে। পেমেন্ট সম্পন্ন হওয়া মাত্রই আমাদের সার্ভার স্বয়ংক্রিয়ভাবে ট্রানজেকশন যাচাই করে আপনার অর্ডারের রসিদ আপডেট করবে। ম্যানুয়ালি কোনো TrxID লেখার প্রয়োজন নেই।
                      </p>
                    </div>

                    {dueTrxError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{dueTrxError}</span>
                      </div>
                    )}

                    <div className="flex gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsPayDueModalOpen(false)}
                        className="px-4 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="button"
                        disabled={payingDue}
                        onClick={
                          isBkash ? handlePayDueWithBkash : handlePayDueWithNagad
                        }
                        className={`flex-1 py-3 px-5 rounded-xl text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition ${
                          isBkash
                            ? "bg-[#E2136E] hover:bg-[#c20f5d]"
                            : "bg-[#E35124] hover:bg-[#c44119]"
                        }`}
                      >
                        {payingDue ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>গেটওয়ে সংযোগ হচ্ছে...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            <span>
                              {isBkash ? "bKash" : "Nagad"} দিয়ে পরিশোধ করুন
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
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
