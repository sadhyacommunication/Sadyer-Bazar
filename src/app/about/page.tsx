"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Truck,
  Leaf,
  Heart,
  Scale,
  Award,
  Sparkles,
  CheckCircle2,
  Fish,
  Users,
  Compass,
  MapPin,
  ArrowRight,
  PhoneCall,
  MessageSquare,
  Clock,
  Building2,
  FileText,
  BadgeCheck,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";

const SOURCING_HUBS = [
  {
    title: "যমুনা নদী অববাহিকা (সিরাজগঞ্জ ও কাজীপুর)",
    titleEn: "Jamuna River Basin, Sirajganj",
    badge: "নদীর তাজা মাছ হাব",
    image: "/images/products/jamuna-chital-rui.jpg",
    desc: "যমুনা নদীর খরস্রোতা জল থেকে ভোরবেলায় স্থানীয় জেলেদের জালে ধরা পড়া বুনো আইড়, বোয়াল, রুই, কাতল, বাতাসি ও দেশি ছোট মাছ। ধরা পড়ার সাথে সাথে খাদ্য-নিরাপদ বরফে সংরক্ষণ করে ঢাকায় দ্রুত কোল্ড-চেইনে পাঠানো হয়।",
    highlights: ["১০০% ফরমালিনমুক্ত", "ভোরের তাজা শিকার", "কোল্ড-চেইন আইস-বক্স"],
  },
  {
    title: "ঐতিহ্যবাহী বগুড়া হাব (শেরপুর ও বনানী)",
    titleEn: "Heritage Bogura Dairy & Sweet Hub",
    badge: "খাঁটি গাওয়া ঘি ও দই",
    image: "/images/banners/ghee-bogura-doi-banner.jpg",
    desc: "বগুড়ার শতবর্ষী ঐতিহ্যের কারিগরদের দিয়ে তৈরি আসল মাটির সরায় জমানো শাহী দই ও ক্ষীরসা। দেশি গরুর খাঁটি দুধের সর সনাতন কাঠের আগুনে জ্বাল দিয়ে তৈরি ১০০% সুগন্ধি দানাদার গাওয়া ঘি।",
    highlights: ["সনাতন সরের ঘি", "মাটির সরার টাটকা দই", "কোনো রাসায়নিক প্রিজারভেটিভ নেই"],
  },
  {
    title: "চলনবিল ও নাটোর-পাবনা অববাহিকা",
    titleEn: "Chalan Beel & Wetland Grazing Farms",
    badge: "দেশি মাংস ও ডিম",
    image: "/images/banners/village-chicken-banner.jpg",
    desc: "চলনবিলের উন্মুক্ত জলাশয়ে শামুক ও প্রাকৃতিক পোকামাকড় খেয়ে বড় হওয়া দেশি রাজহাঁস ও দেশি মুরগি। কোনো ব্রয়লার ফিড বা অ্যান্টিবায়োটিক মুক্ত সম্পূর্ণ প্রাকৃতিকভাবে পালিত।",
    highlights: ["মুক্ত বিচরণশীল হাঁস-মুরগি", "অ্যান্টিবায়োটিক মুক্ত", "পুষ্টিকর দেশি ডিম"],
  },
  {
    title: "উত্তরবঙ্গের আদি শস্যভাণ্ডার ও সুন্দরবন",
    titleEn: "Northern Heritage Grains & Pure Honey",
    badge: "সুগন্ধি চাল ও খাঁটি মধু",
    image: "/images/banners/heritage-rice-banner.jpg",
    desc: "দিনাজপুরের ঐতিহ্যবাহী সুগন্ধি কাটারিভোগ, সুবাসিত চিনিগুঁড়া পোলাও চাল এবং সরাসরি সুন্দরবনের মৌয়ালদের চাক থেকে সংগৃহীত কাঁচা প্রাকৃতিক মধু। কোনো পলিশ বা কেমিক্যাল ছাড়াই প্যাকিং।",
    highlights: ["আনপলিশড সুগন্ধি চাল", "চাকের অপরিশোধিত মধু", "প্রাকৃতিক পুষ্টি অক্ষুণ্ণ"],
  },
];

