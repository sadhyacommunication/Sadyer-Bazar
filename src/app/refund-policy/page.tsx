"use client";

import React from "react";
import Link from "next/link";
import {
  RotateCcw,
  ShieldCheck,
  CreditCard,
  Truck,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  MessageSquare,
  Clock,
  Printer,
  ChevronRight,
  FileText,
  BadgePercent,
  Sparkles,
  Building2,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";

export default function RefundPolicyPage() {
  const { settings } = useStore();

  const cleanPhone = settings.supportPhone.replace(/[^0-9]/g, "");
  const cleanWhatsapp = settings.whatsappNumber.replace(/[^0-9]/g, "");

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
            <span className="text-white font-medium">রিফান্ড ও রিটার্ন নীতিমালা</span>
          </nav>

          <div className="inline-flex items-center space-x-2 bg-white/10 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-200 mb-3 backdrop-blur-xs">
            <RotateCcw className="w-4 h-4 text-emerald-300" />
            <span>ভোক্তা অধিকার সংরক্ষণ আইন ও SSLCommerz রিফান্ড গাইডলাইন</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-serif tracking-tight leading-tight">
            সাধ্যের বাজার রিফান্ড ও রিটার্ন নীতিমালা (Refund & Return Policy)
          </h1>

          <p className="text-sm sm:text-base text-white/80 max-w-2xl mt-2 leading-relaxed font-light">
            আপনার সন্তুষ্টি ও অধিকার সুরক্ষায় আমরা শতভাগ দায়বদ্ধ। পণ্যের মান বা সতেজতায় কোনো
            ত্রুটি থাকলে সহজ ও দ্রুততম রিফান্ড কিংবা পণ্য পরিবর্তনের স্বচ্ছ নীতিমালা।
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-white/70 mt-6 pt-4 border-t border-white/15">
            <span>সর্বশেষ হালনাগাদ: অক্টোবর ২০২৬</span>
            <span>•</span>
            <span>সংস্করণ: ২.০ (কমপ্লায়েন্ট)</span>
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
                  { id: "promise", title: "১. আমাদের ১০০% সন্তুষ্টি প্রতিশ্রুতি" },
                  { id: "eligibility", title: "২. রিফান্ডের গ্রহণযোগ্য কারণসমূহ" },
                  { id: "timeline", title: "৩. অভিযোগ জানানোর সময়সীমা" },
                  { id: "how-to", title: "৪. রিফান্ড পাওয়ার সহজ ধাপসমূহ" },
                  { id: "methods", title: "৫. রিফান্ড মাধ্যম ও নিষ্পত্তির সময়" },
                  { id: "scale-refund", title: "৬. ডিজিটাল ওজনের উদ্বৃত্ত রিফান্ড" },
                  { id: "cancellation", title: "৭. অর্ডার বাতিলকরণ নীতি" },
                  { id: "contact", title: "৮. অভিযোগ নিষ্পত্তি কর্মকর্তা" },
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
                <p>তাৎক্ষণিক রিফান্ড হটলাইন:</p>
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
            <section id="promise" className="scroll-mt-24 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ১ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ১. আমাদের ১০০% সন্তুষ্টি প্রতিশ্রুতি (Our Quality & Freshness Guarantee)
              </h2>
              <p className="text-stone-700">
                সাধ্যের বাজার (<strong>Sadhyer Bazar</strong>) গ্রাহকদের খাবার টেবিলে ১০০% খাঁটি, ফরমালিনমুক্ত
                ও প্রাকৃতিক খাদ্যপণ্য পৌঁছে দিতে প্রতিজ্ঞাবদ্ধ। পচনশীল জৈব খাদ্যপণ্য (যেমন: যমুনা নদীর দেশি মাছ,
                বগুড়ার তাজা দই, সনাতন গাওয়া ঘি, দেশি হাঁস-মুরগি) সরবরাহের ক্ষেত্রে কোনো ত্রুটি হলে
                গ্রাহককে ভোগান্তিতে না ফেলে দ্রুত সমাধান করাই আমাদের বাণিজ্যিক নীতি।
              </p>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-950 text-xs sm:text-sm">
                <strong className="block text-[#0F3D2E] mb-1">
                  আমাদের অনড় নীতি:
                </strong>
                যদি ডেলিভারিকৃত পণ্যের সতেজতা বা মানে কোনো যুক্তিসঙ্গত ত্রুটি থাকে, তবে আমরা কোনো প্রকার
                অজুহাত ছাড়াই হয় পরবর্তী ব্যাচে <strong>বিকল্প তাজা পণ্য ফ্রি ডেলিভারি</strong> প্রদান করব,
                কিংবা <strong>সম্পূর্ণ টাকা রিফান্ড</strong> করব।
              </div>
            </section>

            {/* Clause 2 */}
            <section id="eligibility" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ২য় অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ২. রিফান্ডের গ্রহণযোগ্য কারণসমূহ (Eligible Situations for Refund/Replacement)
              </h2>
              <p className="text-stone-700">
                নিম্নলিখিত যেকোনো পরিস্থিতিতে গ্রাহক সম্পূর্ণ রিফান্ড বা পণ্য পরিবর্তনের অধিকারী হবেন:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                  <div className="flex items-center space-x-1.5 text-stone-900 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>মান বা সতেজতায় ঘাটতি</span>
                  </div>
                  <p className="text-stone-600">মাছ বা মাংসে কোনো অস্বাভাবিক গন্ধ থাকলে কিংবা সতেজতার ঘাটতি পরিলক্ষিত হলে।</p>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                  <div className="flex items-center space-x-1.5 text-stone-900 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>কোল্ড-চেইন বা প্যাকেজিং ক্ষতি</span>
                  </div>
                  <p className="text-stone-600">পরিবহনের সময় বরফ গলে বা মাটির সরা ভেঙে দই কিংবা ঘি নষ্ট হয়ে গেলে।</p>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                  <div className="flex items-center space-x-1.5 text-stone-900 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ভুল পণ্য ডেলিভারি</span>
                  </div>
                  <p className="text-stone-600">অর্ডারকৃত মাছের প্রজাতি বা সাইজের চেয়ে সম্পূর্ণ ভিন্ন পণ্য ডেলিভারি করা হলে।</p>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                  <div className="flex items-center space-x-1.5 text-stone-900 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>নদীতে শিকার অপ্রতুলতা</span>
                  </div>
                  <p className="text-stone-600">প্রি-অর্ডার করা বুনো নদী মাছ ভোরবেলার শিকারে না পেলে এবং গ্রাহক বিকল্প নিতে অসম্মতি জানালে।</p>
                </div>
              </div>
            </section>

            {/* Clause 3 */}
            <section id="timeline" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E]">
                ৩য় অধ্যায় — অত্যন্ত গুরুত্বপূর্ণ
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৩. অভিযোগ জানানোর সময়সীমা (Inspection & Reporting Window)
              </h2>
              <p className="text-stone-700">
                যেহেতু প্রাকৃতিক কাঁচা খাদ্যপণ্য দ্রুত পচনশীল এবং কোনো প্রিজারভেটিভ নেই, তাই সময়মতো
                অভিযোগ জানানো আবশ্যক:
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-stone-200 rounded-xl overflow-hidden">
                  <thead className="bg-stone-50 font-bold text-stone-700">
                    <tr>
                      <th className="py-2.5 px-3.5 border-b border-stone-200">পণ্যের বিভাগ</th>
                      <th className="py-2.5 px-3.5 border-b border-stone-200">অভিযোগের সময়সীমা</th>
                      <th className="py-2.5 px-3.5 border-b border-stone-200">প্রয়োজনীয় প্রমাণ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-600">
                    <tr>
                      <td className="py-2.5 px-3.5 font-semibold text-stone-900">যমুনার তাজা মাছ ও দেশি মাংস</td>
                      <td className="py-2.5 px-3.5 text-rose-700 font-bold">ডেলিভারির ২ থেকে ৪ ঘণ্টার মধ্যে</td>
                      <td className="py-2.5 px-3.5">প্যাকেট খোলার ছবি বা ছোট ভিডিও</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3.5 font-semibold text-stone-900">বগুড়ার শাহী দই ও ক্ষীরসা</td>
                      <td className="py-2.5 px-3.5 text-rose-700 font-bold">ডেলিভারির ৪ ঘণ্টার মধ্যে</td>
                      <td className="py-2.5 px-3.5">মাটির সরার ছবি</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3.5 font-semibold text-stone-900">গাওয়া ঘি, সরিষার তেল ও সুন্দরবনের মধু</td>
                      <td className="py-2.5 px-3.5 text-amber-700 font-bold">ডেলিভারির ২৪ ঘণ্টার মধ্যে</td>
                      <td className="py-2.5 px-3.5">সিল বা বোতলের প্যাকেজিং অবস্থা</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3.5 font-semibold text-stone-900">ঐতিহ্যবাহী পোলাও ও লাল চাল</td>
                      <td className="py-2.5 px-3.5 text-emerald-700 font-bold">ডেলিভারির ৪৮ ঘণ্টার মধ্যে</td>
                      <td className="py-2.5 px-3.5">বস্তা বা ব্যাগের বিবরণ</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Clause 4 */}
            <section id="how-to" className="scroll-mt-24 space-y-4 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ৪র্থ অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৪. রিফান্ড পাওয়ার সহজ ধাপসমূহ (3-Step Claim Process)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-black text-[#C83E2B] bg-red-100 px-2 py-0.5 rounded-full mb-2 inline-block">
                      ধাপ ০১
                    </span>
                    <strong className="block text-stone-900 text-sm mb-1">ছবি বা ভিডিও তুলুন</strong>
                    <p className="text-stone-600">পণ্য হাতে পাওয়ার পর ত্রুটিপূর্ণ পণ্যের সুস্পষ্ট ছবি অথবা ছোট একটি ভিডিও ধারণ করুন।</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-black text-[#0F3D2E] bg-emerald-100 px-2 py-0.5 rounded-full mb-2 inline-block">
                      ধাপ ০২
                    </span>
                    <strong className="block text-stone-900 text-sm mb-1">হোয়াটসঅ্যাপে পাঠান</strong>
                    <p className="text-stone-600">আপনার অর্ডার কোডসহ ছবিটি আমাদের হোয়াটসঅ্যাপে পাঠান অথবা হটলাইনে কল দিন।</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full mb-2 inline-block">
                      ধাপ ০৩
                    </span>
                    <strong className="block text-stone-900 text-sm mb-1">তাৎক্ষণিক সমাধান</strong>
                    <p className="text-stone-600">আমাদের সাপোর্ট টিম দ্রুত যাচাই করে রিপ্লেসমেন্ট অথবা রিফান্ডের ব্যবস্থা করবে।</p>
                  </div>
                </div>
              </div>

              {/* Quick WhatsApp Action Button */}
              <div className="pt-2">
                <a
                  href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
                    "আসসালামু আলাইকুম সাধ্যের বাজার, আমার অর্ডারে একটি সমস্যা হয়েছে। অর্ডার কোড: "
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>হোয়াটসঅ্যাপে তাৎক্ষণিক অভিযোগ জানান ({settings.whatsappNumber})</span>
                </a>
              </div>
            </section>

            {/* Clause 5 */}
            <section id="methods" className="scroll-mt-24 space-y-4 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E]">
                ৫ম অধ্যায় — বাংলাদেশ ব্যাংক ও গেটওয়ে কমপ্লায়েন্স
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৫. রিফান্ড মাধ্যম ও নিষ্পত্তির সময়সীমা (Refund Channels & Timelines)
              </h2>
              <p className="text-stone-700 text-xs sm:text-sm">
                অনুমোদিত রিফান্ডের অর্থ যে মাধ্যমে পরিশোধ করা হয়েছিল, ঠিক সেই মাধ্যমেই স্বয়ংক্রিয়ভাবে ফেরত দেওয়া হয়:
              </p>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-stone-900 text-sm">১. বিকাশ ও নগদ মোবাইল ব্যাংকিং (MFS)</strong>
                    <span className="px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-800 font-bold text-[11px]">
                      ৩ থেকে ৫ কার্যদিবস
                    </span>
                  </div>
                  <p className="text-stone-600">
                    গ্রাহক যদি বিকাশ বা নগদ গেটওয়ে দিয়ে পেমেন্ট করে থাকেন, তবে রিফান্ড অনুমোদনের পর
                    সরাসরি সংশ্লিষ্ট বিকাশ/নগদ ওয়ালেটে ক্যাশব্যাক / রিভার্সেল করা হয়।
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-stone-900 text-sm">২. ভিসা / মাস্টারকার্ড ও ডেবিট-ক্রেডিট কার্ড (SSLCommerz)</strong>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px]">
                      ৫ থেকে ১০ কার্যদিবস
                    </span>
                  </div>
                  <p className="text-stone-600">
                    অনলাইন কার্ডের মাধ্যমে পরিশোধিত টাকা SSLCommerz গেটওয়ের মাধ্যমে গ্রাহকের কার্ড ইস্যুকারী
                    ব্যাংক একাউন্টে রিভার্স করা হয়। ব্যাংকের নিজস্ব ক্লিয়ারিং সাইকেল অনুযায়ী কার্ড স্টেটমেন্টে জমা হয়।
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-stone-900 text-sm">৩. ক্যাশ অন ডেলিভারি (Cash on Delivery - COD)</strong>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      ১ থেকে ৩ কার্যদিবস
                    </span>
                  </div>
                  <p className="text-stone-600">
                    ক্যাশ অন ডেলিভারিতে গৃহীত পণ্যের ক্ষেত্রে গ্রাহকের প্রদত্ত বিকাশ/নগদ নম্বর অথবা ব্যাংক একাউন্টে
                    অনলাইন ট্রান্সফারের মাধ্যমে টাকা ফেরত দেওয়া হয়।
                  </p>
                </div>
              </div>
            </section>

            {/* Clause 6 */}
            <section id="scale-refund" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ৬ষ্ঠ অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৬. ডিজিটাল ওজনের উদ্বৃত্ত রিফান্ড (Digital Scale Surplus Refund)
              </h2>
              <p className="text-stone-700 text-xs sm:text-sm">
                যদি প্রি-অর্ডারকৃত মাছের ক্ষেত্রে গ্রাহক আনুমানিক ওজনের ওপর পুরো অর্থ অগ্রিম পরিশোধ করে থাকেন,
                কিন্তু ভোরের শিকারে প্রাপ্ত মাছের ওজন ডিজিটাল স্কেলে মেপে সামান্য কম হয়—তবে উদ্বৃত্ত বাড়তি টাকা
                ডেলিভারির সাথে সাথে গ্রাহককে স্বয়ংক্রিয়ভাবে ক্যাশ অন ডেলিভারিতে অফসেট করে দেওয়া হবে অথবা বিকাশ/নগদে
                রিফান্ড করা হবে।
              </p>
            </section>

            {/* Clause 7 */}
            <section id="cancellation" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ৭ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৭. অর্ডার বাতিলকরণ নীতি (Order Cancellation Policy)
              </h2>
              <ul className="space-y-2 text-xs sm:text-sm text-stone-700">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>কাটিংয়ের পূর্বে বাতিল:</strong> মাছ সংগ্রহ বা কাটিং প্রক্রিয়া শুরুর পূর্বে (ভোর ৬:০০ টার আগে) গ্রাহক হটলাইনে কল দিয়ে শতভাগ রিফান্ডসহ অর্ডার বাতিল করতে পারবেন।</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>কাটিং ও প্যাকিং সম্পন্ন হওয়ার পর:</strong> স্বাস্থ্যবিধি ও পচনশীলতার কারণে একবার বিশেষায়িত আইস-বক্সে গ্রাহকের পছন্দমতো মাছ কেটে প্যাকিং সম্পন্ন হয়ে গেলে অর্ডার বাতিলযোগ্য নয়।</span>
                </li>
              </ul>
            </section>

            {/* Clause 8 */}
            <section id="contact" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E]">
                ৮ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৮. অভিযোগ নিষ্পত্তি কর্মকর্তা ও যোগাযোগ (Grievance Redressal Contact)
              </h2>
              <p className="text-stone-700 text-xs sm:text-sm">
                রিফান্ড সংক্রান্ত যেকোনো সহায়তার জন্য আমাদের ডেডিকেটেড সাপোর্ট সেল প্রস্তুত রয়েছে:
              </p>

              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-stone-900 font-bold text-sm">
                  <Building2 className="w-4 h-4 text-[#0F3D2E]" />
                  <span>সাধ্যের বাজার (Sadhyer Bazar) — কাস্টমার রিলেশনস ও রিফান্ড সেল</span>
                </div>
                <p className="text-stone-600">
                  <strong>ঢাকা প্রধান কার্যালয়:</strong> বাড়ি ৯০, রোড ২, ব্লক এ, নিকেতন, গুলশান, ঢাকা।
                </p>
                <p className="text-stone-600">
                  <strong>গ্রামের ওয়্যারহাউজ/স্টোর:</strong> ধুনট সদর, ধুনট বাজার, বগুড়া।
                </p>
                <p className="text-stone-600">
                  <strong>হটলাইন:</strong>{" "}
                  <a href={`tel:${cleanPhone}`} className="text-[#0F3D2E] font-bold hover:underline">
                    {settings.supportPhone}
                  </a>{" "}
                  (প্রতিদিন সকাল ৮:০০ - রাত ১০:০০)
                </p>
                <p className="text-stone-600">
                  <strong>হোয়াটসঅ্যাপ সাপোর্ট:</strong>{" "}
                  <a href={`https://wa.me/${cleanWhatsapp}`} className="text-[#0F3D2E] font-bold hover:underline">
                    {settings.whatsappNumber}
                  </a>
                </p>
                <p className="text-stone-600">
                  <strong>অফিসিয়াল রিফান্ড ইমেইল:</strong>{" "}
                  <a href="mailto:support@sadhyerbazar.com" className="text-[#0F3D2E] font-bold hover:underline">
                    support@sadhyerbazar.com
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
