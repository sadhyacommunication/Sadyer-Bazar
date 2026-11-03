"use client";

import React, { useState, useRef, useMemo } from "react";
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
  Sliders,
  X,
  Fish,
  Award,
  Flame,
  Wheat,
  Clock,
  Layers,
  MapPin,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import {
  DEPARTMENT_SECTION_KEYS,
  SECTION_BANNER_LAYOUTS,
  SECTION_LIMITS,
  type DepartmentSectionKey,
  type SectionBannerLayout,
  type SectionSlideInput,
  type SectionSliderSettingsInput,
} from "@/lib/sections/schema";
import { HERO_ICON_KEYS, type HeroIconKey } from "@/lib/hero/schema";
import {
  DEPARTMENT_METAS,
  DEFAULT_SECTION_SETTINGS,
  DEFAULT_SECTION_SLIDES,
  isSectionSlideLive,
  type SectionSlide,
  type SectionSliderSettings,
} from "@/lib/sections/content";
import DepartmentSlider, { renderSectionIcon } from "@/components/storefront/DepartmentSlider";
import { uploadSectionImage } from "@/services/sectionApi";

const DEPARTMENT_PRESETS: Record<DepartmentSectionKey, { label: string; url: string }[]> = {
  dept_jamuna_fish: [
    { label: "Jamuna Fishermen at Dawn (জাল তোলা মাছ)", url: "/images/banners/jamuna-fisherman-banner.jpg" },
    { label: "River Sunrise Catch (ভোরের তাজা নদীর মাছ)", url: "/images/banners/hero-jamuna-river-dawn.jpg" },
  ],
  dept_village_chicken: [
    { label: "Village Deshi Poultry Homestead (উঠানের দেশি মুরগি)", url: "/images/banners/village-chicken-banner.jpg" },
    { label: "Chalan Beel Wetland Duck (চলনবিলের দেশি হাঁস)", url: "/images/banners/hero-village-deshi-poultry.jpg" },
  ],
  dept_heritage_rice: [
    { label: "Dinajpur Kataribhog & Red Rice (দিনাজপুরের ঐতিহ্যবাহী চাল)", url: "/images/banners/heritage-rice-banner.jpg" },
    { label: "Golden Polao Rice & Forest Honey (সুগন্ধি চিনিগুঁড়া ও মধু)", url: "/images/banners/hero-heritage-golden-rice.jpg" },
  ],
  dept_ghee_doi: [
    { label: "Sirajganj Gawa Ghee & Bogura Doi (খাঁটি গাওয়া ঘি ও বগুড়ার দই)", url: "/images/banners/ghee-bogura-doi-banner.jpg" },
    { label: "Royal Bilona Ghee & Sora Khirsha (ঐতিহ্যবাহী ক্ষীরসা ও দানাদার ঘি)", url: "/images/banners/hero-gawa-ghee-bogura-doi.jpg" },
  ],
};

function getSlideStatusBadge(slide: SectionSlide) {
  const now = Date.now();
  if (!slide.isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
        <EyeOff className="w-3 h-3 text-amber-600" />
        Hidden (অদৃশ্য)
      </span>
    );
  }
  if (slide.startsAt && new Date(slide.startsAt).getTime() > now) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
        <Calendar className="w-3 h-3 text-blue-600" />
        Scheduled (নির্ধারিত)
      </span>
    );
  }
  if (slide.endsAt && new Date(slide.endsAt).getTime() < now) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-stone-100 text-stone-600 border border-stone-300">
        <Clock className="w-3 h-3 text-stone-500" />
        Expired (মেয়াদ শেষ)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
      Live on Storefront
    </span>
  );
}

