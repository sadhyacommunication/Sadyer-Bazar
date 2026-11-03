"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Fish,
  Flame,
  Award,
  Wheat,
  Leaf,
  Truck,
  Clock,
  Star,
  Heart,
  Gift,
  Phone,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import {
  DEFAULT_SECTION_SETTINGS,
  DEFAULT_SECTION_SLIDES,
  isSectionSlideLive,
  type SectionSlide,
  type SectionSliderSettings,
} from "@/lib/sections/content";
import type { DepartmentSectionKey } from "@/lib/sections/schema";
import type { HeroIconKey } from "@/lib/hero/schema";

export function renderSectionIcon(
  iconKey: HeroIconKey,
  className = "w-3.5 h-3.5 text-amber-300 shrink-0"
) {
  switch (iconKey) {
    case "fish":
      return <Fish className={className} />;
    case "award":
      return <Award className={className} />;
    case "flame":
      return <Flame className={className} />;
    case "wheat":
      return <Wheat className={className} />;
    case "leaf":
      return <Leaf className={className} />;
    case "sparkles":
      return <Sparkles className={className} />;
    case "truck":
      return <Truck className={className} />;
    case "shield":
      return <ShieldCheck className={className} />;
    case "clock":
      return <Clock className={className} />;
    case "star":
      return <Star className={className} />;
    case "heart":
      return <Heart className={className} />;
    case "gift":
      return <Gift className={className} />;
    case "phone":
      return <Phone className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

export const THEME_STYLES = {
  emerald: {
    wrapperBg: "bg-gradient-to-br from-[#0F3D2E] via-[#124836] to-[#0A291F]",
    badgeBg: "bg-emerald-400/15 text-amber-300 border-emerald-400/30",
    quoteBox: "bg-emerald-950/70 border-amber-400/40 text-amber-200",
    ctaBtn: "bg-amber-400 hover:bg-amber-300 text-stone-950",
    sectionPill: "bg-[#0F3D2E]/10 text-[#0F3D2E] border-[#0F3D2E]/20",
    activeDot: "bg-amber-400",
  },
  amber: {
    wrapperBg: "bg-gradient-to-br from-[#3A2610] via-[#4D3316] to-[#291A0A]",
    badgeBg: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    quoteBox: "bg-stone-950/65 border-amber-400/40 text-amber-200",
    ctaBtn: "bg-amber-400 hover:bg-amber-300 text-stone-950",
    sectionPill: "bg-amber-900/10 text-amber-900 border-amber-800/20",
    activeDot: "bg-amber-400",
  },
  terracotta: {
    wrapperBg: "bg-gradient-to-br from-[#163A24] via-[#1E4B30] to-[#0E2818]",
    badgeBg: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    quoteBox: "bg-black/40 border-amber-400/40 text-amber-200",
    ctaBtn: "bg-[#C83E2B] hover:bg-[#b23321] text-white",
    sectionPill: "bg-emerald-950/10 text-[#0F3D2E] border-emerald-800/20",
    activeDot: "bg-[#C83E2B]",
  },
  royal: {
    wrapperBg: "bg-gradient-to-br from-[#4A121A] via-[#5E1922] to-[#330B11]",
    badgeBg: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    quoteBox: "bg-black/45 border-amber-400/40 text-amber-200",
    ctaBtn: "bg-amber-400 hover:bg-amber-300 text-stone-950",
    sectionPill: "bg-[#C83E2B]/10 text-[#C83E2B] border-[#C83E2B]/20",
    activeDot: "bg-amber-400",
  },
} as const;

export interface DepartmentSliderProps {
  sectionId: DepartmentSectionKey;
  accentTheme: "emerald" | "amber" | "terracotta" | "royal";
  categorySlug: string;
  defaultLayout?: "default" | "reversed";
  previewSlides?: SectionSlide[];
  previewSettings?: SectionSliderSettings;
  previewMode?: boolean;
}

export default function DepartmentSlider({
  sectionId,
  accentTheme,
  categorySlug,
  defaultLayout = "default",
  previewSlides,
  previewSettings,
  previewMode = false,
}: DepartmentSliderProps) {
  const { sectionSlides: storeSlides, sectionSettings: storeSettings } = useStore();

  const theme = THEME_STYLES[accentTheme] ?? THEME_STYLES.emerald;
  const settings =
    previewSettings ??
    storeSettings[sectionId] ??
    DEFAULT_SECTION_SETTINGS[sectionId] ??
    DEFAULT_SECTION_SETTINGS.dept_jamuna_fish;

  const slides = useMemo(() => {
    if (previewMode && previewSlides && previewSlides.length > 0) {
      return previewSlides;
    }
    const filtered = (storeSlides || []).filter((s) => s.sectionId === sectionId);
    const live = filtered.filter((s) => isSectionSlideLive(s));
    if (live.length > 0) return live;
    const defaults = DEFAULT_SECTION_SLIDES.filter((s) => s.sectionId === sectionId);
    return defaults.length > 0 ? defaults : DEFAULT_SECTION_SLIDES.slice(0, 2);
  }, [previewMode, previewSlides, storeSlides, sectionId]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Keep index within bounds if slide count changes dynamically
  useEffect(() => {
    if (currentIndex >= slides.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, slides.length]);

  const nextSlide = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Autoplay timer
  useEffect(() => {
    if (isHovered || !settings.autoplay || slides.length <= 1) return;
    const intervalMs = Math.max(2, Math.min(20, settings.autoplaySeconds || 5.0)) * 1000;
    const timer = setInterval(() => {
      nextSlide();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isHovered, nextSlide, settings.autoplay, settings.autoplaySeconds, slides.length]);

  // Touch Swipe Handlers for mobile & tablets
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 40;

    if (diff > threshold) {
      nextSlide();
    } else if (diff < -threshold) {
      prevSlide();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <div
      className={`relative rounded-3xl overflow-hidden shadow-xl border border-stone-200/80 ${theme.wrapperBg} text-white select-none group`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-label={`${sectionId} department banner carousel`}
    >
      {/* Top Floating Badge Strip: Slide Counter */}
      {settings.showCounter && slides.length > 1 && (
        <div className="absolute top-4 right-4 sm:right-6 z-20 pointer-events-none">
          <span className="px-3 py-1.5 rounded-full bg-stone-950/75 backdrop-blur-md text-white font-mono text-xs font-bold border border-white/15 shadow-sm">
            {String(currentIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>
        </div>
      )}

      {/* Crossfade Slides Container */}
      <div className="relative min-h-[460px] sm:min-h-[440px]">
        {slides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          const isReversed = (slide.bannerLayout || defaultLayout) === "reversed";

          return (
            <div
              key={slide.id || idx}
              className={`w-full transition-opacity duration-700 ease-in-out ${
                isActive
                  ? "relative opacity-100 z-10 pointer-events-auto"
                  : "absolute inset-0 opacity-0 z-0 pointer-events-none"
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
                {/* Visual Bangla Promotional Banner Column — Zero Cropping */}
                <div
                  className={`lg:col-span-7 p-3 sm:p-5 flex flex-col justify-center ${
                    isReversed ? "lg:order-2" : "lg:order-1"
                  }`}
                >
                  <div className="w-full rounded-2xl overflow-hidden border-2 border-amber-400/35 shadow-2xl bg-stone-950">
                    <img
                      src={slide.imageUrl}
                      alt={slide.imageAlt || slide.titleEn}
                      loading={idx === 0 ? "eager" : "lazy"}
                      className="w-full h-auto object-contain block"
                    />
                  </div>

                  {/* Clean Metadata Strip Below Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 px-1 text-[11px] font-bold">
                    {slide.originLocation && (
                      <span className="inline-flex items-center gap-1.5 text-amber-300">
                        <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Origin: {slide.originLocation}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-emerald-300 ml-auto">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>১০০% খাঁটি ও পরীক্ষিত • Sadhyer Bazar Verified</span>
                    </span>
                  </div>
                </div>

                {/* Convincing Story & Action Column */}
                <div
                  className={`lg:col-span-5 p-5 sm:p-7 flex flex-col justify-between space-y-4 ${
                    isReversed ? "lg:order-1" : "lg:order-2"
                  }`}
                >
                  <div className="space-y-3.5">
                    {slide.badgeTextBn && (
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${theme.badgeBg}`}
                      >
                        {renderSectionIcon(slide.badgeIcon)}
                        <span>{slide.badgeTextBn}</span>
                      </div>
                    )}

                    {/* High-Impact Bangla Headline Box */}
                    <div className={`p-3.5 rounded-2xl border-l-4 space-y-1 ${theme.quoteBox}`}>
                      <h3 className="text-base sm:text-lg font-extrabold text-white leading-snug">
                        “{slide.headlineBn}”
                      </h3>
                      {slide.convincingSubtextBn && (
                        <p className="text-xs text-amber-200/95 font-medium leading-relaxed">
                          {slide.convincingSubtextBn}
                        </p>
                      )}
                    </div>

                    {slide.descriptionEn && (
                      <p className="text-xs text-stone-200/90 leading-relaxed">
                        {slide.descriptionEn}
                      </p>
                    )}

                    {/* Quality Guarantees */}
                    {slide.highlights && slide.highlights.length > 0 && (
                      <ul className="space-y-1.5">
                        {slide.highlights.map((point, pIdx) => (
                          <li
                            key={pIdx}
                            className="flex items-center gap-2 text-xs font-semibold text-white/95"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Bottom Pairing Tip + Action CTA */}
                  <div className="pt-3 border-t border-white/15 space-y-3">
                    {slide.pairingTipText && (
                      <div className="flex items-center justify-between gap-2 text-xs bg-white/10 rounded-xl px-3 py-2">
                        <span className="text-stone-200 font-medium">
                          💡 <strong className="text-amber-300">Pairing Tip:</strong>{" "}
                          {slide.pairingTipText}
                        </span>
                        {slide.pairingTargetHref && slide.pairingTargetLabel && (
                          <a
                            href={slide.pairingTargetHref}
                            className="text-amber-300 hover:underline font-extrabold whitespace-nowrap shrink-0"
                          >
                            {slide.pairingTargetLabel} →
                          </a>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={slide.ctaLink || `/shop?category=${encodeURIComponent(categorySlug)}`}
                        className={`px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 transition shadow-lg ${theme.ctaBtn}`}
                      >
                        <span>{slide.ctaText || `Shop All ${slide.badgeTextEn || "Products"}`}</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                      <span className="text-[11px] text-stone-300 font-medium">
                        • 1-Click Checkout • Cash on Delivery
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Chevrons */}
      {settings.showNavigation && slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prevSlide}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-stone-950/70 hover:bg-stone-900/95 backdrop-blur-md text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-lg active:scale-90"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-stone-950/70 hover:bg-stone-900/95 backdrop-blur-md text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-lg active:scale-90"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dot Indicators */}
      {settings.showDots && slides.length > 1 && (
        <div className="absolute bottom-2.5 sm:bottom-3.5 inset-x-0 z-20 flex items-center justify-center gap-2 px-4 pointer-events-auto">
          {slides.map((_, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  isActive ? `w-8 ${theme.activeDot}` : "w-2.5 bg-white/40 hover:bg-white/70"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
