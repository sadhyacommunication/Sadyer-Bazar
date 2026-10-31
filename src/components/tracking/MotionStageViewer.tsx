"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Fish,
  Scale,
  Truck,
  Sparkles,
  Radio,
  Play,
  Pause,
  Compass,
  ThermometerSnowflake,
  ShieldCheck,
  PackageCheck,
  ChevronRight,
  Clock,
  Layers,
} from "lucide-react";
import { OrderStatus } from "@/types";

interface MotionStageViewerProps {
  currentStatus: OrderStatus;
  orderCode: string;
  orderDate: string;
  hasPreorderItems?: boolean;
}

interface StageConfig {
  key: OrderStatus;
  stepNum: number;
  labelBn: string;
  labelEn: string;
  badge: string;
  tagline: string;
  descriptionBn: string;
  imageBg: string;
  accentColor: string;
  metrics: { label: string; value: string }[];
}

const STAGES: StageConfig[] = [
  {
    key: "pending",
    stepNum: 1,
    labelBn: "অর্ডার গৃহীত ও কিউতে সংরক্ষিত",
    labelEn: "Order Placed & Verification Queue",
    badge: "Queue Position #1 — System Verified",
    tagline: "ডিজিটাল ভেরিফিকেশন ও কোল্ড-চেইন ব্যাচ অ্যালোকেশন",
    descriptionBn:
      "আপনার অর্ডারটি কেন্দ্রীয় সিস্টেমে নিবন্ধিত হয়েছে। যমুনা নদী থেকে সকালের তাজা ক্যাচ ও গ্রামীণ খামার পণ্যের জন্য ব্যাচ আইডি বরাদ্দ করা হচ্ছে।",
    imageBg: "/images/banners/hero-gawa-ghee-bogura-doi.jpg",
    accentColor: "#F59E0B",
    metrics: [
      { label: "Verification", value: "Verified & Locked" },
      { label: "Batch Allocation", value: "Express Batch" },
      { label: "Cold-Chain Slot", value: "Reserved" },
    ],
  },
  {
    key: "confirmed",
    stepNum: 2,
    labelBn: "যমুনা নদী ও খামার থেকে তাজা সংগ্রহ",
    labelEn: "Live Fresh River Catch & Village Harvest",
    badge: "Live River Catch — Sirajganj/Dhunot Ghat",
    tagline: "যমুনা নদীর প্রাকৃতিক তাজা মাছ ও খাঁটি গ্রামীণ পণ্য সংগ্রহ",
    descriptionBn:
      "সিরাজগঞ্জ ও ধুনট যমুনা ঘাটে জেলেদের জাল থেকে তাজা দেশি মাছ সংগ্রহ এবং বগুড়ার খাঁটি গাওয়া ঘি ও দই সরাসরি নিজস্ব তত্ত্বাবধানে সংগ্রহ করা হচ্ছে।",
    imageBg: "/images/banners/hero-jamuna-river-dawn.jpg",
    accentColor: "#10B981",
    metrics: [
      { label: "Sourcing Ghat", value: "Jamuna Deep Channel" },
      { label: "Formalin Status", value: "0% (Natural Wild)" },
      { label: "Harvest Time", value: "Morning 04:30 AM" },
    ],
  },
  {
    key: "processing",
    stepNum: 3,
    labelBn: "ডিজিটাল ওজন ও ০°–৪°C কোল্ড-চেইন প্যাক",
    labelEn: "Digital Scale Weighing & Cold-Chain Ice Box",
    badge: "Insulated Cold-Chain Sealing (0°C - 4°C)",
    tagline: "ডিজিটাল স্কেলে সঠিক ওজন ও প্রিমিয়াম আইস-বক্স সিলিং",
    descriptionBn:
      "প্রশিক্ষিত কারিগর দ্বারা মাছের আঁশ পরিষ্কার ও কাটিং সম্পন্ন করে সার্টিফায়েড ডিজিটাল স্কেলে ওজন যাচাই করা হচ্ছে এবং ফুড-গ্রেড থার্মোকুল আইস-বক্সে শুকনো বরফে সিল করা হচ্ছে।",
    imageBg: "/images/banners/jamuna-fisherman-banner.jpg",
    accentColor: "#06B6D4",
    metrics: [
      { label: "Scale Calibration", value: "Certified Tare 0.0g" },
      { label: "Temperature", value: "0.5°C — 3.2°C" },
      { label: "Ice-Box Seal", value: "Airtight Thermocool" },
    ],
  },
  {
    key: "shipped",
    stepNum: 4,
    labelBn: "এক্সপ্রেস হাইওয়ে ও রাইডার ডেলিভারির পথে",
    labelEn: "Cold-Chain Highway Transit & Dispatch",
    badge: "Express Transit — Dhunot to Dhaka Central Hub",
    tagline: "কোল্ড-চেইন ভ্যানে এক্সপ্রেসওয়ে পাড়ি দিয়ে আপনার দরজার পথে",
    descriptionBn:
      "বঙ্গবন্ধু যমুনা সেতু এক্সপ্রেসওয়ে হয়ে পণ্য দ্রুত ঢাকা নিকেতন কেন্দ্রীয় হাবে পৌঁছেছে এবং আপনার এলাকার নির্ধারিত ডেডিকেটেড রাইডার ডেলিভারির উদ্দেশ্যে রওনা দিয়েছেন।",
    imageBg: "/images/banners/hero-village-deshi-poultry.jpg",
    accentColor: "#3B82F6",
    metrics: [
      { label: "Highway Route", value: "Bangabandhu Bridge Exp" },
      { label: "Central Hub", value: "Niketan, Gulshan" },
      { label: "Delivery Fleet", value: "Insulated Box Rider" },
    ],
  },
  {
    key: "delivered",
    stepNum: 5,
    labelBn: "আপনার ঘরে শতভাগ তাজা ডেলিভারি সম্পন্ন",
    labelEn: "Delivered Fresh at Your Doorstep",
    badge: "100% Quality & Freshness Guarantee",
    tagline: "আলহামদুলিল্লাহ! আপনার ঠিকানায় সফলভাবে পণ্য পৌঁছে দেওয়া হয়েছে",
    descriptionBn:
      "নদীর আসল স্বাদ ও সতেজতা বজায় রেখে কোল্ড-চেইন আইস-বক্স আপনার হাতে তুলে দেওয়া হয়েছে। সাধ্যের বাজারের সাথে থাকার জন্য আপনাকে আন্তরিক ধন্যবাদ।",
    imageBg: "/images/hero-banner-bn.jpg",
    accentColor: "#059669",
    metrics: [
      { label: "Delivery Status", value: "Completed & Verified" },
      { label: "Seal Inspection", value: "Intact at Doorstep" },
      { label: "Freshness Rating", value: "5.0 ★★★★★" },
    ],
  },
];

