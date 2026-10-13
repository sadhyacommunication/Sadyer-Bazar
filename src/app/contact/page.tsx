"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Sparkles,
  Truck,
  ShieldCheck,
  Fish,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { createContactMessageSchema } from "@/lib/validations/schemas";

const SUBJECT_OPTIONS = [
  "পণ্য ও ডেলিভারি সংক্রান্ত অনুসন্ধান",
  "যমুনা নদীর তাজা মাছ ও কাটিং পছন্দ",
  "বাল্ক / পারিবারিক উৎসবের বিশেষ অর্ডার",
  "পেমেন্ট ও অর্ডার ট্র্যাকিং সহায়তা",
  "পণ্য পরিবর্তন বা অভিযোগ",
  "অন্যান্য জিজ্ঞাসা",
];

const FAQS = [
  {
    q: "যমুনা নদীর তাজা মাছ কীভাবে ডেলিভারি দেওয়া হয়?",
    a: "আমাদের জেলেরা যমুনা নদী থেকে মাছ শিকারের পর তৎক্ষণাৎ বাছাই করে ইনসুলেটেড আইস-বক্সে খাদ্য-নিরাপদ বরফে সংরক্ষণ করা হয়। কোনো ফরমালিন বা রাসায়নিক ব্যবহার করা হয় না। আপনার চাহিদামতো আঁশ ও নাড়িভুঁড়ি পরিষ্কার করে ঢাকায় নিজস্ব কোল্ড-চেইনে দ্রুততম সময়ে পৌঁছে দেওয়া হয়।",
  },
  {
    q: "বগুড়ার ঐতিহ্যবাহী দই ও গাওয়া ঘি এর বিশুদ্ধতার নিশ্চয়তা কী?",
    a: "আমাদের ঘি ১০০% দেশি গরুর দুধের খাঁটি সর জ্বাল দিয়ে সনাতন পদ্ধতিতে তৈরি। আর বগুড়ার দই সরাসরি বগুড়ার কারিগরদের মাটির সরায় জমানো টাটকা পাঠানো হয়। কোনো কৃত্রিম মিষ্টি বা প্রিজারভেটিভ দেওয়া হয় না।",
  },
  {
    q: "ঢাকা ও ঢাকার বাইরে ডেলিভারি কত সময়ে পৌঁছায়?",
    a: "ঢাকা সিটির ভেতরে অর্ডার কনফার্মেশনের ২৪ থেকে ৩৬ ঘণ্টার মধ্যে স্লট অনুযায়ী হোম ডেলিভারি পৌঁছে যায়। প্রি-অর্ডারের তাজা মাছ নদীর জোয়ার ও ধরার টাইমিং অনুযায়ী নির্ধারিত দিনে সকালে সরাসরি আপনার ঠিকানায় পাঠানো হয়।",
  },
  {
    q: "পেমেন্ট কীভাবে করা যায়? ক্যাশ অন ডেলিভারি আছে কি?",
    a: "হ্যাঁ, ক্যাশ অন ডেলিভারি (পণ্য পেয়ে মূল্য পরিশোধ) রয়েছে। এছাড়া বিকাশ, নগদ ও ডেবিট/ক্রেডিট কার্ডের মাধ্যমেও যেকোনো সময় সহজে ডিজিটাল পেমেন্ট সম্পন্ন করতে পারেন।",
  },
];

