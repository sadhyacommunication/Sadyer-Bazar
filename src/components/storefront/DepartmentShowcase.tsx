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
import ProductCard from "./ProductCard";

export interface DepartmentShowcaseProps {
  id: string;
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

      {/* Thematic Bangla Banner + Persuasive Storytelling Card (Zero Cropping) */}
      <div
        className={`rounded-3xl overflow-hidden shadow-xl border border-stone-200/80 ${theme.wrapperBg} text-white`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
          {/* Visual Bangla Promotional Banner Column — Full Natural Aspect Ratio, Zero Cropping */}
          <div
            className={`lg:col-span-7 p-3 sm:p-5 flex flex-col justify-center ${
              reverseBannerLayout ? "lg:order-2" : "lg:order-1"
            }`}
          >
            <div className="w-full rounded-2xl overflow-hidden border-2 border-amber-400/35 shadow-2xl bg-stone-950">
              <img
                src={bannerImageUrl}
                alt={bannerAlt}
                className="w-full h-auto object-contain block"
              />
            </div>

            {/* Clean Metadata Strip Below Banner (Never Overlaps Image Borders) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 px-1 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Origin: {originLocation}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>১০০% খাঁটি ও পরীক্ষিত • Sadyer Bazar Verified</span>
              </span>
            </div>
          </div>

          {/* Convincing Bangla + English Story & Conversion Column */}
          <div
            className={`lg:col-span-5 p-5 sm:p-7 flex flex-col justify-between space-y-4 ${
              reverseBannerLayout ? "lg:order-1" : "lg:order-2"
            }`}
          >
            <div className="space-y-3.5">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${theme.badgeBg}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{badgeTextBn}</span>
              </div>

              {/* High-Impact Bangla Convincing Headline Box */}
              <div
                className={`p-3.5 rounded-2xl border-l-4 space-y-1 ${theme.quoteBox}`}
              >
                <h3 className="text-base sm:text-lg font-extrabold text-white leading-snug">
                  “{headlineBn}”
                </h3>
                <p className="text-xs text-amber-200/95 font-medium leading-relaxed">
                  {convincingSubtextBn}
                </p>
              </div>

              <p className="text-xs text-stone-200/90 leading-relaxed">
                {descriptionEn}
              </p>

              {/* 3 Key Quality Guarantees */}
              <ul className="space-y-1.5">
                {highlights.map((point, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 text-xs font-semibold text-white/95"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bottom Cross-Sell Pairing Tip + Action CTA */}
            <div className="pt-3 border-t border-white/15 space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs bg-white/10 rounded-xl px-3 py-2">
                <span className="text-stone-200 font-medium">
                  💡 <strong className="text-amber-300">Pairing Tip:</strong>{" "}
                  {pairingTipText}
                </span>
                <a
                  href={pairingTargetHref}
                  className="text-amber-300 hover:underline font-extrabold whitespace-nowrap shrink-0"
                >
                  {pairingTargetLabel} →
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/shop?category=${encodeURIComponent(categorySlug)}`}
                  className={`px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 transition shadow-lg ${theme.ctaBtn}`}
                >
                  <span>Shop All {badgeTextEn}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <span className="text-[11px] text-stone-300 font-medium">
                  • 1-Click Checkout • bKash & COD
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Column Curated Department Product Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
