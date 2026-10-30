"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Calendar,
  Upload,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  ExternalLink,
  Layers,
  Sliders,
  X,
  ChevronRight,
  Fish,
  Award,
  Flame,
  Wheat,
  Leaf,
  Truck,
  ShieldCheck,
  Clock,
  Star,
  Heart,
  Gift,
  Phone,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import {
  HERO_ICON_KEYS,
  HERO_IMAGE_POSITIONS,
  HERO_LIMITS,
  type HeroIconKey,
  type HeroImagePosition,
  type HeroSettingsInput,
  type HeroSlideInput,
} from "@/lib/hero/schema";
import {
  BUILT_IN_HERO_IMAGES,
  listHeroUploads,
  uploadHeroImage,
  type HeroUploadedFile,
} from "@/services/heroApi";
import {
  heroSlideState,
  DEFAULT_HERO_SLIDES,
  DEFAULT_HERO_SETTINGS,
  applyHeroPlaceholders,
  type HeroSlideState,
} from "@/lib/hero/content";
import HeroSlider, { renderHeroIcon } from "@/components/storefront/HeroSlider";
import type { HeroSlide, HeroSettings, HeroTrustItem } from "@/types";

const QUICK_CTA_LINKS = [
  { label: "Pre-Orders (তাজা মাছ)", value: "/pre-orders" },
  { label: "All Products (সব পণ্য)", value: "/shop" },
  { label: "Ghee & Dairy (ঘি ও দই)", value: "/shop?category=ghee-and-dairy" },
  { label: "Deshi Poultry (দেশি মুরগি ও ডিম)", value: "/shop?category=deshi-meat-poultry" },
  { label: "Rice & Honey (চাল ও মধু)", value: "/shop?category=organic-rice-honey" },
];

function getStatusBadge(state: HeroSlideState) {
  switch (state) {
    case "live":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
          Live on Storefront
        </span>
      );
    case "scheduled":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
          <Calendar className="w-3 h-3 text-blue-600" />
          Scheduled Campaign
        </span>
      );
    case "expired":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-stone-100 text-stone-600 border border-stone-300">
          <Clock className="w-3 h-3 text-stone-500" />
          Campaign Expired
        </span>
      );
    case "hidden":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
          <EyeOff className="w-3 h-3 text-amber-600" />
          Hidden (Inactive)
        </span>
      );
  }
}

