"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Calendar,
  Truck,
  ShieldCheck,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  RefreshCw,
  Sparkles,
  Fish,
  Layers,
  ChevronRight,
  Eye,
  Info,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import {
  PreorderBatchStatus,
  PreorderSettingsInput,
  PREORDER_BATCH_STATUSES,
} from "@/lib/preorder/schema";
import {
  DEFAULT_PREORDER_SETTINGS,
  calculatePreorderCountdown,
} from "@/lib/preorder/content";

function toDatetimeLocal(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      const fallback = new Date(Date.now() + 48 * 3600 * 1000);
      return fallback.toISOString().slice(0, 16);
    }
    // format YYYY-MM-DDTHH:mm in local time
    const tzOffset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - tzOffset);
    return local.toISOString().slice(0, 16);
  } catch {
    return new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16);
  }
}

function fromDatetimeLocal(localStr: string): string {
  try {
    const d = new Date(localStr);
    if (isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export default function PreorderManager() {
  const {
    products,
    preorderSettings,
    savePreorderSettings,
    syncPreorderBatchToProducts,
    resetPreorderBatchBookedQty,
    showToast,
  } = useStore();

  const [form, setForm] = useState<PreorderSettingsInput>({
    isBatchActive: preorderSettings.isBatchActive,
    batchStatus: preorderSettings.batchStatus,
    badgeText: preorderSettings.badgeText,
    headline: preorderSettings.headline,
    subheadline: preorderSettings.subheadline,
    cutoffTime: preorderSettings.cutoffTime,
    expectedDeliveryDate: preorderSettings.expectedDeliveryDate,
    dispatchLocation: preorderSettings.dispatchLocation,
    closedMessage: preorderSettings.closedMessage,
    showCountdown: preorderSettings.showCountdown,
    requireAdvancePayment: preorderSettings.requireAdvancePayment,
    advancePercent: preorderSettings.advancePercent,
    bannerAlert: preorderSettings.bannerAlert,
    showBannerAlert: preorderSettings.showBannerAlert,
    maxBatchCapacity: preorderSettings.maxBatchCapacity,
  });

  const [saving, setSaving] = useState(false);
  const [syncingDates, setSyncingDates] = useState(false);
  const [resettingBooked, setResettingBooked] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Sync form with context updates
  useEffect(() => {
    setForm({
      isBatchActive: preorderSettings.isBatchActive,
      batchStatus: preorderSettings.batchStatus,
      badgeText: preorderSettings.badgeText,
      headline: preorderSettings.headline,
      subheadline: preorderSettings.subheadline,
      cutoffTime: preorderSettings.cutoffTime,
      expectedDeliveryDate: preorderSettings.expectedDeliveryDate,
      dispatchLocation: preorderSettings.dispatchLocation,
      closedMessage: preorderSettings.closedMessage,
      showCountdown: preorderSettings.showCountdown,
      requireAdvancePayment: preorderSettings.requireAdvancePayment,
      advancePercent: preorderSettings.advancePercent,
      bannerAlert: preorderSettings.bannerAlert,
      showBannerAlert: preorderSettings.showBannerAlert,
      maxBatchCapacity: preorderSettings.maxBatchCapacity,
    });
  }, [preorderSettings]);

  // Live countdown ticker inside the admin panel
  const [countdown, setCountdown] = useState(() =>
    calculatePreorderCountdown(form.cutoffTime)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(calculatePreorderCountdown(form.cutoffTime));
    }, 1000);
    return () => clearInterval(timer);
  }, [form.cutoffTime]);

  // Preset setter helpers
  const handleQuickPreset = (hoursFromNow: number) => {
    const target = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    setForm((prev) => ({ ...prev, cutoffTime: target.toISOString() }));
    showToast(`Cut-off set to ${hoursFromNow} hours from now.`);
  };

  const handleNextWednesdayNight = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday, 3 is Wednesday
    let daysUntilWednesday = (3 - dayOfWeek + 7) % 7;
    if (daysUntilWednesday === 0 && now.getHours() >= 22) {
      daysUntilWednesday = 7;
    }
    const target = new Date(now);
    target.setDate(now.getDate() + daysUntilWednesday);
    target.setHours(22, 0, 0, 0); // 10:00 PM
    setForm((prev) => ({
      ...prev,
      cutoffTime: target.toISOString(),
      expectedDeliveryDate: "Friday Morning Batch (শুক্রবার সকালের ডেলিভারি)",
    }));
    showToast("Cut-off preset: Next Wednesday 10:00 PM (Friday Delivery).");
  };

  const handleNextFridayMorning = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 5 is Friday
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0 && now.getHours() >= 8) {
      daysUntilFriday = 7;
    }
    const target = new Date(now);
    target.setDate(now.getDate() + daysUntilFriday);
    target.setHours(8, 0, 0, 0); // 08:00 AM
    setForm((prev) => ({
      ...prev,
      cutoffTime: target.toISOString(),
      expectedDeliveryDate: "Saturday Morning Batch (শনিবার সকালের ডেলিভারি)",
    }));
    showToast("Cut-off preset: Next Friday 08:00 AM (Saturday Delivery).");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await savePreorderSettings(form);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncToProducts = async () => {
    setSyncingDates(true);
    try {
      await syncPreorderBatchToProducts();
    } finally {
      setSyncingDates(false);
    }
  };

  const handleResetBatchBooked = async () => {
    setResettingBooked(true);
    try {
      await resetPreorderBatchBookedQty();
      setShowResetConfirm(false);
    } finally {
      setResettingBooked(false);
    }
  };

  const handleResetDefaults = () => {
    if (!confirm("Are you sure you want to reset all pre-order copy to default?")) return;
    setForm({
      isBatchActive: DEFAULT_PREORDER_SETTINGS.isBatchActive,
      batchStatus: DEFAULT_PREORDER_SETTINGS.batchStatus,
      badgeText: DEFAULT_PREORDER_SETTINGS.badgeText,
      headline: DEFAULT_PREORDER_SETTINGS.headline,
      subheadline: DEFAULT_PREORDER_SETTINGS.subheadline,
      cutoffTime: DEFAULT_PREORDER_SETTINGS.cutoffTime,
      expectedDeliveryDate: DEFAULT_PREORDER_SETTINGS.expectedDeliveryDate,
      dispatchLocation: DEFAULT_PREORDER_SETTINGS.dispatchLocation,
      closedMessage: DEFAULT_PREORDER_SETTINGS.closedMessage,
      showCountdown: DEFAULT_PREORDER_SETTINGS.showCountdown,
      requireAdvancePayment: DEFAULT_PREORDER_SETTINGS.requireAdvancePayment,
      advancePercent: DEFAULT_PREORDER_SETTINGS.advancePercent,
      bannerAlert: DEFAULT_PREORDER_SETTINGS.bannerAlert,
      showBannerAlert: DEFAULT_PREORDER_SETTINGS.showBannerAlert,
      maxBatchCapacity: DEFAULT_PREORDER_SETTINGS.maxBatchCapacity,
    });
    showToast("Reset form to factory defaults. Click 'Save Batch Settings' to apply.");
  };

  // Pre-order products in catalog
  const preorderProducts = useMemo(
    () => products.filter((p) => p.isPreorder),
    [products]
  );

  const totalTargetCapacity = preorderProducts.reduce(
    (sum, p) => sum + (p.batchTargetQty || 0),
    0
  );
  const totalBookedCapacity = preorderProducts.reduce(
    (sum, p) => sum + (p.batchBookedQty || 0),
    0
  );
  const overallCapacityPercent =
    totalTargetCapacity > 0
      ? Math.min(Math.round((totalBookedCapacity / totalTargetCapacity) * 100), 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Top Banner / Header */}
      <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-rose-50 text-[#C83E2B] flex items-center justify-center font-bold text-sm">
              <Flame className="w-4 h-4 fill-current" />
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#C83E2B]">
              Campaign & Catch Schedule Control
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Live Pre-Order Batch Management
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 max-w-2xl">
            Control the live storefront cut-off countdown clock, batch schedule,
            catch dispatch headlines, advance booking requirements, and product
            capacity quotas in real time.
          </p>
        </div>

        {/* Global Status Pill & Quick Action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                form.isBatchActive && form.batchStatus === "booking_open"
                  ? "bg-emerald-500 animate-pulse"
                  : form.batchStatus === "paused"
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                Batch Status
              </span>
              <span className="text-xs font-extrabold text-stone-900">
                {form.batchStatus === "booking_open"
                  ? "Booking Open (চলমান)"
                  : form.batchStatus === "paused"
                  ? "Paused (সাময়িক স্থগিত)"
                  : form.batchStatus === "sold_out"
                  ? "Sold Out (কোটা পূর্ণ)"
                  : "Batch Closed (বুকিং বন্ধ)"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-3 rounded-2xl bg-[#0F3D2E] hover:bg-[#134b39] text-white text-xs sm:text-sm font-extrabold shadow-md hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4 text-amber-300" />
            )}
            <span>{saving ? "Saving..." : "Save Batch Settings"}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* CARD 1: LIVE COUNTDOWN & CUT-OFF CONTROLLER */}
        <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-stone-900">
                  Cut-Off Timer & Batch Phase
                </h3>
                <p className="text-xs text-stone-500">
                  Set the target cut-off deadline that powers the live storefront countdown.
                </p>
              </div>
            </div>

            {/* Batch Status Dropdown */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-stone-600">Batch State:</label>
              <select
                value={form.batchStatus}
                onChange={(e) =>
                  setForm({
                    ...form,
                    batchStatus: e.target.value as PreorderBatchStatus,
                    isBatchActive: e.target.value === "booking_open",
                  })
                }
                className="px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-extrabold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
              >
                <option value="booking_open">🟢 Booking Open (চলমান)</option>
                <option value="paused">🟡 Paused (সাময়িক স্থগিত)</option>
                <option value="booking_closed">🔴 Batch Closed (বুকিং বন্ধ)</option>
                <option value="sold_out">⛔ Sold Out (কোটা পূর্ণ)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Cut-off Input & Presets */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600 mb-1.5">
                  Batch Cut-Off Date & Time (Local Time)
                </label>
                <input
                  type="datetime-local"
                  value={toDatetimeLocal(form.cutoffTime)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cutoffTime: fromDatetimeLocal(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-mono font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
                  Quick Schedule Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickPreset(24)}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
                  >
                    +24 Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPreset(48)}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
                  >
                    +48 Hours
                  </button>
                  <button
                    type="button"
                    onClick={handleNextWednesdayNight}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#0F3D2E] text-xs font-extrabold transition cursor-pointer border border-emerald-200"
                  >
                    Next Wednesday 10:00 PM (Friday Delivery)
                  </button>
                  <button
                    type="button"
                    onClick={handleNextFridayMorning}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-extrabold transition cursor-pointer border border-amber-200"
                  >
                    Next Friday 08:00 AM (Saturday Delivery)
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6 pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-extrabold text-stone-700">
                  <input
                    type="checkbox"
                    checked={form.showCountdown}
                    onChange={(e) =>
                      setForm({ ...form, showCountdown: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-[#0F3D2E] focus:ring-[#0F3D2E] cursor-pointer"
                  />
                  <span>Show Cut-Off Countdown Clock on Storefront</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-extrabold text-stone-700">
                  <input
                    type="checkbox"
                    checked={form.isBatchActive}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        isBatchActive: e.target.checked,
                        batchStatus: e.target.checked
                          ? "booking_open"
                          : "booking_closed",
                      })
                    }
                    className="w-4 h-4 rounded text-[#0F3D2E] focus:ring-[#0F3D2E] cursor-pointer"
                  />
                  <span>Active Batch (Accepting Orders)</span>
                </label>
              </div>
            </div>

            {/* Live Countdown Display Box */}
            <div className="lg:col-span-5 bg-stone-950 text-white rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg border border-stone-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-extrabold text-amber-400">
                  <Clock className="w-4 h-4" />
                  <span>STOREFRONT COUNTDOWN TICKER</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-white/10 text-stone-300">
                  {countdown.isExpired ? "EXPIRED" : "LIVE TICKING"}
                </span>
              </div>

              {countdown.isExpired ? (
                <div className="text-center py-4 bg-rose-950/40 border border-rose-800/50 rounded-2xl">
                  <span className="text-rose-300 font-extrabold text-sm block">
                    BATCH CUT-OFF REACHED
                  </span>
                  <span className="text-[11px] text-rose-200/80">
                    Countdown reached 0. Storefront shows batch closed.
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 font-mono text-sm sm:text-base font-extrabold">
                  <div className="flex flex-col items-center">
                    <span className="px-2.5 py-1.5 rounded-xl bg-white/10 text-amber-300 min-w-[42px] text-center text-lg">
                      {String(countdown.days).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-stone-400 mt-1">
                      Days
                    </span>
                  </div>
                  <span className="text-stone-400 font-bold text-lg -mt-3">:</span>
                  <div className="flex flex-col items-center">
                    <span className="px-2.5 py-1.5 rounded-xl bg-white/10 text-amber-300 min-w-[42px] text-center text-lg">
                      {String(countdown.hours).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-stone-400 mt-1">
                      Hours
                    </span>
                  </div>
                  <span className="text-stone-400 font-bold text-lg -mt-3">:</span>
                  <div className="flex flex-col items-center">
                    <span className="px-2.5 py-1.5 rounded-xl bg-white/10 text-amber-300 min-w-[42px] text-center text-lg">
                      {String(countdown.minutes).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-stone-400 mt-1">
                      Mins
                    </span>
                  </div>
                  <span className="text-stone-400 font-bold text-lg -mt-3">:</span>
                  <div className="flex flex-col items-center">
                    <span className="px-2.5 py-1.5 rounded-xl bg-[#C83E2B] text-white min-w-[42px] text-center text-lg shadow-sm">
                      {String(countdown.seconds).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-stone-400 mt-1">
                      Secs
                    </span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-stone-400 text-center">
                Reflects target cut-off:{" "}
                <span className="text-amber-200">
                  {new Date(form.cutoffTime).toLocaleString()}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* CARD 2: HEADLINES, MARKETING COPY & DISPATCH NOTICES */}
        <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0F3D2E] flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-stone-900">
                Banner Headlines, Copy & Dispatch Hub
              </h3>
              <p className="text-xs text-stone-500">
                Customize titles, slogans, dispatch explanations, and urgent announcement banners.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600 mb-1.5">
                Badge Text (ছোট ক্যাচলাইন / টপ ট্যাগ)
              </label>
              <input
                type="text"
                value={form.badgeText}
                onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                placeholder="e.g. LIVE PRE-ORDER BATCH BOOKING"
                className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600 mb-1.5">
                Expected Delivery Date (ডেলিভারির তারিখ ও সময়)
              </label>
              <input
                type="text"
                value={form.expectedDeliveryDate}
                onChange={(e) =>
                  setForm({ ...form, expectedDeliveryDate: e.target.value })
                }
                placeholder="e.g. Friday Morning Batch (শুক্রবার সকালের ডেলিভারি)"
                className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600 mb-1.5">
                Batch Headline (প্রধান শিরোনাম)
              </label>
              <input
                type="text"
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                placeholder="e.g. Next Jamuna River Catch & Bogura Doi Dispatch"
                className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-extrabold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600 mb-1.5">
                Batch Subheadline / Description (বিবরণ)
              </label>
              <textarea
                value={form.subheadline}
                onChange={(e) => setForm({ ...form, subheadline: e.target.value })}
                rows={2}
                placeholder="Reserve your share before the batch closes. Caught at dawn and delivered straight to your home in thermal boxes."
                className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs sm:text-sm text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600 mb-1.5">
                Dispatch Hub / Origin Source (উৎস ও প্রেরণের স্থান)
              </label>
              <input
                type="text"
                value={form.dispatchLocation}
                onChange={(e) =>
                  setForm({ ...form, dispatchLocation: e.target.value })
                }
                placeholder="e.g. যমুনা নদীর ঘাট (সিরাজগঞ্জ) ও শেরপুর, বগুড়া"
                className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600 mb-1.5">
                Batch Closed Message (বুকিং বন্ধ হলে প্রদর্শিত বার্তা)
              </label>
              <input
                type="text"
                value={form.closedMessage}
                onChange={(e) =>
                  setForm({ ...form, closedMessage: e.target.value })
                }
                placeholder="বর্তমান ব্যাচের বুকিং সম্পন্ন হয়েছে। পরবর্তী ব্যাচ শিগগিরই শুরু হবে।"
                className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-medium text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]"
              />
            </div>

            {/* Urgent Alert Banner Toggle & Text */}
            <div className="md:col-span-2 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-extrabold text-amber-950">
                <input
                  type="checkbox"
                  checked={form.showBannerAlert}
                  onChange={(e) =>
                    setForm({ ...form, showBannerAlert: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>Show Urgent Pre-Order Campaign Notice Banner (জরুরি নোটিশ বার)</span>
              </label>

              {form.showBannerAlert && (
                <input
                  type="text"
                  value={form.bannerAlert}
                  onChange={(e) =>
                    setForm({ ...form, bannerAlert: e.target.value })
                  }
                  placeholder="e.g. সীমিত কোটা: তাজা নদীর মাছ ও বগুড়ার শাহী দইয়ের অগ্রিম বুকিং চলছে।"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-amber-300 text-xs font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              )}
            </div>
          </div>
        </div>

        {/* CARD 3: PAYMENT & ADVANCE RULES */}
        <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-stone-900">
                Advance Payment & Booking Rules
              </h3>
              <p className="text-xs text-stone-500">
                Require advance payment to prevent phantom bookings for perishable river catches.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-extrabold text-stone-800">
                <input
                  type="checkbox"
                  checked={form.requireAdvancePayment}
                  onChange={(e) =>
                    setForm({ ...form, requireAdvancePayment: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-[#0F3D2E] focus:ring-[#0F3D2E] cursor-pointer"
                />
                <span>Enforce Advance Payment for Pre-Order Items</span>
              </label>

              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600">
                  Advance Payment Percentage ({form.advancePercent}%)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={form.advancePercent}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        advancePercent: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full accent-[#0F3D2E] cursor-pointer"
                  />
                  <span className="w-16 px-3 py-1.5 rounded-xl bg-stone-100 text-stone-900 font-mono font-bold text-center text-xs">
                    {form.advancePercent}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-stone-900">
                <Info className="w-4 h-4 text-emerald-600" />
                <span>How advance payments protect procurement:</span>
              </div>
              <p>
                When enabled, checkout calculates {form.advancePercent}% of the
                order total for pre-order goods. Customers pay this amount via
                bKash or Nagad to secure their share of the dawn catch. The
                remaining balance is settled on Cash on Delivery.
              </p>
            </div>
          </div>
        </div>

        {/* CARD 4: PRE-ORDER ITEMS & BATCH CAPACITY PROGRESS */}
        <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-[#C83E2B] flex items-center justify-center font-bold">
                <Fish className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-stone-900">
                  Pre-Order Catalog Items & Batch Quota
                </h3>
                <p className="text-xs text-stone-500">
                  {preorderProducts.length} items flagged for pre-order in the catalog.
                </p>
              </div>
            </div>

            {/* Batch Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleSyncToProducts}
                disabled={syncingDates}
                className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#0F3D2E] border border-emerald-200 text-xs font-extrabold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>
                  {syncingDates
                    ? "Syncing Schedule..."
                    : "Sync Schedule to All Items"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                disabled={resettingBooked}
                className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-extrabold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-stone-500" />
                <span>Reset Booked Quantities</span>
              </button>
            </div>
          </div>

          {/* Reset Confirmation Dialog */}
          {showResetConfirm && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-rose-900">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold">
                    Start a New Batch & Reset Booked Quantities?
                  </h4>
                  <p className="text-[11px] text-rose-700">
                    This will set booked quantities back to 0 for all pre-order items.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 rounded-xl bg-white text-stone-700 text-xs font-bold border border-stone-200 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetBatchBooked}
                  disabled={resettingBooked}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  {resettingBooked ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </div>
          )}

          {/* Overall Capacity Bar */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span className="text-stone-700">Overall Batch Booking Capacity:</span>
              <span className="text-stone-900 font-mono">
                {totalBookedCapacity} / {totalTargetCapacity} units booked ({overallCapacityPercent}%)
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-stone-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overallCapacityPercent >= 90
                    ? "bg-rose-500"
                    : overallCapacityPercent >= 60
                    ? "bg-amber-500"
                    : "bg-[#0F3D2E]"
                }`}
                style={{ width: `${overallCapacityPercent}%` }}
              />
            </div>
          </div>

          {/* Pre-Order Items Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {preorderProducts.map((prod) => {
              const booked = prod.batchBookedQty || 0;
              const target = prod.batchTargetQty || 50;
              const pct = target > 0 ? Math.min(Math.round((booked / target) * 100), 100) : 0;
              return (
                <div
                  key={prod.id}
                  className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3 flex flex-col justify-between"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={prod.primaryImage || "/images/placeholder.jpg"}
                      alt={prod.title}
                      className="w-14 h-14 rounded-xl object-cover bg-stone-100 border border-stone-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold uppercase text-[#C83E2B] block">
                        Pre-Order Item
                      </span>
                      <h4 className="text-xs font-extrabold text-stone-900 truncate">
                        {prod.title}
                      </h4>
                      <p className="text-[11px] text-stone-500 truncate">
                        {prod.titleBn}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-stone-100">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-stone-500">Booked:</span>
                      <span className="text-stone-900 font-mono">
                        {booked} / {target} {prod.unitType} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-stone-400">
                      <span>Delivery:</span>
                      <span className="text-stone-700 truncate max-w-[140px]">
                        {prod.expectedDeliveryDate || form.expectedDeliveryDate}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="bg-white rounded-3xl border border-stone-200/90 p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2.5 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restore Factory Copy Defaults</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-2xl bg-[#0F3D2E] hover:bg-[#134b39] text-white text-xs sm:text-sm font-extrabold shadow-md hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4 text-amber-300" />
              )}
              <span>{saving ? "Saving Changes..." : "Save Batch Settings"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
