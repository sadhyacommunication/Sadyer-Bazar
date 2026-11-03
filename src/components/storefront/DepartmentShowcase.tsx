"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Product } from "@/types";
import type { DepartmentSectionKey } from "@/lib/sections/schema";
import ProductCard from "./ProductCard";
import DepartmentSlider from "./DepartmentSlider";

export interface DepartmentShowcaseProps {
  id: string;
  sectionKey?: DepartmentSectionKey;
  departmentNumber: string;
  badgeTextEn: string;
  badgeTextBn: string;
  titleEn: string;
  headlineBn: string;
  convincingSubtextBn: string;
  descriptionEn: string;
  originLocation: string;
  bannerImageUrl: string;
  bannerAlt: string;
  highlights: string[];
  pairingTipText: string;
  pairingTargetHref: string;
  pairingTargetLabel: string;
  categorySlug: string;
  accentTheme: "emerald" | "amber" | "terracotta" | "royal";
  reverseBannerLayout?: boolean;
  products: Product[];
}

const THEME_STYLES = {
  emerald: {
    wrapperBg: "bg-gradient-to-br from-[#0F3D2E] via-[#124836] to-[#0A291F]",
    badgeBg: "bg-emerald-400/15 text-amber-300 border-emerald-400/30",
    quoteBox: "bg-emerald-950/70 border-amber-400/40 text-amber-200",
    ctaBtn: "bg-amber-400 hover:bg-amber-300 text-stone-950",
    sectionPill: "bg-[#0F3D2E]/10 text-[#0F3D2E] border-[#0F3D2E]/20",
  },
  amber: {
    wrapperBg: "bg-gradient-to-br from-[#3A2610] via-[#4D3316] to-[#291A0A]",
    badgeBg: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    quoteBox: "bg-stone-950/65 border-amber-400/40 text-amber-200",
    ctaBtn: "bg-amber-400 hover:bg-amber-300 text-stone-950",
    sectionPill: "bg-amber-900/10 text-amber-900 border-amber-800/20",
  },
  terracotta: {
    wrapperBg: "bg-gradient-to-br from-[#163A24] via-[#1E4B30] to-[#0E2818]",
    badgeBg: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    quoteBox: "bg-black/40 border-amber-400/40 text-amber-200",
    ctaBtn: "bg-[#C83E2B] hover:bg-[#b23321] text-white",
    sectionPill: "bg-emerald-950/10 text-[#0F3D2E] border-emerald-800/20",
  },
  royal: {
    wrapperBg: "bg-gradient-to-br from-[#4A121A] via-[#5E1922] to-[#330B11]",
    badgeBg: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    quoteBox: "bg-black/45 border-amber-400/40 text-amber-200",
    ctaBtn: "bg-amber-400 hover:bg-amber-300 text-stone-950",
    sectionPill: "bg-[#C83E2B]/10 text-[#C83E2B] border-[#C83E2B]/20",
  },
};

export default function DepartmentShowcase({
  id,
  sectionKey,
  departmentNumber,
  badgeTextEn,
  badgeTextBn,
  titleEn,
  headlineBn,
  convincingSubtextBn,
  descriptionEn,
  originLocation,
  bannerImageUrl,
  bannerAlt,
  highlights,
  pairingTipText,
  pairingTargetHref,
  pairingTargetLabel,
  categorySlug,
  accentTheme,
  reverseBannerLayout = false,
  products,
}: DepartmentShowcaseProps) {
  const theme = THEME_STYLES[accentTheme];
  const resolvedSectionKey = (sectionKey || id.replace(/-/g, "_")) as DepartmentSectionKey;

  return (
    <section
      id={id}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-28"
    >
      {/* Department Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold border ${theme.sectionPill}`}
            >
              DEPT {departmentNumber} • {badgeTextEn}
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-[#C83E2B]">
              {badgeTextBn}
            </span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            {titleEn}
          </h2>
        </div>

        <Link
          href={`/shop?category=${encodeURIComponent(categorySlug)}`}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#0F3D2E] hover:text-[#C83E2B] transition self-start md:self-auto"
        >
          <span>Explore Full {badgeTextEn} Department</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Thematic Bangla Banner Carousel / Slider (Zero Cropping, Full Controls) */}
      <DepartmentSlider
        sectionId={resolvedSectionKey}
        accentTheme={accentTheme}
        categorySlug={categorySlug}
        defaultLayout={reverseBannerLayout ? "reversed" : "default"}
      />

      {/* 4-Column Curated Department Product Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