export default function MotionStageViewer({
  currentStatus,
  orderCode,
  orderDate,
  hasPreorderItems,
}: MotionStageViewerProps) {
  // Determine actual current stage index from order status
  const currentActualIndex = Math.max(
    0,
    STAGES.findIndex((s) => s.key === currentStatus)
  );

  // Selected stage for interactive storyboard preview (defaults to current actual status)
  const [selectedStageIndex, setSelectedStageIndex] =
    useState<number>(currentActualIndex);
  const [isPlayingMotion, setIsPlayingMotion] = useState<boolean>(true);
  const [motionTick, setMotionTick] = useState<number>(0);

  // Update selected stage when order updates
  useEffect(() => {
    setSelectedStageIndex(currentActualIndex);
  }, [currentActualIndex]);

  // Motion animation ticker for live dynamic effects (pulses, waves, gauges)
  useEffect(() => {
    if (!isPlayingMotion) return;
    const interval = setInterval(() => {
      setMotionTick((prev) => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [isPlayingMotion]);

  const activeStage = STAGES[selectedStageIndex] || STAGES[0];
  const isViewingLiveStage = selectedStageIndex === currentActualIndex;

  // Calculate dynamic progress percent
  const progressPercent = Math.min(
    100,
    Math.round(((currentActualIndex + 1) / STAGES.length) * 100)
  );

  return (
    <div className="rounded-3xl overflow-hidden border border-emerald-950/20 bg-stone-900 text-white shadow-2xl space-y-0">
      {/* Top Header / Live Telemetry Bar */}
      <div className="bg-[#0A291F] px-5 sm:px-8 py-3.5 border-b border-emerald-800/40 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Live Cold-Chain Motion Radar
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-900/80 text-[10px] font-mono text-emerald-200 border border-emerald-700/50">
            Order #{orderCode}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-xl border border-white/10 text-[11px] text-stone-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Progress:</span>
            <strong className="text-white font-mono">{progressPercent}%</strong>
          </div>

          <button
            type="button"
            onClick={() => setIsPlayingMotion(!isPlayingMotion)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition cursor-pointer"
            title={isPlayingMotion ? "Pause Motion" : "Play Motion"}
          >
            {isPlayingMotion ? (
              <>
                <Pause className="w-3 h-3 text-amber-400" /> Motion Active
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-emerald-400" /> Play Motion
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Cinematic Motion Canvas Window */}
      <div className="relative min-h-[380px] sm:min-h-[460px] flex flex-col justify-between p-6 sm:p-10 overflow-hidden bg-stone-950">
        {/* Dynamic Background Image with Ken-Burns Motion & Ambient Glow */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src={activeStage.imageBg}
            alt={activeStage.labelBn}
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            priority
            className={`object-cover transition-transform duration-1000 ease-out ${
              isPlayingMotion ? "scale-105" : "scale-100"
            }`}
            style={{
              filter: "brightness(0.32) saturate(1.2)",
              transform: isPlayingMotion
                ? `scale(1.08) translate(${Math.sin(motionTick * 0.02) * 4}px, ${
                    Math.cos(motionTick * 0.02) * 3
                  }px)`
                : "none",
            }}
          />
          {/* Radial Ambient Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-950/90 via-stone-950/40 to-transparent" />

          {/* Animated SVG River Waves / Water Ripples (Stages 1 & 2) */}
          {(selectedStageIndex === 0 || selectedStageIndex === 1) && (
            <svg
              className="absolute bottom-0 left-0 right-0 w-full h-32 opacity-25 pointer-events-none"
              viewBox="0 0 1440 320"
              preserveAspectRatio="none"
            >
              <path
                fill="#10B981"
                d={`M0,${160 + Math.sin(motionTick * 0.05) * 20} C320,${
                  220 + Math.cos(motionTick * 0.05) * 20
                } 480,${100 - Math.sin(motionTick * 0.05) * 20} 720,${
                  180 + Math.sin(motionTick * 0.05) * 15
                } C960,${240 - Math.cos(motionTick * 0.05) * 20} 1200,${
                  120 + Math.sin(motionTick * 0.05) * 15
                } 1440,${180} L1440,320 L0,320 Z`}
              />
            </svg>
          )}

          {/* Animated Cold Mist Vapor Particles (Stage 3 - Cold-Chain Ice Box) */}
          {selectedStageIndex === 2 && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div
                className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl"
                style={{
                  top: `${20 + Math.sin(motionTick * 0.04) * 10}%`,
                  right: `${15 + Math.cos(motionTick * 0.03) * 10}%`,
                }}
              />
              <div
                className="absolute w-72 h-72 rounded-full bg-emerald-400/10 blur-3xl"
                style={{
                  bottom: `${10 + Math.cos(motionTick * 0.03) * 10}%`,
                  left: `${20 + Math.sin(motionTick * 0.04) * 10}%`,
                }}
              />
            </div>
          )}

          {/* Animated Speed Lines / Highway Radar (Stage 4 - Transit) */}
          {selectedStageIndex === 3 && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
              <div
                className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent absolute"
                style={{
                  top: "45%",
                  transform: `translateX(${((motionTick * 8) % 1400) - 700}px)`,
                }}
              />
              <div
                className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent absolute"
                style={{
                  top: "60%",
                  transform: `translateX(${((motionTick * 12) % 1400) - 700}px)`,
                }}
              />
            </div>
          )}

          {/* Golden Celebration Sparkles (Stage 5 - Delivered) */}
          {selectedStageIndex === 4 && (
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute w-full h-full bg-radial from-emerald-500/20 via-transparent to-transparent animate-pulse"
                style={{ animationDuration: "3s" }}
              />
            </div>
          )}
        </div>

        {/* Top HUD: Stage Number & Status Pill */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg border"
              style={{
                backgroundColor: activeStage.accentColor,
                color: "#FFFFFF",
                borderColor: "rgba(255,255,255,0.25)",
              }}
            >
              {activeStage.stepNum}
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                Stage {activeStage.stepNum} of 5: {activeStage.labelEn}
              </span>
              <h2 className="text-xl sm:text-3xl font-black text-white mt-0.5 drop-shadow-md">
                {activeStage.labelBn}
              </h2>
            </div>
          </div>

          {/* Active Live Indicator Badge */}
          <div className="flex items-center gap-2">
            {isViewingLiveStage ? (
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-black shadow-inner">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                CURRENT LIVE MILESTONE
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedStageIndex(currentActualIndex)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-emerald-600 border border-white/20 text-white text-xs font-bold transition cursor-pointer"
              >
                <span>Jump to Live Stage #{currentActualIndex + 1}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Middle Stage Content & Dynamic Graphic Widget */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 items-center">
          {/* Left Description & Tagline */}
          <div className="lg:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-amber-300 text-xs font-extrabold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{activeStage.badge}</span>
            </div>

            <p className="text-base sm:text-lg font-bold text-emerald-200">
              {activeStage.tagline}
            </p>

            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-xl">
              {activeStage.descriptionBn}
            </p>

            {/* Quick Live Verification Metrics Card */}
            <div className="grid grid-cols-3 gap-2.5 pt-2 max-w-lg">
              {activeStage.metrics.map((m, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-center"
                >
                  <span className="block text-[10px] uppercase font-bold text-stone-400">
                    {m.label}
                  </span>
                  <span className="block text-xs font-black text-emerald-300 font-mono mt-0.5 truncate">
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Visual Motion Stage Icon / Hologram */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center">
              {/* Pulsing Concentric Radar Rings */}
              <div
                className="absolute inset-0 rounded-full border border-emerald-400/30 animate-ping pointer-events-none"
                style={{ animationDuration: "3s" }}
              />
              <div
                className="absolute inset-4 rounded-full border-2 border-emerald-500/20 pointer-events-none"
                style={{
                  transform: `rotate(${motionTick * 0.5}deg)`,
                  borderStyle: "dashed",
                }}
              />
              <div
                className="absolute inset-8 rounded-full border border-cyan-400/30 pointer-events-none"
                style={{
                  transform: `rotate(-${motionTick * 0.8}deg)`,
                }}
              />

              {/* Central Glowing Icon Sphere */}
              <div
                className="relative w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-md border border-white/30"
                style={{
                  backgroundColor: "rgba(10, 41, 31, 0.85)",
                  boxShadow: `0 0 35px ${activeStage.accentColor}55`,
                }}
              >
                {activeStage.key === "pending" && (
                  <CheckCircle2 className="w-12 h-12 text-amber-400 animate-pulse" />
                )}
                {activeStage.key === "confirmed" && (
                  <Fish
                    className="w-12 h-12 text-emerald-400"
                    style={{
                      transform: `rotate(${Math.sin(motionTick * 0.08) * 12}deg)`,
                    }}
                  />
                )}
                {activeStage.key === "processing" && (
                  <Scale
                    className="w-12 h-12 text-cyan-400"
                    style={{
                      transform: `rotate(${Math.sin(motionTick * 0.05) * 8}deg)`,
                    }}
                  />
                )}
                {activeStage.key === "shipped" && (
                  <Truck
                    className="w-12 h-12 text-blue-400"
                    style={{
                      transform: `translateX(${
                        Math.sin(motionTick * 0.1) * 6
                      }px)`,
                    }}
                  />
                )}
                {activeStage.key === "delivered" && (
                  <PackageCheck className="w-12 h-12 text-emerald-400 scale-110 animate-bounce" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Storyboard Scrubber (Click any stage to inspect) */}
        <div className="relative z-10 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-2">
            <span className="flex items-center gap-1 font-bold text-stone-300">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Interactive Storyboard (প্রতিটি ধাপ ক্লিক করে দেখুন):
            </span>
            <span className="font-mono text-[11px] text-emerald-400">
              Active: Stage #{activeStage.stepNum}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
            {STAGES.map((s, idx) => {
              const isCompleted = idx <= currentActualIndex;
              const isSelected = idx === selectedStageIndex;
              const isActualCurrent = idx === currentActualIndex;

              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelectedStageIndex(idx)}
                  className={`p-2 sm:p-3 rounded-2xl text-left transition-all cursor-pointer relative ${
                    isSelected
                      ? "bg-white/20 border-2 border-emerald-400 shadow-md scale-[1.02]"
                      : isCompleted
                      ? "bg-emerald-950/40 hover:bg-white/10 border border-emerald-500/30"
                      : "bg-black/30 hover:bg-white/5 border border-white/10 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                        isCompleted
                          ? "bg-emerald-500 text-white"
                          : "bg-stone-700 text-stone-300"
                      }`}
                    >
                      {isCompleted ? "✓" : idx + 1}
                    </span>
                    {isActualCurrent && (
                      <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full bg-[#C83E2B] text-[9px] font-bold text-white">
                        LIVE
                      </span>
                    )}
                  </div>
                  <span className="block text-[11px] sm:text-xs font-bold text-white mt-1.5 truncate">
                    {s.labelBn.split(" ")[0]} {s.labelBn.split(" ")[1] || ""}
                  </span>
                  <span className="hidden sm:block text-[10px] text-stone-400 truncate">
                    {s.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
