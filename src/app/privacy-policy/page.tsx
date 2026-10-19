"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  CreditCard,
  Truck,
  Eye,
  FileText,
  UserCheck,
  Building2,
  Mail,
  PhoneCall,
  Printer,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Server,
  Database,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";

export default function PrivacyPolicyPage() {
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
            <span className="text-white font-medium">গোপনীয়তা নীতিমালা</span>
          </nav>

          <div className="inline-flex items-center space-x-2 bg-white/10 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-200 mb-3 backdrop-blur-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>SSLCommerz ও বাংলাদেশ ব্যাংক ডেটা সুরক্ষা স্ট্যান্ডার্ড</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-serif tracking-tight leading-tight">
            সাধ্যের বাজার গোপনীয়তা নীতিমালা (Privacy Policy)
          </h1>

          <p className="text-sm sm:text-base text-white/80 max-w-2xl mt-2 leading-relaxed font-light">
            আপনার ব্যক্তিগত তথ্যের নিরাপত্তা ও সুরক্ষায় আমাদের সুদৃঢ় অঙ্গীকার। আমরা কীভাবে
            আপনার ডেটা সংগ্রহ, ব্যবহার ও নিরাপদ রাখি তা স্বচ্ছভাবে জেনে নিন।
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

      {/* Main Content Area with Sticky Navigation */}
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
                  { id: "intro", title: "১. পরিচিতি ও ডেটা কন্ট্রোলার" },
                  { id: "collection", title: "২. সংগৃহীত তথ্যের তালিকা" },
                  { id: "payment-security", title: "৩. পেমেন্ট ও কার্ড তথ্যের নিরাপত্তা" },
                  { id: "usage", title: "৪. তথ্যের ব্যবহার ও উদ্দেশ্য" },
                  { id: "sharing", title: "৫. ডেলিভারি ও তৃতীয় পক্ষ নীতি" },
                  { id: "storage", title: "৬. কুকিজ ও ব্রাউজার স্টোরেজ" },
                  { id: "rights", title: "৭. গ্রাহকের নিজস্ব অধিকার" },
                  { id: "officer", title: "৮. ডেটা সুরক্ষা কর্মকর্তা ও যোগাযোগ" },
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
                <p>সাহায্যের জন্য হটলাইন:</p>
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
                ১. পরিচিতি ও ডেটা কন্ট্রোলার (Introduction & Scope)
              </h2>
              <p className="text-stone-700">
                সাধ্যের বাজার (<strong>Sadyer Bazar</strong>) একটি নিবন্ধিত ই-কমার্স ও খাদ্য সরবরাহ প্রতিষ্ঠান,
                যা সরাসরি যমুনা নদীর তাজা মাছ, ঐতিহ্যবাহী বগুড়ার ঘি-দই এবং গ্রামবাংলার খাঁটি কৃষি খাদ্যপণ্য
                সরাসরি ভোক্তাদের দোরগোড়ায় পৌঁছে দেয়।
              </p>
              <p className="text-stone-700">
                আমাদের ওয়েবসাইট (
                <Link
                  href="/"
                  className="text-[#0F3D2E] font-medium underline"
                >
                  https://sadhyerbazar.com
                </Link>
                ), মোবাইল ব্রাউজার, হোয়াটসঅ্যাপ হেল্পডেস্ক কিংবা হটলাইনের মাধ্যমে যেসকল গ্রাহক
                সেবা গ্রহণ করেন, তাদের সকলের ক্ষেত্রে এই গোপনীয়তা নীতিমালা সমভাবে প্রযোজ্য।
                আমরা গণপ্রজাতন্ত্রী বাংলাদেশের প্রচলিত তথ্য ও যোগাযোগ প্রযুক্তি (ICT) আইন, ডিজিটাল
                নিরাপত্তা আইন এবং ভোক্তা অধিকার সংরক্ষণ আইনের বিধান অনুযায়ী গ্রাহকের গোপনীয়তা রক্ষা করি।
              </p>
            </section>

            {/* Clause 2 */}
            <section id="collection" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ২য় অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ২. আমরা কোন কোন তথ্য সংগ্রহ করি (Information We Collect)
              </h2>
              <p className="text-stone-700">
                গ্রাহককে সঠিক সময়ে টাটকা খাদ্য সরবরাহ এবং সেবা নিশ্চিত করার উদ্দেশ্যে আমরা নিম্নোক্ত
                ন্যূনতম প্রয়োজনীয় তথ্য সংগ্রহ করি:
              </p>

              <div className="space-y-3 pl-2">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80">
                  <strong className="block text-stone-900 text-xs uppercase mb-1">
                    ক. ব্যক্তিগত পরিচিতি তথ্য (Personally Identifiable Information - PII):
                  </strong>
                  <ul className="list-disc list-inside text-xs text-stone-600 space-y-1">
                    <li>গ্রাহকের পূর্ণ নাম</li>
                    <li>মোবাইল ফোন নম্বর (অর্ডার নিশ্চিতকরণ, ওটিপি ও ডেলিভারির জন্য অপরিহার্য)</li>
                    <li>ডেলিভারির পূর্ণ ঠিকানা (বাসা/ফ্ল্যাট নম্বর, রোড, এলাকা, থানা ও জেলা)</li>
                    <li>ইমেইল ঠিকানা (ডিজিটাল ইনভয়েস ও রসিদ প্রেরণের জন্য - ঐচ্ছিক)</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80">
                  <strong className="block text-stone-900 text-xs uppercase mb-1">
                    খ. অর্ডার ও ক্রয় সংক্রান্ত বিবরণ:
                  </strong>
                  <ul className="list-disc list-inside text-xs text-stone-600 space-y-1">
                    <li>অর্ডারের পণ্যের তালিকা, ওজন এবং বিশেষ মাছ কাটিং নির্দেশনা</li>
                    <li>ডিজিটাল ইনভয়েস কোড (যেমন: SB-1024)</li>
                    <li>পেমেন্ট মাধ্যম (বিকাশ, নগদ, কার্ড বা ক্যাশ অন ডেলিভারি)</li>
                    <li>পেমেন্ট রেফারেন্স বা ট্রানজেকশন আইডি (TrxID)</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80">
                  <strong className="block text-stone-900 text-xs uppercase mb-1">
                    গ. কারিগরি নিরাপত্তা ও ডিভাইস ডেটা:
                  </strong>
                  <ul className="list-disc list-inside text-xs text-stone-600 space-y-1">
                    <li>আইপি অ্যাড্রেস ও ব্রাউজার সেশন (সাইবার আক্রমণ ও ব্রুট-ফোর্স ট্রাফিক রোধে)</li>
                    <li>লোকাল ব্রাউজার স্টোরেজ (কার্ট ব্যাকআপ ও অর্ডার ট্র্যাকিং হিস্ট্রি দ্রুত প্রদর্শনে)</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Clause 3 - PCI-DSS / Payment Security Alert */}
            <section
              id="payment-security"
              className="scroll-mt-24 space-y-4 pt-6 border-t border-stone-100"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E]">
                ৩য় অধ্যায় — সর্বোচ্চ ব্যাংকিং নিরাপত্তা
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৩. পেমেন্ট ও কার্ড তথ্যের নিরাপত্তা (Payment Card & Sensitive Financial Data)
              </h2>

              {/* Highlighted Warning/Declaration Box for Banks and Gateways */}
              <div className="p-5 rounded-2xl bg-emerald-50/80 border-2 border-emerald-600/40 space-y-2">
                <div className="flex items-center space-x-2 text-[#0F3D2E] font-bold">
                  <Lock className="w-5 h-5 text-emerald-700" />
                  <span>গুরুত্বপূর্ণ পেমেন্ট নিরাপত্তা ঘোষণা (Zero Storage Policy)</span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium">
                  <strong>সাধ্যের বাজার কখনোই গ্রাহকের কোনো ডেবিট/ক্রেডিট কার্ড নম্বর, সিভিভি (CVV/CVC),
                  মেয়াদোত্তীর্ণের তারিখ কিংবা বিকাশ/নগদের গোপন পিন (PIN) সংরক্ষণ করে না।</strong>
                </p>
                <p className="text-xs text-emerald-900/90 leading-relaxed">
                  সমস্ত অনলাইন কার্ড এবং মোবাইল ব্যাংকিং লেনদেন সরাসরি বাংলাদেশ ব্যাংক অনুমোদিত
                  পেমেন্ট গেটওয়ে <strong>SSLCommerz</strong> এবং <strong>bKash Tokenized Gateway</strong>-এর
                  মাধ্যমে আন্তর্জাতিক <strong>PCI-DSS লেভেল-১</strong> সার্টিফাইড ও ২৫৬-বিট এসএসএল
                  (SSL/TLS) এনক্রিপ্টেড চ্যানেলে প্রসেস করা হয়। সাধ্যের বাজার শুধুমাত্র পেমেন্টের
                  সাফল্যসূচক স্ট্যাটাস ও ট্রানজেকশন রেফারেন্স কোড সংরক্ষণ করে।
                </p>
              </div>

              <p className="text-stone-700 text-xs sm:text-sm">
                ক্যাশ অন ডেলিভারি (COD) পদ্ধতির ক্ষেত্রে গ্রাহক পণ্য বুঝে পেয়ে ডেলিভারি ম্যানের কাছে
                নগদে মূল্য পরিশোধ করবেন। এতে কোনো ডিজিটাল কার্ড তথ্য প্রদানের প্রয়োজন পড়ে না।
              </p>
            </section>

            {/* Clause 4 */}
            <section id="usage" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ৪র্থ অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৪. তথ্যের ব্যবহার ও উদ্দেশ্য (How We Use Your Information)
              </h2>
              <p className="text-stone-700">
                সংগৃহীত তথ্য কেবলমাত্র নিম্নলিখিত সুস্পষ্ট ও সংগত বাণিজ্যিক উদ্দেশ্যে ব্যবহৃত হয়:
              </p>
              <ul className="space-y-2 text-xs sm:text-sm text-stone-700">
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-700 font-bold">•</span>
                  <span><strong>অর্ডার প্রসেসিং ও ডেলিভারি:</strong> নদী ও খামার থেকে পণ্য সংগ্রহ, কাস্টমাইজড কাটিং এবং কোল্ড-চেইনে আপনার বাসায় পৌঁছে দেওয়া।</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-700 font-bold">•</span>
                  <span><strong>ওজন ও পণ্যের স্বচ্ছতা:</strong> ডিজিটাল স্কেলের সুনির্দিষ্ট ওজন ও ভোরের তাজা মাছের ছবি হোয়াটসঅ্যাপ বা ফোনে গ্রাহকের সাথে শেয়ার করা।</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-700 font-bold">•</span>
                  <span><strong>অর্ডার ট্র্যাকিং আপডেট:</strong> ইনভয়েস কোডের মাধ্যমে পণ্যের লাইভ স্ট্যাটাস জানানো ও জরুরি যোগাযোগ।</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-700 font-bold">•</span>
                  <span><strong>কাস্টমার সাপোর্ট:</strong> পণ্য সম্পর্কিত কোনো প্রশ্ন, মতামত বা অভিযোগের তাৎক্ষণিক সমাধান প্রদান।</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-700 font-bold">•</span>
                  <span><strong>জালিয়াতি প্রতিরোধ:</strong> ভুয়া অর্ডার, স্প্যাম কিংবা সাইবার অপব্যবহার প্রতিরোধ করা।</span>
                </li>
              </ul>
            </section>

            {/* Clause 5 */}
            <section id="sharing" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ৫ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৫. ডেলিভারি ও তৃতীয় পক্ষ নীতি (Third-Party Sharing & Logistics)
              </h2>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-stone-800 text-xs sm:text-sm">
                <strong>তথ্য গোপনীয়তার নিশ্চয়তা:</strong> সাধ্যের বাজার কখনোই কোনো বাণিজ্যিক বিজ্ঞাপনী
                সংস্থা, টেলিমার্কেট বা ডাটা ব্রোকারের কাছে আপনার ব্যক্তিগত ফোন নম্বর, নাম বা ঠিকানা বিক্রি,
                ভাড়া বা হস্তান্তর করে না।
              </div>
              <p className="text-stone-700 text-xs sm:text-sm">
                শুধুমাত্র আপনার অর্ডারের পণ্য আপনার ঠিকানায় সরাসরি হস্তান্তর করার প্রয়োজনে আমরা
                নিম্নলিখিত অনুমোদিত পক্ষগুলোর সাথে ন্যূনতম প্রয়োজনীয় তথ্য শেয়ার করি:
              </p>
              <ul className="list-disc list-inside text-xs sm:text-sm text-stone-600 space-y-1.5 pl-2">
                <li><strong>আমাদের নিজস্ব ডেলিভারি রাইডার ও টিম:</strong> যারা ইনসুলেটেড বক্সে পণ্য পৌঁছে দেন।</li>
                <li><strong>স্বীকৃত লজিস্টিকস পার্টনার (কুরিয়ার সার্ভিস):</strong> ঢাকার বাইরে ডেলিভারির ক্ষেত্রে (নাম, ফোন নম্বর ও পূর্ণ ঠিকানা)।</li>
                <li><strong>আইনগত বাধ্যবাধকতা:</strong> দেশের আদালত বা আইন প্রয়োগকারী সংস্থার লিখিত ও আনুষ্ঠানিক আইনগত নির্দেশনায়।</li>
              </ul>
            </section>

            {/* Clause 6 */}
            <section id="storage" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ৬ষ্ঠ অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৬. কুকিজ ও ব্রাউজার স্টোরেজ নীতি (Cookies & Local Storage)
              </h2>
              <p className="text-stone-700 text-xs sm:text-sm">
                আমাদের ওয়েবসাইট আপনার ব্রাউজারের লোকাল স্টোরেজ (Local Storage) ও সেশন ক্যাশিং ব্যবহার করে।
                এর ফলে:
              </p>
              <ul className="list-disc list-inside text-xs sm:text-sm text-stone-600 space-y-1 pl-2">
                <li>আপনার কার্টে যোগ করা পণ্যগুলো পেজ রিফ্রেশ করলেও অক্ষুণ্ণ থাকে।</li>
                <li>অর্ডার ট্র্যাকিং পেজে আপনি সহজেই আপনার পূর্ববর্তী অর্ডার নম্বর পুনরুদ্ধার করতে পারেন।</li>
                <li>আমরা ব্যবহারকারীর ব্যক্তিগত ট্র্যাকিং বা আগ্রাসী বিজ্ঞাপন কুকি ব্যবহার করি না।</li>
              </ul>
            </section>

            {/* Clause 7 */}
            <section id="rights" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                ৭ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৭. গ্রাহকের নিজস্ব অধিকার ও নিয়ন্ত্রণ (Your Rights & Control)
              </h2>
              <p className="text-stone-700 text-xs sm:text-sm">
                একজন গ্রাহক হিসেবে আপনার তথ্যের ওপর পূর্ণ নিয়ন্ত্রণ রয়েছে:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                  <strong className="text-stone-900 block mb-1">১. তথ্য সংশোধন</strong>
                  <p className="text-stone-600">ঠিকানা বা মোবাইল নম্বরে কোনো ভুল হলে আমাদের কাস্টমার সাপোর্টে কল বা হোয়াটসঅ্যাপ করে তাৎক্ষণিক সংশোধন করতে পারবেন।</p>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                  <strong className="text-stone-900 block mb-1">২. তথ্য মুছে ফেলার অনুরোধ</strong>
                  <p className="text-stone-600">আপনি চাইলে আমাদের অফিসিয়াল ইমেইলে অনুরোধ জানিয়ে আপনার ব্যক্তিগত রেকর্ড আমাদের ডেটাবেজ থেকে মুছে ফেলার আবেদন করতে পারেন।</p>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                  <strong className="text-stone-900 block mb-1">৩. নোটিফিকেশন নিয়ন্ত্রণ</strong>
                  <p className="text-stone-600">আপনি যেকোনো সময় প্রমোশনাল বা অফার সংক্রান্ত বার্তা প্রাপ্তি বন্ধের অপ্ট-আউট অনুরোধ জানাতে পারেন।</p>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                  <strong className="text-stone-900 block mb-1">৪. স্বচ্ছতা নিশ্চিতকরণ</strong>
                  <p className="text-stone-600">আপনার সংরক্ষিত তথ্যের ব্যবহার সম্পর্কে যেকোনো ব্যাখ্যা বা বিবরণ জানতে চাওয়ার পূর্ণ অধিকার আপনার রয়েছে।</p>
                </div>
              </div>
            </section>

            {/* Clause 8 */}
            <section id="officer" className="scroll-mt-24 space-y-3 pt-6 border-t border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2E]">
                ৮ম অধ্যায়
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                ৮. ডেটা সুরক্ষা কর্মকর্তা ও যোগাযোগ (Grievance & Contact Information)
              </h2>
              <p className="text-stone-700 text-xs sm:text-sm">
                আপনার গোপনীয়তা সংক্রান্ত কোনো প্রশ্ন, মতামত বা অভিযোগ থাকলে আমাদের দায়িত্বপ্রাপ্ত
                কর্মকর্তার সাথে সরাসরি যোগাযোগ করতে পারেন:
              </p>

              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-stone-900 font-bold text-sm">
                  <Building2 className="w-4 h-4 text-[#0F3D2E]" />
                  <span>সাধ্যের বাজার (Sadyer Bazar) — ডেটা সুরক্ষা ও কমপ্লায়েন্স সেল</span>
                </div>
                <p className="text-stone-600">
                  <strong>পদবি:</strong> Data Protection & Grievance Redressal Officer
                </p>
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
                  <a href="mailto:privacy@sadhya.com.bd" className="text-[#0F3D2E] font-bold hover:underline">
                    privacy@sadhya.com.bd
                  </a>{" "}
                  /{" "}
                  <a href="mailto:support@sadhya.com.bd" className="text-[#0F3D2E] hover:underline">
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