export default function ContactPage() {
  const { settings, addContactMessage } = useStore();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    subject: SUBJECT_OPTIONS[0],
    message: "",
    website: "", // Honeypot spam trap
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const cleanPhone = settings.supportPhone.replace(/[^0-9]/g, "");
  const cleanWhatsapp = settings.whatsappNumber.replace(/[^0-9]/g, "");

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate using Zod schema
    const validation = createContactMessageSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const fieldName = String(issue.path[0]);
        if (!fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    // Honeypot check
    if (formData.website && formData.website.trim().length > 0) {
      setSubmitSuccess(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await addContactMessage({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        subject: formData.subject,
        message: formData.message.trim(),
      });

      setSubmitSuccess(true);
      setFormData({
        name: "",
        phone: "",
        email: "",
        subject: SUBJECT_OPTIONS[0],
        message: "",
        website: "",
      });
    } catch {
      setErrors({ form: "বার্তাটি পাঠানো যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A1A1A] pb-16">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-[#0F3D2E] text-white py-12 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="max-w-6xl mx-auto relative z-10">
          <nav className="text-xs text-white/70 mb-3 flex items-center space-x-2">
            <Link href="/" className="hover:text-white transition">
              হোম
            </Link>
            <span>/</span>
            <span className="text-white font-medium">যোগাযোগ ও হেল্পডেস্ক</span>
          </nav>
          <div className="inline-flex items-center space-x-2 bg-white/10 px-3 py-1 rounded-full text-xs font-medium text-emerald-200 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>সরাসরি সাধ্যের বাজার কাস্টমার কেয়ার</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold font-serif tracking-tight leading-tight">
            আপনার যেকোনো প্রশ্ন বা প্রয়োজনে আমরা পাশে আছি
          </h1>
          <p className="text-sm md:text-base text-white/80 max-w-2xl mt-2 leading-relaxed">
            যমুনা নদীর টাটকা দেশি মাছ, বগুড়ার ঐতিহ্যবাহী খাঁটি খাদ্যপণ্য কিংবা আপনার
            অর্ডার সংক্রান্ত যেকোনো তথ্য জানতে সরাসরি আমাদের সাথে যোগাযোগ করুন।
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 -mt-6">
        {/* Quick Contact Action Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {/* Hotline Card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200/80 hover:shadow-md transition">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#0F3D2E] flex items-center justify-center mb-3">
              <Phone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-stone-900 text-sm">হটলাইন কল</h3>
            <p className="text-xs text-stone-500 mt-0.5">সরাসরি কথা বলুন</p>
            <a
              href={`tel:${cleanPhone}`}
              className="mt-3 block text-base font-extrabold text-[#0F3D2E] hover:underline"
            >
              {settings.supportPhone}
            </a>
            <div className="flex items-center space-x-1 text-[11px] text-stone-400 mt-1">
              <Clock className="w-3 h-3" />
              <span>সকাল ৮:০০ - রাত ১০:০০</span>
            </div>
          </div>

          {/* WhatsApp Card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200/80 hover:shadow-md transition">
            <div className="w-11 h-11 rounded-xl bg-green-50 text-green-700 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-stone-900 text-sm">হোয়াটসঅ্যাপ সাপোর্ট</h3>
            <p className="text-xs text-stone-500 mt-0.5">তাত্ক্ষণিক চ্যাট ও লাইভ ছবি</p>
            <a
              href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
                "আসসালামু আলাইকুম সাধ্যের বাজার, আমি কিছু জানতে চাচ্ছিলাম।"
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center space-x-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition"
            >
              <span>চ্যাট শুরু করুন</span>
              <span>→</span>
            </a>
            <p className="text-[11px] text-stone-400 mt-2">সাধারণত ৫ মিনিটে রিপ্লাই</p>
          </div>

          {/* Sourcing Hubs */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200/80 hover:shadow-md transition">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-stone-900 text-sm">সোর্সিং ও কালেকশন হাব</h3>
            <p className="text-xs text-stone-600 mt-1.5 leading-snug">
              <strong>যমুনা হাব:</strong> কাজীপুর ঘাট, সিরাজগঞ্জ
            </p>
            <p className="text-xs text-stone-600 mt-1 leading-snug">
              <strong>মিষ্টি ও ঘি হাব:</strong> শেরপুর রোড, বগুড়া
            </p>
            <div className="flex items-center space-x-1 text-[11px] text-amber-700 font-medium mt-2">
              <Fish className="w-3 h-3" />
              <span>সরাসরি নদী ও খামার থেকে</span>
            </div>
          </div>

          {/* Dispatch Center & Email */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200/80 hover:shadow-md transition">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-[#C83E2B] flex items-center justify-center mb-3">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-stone-900 text-sm">ঢাকা সেন্ট্রাল ডিসপ্যাচ</h3>
            <p className="text-xs text-stone-600 mt-1.5 leading-snug">
              তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৮
            </p>
            <div className="flex items-center space-x-1 text-xs text-stone-500 mt-2">
              <Mail className="w-3.5 h-3.5 text-stone-400" />
              <a
                href="mailto:support@sadhya.com.bd"
                className="hover:text-[#C83E2B] transition"
              >
                support@sadhya.com.bd
              </a>
            </div>
            <div className="flex items-center space-x-1 text-[11px] text-stone-400 mt-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>নিরাপদ কোল্ড-চেইন ডেলিভারি</span>
            </div>
          </div>
        </div>

        {/* Contact Form & Side Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-14">
          {/* Form Column */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200/80">
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C83E2B]">
                মেসেজ পাঠান
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900 mt-1">
                আপনার বার্তা বা প্রশ্ন আমাদের লিখুন
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-1">
                নিচের ফর্মটি পূরণ করে পাঠান। আমাদের টিম সর্বোচ্চ গুরুত্বের সাথে
                আপনার সাথে দ্রুত যোগাযোগ করবে।
              </p>
            </div>

            {submitSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center animate-fade-in">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-emerald-950">
                  আপনার বার্তাটি সফলভাবে পাঠানো হয়েছে!
                </h3>
                <p className="text-xs sm:text-sm text-emerald-800 mt-1 max-w-md mx-auto">
                  ধন্যবাদ। আমাদের কাস্টমার সাপোর্ট টিম আপনার বার্তাটি পর্যালোচনা
                  করে খুব শীঘ্রই আপনার প্রদত্ত মোবাইল নম্বরে যোগাযোগ করবে।
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSubmitSuccess(false)}
                    className="px-4 py-2 bg-[#0F3D2E] text-white text-xs font-semibold rounded-lg hover:bg-emerald-900 transition"
                  >
                    আরেকটি বার্তা পাঠান
                  </button>
                  <Link
                    href="/shop"
                    className="px-4 py-2 bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg hover:bg-stone-200 transition"
                  >
                    কেনাকাটা চালিয়ে যান
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Honeypot field for bot defense */}
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />

                {errors.form && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errors.form}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      আপনার নাম <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="উদা: মো. রফিকুল ইসলাম"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none ${
                        errors.name
                          ? "border-red-400 bg-red-50/20 focus:border-red-500"
                          : "border-stone-200 focus:border-[#0F3D2E]"
                      }`}
                    />
                    {errors.name && (
                      <p className="text-[11px] text-red-600 mt-1">
                        {errors.name}
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      মোবাইল নম্বর <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="017XXXXXXXX"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none ${
                        errors.phone
                          ? "border-red-400 bg-red-50/20 focus:border-red-500"
                          : "border-stone-200 focus:border-[#0F3D2E]"
                      }`}
                    />
                    {errors.phone && (
                      <p className="text-[11px] text-red-600 mt-1">
                        {errors.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      ইমেইল ঠিকানা <span className="text-stone-400 font-normal">(ঐচ্ছিক)</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="name@example.com"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none ${
                        errors.email
                          ? "border-red-400 bg-red-50/20 focus:border-red-500"
                          : "border-stone-200 focus:border-[#0F3D2E]"
                      }`}
                    />
                    {errors.email && (
                      <p className="text-[11px] text-red-600 mt-1">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Subject Dropdown */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      বার্তার বিষয় <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm transition focus:outline-none focus:border-[#0F3D2E]"
                    >
                      {SUBJECT_OPTIONS.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    বিস্তারিত বার্তা বা জিজ্ঞাসা <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="আপনার প্রশ্ন বা প্রয়োজনীয় তথ্য বিস্তারিত লিখুন..."
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none resize-none ${
                      errors.message
                        ? "border-red-400 bg-red-50/20 focus:border-red-500"
                        : "border-stone-200 focus:border-[#0F3D2E]"
                    }`}
                  />
                  {errors.message && (
                    <p className="text-[11px] text-red-600 mt-1">
                      {errors.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-7 py-3 bg-[#0F3D2E] hover:bg-emerald-950 text-white font-bold rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-sm disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSubmitting ? "বার্তা পাঠানো হচ্ছে..." : "বার্তা পাঠান"}
                  </span>
                </button>
              </form>
            )}
          </div>

          {/* Right Trust & Direct Assurance Column */}
          <div className="lg:col-span-5 space-y-5">
            {/* Direct WhatsApp Callout Banner */}
            <div className="bg-gradient-to-br from-emerald-900 to-[#0F3D2E] text-white p-6 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="relative z-10">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  দ্রুত যোগাযোগ
                </span>
                <h3 className="text-lg font-bold font-serif mt-1">
                  জরুরি অর্ডার বা তাজা মাছের ছবি দেখতে চান?
                </h3>
                <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                  হোয়াটসঅ্যাপে আমাদের সাথে যোগাযোগ করলে আজকের নদীর শিকার করা মাছের
                  লাইভ ছবি ও ওজন সরাসরি দেখে কনফার্ম করতে পারবেন।
                </p>
                <a
                  href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
                    "আসসালামু আলাইকুম সাধ্যের বাজার, আজকের নদীর তাজা মাছ সম্পর্কে জানতে চাচ্ছি।"
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-stone-900 font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>হোয়াটসঅ্যাপে সরাসরি চ্যাট করুন</span>
                </a>
              </div>
            </div>

            {/* Business Commitment Highlights */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200/80">
              <h3 className="font-bold text-stone-900 text-sm mb-3">
                সাধ্যের বাজার প্রতিশ্রুতি
              </h3>
              <ul className="space-y-3 text-xs text-stone-600">
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>শতভাগ রাসায়নিকমুক্ত:</strong> কোনো ফরমালিন বা কৃত্রিম
                    প্রিজারভেটিভ স্পর্শ করে না।
                  </span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>সঠিক ওজন গ্যারান্টি:</strong> কাটার আগে ও পরে ডিজিটাল
                    স্কেলে মেপে সুনির্দিষ্ট স্লিপ প্রদান।
                  </span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>পছন্দমতো মাছ কাটিং:</strong> গোটা, চাকা বা ঝোল পিস—আপনার
                    রুচিমতো নিখুঁতভাবে কেটে দেওয়া হয়।
                  </span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>সহজ রিফান্ড নীতি:</strong> মান বা সতেজতায় কোনো ত্রুটি
                    পেলে তাৎক্ষণিক পণ্য পরিবর্তন বা রিফান্ড।
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200/80">
          <div className="text-center max-w-2xl mx-auto mb-6">
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0F3D2E] bg-emerald-50 px-3 py-1 rounded-full mb-2">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>সহায়িকা</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
              সচরাচর জিজ্ঞাসিত প্রশ্নাবলী (FAQ)
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              আমাদের ডেলিভারি, মান নিয়ন্ত্রণ ও সোর্সিং পদ্ধতি সম্পর্কে সাধারণ প্রশ্নগুলোর উত্তর
            </p>
          </div>

          <div className="max-w-3xl mx-auto divide-y divide-stone-100">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="py-3.5">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between text-left text-sm font-bold text-stone-800 hover:text-[#0F3D2E] transition focus:outline-none"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-stone-400 transition-transform ${
                        isOpen ? "transform rotate-180 text-[#0F3D2E]" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed animate-fade-in pr-6">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
