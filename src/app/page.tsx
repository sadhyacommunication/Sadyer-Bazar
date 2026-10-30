"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Flame,
  ShieldCheck,
  Truck,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  Fish,
  Award,
  PhoneCall,
  PackageSearch,
  Star,
  Compass,
  Leaf,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import ProductCard from "@/components/storefront/ProductCard";
import FamilyComboBuilder from "@/components/storefront/FamilyComboBuilder";
import DepartmentShowcase from "@/components/storefront/DepartmentShowcase";
import HeroSlider, { renderHeroIcon } from "@/components/storefront/HeroSlider";
import { applyHeroPlaceholders } from "@/lib/hero/content";

export default function HomePage() {
  const router = useRouter();
  const { products, categories, settings, heroSettings } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [quickTrackCode, setQuickTrackCode] = useState("");

  // Live Countdown Timer for Next Pre-Order Catch
  const [timeLeft, setTimeLeft] = useState({
    days: 1,
    hours: 14,
    minutes: 38,
    seconds: 45,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0)
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0)
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { days: 1, hours: 23, minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeProducts = products.filter((p) => p.isActive);
  const preorderProducts = activeProducts.filter((p) => p.isPreorder);
  const filteredProducts =
    selectedCategory === "all"
      ? activeProducts
      : activeProducts.filter((p) => p.categorySlug === selectedCategory);

  // Curated Product Lists for the 4 Dedicated Homepage Department Sections
  const jamunaFishProducts = activeProducts.filter(
    (p) => p.categorySlug === "jamuna-river-fish"
  );

  const villagePoultryProducts = activeProducts.filter(
    (p) =>
      p.categorySlug === "deshi-meat-poultry" ||
      p.categorySlug === "farm-fresh-eggs"
  );

  const heritageRiceProducts = activeProducts.filter(
    (p) =>
      p.id === "prod-kataribhog-rice" ||
      p.id === "prod-basmati-rice" ||
      p.id === "prod-red-rice" ||
      p.id === "prod-chinigura-rice" ||
      (p.categorySlug === "organic-rice-honey" &&
        p.id !== "prod-sundarban-honey")
  );

  const gheeAndDoiProducts = [
    ...activeProducts.filter((p) => p.categorySlug === "ghee-and-dairy"),
    ...activeProducts.filter((p) => p.id === "prod-sundarban-honey"),
  ];

  const handleQuickTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTrackCode.trim()) return;
    router.push(
      `/track-order?code=${encodeURIComponent(quickTrackCode.trim().toUpperCase())}`
    );
  };

  return (
    <div className="space-y-16 sm:space-y-24 pb-20">
      {/* 1. HERO SECTION: Full-Width 4-Banner Natural Photography Slider */}
      <section className="relative overflow-hidden bg-[#0F3D2E] text-white pt-4 pb-8 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3 sm:space-y-4">
          {/* High-Impact Semantic SEO H1 Headline Header */}
          {heroSettings.showHeadline && (
            <div className="text-center space-y-1 pt-1 pb-1">
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                {heroSettings.headline}
              </h1>
              {heroSettings.subheadline && (
                <p className="text-xs sm:text-sm text-emerald-200/90 font-medium max-w-3xl mx-auto">
                  {heroSettings.subheadline}
                </p>
              )}
            </div>
          )}

          <HeroSlider />

          {/* Quick Natural Organic Trust Highlights */}
          {heroSettings.showTrustItems && heroSettings.trustItems.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 text-xs">
              {heroSettings.trustItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-emerald-950/60 border border-emerald-800/50 rounded-2xl p-3 sm:px-4 sm:py-3.5 flex items-center gap-3 shadow-xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-800/80 text-amber-300 flex items-center justify-center shrink-0">
                    {renderHeroIcon(item.icon, "w-4 h-4 text-emerald-300")}
                  </div>
                  <div>
                    <strong className="text-white block font-bold text-xs sm:text-sm">
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
      </section>

      {/* 2. LIVE PRE-ORDER CATCH BOARD (Existing Section Kept Intact) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="bg-white rounded-3xl border-2 border-[#0F3D2E]/15 shadow-xl p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 pb-6 border-b border-stone-200/80">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#C83E2B]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C83E2B] animate-ping" />
                Live Pre-Order Batch Booking
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                Next Jamuna River Catch & Bogura Doi Dispatch
              </h2>
              <p className="text-xs sm:text-sm text-stone-600">
                Reserve your share before the batch closes. Caught at dawn and
                delivered straight to your home in thermal boxes.
              </p>
            </div>

            {/* Live Countdown Clock */}
            <div className="w-full sm:w-auto max-w-full bg-stone-950 text-white px-3.5 py-3 sm:px-5 sm:py-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between sm:justify-start gap-2.5 sm:gap-3.5 self-stretch sm:self-start lg:self-center shrink-0">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-stone-300">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                <span className="whitespace-nowrap">Batch Cut-Off In:</span>
              </div>
              <div className="flex items-center justify-center gap-1 sm:gap-1.5 font-mono text-xs sm:text-base font-extrabold">
                <span className="px-2 py-1 rounded-lg bg-white/10 text-amber-300 min-w-[34px] sm:min-w-[38px] text-center">
                  {String(timeLeft.days).padStart(2, "0")}d
                </span>
                <span className="text-stone-400 font-bold">:</span>
                <span className="px-2 py-1 rounded-lg bg-white/10 text-amber-300 min-w-[34px] sm:min-w-[38px] text-center">
                  {String(timeLeft.hours).padStart(2, "0")}h
                </span>
                <span className="text-stone-400 font-bold">:</span>
                <span className="px-2 py-1 rounded-lg bg-white/10 text-amber-300 min-w-[34px] sm:min-w-[38px] text-center">
                  {String(timeLeft.minutes).padStart(2, "0")}m
                </span>
                <span className="text-stone-400 font-bold">:</span>
                <span className="px-2 py-1 rounded-lg bg-[#C83E2B] text-white min-w-[34px] sm:min-w-[38px] text-center shadow-xs">
                  {String(timeLeft.seconds).padStart(2, "0")}s
                </span>
              </div>
            </div>
          </div>

          {/* Pre-Order Spotlight Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6 pt-4 sm:pt-6">
            {preorderProducts.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* 2.5 QUICK-JUMP DEPARTMENT NAVIGATION RIBBON */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-stone-200/90 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#0F3D2E] text-amber-300 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#C83E2B] block">
                Shop by Specialty Department
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                Jump Directly to Our 4 Signature Collections
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-2 md:pb-0 -mx-1 px-1">
            <a
              href="#dept-jamuna-fish"
              className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 hover:bg-[#0F3D2E] text-[#0F3D2E] hover:text-white border border-emerald-200 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition flex items-center gap-1.5 shrink-0"
            >
              <span>🐟 Fresh Jamuna Fish</span>
              <span className="opacity-75">(যমুনার মাছ)</span>
            </a>
            <a
              href="#dept-village-chicken"
              className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-amber-50 hover:bg-[#0F3D2E] text-amber-950 hover:text-white border border-amber-200 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition flex items-center gap-1.5 shrink-0"
            >
              <span>🐓 Village Deshi Chicken</span>
              <span className="opacity-75">(দেশি মুরগি ও ডিম)</span>
            </a>
            <a
              href="#dept-heritage-rice"
              className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 hover:bg-[#0F3D2E] text-[#0F3D2E] hover:text-white border border-emerald-200 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition flex items-center gap-1.5 shrink-0"
            >
              <span>🌾 Kataribhog, Basmati & Red Rice</span>
              <span className="opacity-75">(চাল)</span>
            </a>
            <a
              href="#dept-ghee-doi"
              className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-rose-50 hover:bg-[#C83E2B] text-[#C83E2B] hover:text-white border border-rose-200 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition flex items-center gap-1.5 shrink-0"
            >
              <span>🏺 Gawa Ghee & Bogura Doi</span>
              <span className="opacity-75">(ঘি ও দই)</span>
            </a>
          </div>
        </div>
      </section>

      {/* =====================================================================
          NEW THEMATIC DEPARTMENT SECTIONS (1 to 4) WITH BANGLA VISUAL BANNERS
         ===================================================================== */}

      {/* DEPARTMENT 1: FRESH FISH FROM JAMUNA RIVER */}
      <DepartmentShowcase
        id="dept-jamuna-fish"
        departmentNumber="01"
        badgeTextEn="Fresh Fish from Jamuna River"
        badgeTextBn="যমুনা নদীর ভোরের তাজা মাছ"
        titleEn="Wild-Caught Fresh Fish Directly from Jamuna River"
        headlineBn="যমুনার ভোরের তাজা মাছ — জেলের জাল থেকে সরাসরি আপনার ঘরে!"
        convincingSubtextBn="১০০% ফরমালিন ও হিমাগার (Cold-Storage) মুক্ত। ভোরবেলা সিরাজগঞ্জ ও সারিয়াকান্দি ঘাটে জেলের জাল থেকে তুলেই ফুড-গ্রেড আইসবক্সে প্যাকিং করে পাঠানো হয়।"
        descriptionEn="We never buy from city wholesale markets or keep fish frozen in storage. Our local team stands at the Jamuna river ghats at dawn to collect wild Piali, Kajoli, Ayer, Boal, Chital, Deshi Rui, and giant Galda Chingri."
        originLocation="Sirajganj & Sariakandi Jamuna Ghat"
        bannerImageUrl="/images/banners/jamuna-fisherman-banner.jpg"
        bannerAlt="যমুনার ভোরের তাজা মাছ — জেলের জাল থেকে সরাসরি আপনার ঘরে"
        highlights={[
          "100% Wild River Catch — Zero Farmed or Cold-Storage Fish",
          "Custom Bengali Cutting & Cleaning Options Available",
          "Packed Immediately in Food-Grade Thermal Ice Boxes",
        ]}
        pairingTipText="Cook fresh river fish with unpolished Red Rice"
        pairingTargetHref="#dept-heritage-rice"
        pairingTargetLabel="See Heritage Rice"
        categorySlug="jamuna-river-fish"
        accentTheme="emerald"
        reverseBannerLayout={false}
        products={jamunaFishProducts.slice(0, 4)}
      />

      {/* DEPARTMENT 2: DESHI CHICKEN, DUCK & EGGS FROM VILLAGE */}
      <DepartmentShowcase
        id="dept-village-chicken"
        departmentNumber="02"
        badgeTextEn="Deshi Chicken & Eggs from Village"
        badgeTextBn="গ্রামের আসল দেশি মুরগি, হাঁস ও ডিম"
        titleEn="Free-Range Deshi Chicken, Wetland Duck & Golden-Yolk Eggs"
        headlineBn="গ্রামীণ উঠানে প্রাকৃতিক খাবারে বেড়ে ওঠা আসল দেশি মুরগি ও ডিম!"
        convincingSubtextBn="ফার্মের সিন্থেটিক ফিড, গ্রোথ হরমোন ও অ্যান্টিবায়োটিক সম্পূর্ণ মুক্ত। বগুড়া, টাঙ্গাইল ও চলনবিল অঞ্চলের গ্রামীণ গৃহস্থ বাড়ি থেকে সরাসরি সংগৃহীত।"
        descriptionEn="Rediscover the authentic taste and aroma of childhood village curry (মাটির গন্ধ ও ঘরোয়া রান্নার স্বাদ). Our free-range Deshi chickens and Chalan Beel ducks are Halal processed on the morning of dispatch and cut to your exact preference."
        originLocation="Bogura, Tangail & Chalan Beel Villages"
        bannerImageUrl="/images/banners/village-chicken-banner.jpg"
        bannerAlt="গ্রামের আসল দেশি মুরগি ও ডিম — উঠানে পালা শতভাগ প্রাকৃতিক"
        highlights={[
          "100% Free-Range Village Homestead Foraged Poultry",
          "Zero Antibiotics, Steroids, or Commercial Broiler Feed",
          "Freshly Halal Dressed & Custom Curry-Cut on Delivery Morning",
        ]}
        pairingTipText="Pair Deshi Chicken Roast or Bhuna with Chinigura Polao"
        pairingTargetHref="#dept-heritage-rice"
        pairingTargetLabel="Explore Polao & Basmati Rice"
        categorySlug="deshi-meat-poultry"
        accentTheme="amber"
        reverseBannerLayout={true}
        products={villagePoultryProducts.slice(0, 4)}
      />

      {/* DEPARTMENT 3: HERITAGE RICE COLLECTION (KATARIBHOG, BASMATI & RED RICE) */}
      <DepartmentShowcase
        id="dept-heritage-rice"
        departmentNumber="03"
        badgeTextEn="Kataribhog, Basmati & Red Rice"
        badgeTextBn="দিনাজপুরের কাটারিভোগ, বাসমতি ও লাল চাল"
        titleEn="Royal Heritage Rice: Kataribhog, Aged Basmati, Chinigura & Red Rice"
        headlineBn="দিনাজপুরের ঐতিহ্যবাহী সুগন্ধি কাটারিভোগ, প্রিমিয়াম বাসমতি ও ঢেঁকি ছাঁটা লাল চাল!"
        convincingSubtextBn="কৃত্রিম সুগন্ধি, মোম পলিশ (Wax Polish) এবং কেমিক্যাল ব্লিচিং মুক্ত। প্রতিদিনের স্বাস্থ্যকর ভাত, ডায়াবেটিক ডায়েট কিংবা রাজকীয় বিরিয়ানি ও পোলাওয়ের জন্য সেরা।"
        descriptionEn="From GI-famous Dinajpur Kataribhog and 12-month aged extra-long Basmati to low-GI full-fiber unpolished Red Rice and Bogura Chinigura—every grain is sourced directly from heritage husking mills with intact nutrition."
        originLocation="Dinajpur, Sherpur & Naogaon Heritage Mills"
        bannerImageUrl="/images/banners/heritage-rice-banner.jpg"
        bannerAlt="কাটারিভোগ, বাসমতি ও লাল চাল — দিনাজপুরের ঐতিহ্যবাহী সুগন্ধি ও পুষ্টিকর চালের সমাহার"
        highlights={[
          "Dinajpur GI-Origin Kataribhog & 12-Month Aged Extra-Long Basmati",
          "Unpolished Low-GI Full-Fiber Red Rice (Diabetic & Heart Friendly)",
          "100% Stone-Free, Unbleached & Zero Chemical Wax Polish",
        ]}
        pairingTipText="Top steaming Kataribhog or Red Rice with 1 spoon Gawa Ghee"
        pairingTargetHref="#dept-ghee-doi"
        pairingTargetLabel="See Pure Gawa Ghee"
        categorySlug="organic-rice-honey"
        accentTheme="terracotta"
        reverseBannerLayout={false}
        products={heritageRiceProducts.slice(0, 4)}
      />

      {/* DEPARTMENT 4: PURE GAWA GHEE & BOGURA SHAHI DOI */}
      <DepartmentShowcase
        id="dept-ghee-doi"
        departmentNumber="04"
        badgeTextEn="Pure Gawa Ghee & Bogura Doi"
        badgeTextBn="খাঁটি গাওয়া ঘি ও বগুড়ার শাহী দই"
        titleEn="Sirajganj Bilona Gawa Ghee, Bogura Clay-Pot Shahi Doi & Raw Honey"
        headlineBn="সিরাজগঞ্জের দানাদার গাওয়া ঘি ও বগুড়ার ঐতিহ্যবাহী মাটির সরার শাহী দই!"
        convincingSubtextBn="খাঁটি গরুর দুধের ননি থেকে কাঠের চুলায় তৈরি ঘ্রাণযুক্ত দানাদার গাওয়া ঘি এবং শেরপুর-বগুড়ার কারিগরদের হাতে তৈরি মাটির সরার আসল শাহী মিষ্টি দই ও ক্ষীরসা।"
        descriptionEn="Experience the crown jewels of North Bengal's dairy heritage. Our Gawa Ghee is 100% free from dalda or palm oil, and our Bogura Shahi Doi & Khirsha are dispatched fresh in insulated thermal packaging."
        originLocation="Sirajganj Bathan & Sherpur, Bogura"
        bannerImageUrl="/images/banners/ghee-bogura-doi-banner.jpg"
        bannerAlt="খাঁটি গাওয়া ঘি ও বগুড়ার দই — সিরাজগঞ্জের দানাদার ঘি ও বগুড়ার ঐতিহ্যবাহী শাহী দই"
        highlights={[
          "Traditional Bilona Wood-Fired Granular Cow Milk Gawa Ghee",
          "Original Terracotta Clay Sora (মাটির সরা) Bogura Shahi Doi & Khirsha",
          "Lab-Verified 100% Pure — Zero Dalda, Artificial Essence or Starch",
        ]}
        pairingTipText="Bundle Ghee, Doi, Fish & Rice together for 8% Combo Savings"
        pairingTargetHref="#combo-builder"
        pairingTargetLabel="Build Family Box"
        categorySlug="ghee-and-dairy"
        accentTheme="royal"
        reverseBannerLayout={true}
        products={gheeAndDoiProducts.slice(0, 4)}
      />

      {/* =====================================================================
          EXISTING SECTIONS KEPT 100% INTACT BELOW
         ===================================================================== */}

      {/* 3. COMPLETE BILINGUAL PRODUCT CATALOG WITH INSTANT FILTER */}
      <section
        id="catalog"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-24"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#0F3D2E]">
              সাধ্যের বাজার • Complete All-In-One Storefront
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-stone-900 mt-1">
              Explore All Fresh & Organic Products ({activeProducts.length})
            </h2>
          </div>
          <Link
            href="/shop"
            className="text-sm font-bold text-[#0F3D2E] hover:text-[#C83E2B] inline-flex items-center gap-1.5 transition"
          >
            <span>View Full Filterable Store</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === "all"
                ? "bg-[#0F3D2E] text-white shadow-md"
                : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
            }`}
          >
            All Products ({activeProducts.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
                selectedCategory === cat.slug
                  ? "bg-[#0F3D2E] text-white shadow-md"
                  : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
              }`}
            >
              <span>{cat.name}</span>
              <span className="text-[11px] opacity-80">({cat.nameBn})</span>
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 3.5 INTERACTIVE FAMILY COMBO BOX BUILDER (v2.0 High-AOV Upgrade) */}
      <div id="combo-builder" className="scroll-mt-24">
        <FamilyComboBuilder />
      </div>

      {/* 4. FARM-TO-DOORSTEP AUTHENTICITY STORY (Retention Hook #4) */}
      <section className="bg-[#0F3D2E] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="px-3.5 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider">
              Why 10,000+ Families Trust Sadhyer Bazar
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold">
              From Jamuna River & Village Homesteads Straight to Your Kitchen
            </h2>
            <p className="text-sm text-emerald-100/80">
              No middleman, no cold-storage fish, and zero chemical
              preservatives. Here is how your order travels from source to
              table:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "1-Click Order or Pre-Order",
                titleBn: "১ ক্লিকে অর্ডার বুকিং",
                desc: "Select your weight (500g / 1kg) and place your order with just your Name, Phone & Address—no password needed.",
                icon: Sparkles,
              },
              {
                step: "02",
                title: "Dawn Harvest at Source",
                titleBn: "ভোরবেলা নদী ও খামার থেকে সংগ্রহ",
                desc: "Our team collects fresh wild catch at Sirajganj Jamuna ghats, Bogura Shahi Doi from master artisans, and village Deshi poultry.",
                icon: Fish,
              },
              {
                step: "03",
                title: "Custom Cut & Thermal Pack",
                titleBn: "পছন্দমতো কাট ও আইসবক্স প্যাকিং",
                desc: "Fish and meat are hygienically cleaned and cut to your preference, then sealed in food-grade insulated ice boxes.",
                icon: Award,
              },
              {
                step: "04",
                title: "Nationwide Home Delivery",
                titleBn: "সারাদেশে দ্রুত হোম ডেলিভারি",
                desc: "Track your package live with your unique Order ID. Pay online via bKash / SSLCommerz or Cash on Delivery.",
                icon: Truck,
              },
            ].map((item) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={item.step}
                  className="bg-emerald-950/60 border border-emerald-800/80 rounded-3xl p-6 space-y-3 relative"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <span className="text-3xl font-black text-emerald-700/60">
                      {item.step}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-amber-300">
                    {item.titleBn}
                  </p>
                  <h3 className="text-lg font-extrabold text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs text-emerald-100/80 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. INSTANT ORDER TRACKING & CUSTOMER REVIEWS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Quick Order Tracker Card */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-stone-200/90 p-7 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#0F3D2E]">
              <PackageSearch className="w-4 h-4" /> Real-Time Order Tracker
            </span>
            <h3 className="text-2xl font-extrabold text-stone-900">
              Already Ordered? Track Your Delivery Status
            </h3>
            <p className="text-xs sm:text-sm text-stone-600">
              Enter your unique Order ID (e.g.,{" "}
              <code className="px-1.5 py-0.5 rounded bg-stone-100 font-mono text-stone-800 font-bold">
                SB-2610-8K4M2
              </code>
              ) to see live packing and dispatch updates.
            </p>
          </div>

          <form onSubmit={handleQuickTrack} className="space-y-3">
            <input
              type="text"
              value={quickTrackCode}
              onChange={(e) => setQuickTrackCode(e.target.value)}
              placeholder="Enter Order ID (e.g. SB-2610-8K4M2)"
              className="w-full px-4 py-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-mono uppercase focus:outline-none focus:border-[#0F3D2E]"
            />
            <button
              type="submit"
              className="w-full py-3.5 px-5 rounded-2xl bg-[#0F3D2E] hover:bg-[#165b44] text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>Track Order Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <span>Try Demo Order ID:</span>
            <button
              type="button"
              onClick={() =>
                router.push("/track-order?code=SB-2610-8K4M2")
              }
              className="font-mono font-bold text-[#C83E2B] hover:underline cursor-pointer"
            >
              SB-2610-8K4M2 →
            </button>
          </div>
        </div>

        {/* Customer Testimonials */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-stone-200/90 p-7 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#C83E2B]">
                Verified Buyer Reviews
              </span>
              <h3 className="text-2xl font-extrabold text-stone-900">
                Loved by Families Across Bangladesh
              </h3>
            </div>
            <div className="hidden sm:flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-bold text-amber-800">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              4.95 / 5 Average Rating
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200/70 space-y-2.5">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-current" />
                ))}
              </div>
              <p className="text-xs text-stone-700 leading-relaxed">
                &ldquo;Ordered the Jamuna River Mixed Small Fish and 1kg Gawa
                Ghee. The fish arrived in Dhaka still ice-cold and tasted just
                like childhood river fish in Sirajganj! Truly 100% authentic.&rdquo;
              </p>
              <div className="flex items-center justify-between pt-1 text-[11px]">
                <strong className="text-stone-900">Dr. Nafisa Islam</strong>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Dhanmondi, Dhaka
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200/70 space-y-2.5">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-current" />
                ))}
              </div>
              <p className="text-xs text-stone-700 leading-relaxed">
                &ldquo;Their Bogura Shahi Doi and Full-Fiber Red Rice are now
                staples in our house. Super clean website—I placed my pre-order
                in 20 seconds and paid advance via bKash effortlessly.&rdquo;
              </p>
              <div className="flex items-center justify-between pt-1 text-[11px]">
                <strong className="text-stone-900">Engr. Rashedul Karim</strong>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Uttara, Dhaka
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <PhoneCall className="w-5 h-5 text-[#0F3D2E]" />
              <span className="text-xs sm:text-sm font-bold text-stone-800">
                Need bulk pre-order for a family event? Call us directly:
              </span>
            </div>
            <a
              href={`tel:${settings.supportPhone.split("-")[0]}`}
              className="px-4 py-2 rounded-xl bg-[#0F3D2E] text-white text-xs font-extrabold"
            >
              {settings.supportPhone}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
