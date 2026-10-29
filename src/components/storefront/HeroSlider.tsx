"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";

export interface HeroSlide {
  id: string;
  image: string;
  alt: string;
  badge: string;
  badgeIcon: React.ReactNode;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

const slides: HeroSlide[] = [
  {
    id: "jamuna-fish",
    image: "/images/banners/hero-jamuna-river-dawn.jpg",
    alt: "যমুনা নদীর ভোরবেলার তাজা মাছ — সাধ্যের বাজার",
    badge: "যমুনার মোহনা থেকে সরাসরি",
    badgeIcon: <Fish className="w-3.5 h-3.5 text-amber-300" />,
    title: "ভোরবেলা ধরা যমুনার তাজা নদীর মাছ",
    subtitle: "ফরমালিন ও রাসায়নিকমুক্ত • বরফ ছাড়া নদী থেকে সরাসরি আপনার ঘরে",
    ctaText: "তাজা মাছ প্রি-অর্ডার করুন",
    ctaLink: "/pre-orders",
  },
  {
    id: "ghee-doi",
    image: "/images/banners/hero-gawa-ghee-bogura-doi.jpg",
    alt: "সিরাজগঞ্জের খাঁটি গাওয়া ঘি ও বগুড়ার শাহী দই — সাধ্যের বাজার",
    badge: "শতভাগ খাঁটি দুগ্ধজাত ঐতিহ্য",
    badgeIcon: <Award className="w-3.5 h-3.5 text-amber-300" />,
    title: "সিরাজগঞ্জের গাওয়া ঘি ও বগুড়ার শাহী দই",
    subtitle: "কোনো প্রিজারভেটিভ বা ডালডা ছাড়া ঐতিহ্যবাহী গ্রাম্য মাটির স্বাদ",
    ctaText: "ঘি ও দই সংগ্রহ করুন",
    ctaLink: "/shop?category=ghee-and-dairy",
  },
  {
    id: "village-poultry",
    image: "/images/banners/hero-village-deshi-poultry.jpg",
    alt: "গ্রামের মুক্ত চারণভূমির দেশি মুরগি ও হাঁসের ডিম — সাধ্যের বাজার",
    badge: "উন্মুক্ত চারণভূমির প্রাকৃতিক খামার",
    badgeIcon: <Flame className="w-3.5 h-3.5 text-amber-300" />,
    title: "গ্রামের মুক্ত খামারের দেশি মুরগি ও ডিম",
    subtitle: "কৃত্রিম ফিড ও অ্যান্টিবায়োটিকমুক্ত স্বাস্থ্যকর প্রাকৃতিক পুষ্টি",
    ctaText: "দেশি মুরগি ও ডিম দেখুন",
    ctaLink: "/shop?category=deshi-meat-poultry",
  },
  {
    id: "heritage-rice",
    image: "/images/banners/hero-heritage-golden-rice.jpg",
    alt: "দিনাজপুরের কাটারিভোগ ও ঐতিহ্যবাহী লাল চাল — সাধ্যের বাজার",
    badge: "অকৃত্রিম গ্রাম্য পুষ্টি ও সুবাস",
    badgeIcon: <Wheat className="w-3.5 h-3.5 text-amber-300" />,
    title: "দিনাজপুরের কাটারিভোগ ও সুগন্ধি লাল চাল",
    subtitle: "পলিশহীন, ফাইবার সমৃদ্ধ ও প্রাচীন জাতের আসল পুষ্টিকর চাল",
    ctaText: "অর্গানিক চাল কিনুন",
    ctaLink: "/shop?category=organic-rice-honey",
  },
];

const AUTO_PLAY_INTERVAL = 4500; // 4.5 seconds per slide

export default function HeroSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, []);

  // Auto-play timer
  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      nextSlide();
    }, AUTO_PLAY_INTERVAL);

    return () => clearInterval(timer);
  }, [isHovered, nextSlide]);

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
              key={slide.id}
              className={`absolute inset-0 w-full h-full transition-all duration-700 ease-in-out ${
                isActive
                  ? "opacity-100 scale-100 pointer-events-auto z-10"
                  : "opacity-0 scale-105 pointer-events-none z-0"
              }`}
            >
              {/* Natural High-Res Photography Banner (Zero text on image) */}
              <img
                src={slide.image}
                alt={slide.alt}
                loading={idx === 0 ? "eager" : "lazy"}
                className="w-full h-full object-cover object-center"
              />

              {/* Natural Left & Bottom Vignette Gradient: keeps photo bright while making text 100% legible */}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/45 to-transparent sm:bg-gradient-to-r sm:from-stone-950/90 sm:via-stone-950/40 sm:to-transparent" />

              {/* Floating Caption Overlay on Left */}
              <div className="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:left-0 sm:w-3/5 lg:w-1/2 p-6 sm:p-10 lg:p-14 flex flex-col justify-end sm:justify-center text-left">
                {/* Category Micro Badge */}
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-900/80 border border-white/20 backdrop-blur-md text-amber-300 text-xs sm:text-sm font-bold w-fit mb-3 shadow-sm">
                  {slide.badgeIcon}
                  <span>{slide.badge}</span>
                </div>

                {/* Punchy Concise Headline */}
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight drop-shadow-md">
                  {slide.title}
                </h2>

                {/* Subtitle */}
                <p className="text-xs sm:text-sm lg:text-base text-emerald-100/90 mt-2 line-clamp-2 max-w-lg drop-shadow-xs">
                  {slide.subtitle}
                </p>

                {/* Action CTA Button */}
                <div className="pt-4 sm:pt-6">
                  <Link
                    href={slide.ctaLink}
                    className="inline-flex items-center gap-2.5 px-5 py-3 sm:px-6 sm:py-3.5 rounded-2xl bg-[#C83E2B] hover:bg-[#b03221] text-white text-xs sm:text-sm font-bold shadow-xl shadow-black/40 transition-transform active:scale-95"
                  >
                    <span>{slide.ctaText}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Floating Badges: Live Sadhyer Bazar Guarantee & Slide Counter */}
      <div className="absolute top-4 inset-x-4 sm:inset-x-6 flex items-center justify-between pointer-events-none z-20">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-950/65 backdrop-blur-md text-emerald-300 text-xs font-semibold border border-white/10 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>১০০% প্রাকৃতিক ও ফরমালিনমুক্ত</span>
        </span>

        {/* Counter (e.g., 01 / 04) */}
        <span className="px-3 py-1.5 rounded-full bg-stone-950/70 backdrop-blur-md text-white font-mono text-xs font-bold border border-white/10 shadow-xs">
          0{currentIndex + 1} / 0{slides.length}
        </span>
      </div>

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
    </div>
  );
}