export default function HeroCmsManager() {
  const {
    heroSlides,
    heroSettings,
    heroLoading,
    settings,
    saveHeroSlide,
    deleteHeroSlide,
    reorderHeroSlides,
    setHeroSlideActive,
    saveHeroSettings,
    resetHeroDefaults,
    showToast,
  } = useStore();

  // Active section view inside Hero tab
  const [activeSection, setActiveSection] = useState<"slides" | "settings" | "preview">("slides");

  // Slide Add / Edit Modal state
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);

  // Form Fields
  const [slideImageUrl, setSlideImageUrl] = useState<string>("/images/banners/hero-jamuna-river-dawn.jpg");
  const [imageSourceTab, setImageSourceTab] = useState<"presets" | "upload" | "gallery" | "custom">("presets");
  const [slideImagePosition, setSlideImagePosition] = useState<HeroImagePosition>("center");
  const [slideImageAlt, setSlideImageAlt] = useState<string>("");
  const [slideBadgeText, setSlideBadgeText] = useState<string>("যমুনার মোহনা থেকে সরাসরি");
  const [slideBadgeIcon, setSlideBadgeIcon] = useState<HeroIconKey>("fish");
  const [slideTitle, setSlideTitle] = useState<string>("");
  const [slideSubtitle, setSlideSubtitle] = useState<string>("");
  const [slideCtaText, setSlideCtaText] = useState<string>("তাজা মাছ প্রি-অর্ডার করুন");
  const [slideCtaLink, setSlideCtaLink] = useState<string>("/pre-orders");
  const [slideIsActive, setSlideIsActive] = useState<boolean>(true);
  const [slideStartsAt, setSlideStartsAt] = useState<string>("");
  const [slideEndsAt, setSlideEndsAt] = useState<string>("");

  // Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [storageGallery, setStorageGallery] = useState<HeroUploadedFile[]>([]);
  const [loadingGallery, setLoadingGallery] = useState<boolean>(false);

  // Saving state
  const [isSavingSlide, setIsSavingSlide] = useState<boolean>(false);

  // Delete modal confirmation
  const [deletingSlide, setDeletingSlide] = useState<HeroSlide | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Reset defaults confirmation modal
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Hero Global Settings state
  const [settingsForm, setSettingsForm] = useState<HeroSettings>(heroSettings);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  useEffect(() => {
    setSettingsForm(heroSettings);
  }, [heroSettings]);

  // Load storage gallery when switching to gallery tab
  useEffect(() => {
    if (imageSourceTab === "gallery") {
      setLoadingGallery(true);
      listHeroUploads()
        .then((files) => setStorageGallery(files))
        .catch(() => {})
        .finally(() => setLoadingGallery(false));
    }
  }, [imageSourceTab]);

  // Open modal for Create
  const handleOpenCreateSlide = () => {
    setEditingSlide(null);
    setSlideImageUrl("/images/banners/hero-jamuna-river-dawn.jpg");
    setImageSourceTab("presets");
    setSlideImagePosition("center");
    setSlideImageAlt("");
    setSlideBadgeText("যমুনার মোহনা থেকে সরাসরি");
    setSlideBadgeIcon("fish");
    setSlideTitle("");
    setSlideSubtitle("");
    setSlideCtaText("তাজা মাছ প্রি-অর্ডার করুন");
    setSlideCtaLink("/pre-orders");
    setSlideIsActive(true);
    setSlideStartsAt("");
    setSlideEndsAt("");
    setUploadError(null);
    setIsSlideModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditSlide = (slide: HeroSlide) => {
    setEditingSlide(slide);
    setSlideImageUrl(slide.imageUrl);
    const isPreset = BUILT_IN_HERO_IMAGES.some((p) => p.url === slide.imageUrl);
    setImageSourceTab(isPreset ? "presets" : slide.imageUrl.startsWith("http") ? "gallery" : "custom");
    setSlideImagePosition(slide.imagePosition || "center");
    setSlideImageAlt(slide.imageAlt || "");
    setSlideBadgeText(slide.badgeText || "");
    setSlideBadgeIcon(slide.badgeIcon || "sparkles");
    setSlideTitle(slide.title || "");
    setSlideSubtitle(slide.subtitle || "");
    setSlideCtaText(slide.ctaText || "");
    setSlideCtaLink(slide.ctaLink || "");
    setSlideIsActive(slide.isActive);
    setSlideStartsAt(slide.startsAt ? slide.startsAt.slice(0, 16) : "");
    setSlideEndsAt(slide.endsAt ? slide.endsAt.slice(0, 16) : "");
    setUploadError(null);
    setIsSlideModalOpen(true);
  };

  // Handle local image file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const res = await uploadHeroImage(file);
      if (res.ok) {
        setSlideImageUrl(res.url);
        showToast("Image uploaded and optimized to WebP successfully!");
      } else {
        setUploadError(res.error);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Submit slide form
  const handleSaveSlideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideTitle.trim()) {
      showToast("Please enter a slide title.");
      return;
    }
    if (!slideImageUrl.trim()) {
      showToast("Please select or upload a banner image.");
      return;
    }
    if (slideCtaText.trim() && !slideCtaLink.trim()) {
      showToast("Please provide a button link for the CTA button.");
      return;
    }

    setIsSavingSlide(true);
    try {
      const payload: HeroSlideInput = {
        id: editingSlide ? editingSlide.id : undefined,
        imageUrl: slideImageUrl.trim(),
        imageAlt: slideImageAlt.trim(),
        imagePosition: slideImagePosition,
        badgeText: slideBadgeText.trim(),
        badgeIcon: slideBadgeIcon,
        title: slideTitle.trim(),
        subtitle: slideSubtitle.trim(),
        ctaText: slideCtaText.trim(),
        ctaLink: slideCtaLink.trim(),
        isActive: slideIsActive,
        startsAt: slideStartsAt ? new Date(slideStartsAt).toISOString() : null,
        endsAt: slideEndsAt ? new Date(slideEndsAt).toISOString() : null,
      };

      const res = await saveHeroSlide(payload);
      if (res.success) {
        setIsSlideModalOpen(false);
      }
    } finally {
      setIsSavingSlide(false);
    }
  };

  // Handle slide deletion
  const handleConfirmDelete = async () => {
    if (!deletingSlide) return;
    setIsDeleting(true);
    try {
      await deleteHeroSlide(deletingSlide.id);
      setDeletingSlide(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle reorder move
  const handleMoveSlide = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= heroSlides.length) return;

    const newSlides = [...heroSlides];
    const [moved] = newSlides.splice(index, 1);
    newSlides.splice(targetIndex, 0, moved);

    const ids = newSlides.map((s) => s.id);
    await reorderHeroSlides(ids);
  };

  // Handle reset to factory defaults
  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await resetHeroDefaults();
      setIsResetConfirmOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  // Handle saving hero global settings
  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const payload: HeroSettingsInput = {
        showHeadline: settingsForm.showHeadline,
        headline: settingsForm.headline.trim(),
        subheadline: settingsForm.subheadline.trim(),
        showGuarantee: settingsForm.showGuarantee,
        guaranteeText: settingsForm.guaranteeText.trim(),
        showCounter: settingsForm.showCounter,
        autoplay: settingsForm.autoplay,
        autoplaySeconds: Number(settingsForm.autoplaySeconds) || 4.5,
        showTrustItems: settingsForm.showTrustItems,
        trustItems: settingsForm.trustItems,
      };
      await saveHeroSettings(payload);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Live preview slide for modal preview card
  const modalPreviewSlide: HeroSlide = useMemo(() => {
    return {
      id: "preview-temp",
      sortOrder: 1,
      isActive: true,
      imageUrl: slideImageUrl,
      imageAlt: slideImageAlt || slideTitle,
      imagePosition: slideImagePosition,
      badgeText: slideBadgeText,
      badgeIcon: slideBadgeIcon,
      title: slideTitle || "ভোরবেলা ধরা যমুনার তাজা নদীর মাছ",
      subtitle: slideSubtitle || "ফরমালিন ও রাসায়নিকমুক্ত • বরফ ছাড়া নদী থেকে সরাসরি আপনার ঘরে",
      ctaText: slideCtaText || "তাজা মাছ প্রি-অর্ডার করুন",
      ctaLink: slideCtaLink || "/pre-orders",
      startsAt: null,
      endsAt: null,
    };
  }, [
    slideImageUrl,
    slideImageAlt,
    slideImagePosition,
    slideBadgeText,
    slideBadgeIcon,
    slideTitle,
    slideSubtitle,
    slideCtaText,
    slideCtaLink,
  ]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Metrics */}
      <div className="bg-gradient-to-br from-[#0F3D2E] to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-amber-300 text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Storefront Hero Carousel CMS</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                হিরো স্লাইডার ও ব্যানার কন্ট্রোল
              </h2>
              <p className="text-xs sm:text-sm text-emerald-200/90 max-w-2xl mt-1">
                হোমপেজের মূল ব্যানার, স্লাইড ইমেজ, টাইটেল, অফার ব্যাজ এবং বাটন সম্পূর্ণ ডায়নামিকভাবে পরিচালনা করুন।
                যেকোনো পরিবর্তন তাৎক্ষণিকভাবে স্টোরফ্রন্টে লাইভ কার্যকর হবে।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleOpenCreateSlide}
                className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>নতুন স্লাইড যোগ করুন</span>
              </button>

              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Restore default 4 photography slides & copy"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ফ্যাক্টরি রিসেট</span>
              </button>
            </div>
          </div>

          {/* Quick Stat Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <span className="text-emerald-300 font-semibold block text-[11px]">মোট স্লাইড</span>
              <strong className="text-xl font-extrabold text-white mt-0.5 block">
                {heroSlides.length} / {HERO_LIMITS.title ? 12 : 12}
              </strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <span className="text-emerald-300 font-semibold block text-[11px]">সক্রিয় (Active)</span>
              <strong className="text-xl font-extrabold text-white mt-0.5 block">
                {heroSlides.filter((s) => s.isActive).length}
              </strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <span className="text-emerald-300 font-semibold block text-[11px]">অটোপ্লে স্পিড</span>
              <strong className="text-xl font-extrabold text-white mt-0.5 block">
                {heroSettings.autoplay ? `${heroSettings.autoplaySeconds}s` : "বন্ধ (Manual)"}
              </strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <span className="text-emerald-300 font-semibold block text-[11px]">ট্রাস্ট হাইলাইটস</span>
              <strong className="text-xl font-extrabold text-white mt-0.5 block">
                {heroSettings.trustItems?.length || 4} টি আইটেম
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-stone-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveSection("slides")}
          className={`pb-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSection === "slides"
              ? "border-[#0F3D2E] text-[#0F3D2E]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>ব্যানার স্লাইড তালিকা ({heroSlides.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("settings")}
          className={`pb-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSection === "settings"
              ? "border-[#0F3D2E] text-[#0F3D2E]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>হেডলাইন ও ট্রাস্ট সেটিংস</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("preview")}
          className={`pb-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSection === "preview"
              ? "border-[#0F3D2E] text-[#0F3D2E]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>লাইভ স্টোরফ্রন্ট প্রিভিউ</span>
        </button>
      </div>

      {/* SECTION 1: SLIDES LIST */}
      {activeSection === "slides" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>স্লাইডগুলো ড্র্যাগ বা অ্যারো বাটন দিয়ে সাজাতে পারবেন। উপরে থাকা স্লাইড আগে প্রদর্শিত হবে।</span>
            <span className="font-semibold text-stone-700">
              সর্বোচ্চ ১২টি স্লাইড সাপোর্ট করে
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {heroSlides.map((slide, idx) => {
              const state = heroSlideState(slide);
              return (
                <div
                  key={slide.id}
                  className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition hover:shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    slide.isActive ? "border-stone-200" : "border-amber-200 bg-amber-50/20 opacity-80"
                  }`}
                >
                  {/* Left: Thumbnail & Content Info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Thumbnail */}
                    <div className="relative w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden bg-stone-900 shrink-0 border border-stone-200 shadow-xs">
                      <img
                        src={slide.imageUrl}
                        alt={slide.imageAlt || slide.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-stone-950/70 text-white font-mono text-[10px] font-bold">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(state)}

                        {slide.badgeText && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            {renderHeroIcon(slide.badgeIcon, "w-3 h-3 text-amber-700")}
                            <span>{slide.badgeText}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-stone-900 text-sm sm:text-base truncate">
                        {slide.title}
                      </h3>

                      {slide.subtitle && (
                        <p className="text-xs text-stone-500 line-clamp-1">
                          {slide.subtitle}
                        </p>
                      )}

                      {slide.ctaText && (
                        <div className="text-[11px] text-stone-400 flex items-center gap-2 pt-0.5">
                          <span className="text-[#C83E2B] font-bold">CTA: {slide.ctaText}</span>
                          <span>→</span>
                          <span className="font-mono">{slide.ctaLink}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 self-end md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 w-full md:w-auto justify-end">
                    {/* Reorder Buttons */}
                    <div className="flex items-center bg-stone-100 rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(idx, "up")}
                        disabled={idx === 0}
                        className="p-1.5 text-stone-600 hover:text-stone-950 disabled:opacity-30 disabled:hover:text-stone-600 transition cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(idx, "down")}
                        disabled={idx === heroSlides.length - 1}
                        className="p-1.5 text-stone-600 hover:text-stone-950 disabled:opacity-30 disabled:hover:text-stone-600 transition cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Active Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => setHeroSlideActive(slide.id, !slide.isActive)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        slide.isActive
                          ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                      }`}
                      title={slide.isActive ? "Hide this slide" : "Publish this slide"}
                    >
                      {slide.isActive ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                          <span>Hidden</span>
                        </>
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditSlide(slide)}
                      className="p-2 text-stone-600 hover:text-[#0F3D2E] hover:bg-emerald-50 rounded-xl transition cursor-pointer"
                      title="Edit slide contents"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setDeletingSlide(slide)}
                      className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      title="Delete slide"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: HERO HEADLINE & TRUST SETTINGS */}
      {activeSection === "settings" && (
        <form onSubmit={handleSaveSettingsSubmit} className="space-y-6 bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xs">
          <div>
            <h3 className="text-lg font-extrabold text-stone-900">
              হিরো সেকশন হেডলাইন ও গ্লোবাল কনফিগারেশন
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              স্লাইডারের উপরের প্রধান SEO H1 শিরোনাম, গ্যারান্টি ব্যাজ এবং নিচে থাকা ৪টি সুবিধা বক্স কাস্টমাইজ করুন।
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top H1 Headline Control */}
            <div className="space-y-4 p-5 rounded-2xl bg-stone-50 border border-stone-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-2">
                  <span>প্রধান H1 হেডলাইন সেকশন</span>
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.showHeadline}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({ ...prev, showHeadline: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0F3D2E]" />
                </label>
              </div>

              {settingsForm.showHeadline && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      মূল শিরোনাম (H1 Title, max 160 chars)
                    </label>
                    <input
                      type="text"
                      maxLength={160}
                      value={settingsForm.headline}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({ ...prev, headline: e.target.value }))
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-xs focus:outline-none focus:border-[#0F3D2E]"
                      placeholder="সাধ্যের বাজার — যমুনা নদীর তাজা দেশি মাছ..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      সাব-শিরোনাম (Sub-headline, max 240 chars)
                    </label>
                    <input
                      type="text"
                      maxLength={240}
                      value={settingsForm.subheadline}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({ ...prev, subheadline: e.target.value }))
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-xs focus:outline-none focus:border-[#0F3D2E]"
                      placeholder="১০০% কেমিক্যাল ও ফরমালিনমুক্ত • নদী ও প্রান্তিক খামার থেকে সরাসরি..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Slider Behavior & Guarantee Badge */}
            <div className="space-y-4 p-5 rounded-2xl bg-stone-50 border border-stone-200">
              <label className="text-xs font-bold text-stone-800 block">
                স্লাইডার কন্ট্রোল ও ব্যাজ
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-stone-200 text-xs font-semibold cursor-pointer">
                  <span>অটোপ্লে চালু রাখুন</span>
                  <input
                    type="checkbox"
                    checked={settingsForm.autoplay}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({ ...prev, autoplay: e.target.checked }))
                    }
                    className="accent-[#0F3D2E]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-stone-200 text-xs font-semibold cursor-pointer">
                  <span>স্লাইড কাউন্টার দেখান (01/04)</span>
                  <input
                    type="checkbox"
                    checked={settingsForm.showCounter}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({ ...prev, showCounter: e.target.checked }))
                    }
                    className="accent-[#0F3D2E]"
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-stone-600">স্লাইড পরিবর্তনের বিরতি (Speed)</span>
                  <span className="font-bold text-[#0F3D2E] font-mono">{settingsForm.autoplaySeconds}s</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={12}
                  step={0.5}
                  value={settingsForm.autoplaySeconds}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      autoplaySeconds: parseFloat(e.target.value) || 4.5,
                    }))
                  }
                  className="w-full accent-[#0F3D2E]"
                />
              </div>

              <div className="pt-2 border-t border-stone-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-stone-700">টপ গ্যারান্টি ব্যাজ</label>
                  <input
                    type="checkbox"
                    checked={settingsForm.showGuarantee}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({ ...prev, showGuarantee: e.target.checked }))
                    }
                    className="accent-[#0F3D2E]"
                  />
                </div>
                {settingsForm.showGuarantee && (
                  <input
                    type="text"
                    maxLength={60}
                    value={settingsForm.guaranteeText}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({ ...prev, guaranteeText: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs focus:outline-none focus:border-[#0F3D2E]"
                    placeholder="১০০% প্রাকৃতিক ও ফরমালিনমুক্ত"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Trust Items Editor */}
          <div className="space-y-4 pt-4 border-t border-stone-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-stone-900">
                  নিচের ৪টি ট্রাস্ট হাইলাইটস কার্ড (Trust Highlights)
                </h4>
                <p className="text-xs text-stone-500">
                  স্লাইডারের ঠিক নিচের কার্ডগুলো। আপনি এখানে ডেসক্রিপশনে{" "}
                  <code className="text-[#0F3D2E] font-bold">{"{insideDhakaFee}"}</code> এবং{" "}
                  <code className="text-[#0F3D2E] font-bold">{"{outsideDhakaFee}"}</code> ব্যবহার করতে পারেন,
                  যা সরাসরি ডেলিভারি ফি সেটিংস থেকে মান বসাবে।
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer">
                <span>ট্রাস্ট সেকশন দেখান</span>
                <input
                  type="checkbox"
                  checked={settingsForm.showTrustItems}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, showTrustItems: e.target.checked }))
                  }
                  className="accent-[#0F3D2E]"
                />
              </label>
            </div>

            {settingsForm.showTrustItems && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {settingsForm.trustItems.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-stone-400">কার্ড #{idx + 1}</span>
                      <select
                        value={item.icon}
                        onChange={(e) => {
                          const icon = e.target.value as HeroIconKey;
                          setSettingsForm((prev) => {
                            const next = [...prev.trustItems];
                            next[idx] = { ...next[idx], icon };
                            return { ...prev, trustItems: next };
                          });
                        }}
                        className="text-xs px-2 py-1 rounded-lg bg-white border border-stone-200 focus:outline-none"
                      >
                        {HERO_ICON_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase">
                        টাইটেল
                      </label>
                      <input
                        type="text"
                        maxLength={60}
                        value={item.title}
                        onChange={(e) => {
                          const title = e.target.value;
                          setSettingsForm((prev) => {
                            const next = [...prev.trustItems];
                            next[idx] = { ...next[idx], title };
                            return { ...prev, trustItems: next };
                          });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-bold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase">
                        সাবটাইটেল
                      </label>
                      <input
                        type="text"
                        maxLength={100}
                        value={item.subtitle}
                        onChange={(e) => {
                          const subtitle = e.target.value;
                          setSettingsForm((prev) => {
                            const next = [...prev.trustItems];
                            next[idx] = { ...next[idx], subtitle };
                            return { ...prev, trustItems: next };
                          });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-xs text-stone-600 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-stone-200">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-6 py-3 rounded-2xl bg-[#0F3D2E] hover:bg-emerald-950 text-white font-bold text-sm shadow-md transition cursor-pointer flex items-center gap-2"
            >
              {isSavingSettings ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>সংরক্ষণ করা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>হেডলাইন ও ট্রাস্ট সেটিংস সেভ করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* SECTION 3: LIVE PREVIEW */}
      {activeSection === "preview" && (
        <div className="space-y-4">
          <div className="bg-[#0F3D2E] text-white p-6 sm:p-8 rounded-3xl space-y-4 shadow-xl">
            {heroSettings.showHeadline && (
              <div className="text-center space-y-1">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                  {heroSettings.headline}
                </h1>
                {heroSettings.subheadline && (
                  <p className="text-xs text-emerald-200/90">{heroSettings.subheadline}</p>
                )}
              </div>
            )}

            <HeroSlider previewMode={true} />

            {heroSettings.showTrustItems && heroSettings.trustItems.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 text-xs">
                {heroSettings.trustItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-emerald-950/60 border border-emerald-800/50 rounded-2xl p-3 flex items-center gap-3 shadow-xs"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-800/80 text-amber-300 flex items-center justify-center shrink-0">
                      {renderHeroIcon(item.icon, "w-4 h-4 text-emerald-300")}
                    </div>
                    <div>
                      <strong className="text-white block font-bold text-xs">
                        {item.title}
                      </strong>
                      {item.subtitle && (
                        <span className="text-emerald-200/80 text-[11px] block">
                          {applyHeroPlaceholders(item.subtitle, settings)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SLIDE */}
      {isSlideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-stone-200 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-stone-900">
                  {editingSlide ? "স্লাইড সম্পাদনা (Edit Slide)" : "নতুন ব্যানার স্লাইড যোগ করুন (Add Slide)"}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  ছবি, টাইটেল, অফার ব্যাজ এবং কল-টু-অ্যাকশন বাটন কনফিগার করুন।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSlideModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-800 rounded-full hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlideSubmit} className="space-y-6">
              {/* IMAGE SELECTION BLOCK */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-stone-800 block">
                  ১. ব্যানার ছবি নির্বাচন (Banner Photography)
                </label>

                {/* Sub-tabs for Image Source */}
                <div className="flex flex-wrap gap-1.5 p-1 bg-stone-100 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setImageSourceTab("presets")}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      imageSourceTab === "presets"
                        ? "bg-white text-stone-900 shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    প্রিসেট ব্যানার কালেকশন
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSourceTab("upload")}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      imageSourceTab === "upload"
                        ? "bg-white text-stone-900 shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>নতুন ছবি আপলোড</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSourceTab("gallery")}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      imageSourceTab === "gallery"
                        ? "bg-white text-stone-900 shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    আপলোড করা ইমেজ গ্যালারি
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSourceTab("custom")}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      imageSourceTab === "custom"
                        ? "bg-white text-stone-900 shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    কাস্টম লিঙ্ক
                  </button>
                </div>

                {/* TAB 1: PRESETS */}
                {imageSourceTab === "presets" && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {BUILT_IN_HERO_IMAGES.map((item) => {
                      const isSelected = slideImageUrl === item.url;
                      return (
                        <button
                          key={item.url}
                          type="button"
                          onClick={() => setSlideImageUrl(item.url)}
                          className={`group relative rounded-xl overflow-hidden aspect-video border-2 transition text-left cursor-pointer ${
                            isSelected
                              ? "border-[#0F3D2E] ring-2 ring-[#0F3D2E]/20"
                              : "border-stone-200 hover:border-stone-400"
                          }`}
                        >
                          <img
                            src={item.url}
                            alt={item.label}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-stone-950/80 p-1 text-[10px] text-white truncate">
                            {item.label}
                          </div>
                          {isSelected && (
                            <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#0F3D2E] text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TAB 2: UPLOAD */}
                {imageSourceTab === "upload" && (
                  <div className="p-6 rounded-2xl border-2 border-dashed border-stone-300 hover:border-[#0F3D2E] bg-stone-50 transition text-center space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="hero-image-file-input"
                    />
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#0F3D2E] flex items-center justify-center mx-auto">
                      {isUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6" />
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="hero-image-file-input"
                        className="px-4 py-2 rounded-xl bg-[#0F3D2E] hover:bg-emerald-950 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 transition"
                      >
                        {isUploading ? "অপ্টিমাইজ ও আপলোড হচ্ছে..." : "ডিভাইস থেকে ছবি বেছে নিন"}
                      </label>
                      <p className="text-[11px] text-stone-500 mt-2">
                        JPG, PNG, WebP বা AVIF (ম্যাক্সিমাম ১৫ MB)। সিস্টেম স্বয়ংক্রিয়ভাবে WebP ফরম্যাটে কম্প্রেস করে সুনির্দিষ্ট স্কেলে সেভ করবে।
                      </p>
                    </div>

                    {uploadError && (
                      <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: GALLERY */}
                {imageSourceTab === "gallery" && (
                  <div className="space-y-2">
                    {loadingGallery ? (
                      <div className="p-8 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#0F3D2E]" />
                        <span>গ্যালারি লোড হচ্ছে...</span>
                      </div>
                    ) : storageGallery.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-stone-50 text-center text-xs text-stone-400">
                        এখনো ক্লাউড স্টোরেজে কোনো ছবি আপলোড করা হয়নি। &ldquo;নতুন ছবি আপলোড&rdquo; ট্যাব থেকে যেকোনো ছবি যোগ করতে পারেন।
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                        {storageGallery.map((file) => {
                          const isSelected = slideImageUrl === file.url;
                          return (
                            <button
                              key={file.url}
                              type="button"
                              onClick={() => setSlideImageUrl(file.url)}
                              className={`group relative rounded-xl overflow-hidden aspect-video border-2 transition text-left cursor-pointer ${
                                isSelected
                                  ? "border-[#0F3D2E] ring-2 ring-[#0F3D2E]/20"
                                  : "border-stone-200 hover:border-stone-400"
                              }`}
                            >
                              <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                              {isSelected && (
                                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#0F3D2E] text-white flex items-center justify-center">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: CUSTOM */}
                {imageSourceTab === "custom" && (
                  <div>
                    <input
                      type="text"
                      value={slideImageUrl}
                      onChange={(e) => setSlideImageUrl(e.target.value.trim())}
                      placeholder="/images/banners/... or https://..."
                      className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-mono focus:outline-none focus:border-[#0F3D2E]"
                    />
                  </div>
                )}

                {/* Image Position Selector */}
                <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                  <span className="font-bold text-stone-600">ছবি ফোকাস পজিশন:</span>
                  <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-0.5">
                    {HERO_IMAGE_POSITIONS.map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setSlideImagePosition(pos)}
                        className={`px-2.5 py-1 rounded-lg capitalize font-bold transition cursor-pointer text-xs ${
                          slideImagePosition === pos
                            ? "bg-white text-stone-900 shadow-xs"
                            : "text-stone-500 hover:text-stone-900"
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CONTENT INPUTS */}
              <div className="space-y-4 pt-4 border-t border-stone-200">
                <label className="text-xs font-bold text-stone-800 block">
                  ২. স্লাইড টেক্সট ও বিবরণ (Slide Content & Copy)
                </label>

                {/* Badge Row */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8">
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      ক্যাটাগরি ব্যাজ টেক্সট (Badge Text, max 60 chars)
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={slideBadgeText}
                      onChange={(e) => setSlideBadgeText(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:border-[#0F3D2E]"
                      placeholder="যমুনার মোহনা থেকে সরাসরি"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      ব্যাজ আইকন (Icon)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-stone-900 text-amber-300 flex items-center justify-center shrink-0">
                        {renderHeroIcon(slideBadgeIcon)}
                      </div>
                      <select
                        value={slideBadgeIcon}
                        onChange={(e) => setSlideBadgeIcon(e.target.value as HeroIconKey)}
                        className="w-full px-2.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:border-[#0F3D2E]"
                      >
                        {HERO_ICON_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    মূল শিরোনাম (Headline Title, max 120 chars) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={slideTitle}
                    onChange={(e) => setSlideTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm font-extrabold focus:outline-none focus:border-[#0F3D2E]"
                    placeholder="ভোরবেলা ধরা যমুনার তাজা নদীর মাছ"
                  />
                </div>

                {/* Subtitle */}
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    সাব-টাইটেল বা বিবরণ (Subtitle, max 220 chars)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={220}
                    value={slideSubtitle}
                    onChange={(e) => setSlideSubtitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:border-[#0F3D2E] resize-none"
                    placeholder="ফরমালিন ও রাসায়নিকমুক্ত • বরফ ছাড়া নদী থেকে সরাসরি আপনার ঘরে"
                  />
                </div>

                {/* CTA Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      কল-টু-অ্যাকশন বাটন টেক্সট (CTA Text, max 40)
                    </label>
                    <input
                      type="text"
                      maxLength={40}
                      value={slideCtaText}
                      onChange={(e) => setSlideCtaText(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-bold focus:outline-none focus:border-[#0F3D2E]"
                      placeholder="তাজা মাছ প্রি-অর্ডার করুন"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      বাটন লিঙ্ক (CTA Link URL)
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={slideCtaLink}
                      onChange={(e) => setSlideCtaLink(e.target.value.trim())}
                      className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-mono focus:outline-none focus:border-[#0F3D2E]"
                      placeholder="/pre-orders or /shop"
                    />
                  </div>
                </div>

                {/* Quick CTA Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-stone-400 font-semibold mr-1">কুইক লিঙ্ক:</span>
                  {QUICK_CTA_LINKS.map((link) => (
                    <button
                      key={link.value}
                      type="button"
                      onClick={() => {
                        setSlideCtaLink(link.value);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-bold transition cursor-pointer"
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SCHEDULE & VISIBILITY */}
              <div className="space-y-3 pt-4 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800">
                    ৩. প্রকাশনা ও ক্যাম্পেইন শিডিউল (Scheduling & Visibility)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slideIsActive}
                      onChange={(e) => setSlideIsActive(e.target.checked)}
                      className="accent-[#0F3D2E]"
                    />
                    <span>সরাসরি স্টোরে চালু রাখুন (Active)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-stone-50 border border-stone-200">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      শুরুর তারিখ ও সময় (ঐচ্ছিক)
                    </label>
                    <input
                      type="datetime-local"
                      value={slideStartsAt}
                      onChange={(e) => setSlideStartsAt(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs focus:outline-none"
                    />
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      খালি রাখলে তাৎক্ষণিকভাবে শুরু হবে
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      শেষ হওয়ার তারিখ ও সময় (ঐচ্ছিক)
                    </label>
                    <input
                      type="datetime-local"
                      value={slideEndsAt}
                      onChange={(e) => setSlideEndsAt(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs focus:outline-none"
                    />
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      নির্দিষ্ট সময় পার হলে স্বয়ংক্রিয়ভাবে বন্ধ হবে
                    </span>
                  </div>
                </div>
              </div>

              {/* INSTANT LIVE PREVIEW CARD */}
              <div className="space-y-2 pt-4 border-t border-stone-200">
                <label className="text-xs font-bold text-stone-700 block">
                  স্লাইড প্রিভিউ (Live Card Preview)
                </label>
                <div className="relative w-full h-56 rounded-2xl overflow-hidden bg-stone-950 border border-stone-300 shadow-md">
                  <img
                    src={modalPreviewSlide.imageUrl}
                    alt={modalPreviewSlide.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/40 to-transparent sm:bg-gradient-to-r sm:from-stone-950/90 sm:via-stone-950/40 sm:to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:left-0 sm:w-3/5 p-4 sm:p-6 flex flex-col justify-end sm:justify-center text-left">
                    {modalPreviewSlide.badgeText && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-900/80 border border-white/20 text-amber-300 text-xs font-bold w-fit mb-1.5">
                        {renderHeroIcon(modalPreviewSlide.badgeIcon, "w-3 h-3 text-amber-300")}
                        <span>{modalPreviewSlide.badgeText}</span>
                      </div>
                    )}
                    <h4 className="text-base sm:text-lg font-extrabold text-white leading-snug drop-shadow-sm">
                      {modalPreviewSlide.title}
                    </h4>
                    {modalPreviewSlide.subtitle && (
                      <p className="text-[11px] text-emerald-100/90 mt-1 line-clamp-2">
                        {modalPreviewSlide.subtitle}
                      </p>
                    )}
                    {modalPreviewSlide.ctaText && (
                      <div className="pt-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C83E2B] text-white text-[11px] font-bold shadow-md">
                          <span>{modalPreviewSlide.ctaText}</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsSlideModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition cursor-pointer"
                >
                  বাতিল করুন
                </button>

                <button
                  type="submit"
                  disabled={isSavingSlide}
                  className="px-6 py-2.5 rounded-xl bg-[#0F3D2E] hover:bg-emerald-950 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  {isSavingSlide ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>সেভ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingSlide ? "আপডেট নিশ্চিত করুন" : "স্লাইড প্রকাশ করুন"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deletingSlide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-900">
                স্লাইড মুছে ফেলতে চান?
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                আপনি কি নিশ্চিত যে <strong>&ldquo;{deletingSlide.title}&rdquo;</strong> স্লাইডটি স্থায়ীভাবে মুছে ফেলতে চান? স্টোরেজে থাকা ফাইলটি থাকলে তাও স্বয়ংক্রিয়ভাবে ক্লিন হবে।
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSlide(null)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
              >
                না, রাখুন
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>হ্যাঁ, মুছে ফেলুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FACTORY RESET CONFIRMATION */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-900">
                ফ্যাক্টরি ডিফল্ট রিস্টোর করতে চান?
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                এটি সব স্লাইড পরিবর্তন মুছে ফেলে মূল ৪টি হাই-রেজ্যুলুশন ন্যাচারাল ব্যানার এবং স্ট্যান্ডার্ড সাধ্যের বাজার কপি পুনরায় ফিরিয়ে আনবে।
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl bg-[#0F3D2E] hover:bg-emerald-950 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>হ্যাঁ, ডিফল্ট ফিরিয়ে আনুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
