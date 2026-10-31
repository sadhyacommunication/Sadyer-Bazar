"use client";

import React, { useState, useEffect } from "react";
import {
  Flame,
  Calendar,
  Truck,
  ShieldCheck,
  Fish,
  Clock,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import ProductCard from "@/components/storefront/ProductCard";
import { calculatePreorderCountdown } from "@/lib/preorder/content";

export default function PreOrdersPage() {
  const { products, settings, preorderSettings } = useStore();
  const preorderProducts = products.filter((p) => p.isActive && p.isPreorder);

  const [countdown, setCountdown] = useState(() =>
    calculatePreorderCountdown(preorderSettings.cutoffTime)
  );

  useEffect(() => {
    setCountdown(calculatePreorderCountdown(preorderSettings.cutoffTime));
    const timer = setInterval(() => {
      setCountdown(calculatePreorderCountdown(preorderSettings.cutoffTime));
    }, 1000);
    return () => clearInterval(timer);
  }, [preorderSettings.cutoffTime]);

  const advancePct =
    preorderSettings.advancePercent ?? settings.preorderAdvancePercent ?? 25;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Optional Urgent Campaign Notice */}
      {preorderSettings.showBannerAlert && preorderSettings.bannerAlert && (
        <div className="px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs sm:text-sm font-bold flex items-center gap-3 shadow-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
          <span>{preorderSettings.bannerAlert}</span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#0F3D2E] via-[#134b39] to-[#C83E2B]/90 text-white rounded-3xl p-6 sm:p-12 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-xs text-amber-300 text-xs font-bold uppercase tracking-wider self-start">
            <Flame className="w-4 h-4 fill-current text-amber-300" />
            {preorderSettings.badgeText || "Live Nationwide Pre-Order Campaign"}
          </div>

          {/* Live Countdown Clock Badge */}
          {preorderSettings.showCountdown && (
            <div className="bg-black/35 backdrop-blur-xs border border-white/15 px-4 py-2.5 rounded-2xl flex items-center gap-3 self-start sm:self-auto">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Cut-Off:</span>
              </div>
              {countdown.isExpired ||
              preorderSettings.batchStatus !== "booking_open" ? (
                <span className="text-xs font-bold text-stone-200">
                  {preorderSettings.closedMessage || "বর্তমান ব্যাচ সম্পন্ন"}
                </span>
              ) : (
                <div className="flex items-center gap-1 font-mono text-xs sm:text-sm font-extrabold text-amber-300">
                  <span className="px-1.5 py-0.5 rounded bg-white/10">
                    {String(countdown.days).padStart(2, "0")}d
                  </span>
                  <span>:</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/10">
                    {String(countdown.hours).padStart(2, "0")}h
                  </span>
                  <span>:</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/10">
                    {String(countdown.minutes).padStart(2, "0")}m
                  </span>
                  <span>:</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#C83E2B] text-white">
                    {String(countdown.seconds).padStart(2, "0")}s
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold max-w-3xl leading-tight">
          {preorderSettings.headline ||
            "Why We Take Pre-Orders for Jamuna River Fish & Bogura Shahi Doi"}
        </h1>
        <p className="text-xs sm:text-base text-emerald-50/90 max-w-2xl leading-relaxed">
          {preorderSettings.subheadline ||
            "True wild river fish and clay-pot Bogura Doi cannot sit on warehouse shelves. We aggregate family pre-orders across Bangladesh, harvest fresh at dawn from the Jamuna River & Sherpur Bogura artisans, and dispatch straight to your doorstep the exact same day."}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-black/25 backdrop-blur-xs p-4 rounded-2xl border border-white/15 flex items-start gap-3">
            <Calendar className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Batch Cut-Off Schedule</h3>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                {preorderSettings.expectedDeliveryDate ||
                  "Orders close Wednesday 10:00 PM for Friday Morning Delivery."}
              </p>
            </div>
          </div>
          <div className="bg-black/25 backdrop-blur-xs p-4 rounded-2xl border border-white/15 flex items-start gap-3">
            <Truck className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Insulated Ice-Box Delivery</h3>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Inside Dhaka ৳{settings.insideDhakaFee} • Outside Dhaka ৳
                {settings.outsideDhakaFee} nationwide.
              </p>
            </div>
          </div>
          <div className="bg-black/25 backdrop-blur-xs p-4 rounded-2xl border border-white/15 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">
                Flexible {advancePct}% Advance or Full Pay
              </h3>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Confirm your slot via bKash / Nagad or Cash on Delivery.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Pre-Order Batch Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#C83E2B] flex items-center gap-1.5">
              <Fish className="w-4 h-4" /> Limited Batch Allocation
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-1">
              Active Pre-Order Products ({preorderProducts.length})
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
          {preorderProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
