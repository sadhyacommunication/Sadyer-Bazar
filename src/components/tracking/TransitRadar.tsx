"use client";

import React, { useState } from "react";
import {
  MapPin,
  Truck,
  PhoneCall,
  Copy,
  Check,
  Compass,
  Building2,
  Home,
  CheckCircle2,
  Navigation,
} from "lucide-react";
import { OrderStatus } from "@/types";

interface TransitRadarProps {
  orderStatus: OrderStatus;
  deliveryZone: string;
  deliveryAddress: string;
  courierName?: string;
  trackingReference?: string;
  riderName?: string;
  riderPhone?: string;
  supportPhone: string;
}

export default function TransitRadar({
  orderStatus,
  deliveryZone,
  deliveryAddress,
  courierName,
  trackingReference,
  riderName,
  riderPhone,
  supportPhone,
}: TransitRadarProps) {
  const [copiedRef, setCopiedRef] = useState(false);

  const handleCopyRef = (refText: string) => {
    navigator.clipboard.writeText(refText);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const getActiveWaypointIndex = (status: OrderStatus) => {
    switch (status) {
      case "pending":
      case "confirmed":
        return 0; // Dhunot / Jamuna River Hub
      case "processing":
        return 1; // Packaging & Jamuna Bridge Expressway
      case "shipped":
        return 2; // Dhaka Niketan Central Hub to Local Route
      case "delivered":
        return 3; // Doorstep
      default:
        return 0;
    }
  };

  const activeWaypoint = getActiveWaypointIndex(orderStatus);

  const WAYPOINTS = [
    {
      titleBn: "ধুনট ও সিরাজগঞ্জ যমুনা ঘাট",
      titleEn: "Dhunot & Sirajganj Jamuna Ghat Hub",
      subtext: "নদী থেকে আহরণ ও প্রাথমিক বরফজাতকরণ",
      icon: Navigation,
      badge: "Origin Hub",
    },
    {
      titleBn: "বঙ্গবন্ধু যমুনা সেতু এক্সপ্রেসওয়ে",
      titleEn: "Bangabandhu Jamuna Bridge Expressway",
      subtext: "ইনসুলেটেড ভ্যানে হাইওয়ে কোল্ড-চেইন ট্রানজিট",
      icon: Truck,
      badge: "Highway Corridor",
    },
    {
      titleBn: "ঢাকা সেন্ট্রাল ডিস্ট্রিবিউশন হাব",
      titleEn: "Dhaka Central Distribution Hub",
      subtext: "বাড়ি ৯০, রোড ২, ব্লক এ, নিকেতন, গুলশান",
      icon: Building2,
      badge: "City Sorting Hub",
    },
    {
      titleBn: "আপনার ডেলিভারি ঠিকানা",
      titleEn: "Your Doorstep Delivery",
      subtext: deliveryAddress || (deliveryZone === "inside_dhaka" ? "ঢাকা শহর" : "ঢাকার বাইরে"),
      icon: Home,
      badge: "Destination",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Visual Route Schematic Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200/90 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#0F3D2E]">
              <Compass className="w-4 h-4 text-emerald-700" />
              Live Route Radar & Highway Transit
            </span>
            <h3 className="text-lg font-black text-stone-900">
              যমুনা ঘাট থেকে আপনার বাড়ি — কোল্ড-চেইন ট্রানজিট ম্যাপ
            </h3>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold font-mono">
            Direct Cold-Chain Corridor
          </span>
        </div>

        {/* 4-Step Animated Geographic Route Nodes */}
        <div className="relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden sm:block absolute top-7 left-8 right-8 h-1 bg-stone-200 z-0">
            <div
              className="h-full bg-[#0F3D2E] transition-all duration-700 ease-out"
              style={{
                width: `${(activeWaypoint / (WAYPOINTS.length - 1)) * 100}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative z-10">
            {WAYPOINTS.map((wp, idx) => {
              const isPast = idx < activeWaypoint;
              const isCurrent = idx === activeWaypoint;
              const IconComp = wp.icon;

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCurrent
                      ? "border-2 border-[#0F3D2E] bg-emerald-50/60 shadow-xs ring-2 ring-emerald-500/20"
                      : isPast
                      ? "border-emerald-200 bg-emerald-50/20"
                      : "border-stone-200 bg-stone-50/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold transition-all shadow-xs ${
                        isCurrent
                          ? "bg-[#0F3D2E] text-amber-300 scale-105"
                          : isPast
                          ? "bg-emerald-600 text-white"
                          : "bg-stone-200 text-stone-600"
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <IconComp className="w-5 h-5" />
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        isCurrent
                          ? "bg-[#C83E2B] text-white"
                          : isPast
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-stone-200 text-stone-600"
                      }`}
                    >
                      {isCurrent ? "Active Radar" : wp.badge}
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-extrabold text-stone-900 line-clamp-1">
                    {wp.titleBn}
                  </h4>
                  <p className="text-[11px] text-[#0F3D2E] font-medium truncate">
                    {wp.titleEn}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-1 line-clamp-2">
                    {wp.subtext}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Assigned Courier & Delivery Rider Dispatch Card */}
      {courierName && (
        <div className="p-5 sm:p-6 rounded-3xl bg-blue-50/90 border border-blue-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Truck className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800">
                Assigned Cold-Chain Courier & Dispatch Fleet
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base sm:text-lg font-black text-stone-900">
                  {courierName}
                </h4>
                {trackingReference && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-blue-950 font-bold">
                    Ref: {trackingReference}
                    <button
                      type="button"
                      onClick={() => handleCopyRef(trackingReference)}
                      className="p-0.5 hover:text-blue-600 cursor-pointer"
                      title="Copy Reference"
                    >
                      {copiedRef ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-stone-400" />
                      )}
                    </button>
                  </span>
                )}
              </div>

              {riderName && (
                <p className="text-xs text-stone-700">
                  Delivery Agent / Rider:{" "}
                  <strong className="text-stone-900 font-bold">{riderName}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions (Call Rider / Call Hotline) */}
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
            {riderPhone && (
              <a
                href={`tel:${riderPhone}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Rider ({riderPhone})</span>
              </a>
            )}
            <a
              href={`tel:${supportPhone}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 text-xs font-bold transition"
            >
              <span>Hotline Help</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