const CORE_PILLARS = [
  {
    icon: ShieldCheck,
    title: "জিরো কেমিক্যাল ও নো ফরমালিন",
    desc: "আমাদের প্রতিটি মাছ ও খাদ্যপণ্য শতভাগ কেমিক্যালমুক্ত। ফরমালিন বা কৃত্রিম প্রিজারভেটিভের বিরুদ্ধে আমাদের নীতি শতভাগ অনমনীয়।",
  },
  {
    icon: Scale,
    title: "ডিজিটাল স্কেলের ১০০% স্বচ্ছ ওজন",
    desc: "মাছ বা মুরগি কাটার আগে ও পরে ডিজিটাল স্কেলে মেপে গ্রাহককে নিখুঁত হিসাব দেওয়া হয়। কোনো অস্পষ্টতা বা বাড়তি ওজনের চার্জ নেই।",
  },
  {
    icon: Truck,
    title: "বিশেষায়িত ইনসুলেটেড কোল্ড-চেইন",
    desc: "খাদ্য-নিরাপদ ফুডগ্রেড বরফ ও প্রিমিয়াম থার্মোকল আইস-বক্স প্যাকেজিংয়ে নিজস্ব ডেলিভারি নেটওয়ার্কে আপনার রান্নাঘরে পৌঁছানো হয়।",
  },
  {
    icon: Users,
    title: "মধ্যস্বত্বভোগীহীন সরাসরি সোর্সিং",
    desc: "কোনো পাইকারি আড়ত বা দালালের হাত না ঘুরে সরাসরি কৃষক ও জেলের হাত থেকে পণ্য আসায় সেরা মান বজায় থাকে এবং দাম থাকে সাশ্রয়ী।",
  },
  {
    icon: Award,
    title: "১০০% মান নিশ্চয়তা বা তাৎক্ষণিক রিফান্ড",
    desc: "পণ্য হাতে পাওয়ার পর তাজাভাব বা মানে বিন্দুমাত্র অসন্তুষ্টি থাকলে আমরা তাৎক্ষণিক পণ্য পরিবর্তন অথবা সম্পূর্ণ মূল্য ফেরত প্রদান করি।",
  },
  {
    icon: Heart,
    title: "প্রান্তিক জেলে ও খামারিদের ক্ষমতায়ন",
    desc: "আমাদের প্রতিটি ক্রয়ের একটি ন্যায্য অংশ সরাসরি পায় প্রান্তিক উৎপাদকেরা, যা তাদের পরিবারের সচ্ছলতা ও সন্তানদের ভবিষ্যৎ গড়তে সাহায্য করে।",
  },
];

const TIMELINE_STEPS = [
  {
    step: "০১",
    time: "ভোর ৪:০০ - ৭:০০ টা",
    title: "নদী ও খামার থেকে শিকার ও বাছাই",
    desc: "যমুনার বুক থেকে জেলেরা মাছ ধরে তীরে ভিড়লেই আমাদের টিম উপস্থিত থেকে সেরা ও সতেজ মাছগুলো বাছাই করে আইস-বক্সে প্রিজার্ভ করে।",
  },
  {
    step: "০২",
    time: "সকাল ৮:০০ - ১১:০০ টা",
    title: "পরিচ্ছন্ন কাটিং ও ডিজিটাল ওজন স্লিপ",
    desc: "গ্রাহকের ব্যক্তিগত চাহিদা অনুযায়ী (আঁশ ফেলে গোটা, চাকা বা ঝোল পিস) নিখুঁতভাবে কেটে ডিজিটাল স্কেলে মেপে কোল্ড-চেইন বক্সে সিল করা হয়।",
  },
  {
    step: "০৩",
    time: "বিকেল ও পরের দিন সকালে",
    title: "দ্রুততম ডোরস্টেপ ইনসুলেটেড ডেলিভারি",
    desc: "ঢাকা শহরে নিজস্ব ঠান্ডা গাড়ির নেটওয়ার্কে এবং সারাদেশে বিশ্বস্ত কোল্ড কুরিয়ারে নির্ধারিত সময়ে সরাসরি আপনার ঠিকানায় হস্তান্তর।",
  },
];

