"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  Scale,
  CreditCard,
  Truck,
  RotateCcw,
  AlertTriangle,
  Lock,
  Building2,
  PhoneCall,
  Printer,
  ChevronRight,
  Fish,
  CheckCircle2,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";

export default function TermsAndConditionsPage() {
  const { settings } = useStore();

  const cleanPhone = settings.supportPhone.replace(/[^0-9]/g, "");

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A1A1A] pb-20">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-[#0F3D2E] text-white py-14 sm:py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="max-w-5xl mx-auto relative z-10">
          <nav className="text-xs text-white/70 mb-3 flex items-center space-x-2">
            <Link href="/" className="hover:text-white transition">
              হোম
            </Link>
            <span>/</span>
            <span className="text-white font-medium">শর্তাবলী ও নীতিমালা</span>
          </nav>

          <div className="inline-flex items-center space-x-2 bg-white/10 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-200 mb-3 backdrop-blur-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>বাংলাদেশ ই-কমার্স পরিচালনা নির্দেশিকা ও SSLCommerz স্ট্যান্ডার্ড</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-serif tracking-tight leading-tight">
            সাধ্যের বাজার শর্তাবলী ও নীতিমালা (Terms & Conditions)
          </h1>

          <p className="text-sm sm:text-base text-white/80 max-w-2xl mt-2 leading-relaxed font-light">
            সাধ্যের বাজার প্ল্যাটফর্ম ব্যবহারের নিয়মাবলি, পণ্যের অর্ডার, ডিজিটাল ওজন স্লিপ,
            কোল্ড-চেইন ডেলিভারি এবং রিফান্ড পলিসি সম্পর্কিত আইনি শর্তসমূহ।
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-white/70 mt-6 pt-4 border-t border-white/15">
            <span>সর্বশেষ হালনাগাদ: অক্টোবর ২০২৬</span>
            <span>•</span>
            <span>সংস্করণ: ২.০ (অনুমোদিত)</span>
            <span>•</span>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center space-x-1.5 text-amber-300 hover:text-amber-200 font-semibold cursor-pointer transition no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>প্রিন্ট বা সেভ করুন</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-4 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Table of Contents (Sticky on Desktop) */}
          <div className="hidden lg:block lg:col-span-4 sticky top-24 no-print">
            <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#0F3D2E] mb-3 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span>সূচিপত্র (Table of Contents)</span>
              </h3>
              <nav className="space-y-1 text-xs">
                {[
                  { id: "intro", title: "১. সাধারণ পরিচিতি ও সম্মতি" },
                  { id: "products", title: "২. পণ্যের প্রকৃতি ও নদীর শিকার" },
                  { id: "scale", title: "৩. ডিজিটাল ওজন ও বিল সমন্বয়" },
                  { id: "pricing", title: "৪. মূল্য ও পেমেন্ট শর্তাবলী" },
                  { id: "delivery", title: "৫. অর্ডার ও কোল্ড-চেইন ডেলিভারি" },
                  { id: "cancellation", title: "৬. বাতিলকরণ, রিটার্ন ও রিফান্ড" },
                  { id: "ip", title: "৭. মেধা সম্পদ ও সাইট ব্যবহার" },
                  { id: "liability", title: "৮. দায়বদ্ধতার সীমাবদ্ধতা" },
                  { id: "law", title: "৯. প্রযোজ্য আইন ও বিরোধ নিষ্পত্তি" },
                  { id: "contact", title: "১০. প্রাতিষ্ঠানিক তথ্য ও যোগাযোগ" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-stone-600 hover:text-[#0F3D2E] hover:bg-emerald-50 transition cursor-pointer flex items-center justify-between group"
                  >
                    <span className="truncate">{item.title}</span>
                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </nav>

              <div className="pt-4 border-t border-stone-100 text-[11px] text-stone-500 space-y-1">
                <p>সাহায্য ও কাস্টমার কেয়ার:</p>
                <a
                  href={`tel:${cleanPhone}`}
                  className="font-bold text-[#0F3D2E] hover:underline block"
                >
                  {settings.supportPhone}
                </a>
              </div>
            </div>
          </div>

          {/* Right Detailed Clauses */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-xs space-y-10 leading-relaxed text-stone-800 text-sm">
            {/* Clause 1 */}
            <section id="intro" className="scroll-mt-24 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ১ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ১. সাধারণ পরিচিতি ও শর্তাবলীর গ্রহণযোগ্যতা (Introduction & Acceptance)
              </h2>
              <p className="text-stone-700">
                সাধ্যের বাজার (<strong>Sadyer Bazar</strong>) বাংলাদেশের একটি নিবন্ধিত অনলাইন কৃষিপণ্য ও
                তাজা খাদ্য বিপণন প্ল্যাটফর্ম। এই ওয়েবসাইট (
                <Link
                  href="/"
                  className="text-[#0F3D2E] font-medium underline"
                >
                  https://sadyer-bazar.sadhyacommunication.workers.dev
                </Link>
                ), আমাদের ফোন হটলাইন বা হোয়াটসঅ্যাপ চ্যাটের মাধ্যমে অর্ডার করার সাথে সাথেই আপনি
                এই শর্তাবলীর সমস্ত ধারার প্রতি আপনার পূর্ণ সম্মতি জ্ঞাপন করছেন।
              </p>
              <p className="text-stone-700">
                এই শর্তাবলী গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের বাণিজ্য মন্ত্রণালয় কর্তৃক প্রণীত
                &quot;ডিজিটাল কমার্স পরিচালনা নির্দেশিকা ২০২১&quot;, ভোক্তা অধিকার সংরক্ষণ আইন ২০০৯ এবং
                তথ্য ও যোগাযোগ প্রযুক্তি আইনের সকল সংশ্লিষ্ট ধারা অনুসারে প্রণীত।
              </p>
            </section>

            {/* Clause 2 */}
            <section id="products" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ২য় অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ২. পণ্যের প্রকৃতি, নদীর বুনো শিকার ও মান (Product Nature & Fresh River Catch)
              </h2>
              <p className="text-stone-700">
                সাধ্যের বাজারে বিক্রিত বেশিরভাগ পণ্যই পচনশীল ও প্রাকৃতিক খাদ্য (যেমন: যমুনা নদীর দেশি মাছ,
                বগুড়ার তাজা দই ও সরের ঘি, চলনবিলের হাঁস ও ডিম)।
              </p>
              <div className="space-y-2 pl-2">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs">
                  <strong className="text-stone-900 block mb-1">
                    ক. শতভাগ কেমিক্যাল ও ফরমালিন মুক্ত গ্যারান্টি:
                  </strong>
                  <p className="text-stone-600">
                    আমাদের সকল মাছ ও পণ্য কৃত্রিম ফরমালিন বা রাসায়নিক প্রিজারভেটিভমুক্ত। পণ্য সরাসরি নদী ও
                    খামার থেকে ফুডগ্রেড বরফে সংরক্ষিত করে দ্রুততম সময়ে পাঠানো হয়।
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs">
                  <strong className="text-stone-900 block mb-1">
                    খ. প্রাকৃতিক শিকারের পরিবর্তনশীলতা (Wild River Availability):
                  </strong>
                  <p className="text-stone-600">
                    নদীর মাছ কৃত্রিম চাষের নয়, বরং উন্মুক্ত নদীর প্রাকৃতিক শিকার। নদীর জোয়ার, আবহাওয়া বা
                    ভোরের শিকারে কোনো নির্দিষ্ট প্রজাতির মাছের অপ্রতুলতা দেখা দিলে সাধ্যের বাজার তাৎক্ষণিকভাবে
                    গ্রাহককে ফোনে অবহিত করে বিকল্প মাছের প্রস্তাব দেবে অথবা অগ্রিম পরিশোধিত টাকা রিফান্ড করবে।
                  </p>
                </div>
              </div>
            </section>

            {/* Clause 3 */}
            <section id="scale" className="scroll-mt-24 space-y-4 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E]">
                ৩য় অধ্যায় — স্বচ্ছতা ও সঠিক ওজন
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৩. ডিজিটাল স্কেল ও ওজনের সামান্য তারতম্য নীতি (Digital Scale Adjustment)
              </h2>

              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-stone-800 text-xs sm:text-sm space-y-2">
                <div className="flex items-center space-x-2 font-bold text-amber-900">
                  <Scale className="w-5 h-5 text-amber-700" />
                  <span>গোটা মাছ ও মুরগির প্রাকৃতিক ওজন নির্ধারণ নীতি</span>
                </div>
                <p className="leading-relaxed">
                  গোটা জীবন্ত নদী মাছ বা দেশি মুরগির ক্ষেত্রে প্রাকৃতিক কারণে বুকিং পরিমাণের চেয়ে
                  কিছু গ্রাম কম বা বেশি হতে পারে।
                </p>
                <p className="leading-relaxed font-semibold">
                  সাধ্যের বাজার ডিজিটাল স্কেলে মেপে কাটার আগের ও পরের সুনির্দিষ্ট ওজন স্লিপ প্রদান করে।
                  ওজন সামান্য কম বা বেশি হলে সেই অনুপাতে ডিজিটাল বিলে সমন্বয় (+ বা - টাকা) করা হয়।
                </p>
              </div>

              <ul className="list-disc list-inside text-xs sm:text-sm text-stone-600 space-y-1 pl-2">
                <li>যদি বুকিংয়ের চেয়ে মাছের ওজন বেশি হয়, তবে প্রতি কেজি নির্ধারিত দরে অতিরিক্ত অংশের সামান্য মূল্য যুক্ত হবে।</li>
                <li>যদি মাছের ওজন কম হয়, তবে ডিজিটাল ইনভয়েস থেকে তত টাকা স্বয়ংক্রিয়ভাবে মাইনাস হয়ে যাবে।</li>
                <li>গ্রাহকের চাহিদা অনুযায়ী পরিষ্কার করা ও কাটিংয়ের পর নাড়িভুঁড়ি অপসারণের কারণে ওজনে যে সাধারণ ঘাটতি হয়, তা বিশ্বজনীন প্রাকৃতিক নিয়ম।</li>
              </ul>
            </section>

            {/* Clause 4 */}
            <section id="pricing" className="scroll-mt-24 space-y-4 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E]">
                ৪র্থ অধ্যায় — পেমেন্ট ও লেনদেন
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৪. মূল্য নির্ধারণ, মুদ্রা ও পেমেন্ট শর্তাবলী (Pricing & Payment via SSLCommerz)
              </h2>
              <p className="text-stone-700 text-xs sm:text-sm">
                ওয়েবসাইটে প্রদর্শিত সকল পণ্যের মূল্য বাংলাদেশি টাকা (BDT ৳)-তে নির্ধারিত।
              </p>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs sm:text-sm space-y-2">
                <div className="flex items-center space-x-2 font-bold text-[#0F3D2E]">
                  <CreditCard className="w-5 h-5 text-emerald-700" />
                  <span>অনুমোদিত পেমেন্ট চ্যানেল ও কার্ড ডেটা সুরক্ষা</span>
                </div>
                <p className="leading-relaxed">
                  গ্রাহক ক্যাশ অন ডেলিভারি (COD), বিকাশ, নগদ কিংবা ভিসা/মাস্টারকার্ড ডেবিট/ক্রেডিট কার্ডের
                  মাধ্যমে মূল্য পরিশোধ করতে পারবেন। অনলাইন কার্ড ও মোবাইল ফিনান্সিয়াল পেমেন্ট সরাসরি
                  বাংলাদেশ ব্যাংক অনুমোদিত <strong>SSLCommerz</strong> ও <strong>bKash PGW</strong>-এর
                  মাধ্যমে আন্তর্জাতিক PCI-DSS লেভেল-১ স্ট্যান্ডার্ডে প্রসেস করা হয়।
                </p>
                <p className="leading-relaxed font-medium">
                  <strong>সাধ্যের বাজার কখনোই গ্রাহকের কার্ড নম্বর, CVV/CVC কোড কিংবা বিকাশ/নগদের গোপন পিন সংরক্ষণ করে না।</strong>
                </p>
              </div>

              <p className="text-stone-600 text-xs">
                প্রি-অর্ডার ব্যাচের বিশেষ নদী মাছের ক্ষেত্রে গ্রাহককে নির্দিষ্ট অংশ (যেমন: ২০%-৫০%)
                অগ্রিম পরিশোধ করতে হতে পারে। বাকি অংশ ডেলিভারির সময় ক্যাশ অন ডেলিভারিতে প্রদানযোগ্য।
              </p>
            </section>

            {/* Clause 5 */}
            <section id="delivery" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ৫ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৫. অর্ডার নিশ্চিতকরণ ও কোল্ড-চেইন ডেলিভারি (Confirmation & Delivery Policy)
              </h2>
              <ul className="space-y-2.5 text-xs sm:text-sm text-stone-700">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>ঢাকা মেট্রোপলিটন ডেলিভারি:</strong> অর্ডার কনফার্মেশনের ২৪ থেকে ৩৬ ঘণ্টার মধ্যে নির্দিষ্ট টাইম স্লটে নিজস্ব কোল্ড-চেইন রাইডারের মাধ্যমে সম্পন্ন হয়।</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>ঢাকার বাইরের জেলা ডেলিভারি:</strong> বিশেষায়িত থার্মোকল আইস-বক্স ও কোল্ড কুরিয়ারে ৪৮ থেকে ৭২ ঘণ্টার মধ্যে জেলা শহরে পাঠানো হয়।</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>ডেলিভারি ফি:</strong> ঢাকা সিটির ভেতরে ৳{settings.insideDhakaFee} এবং ঢাকার বাইরে ৳{settings.outsideDhakaFee} (ফ্রি ডেলিভারি থ্রেশহোল্ড অতিক্রম করলে ফ্রি)।</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>পণ্য গ্রহণের সময় যাচাই:</strong> ডেলিভারিম্যানের উপস্থিতিতে প্যাকেজিং ও পণ্যের অবস্থা প্রাথমিকভাবে যাচাই করে নেওয়ার অনুরোধ জানানো হচ্ছে।</span>
                </li>
              </ul>
            </section>

            {/* Clause 6 */}
            <section id="cancellation" className="scroll-mt-24 space-y-4 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ৬ষ্ঠ অধ্যায় — গ্রাহকের অধিকার
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৬. অর্ডার বাতিলকরণ, রিটার্ন ও রিফান্ড নীতিমালা (Cancellation, Return & Refund)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                  <strong className="text-stone-900 text-sm block">ক. অর্ডার বাতিল (Cancellation)</strong>
                  <p className="text-stone-600">
                    মাছ শিকার ও কাটিং শুরু হওয়ার পূর্বে গ্রাহক হটলাইনে ফোন দিয়ে অর্ডার বাতিল করতে পারবেন।
                    একবার নদী থেকে মাছ সংগ্রহ করে কেটে বরফে প্যাকিং সম্পন্ন হয়ে গেলে অর্ডার বাতিলযোগ্য নয়।
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                  <strong className="text-stone-900 text-sm block">খ. রিটার্ন বা অভিযোগ (Return)</strong>
                  <p className="text-stone-600">
                    পচনশীল খাদ্য হওয়ায় ডেলিভারি পাওয়ার ২ থেকে ৪ ঘণ্টার মধ্যে যেকোনো গুণগত অসঙ্গতি
                    বা নষ্ট হওয়ার প্রমাণসহ ছবি/ভিডিও আমাদের হোয়াটসঅ্যাপে পাঠাতে হবে।
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-950 space-y-1">
                <strong className="block text-[#0F3D2E]">গ. রিফান্ড নিষ্পত্তির সময়সীমা (Refund Settlement):</strong>
                <p className="leading-relaxed">
                  অভিযোগের সত্যতা নিশ্চিত হওয়ার পর গ্রাহক চাইলে পরবর্তী ব্যাচে সমমূল্যের বিকল্প পণ্য নিতে পারবেন,
                  কিংবা সম্পূর্ণ টাকা ৩ থেকে ৭ কর্মদিবসের মধ্যে গ্রাহকের মূল পেমেন্ট মাধ্যমে (বিকাশ/কার্ড/ব্যাংক একাউন্ট)
                  সরাসরি রিফান্ড করা হবে।
                </p>
              </div>
            </section>

            {/* Clause 7 */}
            <section id="ip" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ৭ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৭. মেধা সম্পদ ও সাইট ব্যবহার বিধি (Intellectual Property & Conduct)
              </h2>
              <p className="text-stone-700 text-xs sm:text-sm">
                সাধ্যের বাজার ওয়েবসাইটের সকল লোগো, কনটেন্ট, আলোকচিত্র, গ্রাফিক্স এবং ট্রেডমার্ক
                সাধ্যের বাজারের নিজস্ব বুদ্ধিবৃত্তিক সম্পদ। অনুমতি ব্যতীত কোনো ছবি বা লেখা বাণিজ্যিক
                উদ্দেশ্যে কপি বা নকল করা সম্পূর্ণ আইনত নিষিদ্ধ ও দণ্ডনীয় অপরাধ।
              </p>
            </section>

            {/* Clause 8 */}
            <section id="liability" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ৮ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৮. দায়বদ্ধতার সীমাবদ্ধতা ও দৈবদুর্বিপাক (Limitation of Liability & Force Majeure)
              </h2>
              <p className="text-stone-700 text-xs sm:text-sm">
                নদীতে আকস্মিক প্রাকৃতিক দুর্যোগ, কালবৈশাখী ঝড়, শৈত্যপ্রবাহ, রাজনৈতিক ধর্মঘট কিংবা
                জাতীয় পরিবহন ধর্মঘটের মতো অনাকাঙ্ক্ষিত পরিস্থিতিতে ডেলিভারি বিলম্বিত হলে সাধ্যের বাজার
                গ্রাহককে দ্রুত অবহিত করবে। এই ধরনের দৈবদুর্বিপাকের ক্ষেত্রে সাধ্যের বাজার কোনো প্রকার
                পরোক্ষ আর্থিক ক্ষতির জন্য দায়ী থাকবে না, তবে গ্রাহকের পণ্য পুনঃনির্ধারণ বা সম্পূর্ণ মূল্য
                ফেরত নিশ্চিতে সচেষ্ট থাকবে।
              </p>
            </section>

            {/* Clause 9 */}
            <section id="law" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E]">
                ৯ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৯. প্রযোজ্য আইন ও বিরোধ নিষ্পত্তি (Governing Law & Dispute Resolution)
              </h2>
              <p className="text-stone-700 text-xs sm:text-sm">
                এই শর্তাবলী গণপ্রজাতন্ত্রী বাংলাদেশের প্রচলিত আইন দ্বারা পরিচালিত এবং ব্যাখ্যায়িত হবে।
                যেকোনো বিরোধের ক্ষেত্রে উভয় পক্ষ প্রথমে পারস্পরিক আলোচনা ও সমঝোতার মাধ্যমে নিষ্পত্তির
                চেষ্টা করবেন। ব্যর্থ হলে বিরোধ নিষ্পত্তির আইনি এখতিয়ার ঢাকা, বাংলাদেশের আদালতের অধীন থাকবে।
              </p>
            </section>

            {/* Clause 10 */}
            <section id="contact" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E]">
                ১০ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ১০. প্রাতিষ্ঠানিক তথ্য ও যোগাযোগ (Merchant Information & Grievance Contact)
              </h2>
              <p className="text-stone-700 text-xs sm:text-sm">
                যেকোনো আইনি নোটিশ, শর্তাবলীর ব্যাখ্যা কিংবা অভিযোগ জানাতে আমাদের সাথে যোগাযোগ করুন:
              </p>

              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-stone-900 font-bold text-sm">
                  <Building2 className="w-4 h-4 text-[#0F3D2E]" />
                  <span>সাধ্যের বাজার (Sadyer Bazar) — লিগ্যাল ও কমপ্লায়েন্স বিভাগ</span>
                </div>
                <p className="text-stone-600">
                  <strong>সেন্ট্রাল অফিস:</strong> তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৮, বাংলাদেশ।
                </p>
                <p className="text-stone-600">
                  <strong>হটলাইন:</strong>{" "}
                  <a href={`tel:${cleanPhone}`} className="text-[#0F3D2E] font-bold hover:underline">
                    {settings.supportPhone}
                  </a>{" "}
                  (প্রতিদিন সকাল ৮:০০ - রাত ১০:০০)
                </p>
                <p className="text-stone-600">
                  <strong>অফিসিয়াল ইমেইল:</strong>{" "}
                  <a href="mailto:support@sadhya.com.bd" className="text-[#0F3D2E] font-bold hover:underline">
                    support@sadhya.com.bd
                  </a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
