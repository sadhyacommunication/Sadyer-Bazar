"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Fish,
  Flame,
  Award,
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
import { DEFAULT_HERO_SETTINGS, DEFAULT_HERO_SLIDES, isHeroSlideLive } from "@/lib/hero/content";
import type { HeroIconKey, HeroImagePosition, HeroSettings, HeroSlide } from "@/types";

export function renderHeroIcon(
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

function getImagePositionClass(pos?: HeroImagePosition): string {
  switch (pos) {
    case "top":
      return "object-top";
    case "bottom":
      return "object-bottom";
    case "left":
      return "object-left";
    case "right":
      return "object-right";
    case "center":
    default:
      return "object-center";
  }
}

export interface HeroSliderProps {
  slides?: HeroSlide[];
  settings?: HeroSettings;
  /** When true, shows all provided slides even if scheduled/inactive (used in admin live preview) */
  previewMode?: boolean;
}

export default function HeroSlider({
  slides: propSlides,
  settings: propSettings,
  previewMode = false,
}: HeroSliderProps) {
  const { heroSlides: storeSlides, heroSettings: storeSettings } = useStore();

  const settings = propSettings ?? storeSettings ?? DEFAULT_HERO_SETTINGS;
  const rawSlides = propSlides ?? storeSlides ?? DEFAULT_HERO_SLIDES;

  const slides = useMemo(() => {
    if (previewMode && propSlides && propSlides.length > 0) {
      return propSlides;
    }
    const live = rawSlides.filter((s) => isHeroSlideLive(s));
    return live.length > 0 ? live : DEFAULT_HERO_SLIDES;
  }, [previewMode, propSlides, rawSlides]);

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

  // Auto-play timer
  useEffect(() => {
    if (isHovered || !settings.autoplay || slides.length <= 1) return;
    const intervalMs = Math.max(2, Math.min(20, settings.autoplaySeconds || 4.5)) * 1000;
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
    const threshold = 40; // minimum 40px swipe distance

    if (diff > threshold) {
      nextSlide(); // swiped left
    } else if (diff < -threshold) {
      prevSlide(); // swiped right
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <div
      className="relative w-full h-[320px] sm:h-[400px] lg:h-[460px] xl:h-[500px] rounded-3xl overflow-hidden shadow-2xl border-2 border-emerald-700/50 bg-stone-950 select-none group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-label="Fresh organic food showcase carousel"
    >
      {/* Slides Container */}
      <div className="relative w-full h-full">
        {slides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          return (
            <div
              key={slide.id || idx}
              className={`absolute inset-0 w-full h-full transition-all duration-700 ease-in-out ${
                isActive
                  ? "opacity-100 scale-100 pointer-events-auto z-10"
                  : "opacity-0 scale-105 pointer-events-none z-0"
              }`}
            >
              {/* Natural High-Res Photography Banner */}
              <img
                src={slide.imageUrl}
                alt={slide.imageAlt || slide.title}
                loading={idx === 0 ? "eager" : "lazy"}
                className={`w-full h-full object-cover ${getImagePositionClass(
                  slide.imagePosition
                )}`}
              />

              {/* Natural Left & Bottom Vignette Gradient: keeps photo bright while making text 100% legible */}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/45 to-transparent sm:bg-gradient-to-r sm:from-stone-950/90 sm:via-stone-950/40 sm:to-transparent" />

              {/* Floating Caption Overlay on Left */}
              <div className="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:left-0 sm:w-3/5 lg:w-1/2 p-6 sm:p-10 lg:p-14 flex flex-col justify-end sm:justify-center text-left">
                {/* Category Micro Badge */}
                {slide.badgeText && (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-900/80 border border-white/20 backdrop-blur-md text-amber-300 text-xs sm:text-sm font-bold w-fit mb-3 shadow-sm">
                    {renderHeroIcon(slide.badgeIcon)}
                    <span>{slide.badgeText}</span>
                  </div>
                )}

                {/* Punchy Concise Headline */}
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight drop-shadow-md">
                  {slide.title}
                </h2>

                {/* Subtitle */}
                {slide.subtitle && (
                  <p className="text-xs sm:text-sm lg:text-base text-emerald-100/90 mt-2 line-clamp-2 max-w-lg drop-shadow-xs">
                    {slide.subtitle}
                  </p>
                )}

                {/* Action CTA Button */}
                {slide.ctaText && slide.ctaLink && (
                  <div className="pt-4 sm:pt-6">
                    <Link
                      href={slide.ctaLink}
                      className="inline-flex items-center gap-2.5 px-5 py-3 sm:px-6 sm:py-3.5 rounded-2xl bg-[#C83E2B] hover:bg-[#b03221] text-white text-xs sm:text-sm font-bold shadow-xl shadow-black/40 transition-transform active:scale-95"
                    >
                      <span>{slide.ctaText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Floating Badges: Guarantee & Slide Counter */}
      <div className="absolute top-4 inset-x-4 sm:inset-x-6 flex items-center justify-between pointer-events-none z-20">
        {settings.showGuarantee && settings.guaranteeText ? (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-950/65 backdrop-blur-md text-emerald-300 text-xs font-semibold border border-white/10 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{settings.guaranteeText}</span>
          </span>
        ) : (
          <span />
        )}

        {/* Counter (e.g., 01 / 04) */}
        {settings.showCounter && slides.length > 0 && (
          <span className="px-3 py-1.5 rounded-full bg-stone-950/70 backdrop-blur-md text-white font-mono text-xs font-bold border border-white/10 shadow-xs">
            {String(currentIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>
        )}
      </div>

      {/* Navigation Arrows (rendered when there is more than 1 slide) */}
      {slides.length > 1 && (
        <>
          {/* Previous Slide Button */}
          <button
            type="button"
            onClick={prevSlide}
            className="absolute left-3.5 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-stone-950/60 hover:bg-stone-900/90 backdrop-blur-md text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-lg active:scale-90"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Next Slide Button */}
          <button
            type="button"
            onClick={nextSlide}
            className="absolute right-3.5 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-stone-950/60 hover:bg-stone-900/90 backdrop-blur-md text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-lg active:scale-90"
            aria-label="Next slide"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Segmented Progress Indicators */}
          <div className="absolute bottom-3.5 sm:bottom-5 inset-x-0 z-20 flex items-center justify-center gap-2.5 px-4 pointer-events-auto">
            {slides.map((_, idx) => {
              const isActive = idx === currentIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    isActive
                      ? "w-10 bg-amber-400"
                      : "w-3 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
