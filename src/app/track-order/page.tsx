"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  PackageSearch,
  CheckCircle2,
  Printer,
  Copy,
  Check,
  PhoneCall,
  Lock,
  Sparkles,
  CreditCard,
  Loader2,
  X,
  Smartphone,
  AlertCircle,
  Share2,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  ArrowRight,
  Fish,
} from "lucide-react";
import {
  getOrderStatusOverrides,
  getRecentOrderPhoneLast4,
  rememberRecentOrderInSession,
  useStore,
} from "@/context/StoreContext";
import { Order } from "@/types";
import { checkRateLimit, maskAddress, maskPhoneNumber } from "@/lib/security";
import { trackOrderViaEdgeApi } from "@/services/supabaseSync";
import MotionStageViewer from "@/components/tracking/MotionStageViewer";
import FreshnessTelemetry from "@/components/tracking/FreshnessTelemetry";
import TransitRadar from "@/components/tracking/TransitRadar";
import PrintableInvoice from "@/components/tracking/PrintableInvoice";

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
  const [shareCopied, setShareCopied] = useState(false);

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
        // Check if order is already in current memory session (e.g. just placed)
        const inMemory = findOrderByCode(cleanCode);
        if (inMemory) {
          const derivedLast4 = inMemory.customerPhone
            .replace(/\D/g, "")
            .slice(-4);
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
        const overrides = getOrderStatusOverrides();
        const ov = overrides[cleanCode];

        if (res.success && res.order) {
          rememberRecentOrderInSession(cleanCode, cleanLast4);
          const finalOrder: Order = ov
            ? {
                ...res.order,
                orderStatus: ov.orderStatus || res.order.orderStatus,
                paymentStatus: ov.paymentStatus || res.order.paymentStatus,
                dueAmount:
                  ov.dueAmount !== undefined ? ov.dueAmount : res.order.dueAmount,
                advancePaid:
                  ov.advancePaid !== undefined
                    ? ov.advancePaid
                    : res.order.advancePaid,
                courierName: ov.courierName || res.order.courierName,
                trackingReference:
                  ov.trackingReference || res.order.trackingReference,
                riderName: ov.riderName || res.order.riderName,
                riderPhone: ov.riderPhone || res.order.riderPhone,
                weightAdjustmentAmount:
                  ov.weightAdjustmentAmount !== undefined
                    ? ov.weightAdjustmentAmount
                    : res.order.weightAdjustmentAmount,
                weightAdjustmentNote:
                  ov.weightAdjustmentNote || res.order.weightAdjustmentNote,
                updatedAt: ov.updatedAt || res.order.updatedAt,
              }
            : res.order;
          setActiveOrder(finalOrder);
          setNotFound(false);
          return;
        }

        // Fallback to in-memory seed order only if matching code + last4
        const localMatch = findOrderByCode(cleanCode);
        if (
          localMatch &&
          localMatch.customerPhone.replace(/\D/g, "").endsWith(cleanLast4)
        ) {
          const finalOrder: Order = ov
            ? {
                ...localMatch,
                orderStatus: ov.orderStatus || localMatch.orderStatus,
                paymentStatus: ov.paymentStatus || localMatch.paymentStatus,
                dueAmount:
                  ov.dueAmount !== undefined ? ov.dueAmount : localMatch.dueAmount,
                advancePaid:
                  ov.advancePaid !== undefined
                    ? ov.advancePaid
                    : localMatch.advancePaid,
                courierName: ov.courierName || localMatch.courierName,
                trackingReference:
                  ov.trackingReference || localMatch.trackingReference,
                riderName: ov.riderName || localMatch.riderName,
                riderPhone: ov.riderPhone || localMatch.riderPhone,
                weightAdjustmentAmount:
                  ov.weightAdjustmentAmount !== undefined
                    ? ov.weightAdjustmentAmount
                    : localMatch.weightAdjustmentAmount,
                weightAdjustmentNote:
                  ov.weightAdjustmentNote || localMatch.weightAdjustmentNote,
                updatedAt: ov.updatedAt || localMatch.updatedAt,
              }
            : localMatch;
          setActiveOrder(finalOrder);
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
        const derivedLast4 = inMemory.customerPhone
          .replace(/\D/g, "")
          .slice(-4);
        setPhoneLast4(derivedLast4);
        void performLookup(initialCode, derivedLast4);
      } else {
        setNeedsPhonePrompt(true);
      }
    }
  }, [initialCode, findOrderByCode, performLookup]);

  // Keep activeOrder synced when orders update in context or via cross-tab broadcast
  useEffect(() => {
    if (activeOrder) {
      const updated = findOrderByCode(activeOrder.orderCode);
      if (
        updated &&
        (updated.orderStatus !== activeOrder.orderStatus ||
          updated.updatedAt > activeOrder.updatedAt)
      ) {
        setActiveOrder((prev) => (prev ? { ...prev, ...updated } : updated));
      }
    }
  }, [orders, activeOrder, findOrderByCode]);

  // Cross-Tab BroadcastChannel & Event Synchronization
  useEffect(() => {
    if (typeof window === "undefined") return;

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("sb_orders_sync");
      channel.onmessage = (event) => {
        const data = event.data;
        if (
          data?.orderCode &&
          activeOrder &&
          activeOrder.orderCode.toUpperCase() === data.orderCode.toUpperCase()
        ) {
          setActiveOrder((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              orderStatus: data.status || data.orderStatus || prev.orderStatus,
              paymentStatus: data.paymentStatus || prev.paymentStatus,
              dueAmount:
                data.dueAmount !== undefined ? data.dueAmount : prev.dueAmount,
              advancePaid:
                data.advancePaid !== undefined
                  ? data.advancePaid
                  : prev.advancePaid,
              courierName: data.courierName || prev.courierName,
              trackingReference:
                data.trackingReference || prev.trackingReference,
              riderName: data.riderName || prev.riderName,
              riderPhone: data.riderPhone || prev.riderPhone,
              weightAdjustmentAmount:
                data.weightAdjustmentAmount !== undefined
                  ? data.weightAdjustmentAmount
                  : prev.weightAdjustmentAmount,
              weightAdjustmentNote:
                data.weightAdjustmentNote || prev.weightAdjustmentNote,
              updatedAt: data.updatedAt || new Date().toISOString(),
            };
          });
        }
      };
    } catch {}

    const handleStatusEvent = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (
        data?.orderCode &&
        activeOrder &&
        activeOrder.orderCode.toUpperCase() === data.orderCode.toUpperCase()
      ) {
        setActiveOrder((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            orderStatus: data.status || data.orderStatus || prev.orderStatus,
            paymentStatus: data.paymentStatus || prev.paymentStatus,
            dueAmount:
              data.dueAmount !== undefined ? data.dueAmount : prev.dueAmount,
            advancePaid:
              data.advancePaid !== undefined
                ? data.advancePaid
                : prev.advancePaid,
            courierName: data.courierName || prev.courierName,
            trackingReference:
              data.trackingReference || prev.trackingReference,
            riderName: data.riderName || prev.riderName,
            riderPhone: data.riderPhone || prev.riderPhone,
            weightAdjustmentAmount:
              data.weightAdjustmentAmount !== undefined
                ? data.weightAdjustmentAmount
                : prev.weightAdjustmentAmount,
            weightAdjustmentNote:
              data.weightAdjustmentNote || prev.weightAdjustmentNote,
            updatedAt: data.updatedAt || new Date().toISOString(),
          };
        });
      }
    };

    window.addEventListener("sb_order_status_changed", handleStatusEvent);

    return () => {
      channel?.close();
      window.removeEventListener("sb_order_status_changed", handleStatusEvent);
    };
  }, [activeOrder]);

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

  const handleShareTracking = async () => {
    if (!activeOrder) return;
    const shareUrl = `${window.location.origin}/track-order?code=${activeOrder.orderCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Track Order #${activeOrder.orderCode} — Sadhyer Bazar`,
          text: `সাধ্যের বাজার রিয়েল-টাইম কোল্ড-চেইন ট্র্যাকিং: ${activeOrder.orderCode}`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const gatewayDisplayName =
    gatewayParam === "bkash"
      ? "bKash (বিকাশ)"
      : gatewayParam === "nagad"
      ? "Nagad (নগদ)"
      : "অনলাইন পেমেন্ট গেটওয়ে";

  const whatsappDirectUrl = activeOrder
    ? `https://wa.me/8801713477780?text=${encodeURIComponent(
        `আসসালামু আলাইকুম, আমি সাধ্যের বাজার অর্ডার #${activeOrder.orderCode} সম্পর্কে জানতে চাচ্ছি।`
      )}`
    : `https://wa.me/8801713477780`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* 1. Advance Search Card Header */}
      <div className="bg-gradient-to-br from-[#0F3D2E] via-[#0C3225] to-[#082219] text-white rounded-3xl p-7 sm:p-10 shadow-2xl space-y-6 no-print border border-emerald-800/40 relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-amber-300 text-xs font-black uppercase tracking-wider">
            <PackageSearch className="w-4 h-4 text-amber-400" />
            <span>Real-Time Cold-Chain & River Harvest Tracker</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            অর্ডার ট্র্যাকিং ও কোল্ড-চেইন ডেলিভারি মনিটর
          </h1>

          <p className="text-xs sm:text-sm text-emerald-100/85 max-w-2xl leading-relaxed">
            আপনার ইউনিক অর্ডার আইডি (যেমন{" "}
            <code className="px-2 py-0.5 rounded bg-white/15 font-mono text-amber-300 font-bold">
              SB-YYMM-XXXXXXXXXX
            </code>
            ) এবং অর্ডারে ব্যবহৃত মোবাইল নম্বরের শেষ ৪টি ডিজিট লিখে যমুনা নদী থেকে তাজা সংগ্রহ, ডিজিটাল স্কেলের নিট ওজন ও রাইডার স্ট্যাটাস সরাসরি ট্র্যাক করুন।
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="relative z-10 grid grid-cols-1 sm:grid-cols-12 gap-3"
        >
          <input
            type="text"
            required
            value={orderCodeInput}
            onChange={(e) => setOrderCodeInput(e.target.value.toUpperCase())}
            placeholder="Order ID (e.g. SB-2610-XXXXXXXXXX)"
            className="sm:col-span-6 px-4 py-3.5 rounded-2xl bg-white text-stone-900 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-inner"
          />
          <input
            type="text"
            required
            maxLength={4}
            value={phoneLast4}
            onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ""))}
            placeholder="Last 4 digits of Phone *"
            className="sm:col-span-4 px-4 py-3.5 rounded-2xl bg-white text-stone-900 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-inner"
          />
          <button
            type="submit"
            disabled={loadingTrack}
            className="sm:col-span-2 py-3.5 px-5 rounded-2xl bg-[#C83E2B] hover:bg-[#b03221] disabled:opacity-60 text-white font-black text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-lg"
          >
            {loadingTrack ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Track Now</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security & Anti-Harvesting Privacy Notice */}
        <div className="relative z-10 flex flex-wrap items-center gap-2 text-xs text-emerald-200/90 pt-1">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>
              Zero-Leakage Privacy Guard: অর্ডার আইডি ও মোবাইল নম্বরের শেষ ৪ ডিজিট ছাড়া তথ্য দেখা যাবে না।
            </span>
          </span>
        </div>
      </div>

      {/* 2. Prompt for 4 digits if opened with ?code= on new device */}
      {needsPhonePrompt && !activeOrder && (
        <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200 text-amber-950 text-xs sm:text-sm font-semibold flex items-center gap-3.5 no-print shadow-xs">
          <Lock className="w-5 h-5 text-amber-700 shrink-0" />
          <span>
            অর্ডার <strong className="font-mono">{orderCodeInput}</strong>-এর বিস্তারিত
            দেখতে উপরে আপনার মোবাইল নম্বরের শেষ ৪টি ডিজিট লিখে{" "}
            <strong>Track Now</strong> বাটনে ক্লিক করুন।
          </span>
        </div>
      )}

      {/* 3. Official Gateway Alerts (Success, Cancelled, Failed, Review) */}
      {paymentStatusParam === "success" && (
        <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-600/40 flex items-start gap-4 no-print shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#0F3D2E] text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black text-[#0F3D2E]">
              আলহামদুলিল্লাহ! আপনার {gatewayDisplayName} পেমেন্ট সফলভাবে সম্পন্ন ও ভেরিফাই হয়েছে!
            </h2>
            <p className="text-xs sm:text-sm text-stone-700">
              গেটওয়ে থেকে আপনার লেনদেন নিশ্চিত করা হয়েছে এবং অর্ডারের পেমেন্ট লেজার স্বয়ংক্রিয়ভাবে আপডেট করা হয়েছে।
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
              <h2 className="text-lg font-black text-[#C83E2B]">
                অনলাইন পেমেন্ট সম্পন্ন করা যায়নি
              </h2>
              <p className="text-xs sm:text-sm text-stone-700">
                গেটওয়ে থেকে অর্থ কর্তন করা হয়নি। আপনার অর্ডারটি সুরক্ষিত আছে; নিচে &ldquo;Pay Due Online&rdquo; বাটনে ক্লিক করে আবার চেষ্টা করতে পারেন।
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
              className="px-4 py-2.5 rounded-2xl bg-[#E2136E] hover:bg-[#c20f5d] text-white text-xs font-black shrink-0 cursor-pointer transition shadow-md"
            >
              Pay Online (৳{activeOrder.dueAmount.toLocaleString()})
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
            <h2 className="text-lg font-black text-amber-950">
              পেমেন্ট প্রক্রিয়াটি বাতিল করা হয়েছে
            </h2>
            <p className="text-xs sm:text-sm text-stone-700">
              আপনি পেমেন্ট উইন্ডো বাতিল করেছেন। আপনার অর্ডারটি বজায় আছে এবং আপনি যেকোনো সময় অনলাইন বা হোম ডেলিভারিতে ক্যাশে পরিশোধ করতে পারবেন।
            </p>
          </div>
        </div>
      )}

      {/* 4. Just Ordered Confirmation Banner */}
      {justOrdered && activeOrder && (
        <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-600/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#0F3D2E] text-amber-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#0F3D2E]">
                আলহামদুলিল্লাহ! আপনার অর্ডার সফলভাবে নিবন্ধিত হয়েছে!
              </h2>
              <p className="text-xs sm:text-sm text-stone-700 mt-0.5">
                আপনার অর্ডার আইডি{" "}
                <strong className="font-mono text-[#C83E2B]">
                  {activeOrder.orderCode}
                </strong>{" "}
                সংরক্ষণ করুন অথবা নিচের বাটনে ক্লিক করে ট্র্যাকিং লিংক সেভ করুন।
              </p>
            </div>
          </div>
          <button
            onClick={() => handleCopyCode(activeOrder.orderCode)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-xs font-black text-[#0F3D2E] hover:bg-emerald-100 transition cursor-pointer self-start sm:self-center"
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

      {/* 5. Not Found State */}
      {notFound && (
        <div className="bg-white rounded-3xl border border-stone-200 p-10 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
            <PackageSearch className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-stone-900">
            &ldquo;{orderCodeInput}&rdquo; নম্বরের কোনো অর্ডার খুঁজে পাওয়া যায়নি
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
            {trackError ||
              `দয়া করে আপনার অর্ডার আইডি (যেমন SB-YYMM-XXXXXXXXXX) এবং চেকআউটের সময় ব্যবহৃত ফোন নম্বরের শেষ ৪টি ডিজিট সঠিকভাবে মিলিয়ে নিন, অথবা আমাদের হটলাইনে কল করুন: ${settings.supportPhone}।`}
          </p>
        </div>
      )}

      {/* 6. Active Order Main Journey & Telemetry Hub */}
      {activeOrder && (
        <div className="space-y-6">
          {/* Action Toolbar (Share, WhatsApp, Print, Copy) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-white border border-stone-200/80 shadow-xs no-print">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm sm:text-base font-black text-stone-900">
                #{activeOrder.orderCode}
              </span>
              <button
                onClick={() => handleCopyCode(activeOrder.orderCode)}
                className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                title="Copy Order ID"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleShareTracking}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition cursor-pointer"
              >
                {shareCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied Link!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-stone-600" />
                    <span>Share Tracking</span>
                  </>
                )}
              </button>

              <a
                href={whatsappDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp Care</span>
              </a>

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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E2136E] hover:bg-[#c20f5d] text-white text-xs font-black shadow-sm transition cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay Due (৳{activeOrder.dueAmount.toLocaleString()})</span>
                  </button>
                )}

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F3D2E] hover:bg-[#165b44] text-white text-xs font-bold transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>

          {/* Module 1: CINEMATIC MOTION VIDEO GRAPHICS STAGE VIEWER */}
          <div className="no-print">
            <MotionStageViewer
              currentStatus={activeOrder.orderStatus}
              orderCode={activeOrder.orderCode}
              orderDate={activeOrder.createdAt}
              hasPreorderItems={activeOrder.hasPreorderItems}
            />
          </div>

          {/* Module 2: FRESHNESS & COLD-CHAIN TELEMETRY */}
          <div className="no-print">
            <FreshnessTelemetry
              orderStatus={activeOrder.orderStatus}
              weightAdjustmentAmount={activeOrder.weightAdjustmentAmount}
              weightAdjustmentNote={activeOrder.weightAdjustmentNote}
              hasPreorderItems={activeOrder.hasPreorderItems}
            />
          </div>

          {/* Module 3: TRANSIT RADAR & RIDER DISPATCH */}
          <div className="no-print">
            <TransitRadar
              orderStatus={activeOrder.orderStatus}
              deliveryZone={activeOrder.deliveryZone}
              deliveryAddress={activeOrder.customerAddress}
              courierName={activeOrder.courierName}
              trackingReference={activeOrder.trackingReference}
              riderName={activeOrder.riderName}
              riderPhone={activeOrder.riderPhone}
              supportPhone={settings.supportPhone}
            />
          </div>

          {/* Module 4: CUSTOMER DETAILS & FINANCIAL PAYMENT LEDGER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
            {/* Customer Recipient Details */}
            <div className="p-6 rounded-3xl bg-white border border-stone-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-stone-500">
                  ডেলিভারি গ্রহীতার তথ্য (Recipient)
                </h4>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <Lock className="w-3 h-3" /> PII Protected
                </span>
              </div>

              <p className="text-base font-black text-stone-900">
                {activeOrder.customerName}
              </p>

              <div className="space-y-1 text-xs text-stone-600">
                <p>
                  মোবাইল:{" "}
                  <strong className="font-mono text-stone-900">
                    {activeOrder.customerPhone.includes("*")
                      ? activeOrder.customerPhone
                      : maskPhoneNumber(activeOrder.customerPhone)}
                  </strong>
                </p>
                <p>
                  ডেলিভারি জোন:{" "}
                  <strong className="text-stone-900 uppercase">
                    {activeOrder.deliveryZone === "inside_dhaka"
                      ? "Inside Dhaka (ঢাকা শহর)"
                      : "Outside Dhaka (ঢাকার বাইরে)"}
                  </strong>{" "}
                  ({activeOrder.customerDistrict})
                </p>
                <p>
                  ঠিকানা:{" "}
                  <strong className="text-stone-900">
                    {activeOrder.customerAddress.includes("*")
                      ? activeOrder.customerAddress
                      : maskAddress(
                          activeOrder.customerAddress,
                          activeOrder.customerDistrict
                        )}
                  </strong>
                </p>
              </div>
            </div>

            {/* Verified Payment Ledger */}
            <div className="p-6 rounded-3xl bg-[#0F3D2E] text-white shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  পেমেন্ট লেজার (Payment Ledger)
                </h4>
                <span
                  className={`px-3 py-0.5 rounded-full text-[11px] font-black uppercase ${
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
                <div className="flex justify-between text-emerald-100">
                  <span>পণ্যের উপমোট (Subtotal):</span>
                  <span className="font-mono">
                    ৳{activeOrder.subtotal.toLocaleString()}
                  </span>
                </div>

                {activeOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-300 font-semibold">
                    <span>
                      প্রোমো ডিসকাউন্ট{" "}
                      {activeOrder.couponCode
                        ? `(${activeOrder.couponCode})`
                        : ""}
                      :
                    </span>
                    <span className="font-mono">
                      - ৳{activeOrder.discountAmount.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-emerald-100">
                  <span>কোল্ড-চেইন ডেলিভারি চার্জ:</span>
                  <span className="font-mono">
                    ৳{activeOrder.deliveryCharge.toLocaleString()}
                  </span>
                </div>

                {activeOrder.weightAdjustmentAmount !== undefined &&
                  activeOrder.weightAdjustmentAmount !== 0 && (
                    <div className="flex justify-between text-amber-300 font-semibold">
                      <span>ডিজিটাল স্কেল সমন্বয়:</span>
                      <span className="font-mono">
                        {activeOrder.weightAdjustmentAmount > 0 ? "+" : ""}৳
                        {activeOrder.weightAdjustmentAmount.toLocaleString()}
                      </span>
                    </div>
                  )}

                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-emerald-800">
                  <span>সর্বমোট প্রদেয় বিল:</span>
                  <span className="font-mono font-black">
                    ৳{activeOrder.totalAmount.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-emerald-300 font-bold">
                  <span>
                    পরিশোধিত অগ্রিম ({activeOrder.paymentMethod.toUpperCase()}):
                  </span>
                  <span className="font-mono">
                    - ৳{activeOrder.advancePaid.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-base font-black text-amber-300 pt-2 border-t border-emerald-800">
                  <span>বকেয়া দেয় টাকা (Due on Delivery):</span>
                  <span className="font-mono">
                    ৳{activeOrder.dueAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {activeOrder.transactionId && (
                <p className="text-[11px] font-mono text-emerald-300/80 pt-1 border-t border-emerald-800/60">
                  Verified TrxID: {activeOrder.transactionId}
                </p>
              )}
            </div>
          </div>

          {/* Module 5: ITEMIZED ORGANIC CATCH & CUSTOM CUTTING SPECIFICATIONS */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200/90 shadow-xs space-y-5 no-print">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-black uppercase tracking-wider text-[#0F3D2E] flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-emerald-700" />
                  Itemized Catch & Village Staples
                </span>
                <h3 className="text-lg font-black text-stone-900">
                  অর্ডারকৃত পণ্যের বিস্তারিত তালিকা ({activeOrder.items.length})
                </h3>
              </div>
              <span className="text-xs font-bold text-stone-500 font-mono">
                Batch: Live River Batch
              </span>
            </div>

            <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden">
              {activeOrder.items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:bg-stone-50/50 transition"
                >
                  <div className="flex items-start sm:items-center gap-4">
                    {item.productImage && (
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stone-950 p-0.5 border border-stone-200 shrink-0 relative">
                        <img
                          src={item.productImage}
                          alt={item.productTitle}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-black text-[#0F3D2E]">
                        {item.productTitleBn}
                      </p>
                      <h4 className="text-sm sm:text-base font-extrabold text-stone-900">
                        {item.productTitle}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-xs font-medium">
                          প্যাক: <strong>{item.variantLabel}</strong> × {item.quantity}
                        </span>
                        {item.cuttingPreference && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold">
                            কাটিং: {item.cuttingPreference}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-base font-black text-stone-900 font-mono">
                      ৳{item.lineTotal.toLocaleString()}
                    </p>
                    <p className="text-xs text-stone-500 font-mono">
                      ৳{item.unitPrice.toLocaleString()} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Module 6: HIGH-RES PRINTABLE INVOICE (ONLY VISIBLE ON PRINT) */}
          <PrintableInvoice
            order={activeOrder}
            supportPhone={settings.supportPhone}
          />
        </div>
      )}

      {/* 7. MODAL: PAY REMAINING DUE ONLINE VIA OFFICIAL BKASH OR NAGAD MERCHANT GATEWAY */}
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
                        <strong className="text-2xl font-black font-mono">
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
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedDueGateway("bkash")}
                          className={`py-3 px-3 rounded-2xl font-bold border-2 transition cursor-pointer flex flex-col items-center gap-1 ${
                            selectedDueGateway === "bkash"
                              ? "border-[#E2136E] bg-pink-50 text-[#E2136E]"
                              : "border-stone-200 text-stone-600 hover:border-stone-300"
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                          <span className="text-xs font-black">bKash (বিকাশ)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDueGateway("nagad")}
                          className={`py-3 px-3 rounded-2xl font-bold border-2 transition cursor-pointer flex flex-col items-center gap-1 ${
                            selectedDueGateway === "nagad"
                              ? "border-orange-500 bg-orange-50 text-orange-700"
                              : "border-stone-200 text-stone-600 hover:border-stone-300"
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                          <span className="text-xs font-black">Nagad (নগদ)</span>
                        </button>
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
                        className={`flex-1 py-3 px-5 rounded-xl text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition ${
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