export default function AboutPage() {
  const { settings } = useStore();

  const cleanPhone = settings.supportPhone.replace(/[^0-9]/g, "");
  const cleanWhatsapp = settings.whatsappNumber.replace(/[^0-9]/g, "");

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A1A1A] pb-20">
      {/* Hero Section */}
      <div className="bg-[#0F3D2E] text-white py-16 sm:py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
        
        <div className="max-w-6xl mx-auto relative z-10">
          <nav className="text-xs text-white/70 mb-4 flex items-center space-x-2">
            <Link href="/" className="hover:text-white transition">
              হোম
            </Link>
            <span>/</span>
            <span className="text-white font-medium">আমাদের সম্পর্কে</span>
          </nav>

          <div className="inline-flex items-center space-x-2 bg-white/10 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-200 mb-4 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>নদী ও প্রান্তিক খামারের খাঁটি আস্থার প্রতীক</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold font-serif tracking-tight leading-tight max-w-4xl">
            ভেজালমুক্ত খাঁটি খাবারের স্বাদ ফিরিয়ে আনার এক আন্তরিক যাত্রা
          </h1>

          <p className="text-base sm:text-lg text-white/85 max-w-3xl mt-4 leading-relaxed font-light">
            সাধ্যের বাজার কেবল কোনো সাধারণ ই-কমার্স শপ নয়; এটি শহরবাসীর সুস্বাস্থ্য আর
            গ্রামবাংলার প্রান্তিক জেলে ও খামারিদের ন্যায্য পারিশ্রমিকের মাঝে গড়ে তোলা
            এক বিশ্বস্ত ও স্বচ্ছ সেতুবন্ধন।
          </p>

          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 pt-8 border-t border-white/15">
            <div>
              <span className="block text-2xl sm:text-3xl font-extrabold text-amber-400 font-serif">
                ৩,২০০+
              </span>
              <span className="text-xs sm:text-sm text-white/80 font-medium">
                সন্তুষ্ট গ্রাহক পরিবার
              </span>
            </div>
            <div>
              <span className="block text-2xl sm:text-3xl font-extrabold text-amber-400 font-serif">
                ৬০+
              </span>
              <span className="text-xs sm:text-sm text-white/80 font-medium">
                নিবন্ধিত প্রান্তিক জেলে ও খামারি
              </span>
            </div>
            <div>
              <span className="block text-2xl sm:text-3xl font-extrabold text-amber-400 font-serif">
                ১০০%
              </span>
              <span className="text-xs sm:text-sm text-white/80 font-medium">
                ফরমালিন ও রাসায়নিকমুক্ত
              </span>
            </div>
            <div>
              <span className="block text-2xl sm:text-3xl font-extrabold text-amber-400 font-serif">
                ২৪-৩৬
              </span>
              <span className="text-xs sm:text-sm text-white/80 font-medium">
                ঘণ্টায় কোল্ড-চেইন ডেলিভারি
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-12 space-y-16 sm:space-y-24">
        {/* Origin Story: How Sadyer Bazar was born */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
              আমাদের শুরুর গল্প
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold font-serif text-stone-900 leading-snug">
              কেন গড়ে উঠল সাধ্যের বাজার?
            </h2>
            <p className="text-stone-700 text-sm sm:text-base leading-relaxed">
              আজকের ব্যস্ত শহরের বাজারে তাজা মাছের নামে বরফে ভেজানো ফরমালিনযুক্ত মাছ,
              ঘিয়ের নামে ডালডা ও কেমিক্যাল ফ্লেভার, আর ক্ষতিকর প্রিজারভেটিভ দেওয়া খাবার
              দেখে আমরা প্রতিনিয়ত উদ্বিগ্ন হতাম। নিজের পরিবারের বাচ্চাদের মুখে এই বিষাক্ত খাবার
              তুলে দেওয়া কতটা কষ্টদায়ক, তা আমরা অনুভব করেছি।
            </p>
            <p className="text-stone-700 text-sm sm:text-base leading-relaxed">
              অন্যদিকে, যমুনা নদীর কোল ঘেঁষা সিরাজগঞ্জের জেলে কিংবা বগুড়ার দুগ্ধ খামারিরা দিন-রাত
              কঠোর পরিশ্রম করেও মধ্যস্বত্বভোগী সিন্ডিকেটের কারণে তাদের পণ্যের ন্যায্য মূল্য পান না।
              এই দুটি সংকটের টেকসই সমাধান করতেই <strong>সাধ্যের বাজার</strong>-এর জন্ম।
            </p>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-stone-800 text-xs sm:text-sm leading-relaxed italic">
              &quot;আমাদের মূল পণ—মধ্যস্বত্বভোগীদের কৃত্রিম চক্র ভেঙে সরাসরি নদী ও খামার থেকে
              খাঁটি খাবার এনে দেব প্রতিটি পরিবারের খাবার টেবিলে; দাম থাকবে সাধারণ মানুষের সাধ্যের মধ্যে।&quot;
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="relative h-80 sm:h-96 w-full rounded-3xl overflow-hidden shadow-lg border border-stone-200">
              <Image
                src="/images/banners/jamuna-fisherman-banner.jpg"
                alt="যমুনার জেলেরা মাছ শিকার করছেন"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wide mb-2">
                  সরাসরি নদী থেকে সংগ্রহ
                </span>
                <p className="text-sm sm:text-base font-serif font-bold">
                  যমুনার ভোরবেলার শিকার — খাঁটি দেশি মাছ কোনো কেমিক্যাল স্পর্শ ছাড়াই।
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mission, Vision & Core Philosophy */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200/90">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E]">
              আমাদের দৃষ্টিভঙ্গি
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif text-stone-900 mt-1">
              মিশন, ভিশন ও মূল অঙ্গীকার
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              যে আদর্শ ও লক্ষ্যের ওপর ভিত্তি করে সাধ্যের বাজারের পথচলা
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-[#0F3D2E] flex items-center justify-center mb-4">
                  <Compass className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#0F3D2E] mb-2 font-serif">
                  আমাদের মিশন (Mission)
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  বিশুদ্ধ প্রাকৃতিক খাবারকে কোনো বিলাসী সামগ্রী নয়, বরং সাধারণ পরিবারের সাধ্যের
                  মধ্যে নিয়ে আসা। মধ্যস্বত্বভোগী দূর করে কৃষক ও ভোক্তার মাঝে সরাসরি স্বচ্ছ সংযোগ স্থাপন।
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-100 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
                  <Leaf className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-amber-900 mb-2 font-serif">
                  আমাদের ভিশন (Vision)
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  বাংলাদেশের প্রতিটি রান্নাঘরে ভেজালহীন সুস্বাদু খাবারের নিশ্চয়তা প্রদান করা এবং
                  গ্রামীণ ঐতিহ্যবাহী খাদ্যপণ্যকে আধুনিক স্বাস্থ্যসম্মত কোল্ড-চেইনে পৌঁছে দেওয়া।
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-rose-50/60 border border-rose-100 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-rose-100 text-[#C83E2B] flex items-center justify-center mb-4">
                  <Heart className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#C83E2B] mb-2 font-serif">
                  মূল অঙ্গীকার (Values)
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  শতভাগ সততা, ওজনে ডিজিটাল স্বচ্ছতা, শূন্য ফরমালিন ছাড় এবং প্রান্তিক জেলে ও
                  চাষীদের ন্যায্য সম্মানজনক মূল্য প্রদান—ইহাই সাধ্যের বাজারের মূল ভিত্তি।
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Direct Sourcing Hubs Section */}
        <div>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
              আমাদের উৎপত্তিস্থল
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold font-serif text-stone-900 mt-1">
              আমাদের ৪টি নিজস্ব সোর্সিং হাব
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1.5">
              কোনো অজানা আড়ত নয়; আমাদের প্রতিটি খাদ্যপণ্যের আছে নিজস্ব মাটি ও জলের ঠিকানা
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {SOURCING_HUBS.map((hub, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl overflow-hidden border border-stone-200/90 shadow-sm hover:shadow-md transition flex flex-col"
              >
                <div className="relative h-56 w-full">
                  <Image
                    src={hub.image}
                    alt={hub.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-xs text-white px-3 py-1 rounded-full text-xs font-bold">
                    {hub.badge}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold font-serif text-stone-900">
                      {hub.title}
                    </h3>
                    <span className="text-xs text-stone-400 font-sans block mb-2">
                      {hub.titleEn}
                    </span>
                    <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                      {hub.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex flex-wrap gap-2">
                    {hub.highlights.map((h, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{h}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The 5 Quality Pillars */}
        <div className="bg-gradient-to-br from-emerald-950 via-[#0F3D2E] to-emerald-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                কেন আমরা ভিন্ন
              </span>
              <h2 className="text-2xl sm:text-4xl font-bold font-serif mt-1">
                সাধ্যের বাজারের মান নিয়ন্ত্রণের ৬টি স্তম্ভ
              </h2>
              <p className="text-xs sm:text-sm text-white/80 mt-1">
                প্রতিটি অর্ডারে আপনার স্বাস্থ্য ও অধিকার রক্ষায় আমাদের আপসহীন মানদণ্ড
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {CORE_PILLARS.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <div
                    key={idx}
                    className="bg-white/10 backdrop-blur-xs p-6 rounded-2xl border border-white/15 hover:bg-white/15 transition"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white/15 text-amber-300 flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-white text-base mb-1.5 font-serif">
                      {p.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-light">
                      {p.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3-Step Cold-Chain Journey */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200/90">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E]">
              প্রক্রিয়াকরণ ও সরবরাহ
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif text-stone-900 mt-1">
              কীভাবে তাজা খাবার পৌঁছায় আপনার টেবিলে?
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              নদী থেকে রান্নাঘর — আমাদের সুশৃঙ্খল ৩ ধাপের কোল্ড-চেইন যাত্রা
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {TIMELINE_STEPS.map((step, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-stone-50 border border-stone-200/80 relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black text-[#0F3D2E] font-serif">
                      {step.step}
                    </span>
                    <span className="text-xs font-bold text-[#C83E2B] bg-red-50 px-2.5 py-1 rounded-full">
                      {step.time}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-stone-900 mb-2 font-serif">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Corporate Transparency & Legal Governance (Bank & SSLCommerz Ready) */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-stone-200/90">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#0F3D2E] uppercase tracking-wider mb-2">
            <Building2 className="w-4 h-4" />
            <span>প্রাতিষ্ঠানিক স্বচ্ছতা ও পরিচয়</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900 mb-4">
            ব্যবসায়িক বৈধতা ও প্রাতিষ্ঠানিক তথ্য
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 max-w-3xl leading-relaxed mb-6">
            সাধ্যের বাজার বাংলাদেশ সরকারের আইন অনুযায়ী পরিচালিত একটি নিবন্ধিত ই-কমার্স ও
            খাদ্য সরবরাহ প্রতিষ্ঠান। গ্রাহকদের নিরাপত্তা ও আস্থার স্বার্থে আমাদের সকল
            কার্যক্রম ডিজিটাল রসিদ ও ব্যাংকিং চ্যানেলে পরিচালিত হয়।
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
              <span className="text-stone-400 uppercase font-bold block text-[10px]">
                রেজিস্টার্ড ট্রেড নাম
              </span>
              <strong className="text-stone-900 text-sm block mt-0.5">
                সাধ্যের বাজার (Sadyer Bazar)
              </strong>
              <span className="text-stone-500 block text-[11px] mt-1">
                E-Commerce & Organic Agro Sourcing
              </span>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
              <span className="text-stone-400 uppercase font-bold block text-[10px]">
                সেন্ট্রাল ডিসপ্যাচ ও প্রধান অফিস
              </span>
              <strong className="text-stone-900 text-sm block mt-0.5">
                তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৮
              </strong>
              <span className="text-stone-500 block text-[11px] mt-1">
                কোল্ড স্টোরেজ ও প্যাকেজিং হাব
              </span>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
              <span className="text-stone-400 uppercase font-bold block text-[10px]">
                নদী ও খামার কালেকশন পয়েন্ট
              </span>
              <strong className="text-stone-900 text-sm block mt-0.5">
                কাজীপুর ঘাট (সিরাজগঞ্জ) ও শেরপুর (বগুড়া)
              </strong>
              <span className="text-stone-500 block text-[11px] mt-1">
                সরাসরি নদী ও দুগ্ধ খামার হাব
              </span>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
              <span className="text-stone-400 uppercase font-bold block text-[10px]">
                কাস্টমার হটলাইন
              </span>
              <a
                href={`tel:${cleanPhone}`}
                className="text-[#0F3D2E] text-sm font-bold block mt-0.5 hover:underline"
              >
                {settings.supportPhone}
              </a>
              <span className="text-stone-500 block text-[11px] mt-1">
                সকাল ৮:০০টা - রাত ১০:০০টা
              </span>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
              <span className="text-stone-400 uppercase font-bold block text-[10px]">
                অফিসিয়াল ইমেইল
              </span>
              <a
                href="mailto:support@sadhya.com.bd"
                className="text-[#0F3D2E] text-sm font-bold block mt-0.5 hover:underline"
              >
                support@sadhya.com.bd
              </a>
              <span className="text-stone-500 block text-[11px] mt-1">
                কর্পোরেট ও সাধারণ জিজ্ঞাসা
              </span>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
              <span className="text-stone-400 uppercase font-bold block text-[10px]">
                অনুমোদিত পেমেন্ট পার্টনার
              </span>
              <strong className="text-stone-900 text-sm block mt-0.5">
                bKash, SSLCommerz ও ক্যাশ অন ডেলিভারি
              </strong>
              <span className="text-stone-500 block text-[11px] mt-1">
                ২৫৬-বিট সুরক্ষিত এনক্রিপ্টেড পেমেন্ট
              </span>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-[#0F3D2E] text-white rounded-3xl p-8 sm:p-12 text-center shadow-lg relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4 relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              সুস্বাস্থ্যের সঙ্গী হোন
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold font-serif leading-tight">
              আপনার পরিবারের খাবার টেবিলে ফিরুক নদী ও মাটির আসল স্বাদ
            </h2>
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-light">
              আজই পরখ করে দেখুন সাধ্যের বাজারের তাজা দেশি মাছ কিংবা খাঁটি গাওয়া ঘি।
              আপনার সন্তুষ্টিই আমাদের সর্বোচ্চ প্রেরণা।
            </p>
            <div className="pt-4 flex flex-wrap justify-center gap-3">
              <Link
                href="/shop"
                className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-xl text-sm transition shadow-sm flex items-center space-x-2"
              >
                <span>সব পণ্য দেখুন</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pre-orders"
                className="px-6 py-3 bg-[#C83E2B] hover:bg-red-700 text-white font-bold rounded-xl text-sm transition shadow-sm flex items-center space-x-2"
              >
                <Fish className="w-4 h-4" />
                <span>লাইভ প্রি-অর্ডার মাছ</span>
              </Link>
              <Link
                href="/contact"
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-sm transition"
              >
                যোগাযোগ করুন
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