export default function SectionCmsManager() {
  const {
    sectionSlides,
    sectionSettings,
    sectionLoading,
    saveSectionSlide,
    deleteSectionSlide,
    reorderSectionSlides,
    setSectionSlideActive,
    saveSectionSettings,
    resetSectionDefaults,
    showToast,
  } = useStore();

  // Active department selector
  const [selectedDept, setSelectedDept] = useState<DepartmentSectionKey>("dept_jamuna_fish");
  // Active inner view: "slides" | "settings" | "preview"
  const [activeView, setActiveView] = useState<"slides" | "settings" | "preview">("slides");

  // Filter slides for current department
  const currentDeptSlides = useMemo(() => {
    return (sectionSlides || [])
      .filter((s) => s.sectionId === selectedDept)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [sectionSlides, selectedDept]);

  const currentDeptSettings =
    sectionSettings[selectedDept] ||
    DEFAULT_SECTION_SETTINGS[selectedDept] ||
    DEFAULT_SECTION_SETTINGS.dept_jamuna_fish;

  // Slide Modal state
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SectionSlide | null>(null);

  // Form Fields
  const [slideImageUrl, setSlideImageUrl] = useState<string>("");
  const [slideImageAlt, setSlideImageAlt] = useState<string>("");
  const [slideBannerLayout, setSlideBannerLayout] = useState<SectionBannerLayout>("default");
  const [slideBadgeTextBn, setSlideBadgeTextBn] = useState<string>("");
  const [slideBadgeTextEn, setSlideBadgeTextEn] = useState<string>("");
  const [slideBadgeIcon, setSlideBadgeIcon] = useState<HeroIconKey>("sparkles");
  const [slideHeadlineBn, setSlideHeadlineBn] = useState<string>("");
  const [slideTitleEn, setSlideTitleEn] = useState<string>("");
  const [slideConvincingSubtextBn, setSlideConvincingSubtextBn] = useState<string>("");
  const [slideDescriptionEn, setSlideDescriptionEn] = useState<string>("");
  const [slideOriginLocation, setSlideOriginLocation] = useState<string>("");
  const [slideHighlights, setSlideHighlights] = useState<string[]>([]);
  const [newHighlightText, setNewHighlightText] = useState<string>("");
  const [slidePairingTipText, setSlidePairingTipText] = useState<string>("");
  const [slidePairingTargetHref, setSlidePairingTargetHref] = useState<string>("");
  const [slidePairingTargetLabel, setSlidePairingTargetLabel] = useState<string>("");
  const [slideCtaText, setSlideCtaText] = useState<string>("");
  const [slideCtaLink, setSlideCtaLink] = useState<string>("");
  const [slideIsActive, setSlideIsActive] = useState<boolean>(true);
  const [slideStartsAt, setSlideStartsAt] = useState<string>("");
  const [slideEndsAt, setSlideEndsAt] = useState<string>("");

  // Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageTab, setImageTab] = useState<"presets" | "upload" | "custom">("presets");

  // Carousel Settings Form
  const [autoplay, setAutoplay] = useState(currentDeptSettings.autoplay);
  const [autoplaySeconds, setAutoplaySeconds] = useState(currentDeptSettings.autoplaySeconds);
  const [showCounter, setShowCounter] = useState(currentDeptSettings.showCounter);
  const [showNavigation, setShowNavigation] = useState(currentDeptSettings.showNavigation);
  const [showDots, setShowDots] = useState(currentDeptSettings.showDots);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Synchronize carousel settings form when switching departments
  const handleDepartmentChange = (key: DepartmentSectionKey) => {
    setSelectedDept(key);
    const s = sectionSettings[key] || DEFAULT_SECTION_SETTINGS[key];
    setAutoplay(s.autoplay);
    setAutoplaySeconds(s.autoplaySeconds);
    setShowCounter(s.showCounter);
    setShowNavigation(s.showNavigation);
    setShowDots(s.showDots);
  };

  const handleOpenAddModal = () => {
    const meta = DEPARTMENT_METAS[selectedDept];
    setEditingSlide(null);
    const presets = DEPARTMENT_PRESETS[selectedDept];
    setSlideImageUrl(presets[0]?.url || "/images/banners/jamuna-fisherman-banner.jpg");
    setSlideImageAlt("");
    setSlideBannerLayout(meta.defaultLayout);
    setSlideBadgeTextBn(meta.nameBn);
    setSlideBadgeTextEn(meta.nameEn);
    setSlideBadgeIcon("sparkles");
    setSlideHeadlineBn("");
    setSlideTitleEn("");
    setSlideConvincingSubtextBn("");
    setSlideDescriptionEn("");
    setSlideOriginLocation("");
    setSlideHighlights([]);
    setNewHighlightText("");
    setSlidePairingTipText("");
    setSlidePairingTargetHref("");
    setSlidePairingTargetLabel("");
    setSlideCtaText(`Shop All ${meta.nameEn}`);
    setSlideCtaLink(`/shop?category=${meta.categorySlug}`);
    setSlideIsActive(true);
    setSlideStartsAt("");
    setSlideEndsAt("");
    setImageTab("presets");
    setUploadError(null);
    setIsSlideModalOpen(true);
  };

  const handleOpenEditModal = (slide: SectionSlide) => {
    setEditingSlide(slide);
    setSlideImageUrl(slide.imageUrl);
    setSlideImageAlt(slide.imageAlt);
    setSlideBannerLayout(slide.bannerLayout || "default");
    setSlideBadgeTextBn(slide.badgeTextBn);
    setSlideBadgeTextEn(slide.badgeTextEn);
    setSlideBadgeIcon(slide.badgeIcon || "sparkles");
    setSlideHeadlineBn(slide.headlineBn);
    setSlideTitleEn(slide.titleEn);
    setSlideConvincingSubtextBn(slide.convincingSubtextBn);
    setSlideDescriptionEn(slide.descriptionEn);
    setSlideOriginLocation(slide.originLocation);
    setSlideHighlights([...slide.highlights]);
    setNewHighlightText("");
    setSlidePairingTipText(slide.pairingTipText);
    setSlidePairingTargetHref(slide.pairingTargetHref);
    setSlidePairingTargetLabel(slide.pairingTargetLabel);
    setSlideCtaText(slide.ctaText);
    setSlideCtaLink(slide.ctaLink);
    setSlideIsActive(slide.isActive);
    setSlideStartsAt(slide.startsAt ? slide.startsAt.slice(0, 16) : "");
    setSlideEndsAt(slide.endsAt ? slide.endsAt.slice(0, 16) : "");
    setImageTab("custom");
    setUploadError(null);
    setIsSlideModalOpen(true);
  };

  const handleAddHighlight = () => {
    const text = newHighlightText.trim();
    if (!text) return;
    if (slideHighlights.length >= 6) {
      showToast("সর্বোচ্চ ৬টি গ্যারান্টি বা হাইলাইট যোগ করা যাবে।");
      return;
    }
    setSlideHighlights([...slideHighlights, text]);
    setNewHighlightText("");
  };

  const handleRemoveHighlight = (idx: number) => {
    setSlideHighlights(slideHighlights.filter((_, i) => i !== idx));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      const res = await uploadSectionImage(file);
      if (res.ok) {
        setSlideImageUrl(res.url);
        showToast("ব্যানার ছবি সফলভাবে আপলোড ও অপ্টিমাইজ হয়েছে!");
      } else {
        setUploadError(res.error);
        showToast(res.error);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!slideHeadlineBn.trim()) {
      showToast("বাংলা হেডলাইন লেখা আবশ্যক।");
      return;
    }
    if (!slideTitleEn.trim()) {
      showToast("English title is required.");
      return;
    }
    if (!slideImageUrl.trim()) {
      showToast("ব্যানারের ছবি নির্বাচন করুন।");
      return;
    }

    const payload: SectionSlideInput = {
      id: editingSlide?.id,
      sectionId: selectedDept,
      sortOrder: editingSlide ? editingSlide.sortOrder : currentDeptSlides.length + 1,
      isActive: slideIsActive,
      imageUrl: slideImageUrl.trim(),
      imageAlt: slideImageAlt.trim(),
      bannerLayout: slideBannerLayout,
      badgeTextBn: slideBadgeTextBn.trim(),
      badgeTextEn: slideBadgeTextEn.trim(),
      badgeIcon: slideBadgeIcon,
      headlineBn: slideHeadlineBn.trim(),
      titleEn: slideTitleEn.trim(),
      convincingSubtextBn: slideConvincingSubtextBn.trim(),
      descriptionEn: slideDescriptionEn.trim(),
      originLocation: slideOriginLocation.trim(),
      highlights: slideHighlights,
      pairingTipText: slidePairingTipText.trim(),
      pairingTargetHref: slidePairingTargetHref.trim(),
      pairingTargetLabel: slidePairingTargetLabel.trim(),
      ctaText: slideCtaText.trim(),
      ctaLink: slideCtaLink.trim(),
      startsAt: slideStartsAt ? new Date(slideStartsAt).toISOString() : null,
      endsAt: slideEndsAt ? new Date(slideEndsAt).toISOString() : null,
    };

    const res = await saveSectionSlide(payload);
    if (res.success) {
      setIsSlideModalOpen(false);
    } else {
      showToast(res.error || "স্লাইড সংরক্ষণ ব্যর্থ হয়েছে।");
    }
  };

  const handleDeleteSlide = async (id: string) => {
    if (currentDeptSlides.length <= 1) {
      showToast("প্রতি সেকশনে কমপক্ষে একটি স্লাইড থাকা আবশ্যক।");
      return;
    }
    if (confirm("আপনি কি নিশ্চিত এই ব্যানার স্লাইডটি মুছে ফেলতে চান?")) {
      await deleteSectionSlide(id);
    }
  };

  const handleMoveSlide = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentDeptSlides.length) return;

    const newSlides = [...currentDeptSlides];
    const temp = newSlides[index];
    newSlides[index] = newSlides[targetIndex];
    newSlides[targetIndex] = temp;

    const ids = newSlides.map((s) => s.id);
    await reorderSectionSlides(selectedDept, ids);
  };

  const handleSaveSettings = async () => {
    try {
      setIsSavingSettings(true);
      const payload: SectionSliderSettingsInput = {
        sectionId: selectedDept,
        autoplay,
        autoplaySeconds,
        showCounter,
        showNavigation,
        showDots,
      };
      await saveSectionSettings(payload);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetDefaults = async () => {
    const meta = DEPARTMENT_METAS[selectedDept];
    if (
      confirm(
        `আপনি কি '${meta.nameBn}' সেকশনের ব্যানার ও স্লাইডার ফ্যাক্টরি ডিফল্টে রিসেট করতে চান?`
      )
    ) {
      await resetSectionDefaults(selectedDept);
    }
  };

  const currentMeta = DEPARTMENT_METAS[selectedDept];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0F3D2E]/10 text-[#0F3D2E] rounded-xl">
              <Layers className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900">
              সেকশন ব্যানার ও স্লাইডার (Section Sliders CMS)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-2xl">
            হোমপেজের ৪টি প্রধান সেকশনের ব্যানারকে হিরো সেকশনের মতো ইন্টারঅ্যাক্টিভ ক্যারোসেল/স্লাইডার
            হিসেবে সম্পূর্ণ নিয়ন্ত্রণ করুন। ছবি, হেডলাইন, গ্যারান্টি, বোতাম ও অটো-প্লে নিয়ন্ত্রণ এখান থেকে লাইভ হবে।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition flex items-center gap-1.5"
            title="Restore default slides for this section"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ফ্যাক্টরি রিসেট</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 text-xs font-extrabold text-white bg-[#0F3D2E] hover:bg-[#14533e] rounded-xl transition shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন স্লাইড যোগ করুন</span>
          </button>
        </div>
      </div>

      {/* 4 Departments Switcher Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {DEPARTMENT_SECTION_KEYS.map((key) => {
          const meta = DEPARTMENT_METAS[key];
          const isSelected = selectedDept === key;
          const count = (sectionSlides || []).filter((s) => s.sectionId === key).length;

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleDepartmentChange(key)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? "bg-white border-[#0F3D2E] shadow-md ring-2 ring-[#0F3D2E]/20"
                  : "bg-white/80 border-stone-200 hover:bg-stone-50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isSelected ? "bg-[#0F3D2E] text-white" : "bg-stone-100 text-stone-600"
                  }`}
                >
                  DEPT {meta.deptNumber}
                </span>
                <span className="text-[11px] font-bold text-stone-500">
                  {count} {count === 1 ? "স্লাইড" : "স্লাইড"}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-stone-900 leading-snug line-clamp-1">
                {meta.nameBn}
              </h3>
              <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">{meta.nameEn}</p>
            </button>
          );
        })}
      </div>

      {/* View Switcher: Slides / Settings / Preview */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveView("slides")}
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition ${
            activeView === "slides"
              ? "bg-[#0F3D2E] text-white shadow-xs"
              : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          স্লাইডার ব্যানার তালিকা ({currentDeptSlides.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveView("settings")}
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 ${
            activeView === "settings"
              ? "bg-[#0F3D2E] text-white shadow-xs"
              : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>ক্যারোসেল ও অটো-প্লে সেটিংস</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveView("preview")}
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 ${
            activeView === "preview"
              ? "bg-[#0F3D2E] text-white shadow-xs"
              : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>লাইভ প্রিভিউ (Storefront Preview)</span>
        </button>
      </div>

      {/* VIEW 1: Slides List */}
      {activeView === "slides" && (
        <div className="space-y-4">
          {currentDeptSlides.map((slide, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === currentDeptSlides.length - 1;

            return (
              <div
                key={slide.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all ${
                  slide.isActive
                    ? "border-stone-200/90 shadow-xs hover:border-emerald-300"
                    : "border-stone-200 opacity-70 bg-stone-50"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Thumbnail + Info */}
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    {/* Slide Order Badge */}
                    <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-28 sm:w-36 h-20 rounded-xl overflow-hidden bg-stone-900 border border-stone-200 shrink-0">
                      <img
                        src={slide.imageUrl}
                        alt={slide.titleEn}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {getSlideStatusBadge(slide)}
                        <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                          লেআউট: {slide.bannerLayout === "reversed" ? "ছবি ডানে" : "ছবি বামে"}
                        </span>
                        {slide.originLocation && (
                          <span className="text-[11px] text-stone-600 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-amber-500" />
                            {slide.originLocation}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm sm:text-base font-extrabold text-stone-900 line-clamp-1">
                        {slide.headlineBn}
                      </h4>
                      <p className="text-xs text-stone-600 line-clamp-1">{slide.titleEn}</p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 self-end lg:self-auto shrink-0">
                    {/* Reorder Buttons */}
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveSlide(idx, "up")}
                      className="p-2 text-stone-600 hover:bg-stone-100 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveSlide(idx, "down")}
                      className="p-2 text-stone-600 hover:bg-stone-100 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>

                    {/* Visibility Toggle */}
                    <button
                      type="button"
                      onClick={() => setSectionSlideActive(slide.id, !slide.isActive)}
                      className={`p-2 rounded-xl transition ${
                        slide.isActive
                          ? "text-emerald-700 hover:bg-emerald-50"
                          : "text-stone-400 hover:bg-stone-100"
                      }`}
                      title={slide.isActive ? "Hide slide" : "Show slide"}
                    >
                      {slide.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(slide)}
                      className="px-3 py-1.5 text-xs font-extrabold text-[#0F3D2E] bg-[#0F3D2E]/10 hover:bg-[#0F3D2E]/20 rounded-xl transition flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>সম্পাদনা</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteSlide(slide.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      title="Delete slide"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: Settings Panel */}
      {activeView === "settings" && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-sm max-w-2xl space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-stone-900">
              {currentMeta.nameBn} — ক্যারোসেল কন্ট্রোল
            </h3>
            <p className="text-xs text-stone-600 mt-0.5">
              এই সেকশনের অটো-প্লে ট্রানজিশন স্পিড এবং নেভিগেশন কন্ট্রোল পরিচালনা করুন।
            </p>
          </div>

          <div className="space-y-4">
            {/* Autoplay Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 border border-stone-200">
              <div>
                <p className="text-sm font-extrabold text-stone-900">অটো-প্লে (Auto-Play)</p>
                <p className="text-xs text-stone-500">ব্যানারগুলো স্বয়ংক্রিয়ভাবে একটির পর একটি স্লাইড হবে</p>
              </div>
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => setAutoplay(e.target.checked)}
                className="w-5 h-5 accent-[#0F3D2E] rounded cursor-pointer"
              />
            </div>

            {/* Autoplay Speed Slider */}
            {autoplay && (
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                  <span>স্লাইড পরিবর্তনের গতি (Interval)</span>
                  <span className="font-mono text-[#0F3D2E] font-extrabold">
                    {autoplaySeconds.toFixed(1)} সেকেন্ড
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="15"
                  step="0.5"
                  value={autoplaySeconds}
                  onChange={(e) => setAutoplaySeconds(parseFloat(e.target.value))}
                  className="w-full accent-[#0F3D2E] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400">
                  <span>দ্রুত (২ সেকেন্ড)</span>
                  <span>ধীর (১৫ সেকেন্ড)</span>
                </div>
              </div>
            )}

            {/* Show Counter */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 border border-stone-200">
              <div>
                <p className="text-sm font-extrabold text-stone-900">স্লাইড কাউন্টার (01 / 02)</p>
                <p className="text-xs text-stone-500">ব্যানারের উপরে স্লাইড নম্বর পিল প্রদর্শন করবে</p>
              </div>
              <input
                type="checkbox"
                checked={showCounter}
                onChange={(e) => setShowCounter(e.target.checked)}
                className="w-5 h-5 accent-[#0F3D2E] rounded cursor-pointer"
              />
            </div>

            {/* Show Navigation Chevrons */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 border border-stone-200">
              <div>
                <p className="text-sm font-extrabold text-stone-900">তীর বাটন (Next / Prev Arrows)</p>
                <p className="text-xs text-stone-500">বাম ও ডানের নেভিগেশন অ্যারো বাটন সক্রিয় থাকবে</p>
              </div>
              <input
                type="checkbox"
                checked={showNavigation}
                onChange={(e) => setShowNavigation(e.target.checked)}
                className="w-5 h-5 accent-[#0F3D2E] rounded cursor-pointer"
              />
            </div>

            {/* Show Dots */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 border border-stone-200">
              <div>
                <p className="text-sm font-extrabold text-stone-900">ইন্ডিকেটর ডটস (Pagination Dots)</p>
                <p className="text-xs text-stone-500">নিচে স্লাইড নির্দেশক ডট বার প্রদর্শন করবে</p>
              </div>
              <input
                type="checkbox"
                checked={showDots}
                onChange={(e) => setShowDots(e.target.checked)}
                className="w-5 h-5 accent-[#0F3D2E] rounded cursor-pointer"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isSavingSettings}
            onClick={handleSaveSettings}
            className="w-full py-3 rounded-xl bg-[#0F3D2E] hover:bg-[#14533e] text-white font-extrabold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            {isSavingSettings ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>সংরক্ষণ হচ্ছে...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>ক্যারোসেল সেটিংস সংরক্ষণ করুন</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* VIEW 3: Live Preview */}
      {activeView === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 font-medium">
            <span>
              ℹ️ এটি লাইভ স্টোরফ্রন্ট প্রিভিউ। গ্রাহকরা হোমপেজে এই সেকশনে ঠিক যেমনটি দেখবে এটি হুবহু তেমনই
              রেন্ডার হচ্ছে।
            </span>
          </div>

          <DepartmentSlider
            sectionId={selectedDept}
            accentTheme={currentMeta.accentTheme}
            categorySlug={currentMeta.categorySlug}
            defaultLayout={currentMeta.defaultLayout}
            previewMode={true}
            previewSlides={currentDeptSlides}
            previewSettings={{
              sectionId: selectedDept,
              autoplay,
              autoplaySeconds,
              showCounter,
              showNavigation,
              showDots,
            }}
          />
        </div>
      )}

      {/* Slide Add / Edit Modal */}
      {isSlideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200 p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-stone-900">
                  {editingSlide ? "স্লাইড সম্পাদনা করুন" : "নতুন ব্যানার স্লাইড যোগ করুন"}
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  সেকশন: <strong className="text-[#0F3D2E]">{currentMeta.nameBn}</strong> (DEPT{" "}
                  {currentMeta.deptNumber})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSlideModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlide} className="space-y-6">
              {/* Image Picker Section */}
              <div className="space-y-3">
                <label className="block text-xs font-extrabold text-stone-800">
                  ব্যানার ছবি (Banner Image) *
                </label>

                {/* Image Source Tabs */}
                <div className="flex items-center gap-2 border-b border-stone-200 pb-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setImageTab("presets")}
                    className={`px-3 py-1.5 rounded-lg font-extrabold transition ${
                      imageTab === "presets"
                        ? "bg-[#0F3D2E] text-white"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    প্রিসেট ইমেজ ({DEPARTMENT_PRESETS[selectedDept].length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab("upload")}
                    className={`px-3 py-1.5 rounded-lg font-extrabold transition flex items-center gap-1.5 ${
                      imageTab === "upload"
                        ? "bg-[#0F3D2E] text-white"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>নতুন ছবি আপলোড</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab("custom")}
                    className={`px-3 py-1.5 rounded-lg font-extrabold transition ${
                      imageTab === "custom"
                        ? "bg-[#0F3D2E] text-white"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    কাস্টম লিঙ্ক
                  </button>
                </div>

                {/* Tab 1: Presets */}
                {imageTab === "presets" && (
                  <div className="grid grid-cols-2 gap-3">
                    {DEPARTMENT_PRESETS[selectedDept].map((preset) => {
                      const isSelected = slideImageUrl === preset.url;
                      return (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => setSlideImageUrl(preset.url)}
                          className={`relative rounded-xl overflow-hidden border-2 text-left transition ${
                            isSelected
                              ? "border-[#0F3D2E] ring-2 ring-[#0F3D2E]/20"
                              : "border-stone-200 hover:border-stone-300"
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-full h-24 object-cover"
                          />
                          <div className="p-2 bg-stone-900/90 text-white text-[11px] font-bold line-clamp-1">
                            {preset.label}
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-[#0F3D2E] text-white rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Tab 2: Upload */}
                {imageTab === "upload" && (
                  <div className="p-4 border-2 border-dashed border-stone-300 rounded-2xl text-center space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="section-banner-upload-input"
                    />
                    <label
                      htmlFor="section-banner-upload-input"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-extrabold cursor-pointer transition"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>আপলোড ও কম্প্রেশন চলছে...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>কম্পিউটার থেকে ছবি বাছুন</span>
                        </>
                      )}
                    </label>
                    <p className="text-[11px] text-stone-500">
                      JPG, PNG বা WebP ফরম্যাট। স্বয়ংক্রিয়ভাবে WebP-তে কম্প্রেস হয়ে সেভ হবে।
                    </p>
                    {uploadError && (
                      <p className="text-xs text-rose-600 font-bold">{uploadError}</p>
                    )}
                  </div>
                )}

                {/* Tab 3: Custom URL */}
                {imageTab === "custom" && (
                  <input
                    type="text"
                    value={slideImageUrl}
                    onChange={(e) => setSlideImageUrl(e.target.value)}
                    placeholder="/images/banners/..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-[#0F3D2E]"
                  />
                )}

                {/* Current Selected Image Preview */}
                {slideImageUrl && (
                  <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <img
                      src={slideImageUrl}
                      alt="Selected preview"
                      className="w-20 h-14 object-cover rounded-lg border border-stone-300"
                    />
                    <div className="text-xs min-w-0">
                      <p className="font-extrabold text-stone-800">নির্বাচিত ছবি:</p>
                      <p className="text-[11px] text-stone-500 truncate font-mono">{slideImageUrl}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Layout & Badge Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Banner Layout Selector */}
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    লেআউট ধরন (Banner Layout)
                  </label>
                  <select
                    value={slideBannerLayout}
                    onChange={(e) => setSlideBannerLayout(e.target.value as SectionBannerLayout)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-extrabold bg-white"
                  >
                    <option value="default">ডিফল্ট (ছবি বামে, বর্ণনা ডানে)</option>
                    <option value="reversed">রিভার্সড (বর্ণনা বামে, ছবি ডানে)</option>
                  </select>
                </div>

                {/* Badge Icon Selector */}
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    ব্যাজ আইকন (Badge Icon)
                  </label>
                  <select
                    value={slideBadgeIcon}
                    onChange={(e) => setSlideBadgeIcon(e.target.value as HeroIconKey)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-extrabold bg-white"
                  >
                    {HERO_ICON_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bangla Headline & English Title */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    বাংলা মূল হেডলাইন (Bangla Headline) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={SECTION_LIMITS.headlineBn}
                    value={slideHeadlineBn}
                    onChange={(e) => setSlideHeadlineBn(e.target.value)}
                    placeholder="যমুনার ভোরের তাজা মাছ — জেলের জাল থেকে সরাসরি আপনার ঘরে!"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-[#0F3D2E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    ইংরেজি শিরোনাম (English Title) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={SECTION_LIMITS.titleEn}
                    value={slideTitleEn}
                    onChange={(e) => setSlideTitleEn(e.target.value)}
                    placeholder="Wild-Caught Fresh Fish Directly from Jamuna River"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0F3D2E]"
                  />
                </div>
              </div>

              {/* Badges Text & Origin */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    বাংলা ব্যাজ (Badge BN)
                  </label>
                  <input
                    type="text"
                    maxLength={SECTION_LIMITS.badgeText}
                    value={slideBadgeTextBn}
                    onChange={(e) => setSlideBadgeTextBn(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    ইংরেজি ব্যাজ (Badge EN)
                  </label>
                  <input
                    type="text"
                    maxLength={SECTION_LIMITS.badgeText}
                    value={slideBadgeTextEn}
                    onChange={(e) => setSlideBadgeTextEn(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    উৎপত্তি স্থান (Origin Location)
                  </label>
                  <input
                    type="text"
                    maxLength={SECTION_LIMITS.originLocation}
                    value={slideOriginLocation}
                    onChange={(e) => setSlideOriginLocation(e.target.value)}
                    placeholder="Sirajganj & Sariakandi Jamuna Ghat"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
              </div>

              {/* Storytelling Boxes: Bangla Subtext & English Description */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    বাংলা বিশ্বাসযোগ্য সাবটেক্সট (Box Quote Subtext)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={SECTION_LIMITS.convincingSubtextBn}
                    value={slideConvincingSubtextBn}
                    onChange={(e) => setSlideConvincingSubtextBn(e.target.value)}
                    placeholder="১০০% ফরমালিন ও হিমাগার মুক্ত। ভোরবেলা সিরাজগঞ্জ ও সারিয়াকান্দি ঘাটে..."
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    ইংরেজি বিবরণ (English Story Description)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={SECTION_LIMITS.descriptionEn}
                    value={slideDescriptionEn}
                    onChange={(e) => setSlideDescriptionEn(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
              </div>

              {/* Highlights Guarantees (Checklist) */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-stone-800">
                  ৩টি প্রধান গুণগত নিশ্চয়তা / গ্যারান্টি (Highlights Checklist)
                </label>
                <div className="space-y-1.5">
                  {slideHighlights.map((hl, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                    >
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{hl}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHighlight(i)}
                        className="text-stone-400 hover:text-rose-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {slideHighlights.length < 6 && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newHighlightText}
                      onChange={(e) => setNewHighlightText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddHighlight();
                        }
                      }}
                      placeholder="নতুন গ্যারান্টি লিখুন এবং 'যোগ করুন' চাপুন..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-stone-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddHighlight}
                      className="px-3 py-1.5 text-xs font-extrabold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl"
                    >
                      যোগ করুন
                    </button>
                  </div>
                )}
              </div>

              {/* Cross-Sell Pairing Tip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-2xl">
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    পেয়ারিং টিপস টেক্সট (Pairing Tip)
                  </label>
                  <input
                    type="text"
                    maxLength={SECTION_LIMITS.pairingTipText}
                    value={slidePairingTipText}
                    onChange={(e) => setSlidePairingTipText(e.target.value)}
                    placeholder="Cook fresh river fish with unpolished Red Rice"
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    টার্গেট লিঙ্ক (Target Href)
                  </label>
                  <input
                    type="text"
                    value={slidePairingTargetHref}
                    onChange={(e) => setSlidePairingTargetHref(e.target.value)}
                    placeholder="#dept-heritage-rice"
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    লেবেল (Button Label)
                  </label>
                  <input
                    type="text"
                    maxLength={SECTION_LIMITS.pairingTargetLabel}
                    value={slidePairingTargetLabel}
                    onChange={(e) => setSlidePairingTargetLabel(e.target.value)}
                    placeholder="See Heritage Rice"
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 text-xs bg-white"
                  />
                </div>
              </div>

              {/* CTA Button */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    কল টু অ্যাকশন বাটন টেক্সট (CTA Button Text)
                  </label>
                  <input
                    type="text"
                    maxLength={SECTION_LIMITS.ctaText}
                    value={slideCtaText}
                    onChange={(e) => setSlideCtaText(e.target.value)}
                    placeholder="Shop All Fresh Fish from Jamuna River"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1">
                    বাটন লিঙ্ক (CTA Link)
                  </label>
                  <input
                    type="text"
                    value={slideCtaLink}
                    onChange={(e) => setSlideCtaLink(e.target.value)}
                    placeholder="/shop?category=jamuna-river-fish"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Schedule and Active Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-stone-50 border border-stone-200 rounded-2xl items-center">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    ক্যাম্পেইন শুরু (Starts At)
                  </label>
                  <input
                    type="datetime-local"
                    value={slideStartsAt}
                    onChange={(e) => setSlideStartsAt(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    ক্যাম্পেইন শেষ (Ends At)
                  </label>
                  <input
                    type="datetime-local"
                    value={slideEndsAt}
                    onChange={(e) => setSlideEndsAt(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4 sm:pt-0">
                  <input
                    type="checkbox"
                    id="slide-is-active-chk"
                    checked={slideIsActive}
                    onChange={(e) => setSlideIsActive(e.target.checked)}
                    className="w-5 h-5 accent-[#0F3D2E] rounded cursor-pointer"
                  />
                  <label
                    htmlFor="slide-is-active-chk"
                    className="text-xs font-extrabold text-stone-800 cursor-pointer"
                  >
                    স্লাইড সক্রিয় রাখুন (Active)
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsSlideModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#0F3D2E] hover:bg-[#14533e] text-white text-xs font-black shadow-md transition"
                >
                  {editingSlide ? "আপডেট সংরক্ষণ করুন" : "স্লাইড প্রকাশ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
