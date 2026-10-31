"use client";

import React from "react";
import {
  ThermometerSnowflake,
  ShieldCheck,
  Scale,
  Sparkles,
  CheckCircle2,
  Info,
} from "lucide-react";

interface FreshnessTelemetryProps {
  orderStatus: string;
  weightAdjustmentAmount?: number;
  weightAdjustmentNote?: string;
  hasPreorderItems?: boolean;
}

export default function FreshnessTelemetry({
  orderStatus,
  weightAdjustmentAmount,
  weightAdjustmentNote,
  hasPreorderItems,
}: FreshnessTelemetryProps) {
  const isDelivered = orderStatus === "delivered";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Cold-Chain Temperature Gauge */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-cyan-950/20 via-white to-cyan-50/40 border border-cyan-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-900 text-[11px] font-extrabold uppercase tracking-wider">
            <ThermometerSnowflake className="w-3.5 h-3.5 text-cyan-700 animate-pulse" />
            Cold-Chain Telemetry
          </span>
          <span className="text-[11px] font-mono font-bold text-cyan-800 bg-white px-2 py-0.5 rounded-lg border border-cyan-200">
            {isDelivered ? "Delivered Cold" : "Active 0°C – 4°C"}
          </span>
        </div>

        <div className="my-3 flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-black font-mono text-cyan-950">
            2.4°C
          </span>
          <span className="text-xs font-bold text-cyan-800">
            Optimal Chilled Zone
          </span>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed">
          ফুড-গ্রেড থার্মোকুল বক্সে শুকনো বরফ ও ক্রাশড আইস দিয়ে মোড়ানো, যা নদীর সতেজতা এবং পুষ্টিগুণ সম্পূর্ণ অক্ষুণ্ণ রাখে।
        </p>
      </div>

      {/* 2. Formalin-Free & Quality Guarantee */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/20 via-white to-emerald-50/40 border border-emerald-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-extrabold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            100% Quality Purity
          </span>
          <span className="text-[11px] font-mono font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
            Formalin: 0.00%
          </span>
        </div>

        <div className="my-3 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-stone-900">
              শতভাগ রাসায়নিক ও ফর্মালিনমুক্ত
            </h4>
            <p className="text-[11px] text-emerald-800 font-semibold">
              সরাসরি যমুনার জেলে ও গ্রামীণ খামার উৎস
            </p>
          </div>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed">
          কোনো কৃত্রিম রং, প্রিজারভেটিভ বা কেমিক্যাল ছাড়া সংগৃহীত। প্রতিটি ব্যাচ কঠোর মান নিয়ন্ত্রণ পেরিয়ে ঢাকায় আনা হয়।
        </p>
      </div>

      {/* 3. Certified Digital Scale Weight Verification */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-950/20 via-white to-amber-50/40 border border-amber-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-950 text-[11px] font-extrabold uppercase tracking-wider">
            <Scale className="w-3.5 h-3.5 text-amber-700" />
            Digital Scale Precision
          </span>
          <span className="text-[11px] font-mono font-bold text-amber-800 bg-white px-2 py-0.5 rounded-lg border border-amber-200">
            Tare Calibrated
          </span>
        </div>

        <div className="my-3">
          {weightAdjustmentAmount !== undefined && weightAdjustmentAmount !== 0 ? (
            <div className="space-y-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black font-mono text-amber-950">
                  {weightAdjustmentAmount > 0 ? "+" : ""}৳
                  {weightAdjustmentAmount}
                </span>
                <span className="text-xs font-bold text-amber-900">
                  স্কেল অ্যাডজাস্টমেন্ট
                </span>
              </div>
              <p className="text-[11px] text-amber-900 line-clamp-2">
                {weightAdjustmentNote ||
                  "মাছ সংগ্রহের পর ডিজিটাল স্কেলে নিখুঁত ওজনের উপর মূল্য সমন্বয় করা হয়েছে।"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-stone-900">
                সার্টিফায়েড ডিজিটাল স্কেলে ওজন
              </h4>
              <p className="text-[11px] text-stone-600">
                বক্সের কোনো অতিরিক্ত ওজন নয়, শুধুমাত্র নিট পণ্য ওজন করে সিল করা হয়।
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-amber-800 font-medium">
          <Info className="w-3.5 h-3.5 shrink-0 text-amber-600" />
          <span>ওজনে শতভাগ বিশ্বস্ততা ও স্বচ্ছতার নিশ্চয়তা</span>
        </div>
      </div>
    </div>
  );
}
