"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Eye,
  Leaf,
  Layers,
  Palette,
  ExternalLink,
  ShieldCheck,
  X,
  FileText,
  Printer,
  Smartphone,
  Monitor,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { SiteSettings } from "@/types";
import { INITIAL_SITE_SETTINGS } from "@/services/seedData";

export default function BrandIdentityManager() {
  const { settings, updateSiteSettings, showToast } = useStore();

  const [form, setForm] = useState<{
    brandNameEn: string;
    brandNameBn: string;
    sloganEn: string;
    sloganBn: string;
    logoUrl: string;
    logoMode: "custom" | "badge";
    faviconUrl: string;
  }>({
    brandNameEn: settings.brandNameEn || "Sadhyer Bazar",
    brandNameBn: settings.brandNameBn || "সাধ্যের বাজার",
    sloganEn: settings.sloganEn || "Village Freshness in the City, at Your Home",
    sloganBn: settings.sloganBn || "গ্রামের পণ্য শহরে, আপনার ঘরে",
    logoUrl: settings.logoUrl || "",
    logoMode: settings.logoMode || "badge",
    faviconUrl: settings.faviconUrl || "",
  });

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"desktop" | "mobile" | "footer" | "invoice">("desktop");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if external settings change
  useEffect(() => {
    setForm({
      brandNameEn: settings.brandNameEn || "Sadhyer Bazar",
      brandNameBn: settings.brandNameBn || "সাধ্যের বাজার",
      sloganEn: settings.sloganEn || "Village Freshness in the City, at Your Home",
      sloganBn: settings.sloganBn || "গ্রামের পণ্য শহরে, আপনার ঘরে",
      logoUrl: settings.logoUrl || "",
      logoMode: settings.logoMode || "badge",
      faviconUrl: settings.faviconUrl || "",
    });
  }, [settings]);

  // Handle client-side image downscale & base64/dataURL conversion
  const processImageFile = (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file (PNG, JPG, WebP, or SVG).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setUploadError("File is too large. Please select an image under 8MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        setUploadError("Failed to read image file.");
        setUploading(false);
        return;
      }

      // If SVG, use directly without canvas conversion to preserve vector sharpness
      if (file.type === "image/svg+xml") {
        setForm((prev) => ({
          ...prev,
          logoUrl: dataUrl,
          logoMode: "custom",
        }));
        setUploading(false);
        showToast("SVG Logo uploaded successfully!");
        return;
      }

      // Convert/optimize raster image (PNG/JPG/WebP) via canvas
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 800; // max 800px width/height for crisp Retina logos
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context unavailable");

          ctx.drawImage(img, 0, 0, w, h);
          const optimizedDataUrl = canvas.toDataURL("image/png", 0.95);

          setForm((prev) => ({
            ...prev,
            logoUrl: optimizedDataUrl,
            logoMode: "custom",
          }));
          showToast(`Logo processed (${w}×${h}px) successfully!`);
        } catch {
          // Fallback to raw dataUrl if canvas fails
          setForm((prev) => ({
            ...prev,
            logoUrl: dataUrl,
            logoMode: "custom",
          }));
        } finally {
          setUploading(false);
        }
      };
      img.onerror = () => {
        setUploadError("Could not process this image format. Please try PNG or JPG.");
        setUploading(false);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setUploadError("Failed to read file.");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const updated: SiteSettings = {
        ...settings,
        brandNameEn: form.brandNameEn.trim() || "Sadhyer Bazar",
        brandNameBn: form.brandNameBn.trim() || "সাধ্যের বাজার",
        sloganEn: form.sloganEn.trim() || "Village Freshness in the City, at Your Home",
        sloganBn: form.sloganBn.trim() || "গ্রামের পণ্য শহরে, আপনার ঘরে",
        logoUrl: form.logoUrl.trim(),
        logoMode: form.logoMode,
        faviconUrl: form.faviconUrl.trim(),
        updatedAt: new Date().toISOString(),
      };

      await updateSiteSettings(updated);
      showToast("Brand Identity & Logo updated live across the website!");
    } catch {
      showToast("Failed to save brand identity");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("Reset company logo, brand name, and slogan back to Sadhyer Bazar original defaults?")) {
      setForm({
        brandNameEn: INITIAL_SITE_SETTINGS.brandNameEn || "Sadhyer Bazar",
        brandNameBn: INITIAL_SITE_SETTINGS.brandNameBn || "সাধ্যের বাজার",
        sloganEn: INITIAL_SITE_SETTINGS.sloganEn || "Village Freshness in the City, at Your Home",
        sloganBn: INITIAL_SITE_SETTINGS.sloganBn || "গ্রামের পণ্য শহরে, আপনার ঘরে",
        logoUrl: "",
        logoMode: "badge",
        faviconUrl: "",
      });
      showToast("Reset to factory defaults. Click 'Save Changes' to apply.");
    }
  };

  return (
    <div className="space-y-8 max-w-6xl pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0F3D2E] via-[#14543f] to-[#0F3D2E] text-white p-6 sm:p-8 rounded-3xl shadow-sm border border-emerald-900/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-radial from-amber-400/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-400/30">
              <Palette className="w-3.5 h-3.5" /> Brand Identity & Logo CMS
            </span>
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
              কোম্পানি লোগো, ব্র্যান্ড নাম ও স্লোগান কন্ট্রোল
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/85 max-w-2xl">
              এখানে আপনার প্রতিষ্ঠানের অফিসিয়াল লোগো আপলোড করুন এবং নাম ও স্লোগান পরিবর্তন করুন। এটি তাৎক্ষণিকভাবে স্টোরফ্রন্ট হেডার, ফুটার, প্রিন্ট ইনভয়েস এবং রিসিপ্ট ওয়াটারমার্কে আপডেট হবে।
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-sm flex items-center gap-2 shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{saving ? "সংরক্ষণ হচ্ছে..." : "Save Brand Identity"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Configuration Forms */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Logo Upload & Mode */}
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-7 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-stone-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#0F3D2E] text-white text-xs flex items-center justify-center font-mono">
                    1
                  </span>
                  Company Logo (কোম্পানি লোগো)
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  কাস্টম লোগো ছবি আপলোড করুন অথবা স্টাইলাইজড এম্বলেম ব্যাজ ব্যবহার করুন।
                </p>
              </div>
            </div>

            {/* Logo Display Mode Switcher */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, logoMode: "custom" }))}
                className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer flex items-center gap-3 ${
                  form.logoMode === "custom"
                    ? "border-[#0F3D2E] bg-emerald-50/70"
                    : "border-stone-200 hover:border-stone-300 bg-stone-50/50"
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  form.logoMode === "custom" ? "bg-[#0F3D2E] text-white" : "bg-stone-200 text-stone-600"
                }`}>
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-stone-900">Custom Image Logo</p>
                  <p className="text-[10px] text-stone-500">আপনার নিজস্ব ইমেজ/পিএনজি লোগো</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, logoMode: "badge" }))}
                className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer flex items-center gap-3 ${
                  form.logoMode === "badge"
                    ? "border-[#0F3D2E] bg-emerald-50/70"
                    : "border-stone-200 hover:border-stone-300 bg-stone-50/50"
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  form.logoMode === "badge" ? "bg-[#0F3D2E] text-white" : "bg-stone-200 text-stone-600"
                }`}>
                  <Leaf className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-stone-900">Stylized Badge Emblem</p>
                  <p className="text-[10px] text-stone-500">সাধ্যের বাজার দ্বৈত-রঙিন বৃত্তাকার ব্যাজ</p>
                </div>
              </button>
            </div>

            {/* Logo Dropzone & Controls */}
            {form.logoMode === "custom" && (
              <div className="space-y-4 pt-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processImageFile(e.target.files[0]);
                    }
                  }}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                />

                {/* Upload Box */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                    isDragOver
                      ? "border-emerald-600 bg-emerald-50/80 scale-[1.01]"
                      : "border-stone-300 hover:border-[#0F3D2E] bg-stone-50/60 hover:bg-stone-50"
                  }`}
                >
                  {form.logoUrl ? (
                    <div className="relative group/logo">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border border-stone-200 shadow-sm p-2 flex items-center justify-center overflow-hidden">
                        <img
                          src={form.logoUrl}
                          alt="Uploaded Logo"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-[#0F3D2E] group-hover/logo:underline">
                        <Upload className="w-3.5 h-3.5" /> নতুন ছবি সিলেক্ট করতে ক্লিক করুন
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100/70 text-[#0F3D2E] flex items-center justify-center shadow-2xs">
                        {uploading ? (
                          <Loader2 className="w-6 h-6 animate-spin text-[#0F3D2E]" />
                        ) : (
                          <Upload className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-stone-900">
                          লোগো ফাইল আপলোড করতে এখানে ক্লিক করুন অথবা টেনে আনুন
                        </p>
                        <p className="text-xs text-stone-500 mt-1">
                          PNG, SVG, JPG বা WebP ফরম্যাট সমর্থিত (ট্রান্সপারেন্ট ব্যাকগ্রাউন্ড PNG সাজেস্টেড)
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {uploadError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Direct URL Input Alternative */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    অথবা সরাসরি লোগো ইমেজ URL দিন (Direct Image URL):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={form.logoUrl}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          logoUrl: e.target.value,
                          logoMode: "custom",
                        }))
                      }
                      placeholder="https://example.com/logo.png"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs font-mono"
                    />
                    {form.logoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, logoUrl: "", logoMode: "badge" }))
                        }
                        className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 transition cursor-pointer"
                        title="Remove Logo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Brand Name (English & Bengali) */}
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-7 shadow-2xs space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-extrabold text-stone-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0F3D2E] text-white text-xs flex items-center justify-center font-mono">
                  2
                </span>
                Company Brand Name (প্রতিষ্ঠানের নাম)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                ওয়েবসাইটে প্রদর্শনের জন্য ইংরেজি ও বাংলা উভয় নাম প্রদান করুন।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Brand Name (English) *
                </label>
                <input
                  type="text"
                  required
                  value={form.brandNameEn}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, brandNameEn: e.target.value }))
                  }
                  placeholder="e.g. Sadhyer Bazar"
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  প্রতিষ্ঠানের নাম (বাংলা) *
                </label>
                <input
                  type="text"
                  required
                  value={form.brandNameBn}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, brandNameBn: e.target.value }))
                  }
                  placeholder="যেমন: সাধ্যের বাজার"
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold text-stone-900"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Brand Slogan / Tagline */}
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-7 shadow-2xs space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-extrabold text-stone-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0F3D2E] text-white text-xs flex items-center justify-center font-mono">
                  3
                </span>
                Brand Slogan & Tagline (ব্র্যান্ড স্লোগান ও মূলমন্ত্র)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                লোগোর নিচে এবং প্রিন্ট মেমো ও হেডারে প্রদর্শিত স্লোগান।
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Company Slogan / Tagline (English)
                </label>
                <input
                  type="text"
                  value={form.sloganEn}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, sloganEn: e.target.value }))
                  }
                  placeholder="e.g. Village Freshness in the City, at Your Home"
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-medium text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  ব্র্যান্ডের স্লোগান (বাংলা)
                </label>
                <input
                  type="text"
                  value={form.sloganBn}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, sloganBn: e.target.value }))
                  }
                  placeholder="যেমন: গ্রামের পণ্য শহরে, আপনার ঘরে"
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-medium text-stone-900"
                />
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-6 py-3 rounded-2xl bg-[#0F3D2E] hover:bg-[#165b44] text-white font-extrabold text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{saving ? "Saving Changes..." : "Save Brand Identity"}</span>
            </button>
          </div>
        </div>

        {/* Right Column (5 cols): Live Interactive Preview */}
        <div className="lg:col-span-5 space-y-5 sticky top-24">
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#0F3D2E]" /> Live Interactive Preview
                </h3>
                <p className="text-xs text-stone-500">
                  পরিবর্তনগুলো বিভিন্ন স্থানে কীভাবে দেখাবে তার তাৎক্ষণিক প্রিভিউ:
                </p>
              </div>
            </div>

            {/* Preview Viewport Switcher */}
            <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPreviewTab("desktop")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  previewTab === "desktop"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" /> Header
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("footer")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  previewTab === "footer"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Footer
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("invoice")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  previewTab === "invoice"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Invoice
              </button>
            </div>

            {/* PREVIEW 1: Desktop Navbar Header */}
            {previewTab === "desktop" && (
              <div className="rounded-2xl border border-stone-200 overflow-hidden shadow-xs bg-stone-50">
                <div className="px-3 py-1.5 bg-stone-200/70 border-b border-stone-200 text-[10px] font-mono text-stone-600 flex items-center justify-between">
                  <span>Storefront Sticky Header Preview</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="p-4 bg-[#FAF8F5]">
                  <div className="flex items-center gap-3">
                    {form.logoMode === "custom" && form.logoUrl ? (
                      <div className="w-11 h-11 rounded-2xl bg-white border border-stone-200 p-1 shadow-xs flex items-center justify-center overflow-hidden">
                        <img
                          src={form.logoUrl}
                          alt="Logo Preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-white border-2 border-[#0F3D2E] shadow-xs flex flex-col items-center justify-center">
                        <Leaf className="w-3 h-3 text-emerald-600 -mb-0.5" />
                        <span className="text-[9px] font-extrabold text-[#0F3D2E] leading-none">
                          {form.brandNameBn.split(" ")[0] || "সাধ্যের"}
                        </span>
                        <span className="text-[8px] font-bold text-[#C83E2B] leading-tight">
                          {form.brandNameBn.split(" ").slice(1).join(" ") || "বাজার"}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl font-extrabold tracking-tight text-[#0F3D2E]">
                          {form.brandNameEn.split(" ")[0] || "Sadhyer"}
                        </span>
                        <span className="text-xl font-extrabold tracking-tight text-[#C83E2B]">
                          {form.brandNameEn.split(" ").slice(1).join(" ") || "Bazar"}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-500 font-medium leading-none mt-0.5">
                        {form.sloganEn || "Village Freshness in the City, at Your Home"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW 2: Dark Green Footer */}
            {previewTab === "footer" && (
              <div className="rounded-2xl border border-stone-800 overflow-hidden shadow-xs bg-[#0F3D2E] text-white">
                <div className="px-3 py-1.5 bg-[#0a291f] border-b border-emerald-900 text-[10px] font-mono text-emerald-300 flex items-center justify-between">
                  <span>Storefront Dark Footer Preview</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    {form.logoMode === "custom" && form.logoUrl ? (
                      <div className="w-11 h-11 rounded-2xl bg-white p-1 flex items-center justify-center overflow-hidden shadow-xs">
                        <img
                          src={form.logoUrl}
                          alt="Logo Preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-white flex flex-col items-center justify-center">
                        <span className="text-[10px] font-extrabold text-[#0F3D2E] leading-none">
                          {form.brandNameBn.split(" ")[0] || "সাধ্যের"}
                        </span>
                        <span className="text-[9px] font-bold text-[#C83E2B] leading-tight">
                          {form.brandNameBn.split(" ").slice(1).join(" ") || "বাজার"}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-lg font-extrabold text-white block">
                        {form.brandNameEn}
                      </span>
                      <p className="text-xs text-emerald-300">
                        {form.sloganBn}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-100/70 leading-relaxed border-t border-emerald-800/80 pt-2.5">
                    Bringing you wild-caught Jamuna fish, Sirajganj pure Gawa Ghee and authentic Bogura Shahi Doi across Bangladesh.
                  </p>
                </div>
              </div>
            )}

            {/* PREVIEW 3: Printable Invoice & Watermark */}
            {previewTab === "invoice" && (
              <div className="rounded-2xl border border-stone-200 overflow-hidden shadow-xs bg-white text-stone-900 p-5 space-y-4 relative">
                {/* Simulated Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none -rotate-12 select-none">
                  <div className="w-48 h-48 rounded-full border-4 border-dashed border-stone-900 flex flex-col items-center justify-center text-center p-2">
                    <span className="text-xl font-black">{form.brandNameBn}</span>
                    <span className="text-sm font-bold uppercase">{form.brandNameEn}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wider">{form.sloganBn}</span>
                  </div>
                </div>

                <div className="border-b-2 border-stone-900 pb-3 flex items-start gap-3 relative z-10">
                  {form.logoMode === "custom" && form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="Logo"
                      className="w-12 h-12 object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-stone-100 border border-stone-800 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-black">{form.brandNameBn.split(" ")[0]}</span>
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-black text-stone-900">
                      {form.brandNameBn} ({form.brandNameEn})
                    </h4>
                    <p className="text-[10px] text-stone-600">
                      {form.sloganBn} — {form.sloganEn}
                    </p>
                    <p className="text-[9px] text-stone-400 mt-1 font-mono">
                      OFFICIAL TAX INVOICE • QR & RETINA VERIFIED
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-stone-500 font-mono space-y-1 relative z-10">
                  <div className="flex justify-between border-b border-stone-100 pb-1">
                    <span>Order: SB-2610-SAMPLE</span>
                    <span>Status: Paid</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net Total:</span>
                    <span className="font-bold text-stone-900">৳2,450</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Status Pill */}
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-950 text-xs flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Active Brand Mode:
              </span>
              <span className="font-extrabold uppercase text-[#0F3D2E] bg-white px-2.5 py-0.5 rounded-full border border-emerald-200">
                {form.logoMode === "custom" ? "Custom Logo Active" : "Emblem Badge Active"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
