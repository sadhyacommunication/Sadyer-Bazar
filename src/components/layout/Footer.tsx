"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PhoneCall,
  MapPin,
  ShieldCheck,
  Truck,
  Leaf,
  Clock,
  MessageCircle,
  Lock,
  ShoppingBag,
  ArrowRight,
  Banknote,
  Home,
  Store,
  Flame,
  PackageSearch,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";

export default function Footer() {
  const pathname = usePathname();
  const { settings, cartCount, cartSubtotal, setIsCartOpen } = useStore();

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      <footer className="bg-[#0F3D2E] text-emerald-50 border-t border-emerald-900 no-print">
        {/* Top Trust Guarantee Bar */}
        <div className="border-b border-emerald-800/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-800/80 text-amber-300 flex items-center justify-center shrink-0">
                <Leaf className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  100% Chemical & Formalin Free
                </h3>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  Direct from Jamuna River fishermen & rural organic homesteads.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-800/80 text-amber-300 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Nationwide Insulated Delivery
                </h3>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  Inside Dhaka ৳{settings.insideDhakaFee} • Outside Dhaka ৳
                  {settings.outsideDhakaFee} home delivery.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-800/80 text-amber-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Automated bKash & SSLCommerz
                </h3>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  Pay full, pre-order advance, or Cash on Home Delivery.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-800/80 text-amber-300 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Real-Time Order ID Tracking
                </h3>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  Track your catch & delivery status anytime with your Order ID.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white flex flex-col items-center justify-center">
                <span className="text-[10px] font-extrabold text-[#0F3D2E] leading-none">
                  সাধ্যের
                </span>
                <span className="text-[9px] font-bold text-[#C83E2B] leading-tight">
                  বাজার
                </span>
              </div>
              <div>
                <span className="text-xl font-extrabold text-white">
                  Sadyer Bazar
                </span>
                <p className="text-xs text-emerald-300">
                  সাধ্যের বাজার — খাঁটি অর্গানিক পণ্য
                </p>
              </div>
            </div>
            <p className="text-xs text-emerald-100/80 leading-relaxed">
              Bringing you freshly caught Jamuna River fish, Sirajganj pure Gawa
              Ghee, authentic Bogura Shahi Doi, village Deshi chicken, eggs, and
              full-fiber red rice across Bangladesh.
            </p>
            <div className="pt-1 space-y-1.5 text-xs text-emerald-200">
              <p className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-amber-400" />
                Hotline: <strong>{settings.supportPhone}</strong>
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                Sourcing Hub: Sirajganj, Bogura & Dhaka Dispatch Center
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Fresh Categories
            </h4>
            <ul className="space-y-2.5 text-xs text-emerald-100/85">
              <li>
                <Link
                  href="/shop?category=jamuna-river-fish"
                  className="hover:text-amber-300 transition"
                >
                  Jamuna River Fish (যমুনা নদীর মাছ)
                </Link>
              </li>
              <li>
                <Link
                  href="/shop?category=ghee-and-dairy"
                  className="hover:text-amber-300 transition"
                >
                  Pure Gawa Ghee & Bogura Doi (ঘি ও দই)
                </Link>
              </li>
              <li>
                <Link
                  href="/shop?category=deshi-meat-poultry"
                  className="hover:text-amber-300 transition"
                >
                  Village Deshi Chicken (দেশি মুরগি)
                </Link>
              </li>
              <li>
                <Link
                  href="/shop?category=farm-fresh-eggs"
                  className="hover:text-amber-300 transition"
                >
                  Deshi Chicken Eggs (দেশি মুরগির ডিম)
                </Link>
              </li>
              <li>
                <Link
                  href="/shop?category=organic-rice-honey"
                  className="hover:text-amber-300 transition"
                >
                  Full-Fiber Red Rice & Honey (লাল চাল ও মধু)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Care & Quick Services */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Customer Care
            </h4>
            <ul className="space-y-2.5 text-xs text-emerald-100/85">
              <li>
                <Link
                  href="/track-order"
                  className="hover:text-amber-300 transition font-semibold text-amber-200"
                >
                  Track Your Order by ID (অর্ডার ট্র্যাকিং)
                </Link>
              </li>
              <li>
                <Link
                  href="/pre-orders"
                  className="hover:text-amber-300 transition"
                >
                  Live Pre-Order Schedule (প্রি-অর্ডার)
                </Link>
              </li>
              <li>
                <Link
                  href="/shop"
                  className="hover:text-amber-300 transition"
                >
                  All Fresh Groceries (সব পণ্য ক্যাটালগ)
                </Link>
              </li>
              <li>
                <Link
                  href="/checkout"
                  className="hover:text-amber-300 transition"
                >
                  1-Click Express Checkout (দ্রুত চেকআউট)
                </Link>
              </li>
              <li>
                <Link
                  href="/admin"
                  className="hover:text-amber-300 transition text-emerald-300/70 hover:text-emerald-200"
                >
                  Merchant Management Portal (অ্যাডমিন)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Company & Policies (Replaces square redmark section) */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Company & Policies
            </h4>
            <ul className="space-y-2.5 text-xs text-emerald-100/85">
              <li>
                <Link
                  href="/about"
                  className="hover:text-amber-300 transition"
                >
                  About Our Story (আমাদের গল্প ও পরিচয়)
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-amber-300 transition"
                >
                  Contact & Support (যোগাযোগ ও সহায়তা)
                </Link>
              </li>
              <li>
                <Link
                  href="/terms-and-conditions"
                  className="hover:text-amber-300 transition"
                >
                  Terms & Conditions (শর্তাবলী)
                </Link>
              </li>
              <li>
                <Link
                  href="/refund-policy"
                  className="hover:text-amber-300 transition"
                >
                  Refund & Return Policy (রিফান্ড নীতি)
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className="hover:text-amber-300 transition"
                >
                  Privacy Policy (গোপনীয়তা নীতি)
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Payment Partners & Security Showcase in Blank Redmark Area */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <div className="pt-8 border-t border-emerald-800/60 flex flex-col lg:flex-row items-center justify-between gap-5">
            {/* Left Security Note */}
            <div className="flex items-center gap-3.5 text-center sm:text-left">
              <div className="w-10 h-10 rounded-2xl bg-emerald-800/80 border border-emerald-700/60 text-amber-300 flex items-center justify-center shrink-0 shadow-xs">
                <Lock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wider">
                  100% Secured Payment Gateways
                </p>
                <p className="text-[11px] text-emerald-200/80 mt-0.5">
                  নিরাপদ ও সহজ পেমেন্ট — বিকাশ, নগদ, ভিসা কার্ড, মাস্টারকার্ড ও ক্যাশ অন ডেলিভারি
                </p>
              </div>
            </div>

            {/* Payment Method Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              {/* bKash */}
              <div
                className="h-9 px-3 bg-white rounded-xl shadow-xs border border-white/20 flex items-center gap-1.5 select-none hover:scale-105 hover:shadow-md transition-all cursor-default"
                title="bKash (বিকাশ) Payment"
              >
                <svg
                  viewBox="0 0 45 40"
                  className="h-5 w-auto shrink-0"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="bKash"
                >
                  <path d="M21.5 2L35 15.5L21.5 29L21.5 2Z" fill="#D12053" />
                  <path d="M21.5 2L8 15.5L21.5 29L21.5 2Z" fill="#E2136E" />
                  <path d="M21.5 29L35 15.5L28 37L21.5 29Z" fill="#9E0836" />
                  <path d="M21.5 29L8 15.5L15 37L21.5 29Z" fill="#C4164B" />
                  <path d="M35 15.5L43 12.5L38 19L35 15.5Z" fill="#E2136E" />
                </svg>
                <span className="text-[#D12053] font-black text-xs tracking-tight">
                  bKash
                </span>
              </div>

              {/* Nagad */}
              <div
                className="h-9 px-3 bg-white rounded-xl shadow-xs border border-white/20 flex items-center gap-1.5 select-none hover:scale-105 hover:shadow-md transition-all cursor-default"
                title="Nagad (নগদ) Payment"
              >
                <svg
                  viewBox="0 0 36 32"
                  className="h-5 w-auto shrink-0"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="Nagad"
                >
                  <path
                    d="M18 2C11 2 5.5 7.5 5.5 14C5.5 21.5 13 27.5 18 30C23 27.5 30.5 21.5 30.5 14C30.5 7.5 25 2 18 2Z"
                    fill="url(#nagad-grad-footer)"
                  />
                  <path
                    d="M18 8C14.5 8 11.8 10.7 11.8 14C11.8 18.5 18 23.5 18 23.5C18 23.5 24.2 18.5 24.2 14C24.2 10.7 21.5 8 18 8Z"
                    fill="#FFFFFF"
                  />
                  <circle cx="18" cy="14" r="3.8" fill="#ED1C24" />
                  <defs>
                    <linearGradient
                      id="nagad-grad-footer"
                      x1="5"
                      y1="2"
                      x2="30"
                      y2="30"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#F7931E" />
                      <stop offset="1" stopColor="#ED1C24" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="text-[#ED1C24] font-black text-xs tracking-tight">
                  nagad
                </span>
              </div>

              {/* Visa Card */}
              <div
                className="h-9 px-3.5 bg-white rounded-xl shadow-xs border border-white/20 flex items-center justify-center select-none hover:scale-105 hover:shadow-md transition-all cursor-default"
                title="Visa Card Payment"
              >
                <svg
                  viewBox="0 0 54 18"
                  className="h-4 w-auto shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="Visa"
                >
                  <path
                    d="M21.2 1.2L14.2 16.8H9.9L6.1 3.7C5.8 2.7 5.6 2.3 4.8 1.9C3.4 1.2 1.6 0.6 0 0.3L0.2 0H7.7C8.7 0 9.7 0.7 9.9 1.8L11.8 11.2L16.1 1.2H21.2ZM39.8 10.8C39.8 6.7 34.2 6.4 34.2 4.6C34.2 4 34.8 3.3 36.1 3.1C36.8 3 38.6 2.9 40.4 3.8L41.2 0.7C40.1 0.3 38.7 0 37 0C32.4 0 29.2 2.4 29.2 5.9C29.2 11 36.2 11.3 36.2 13.4C36.2 14.1 35.5 14.8 34.1 14.8C32.4 14.8 30.6 14.3 29.3 13.6L28.5 16.9C30 17.6 32.3 18 34.6 18C39.4 18 42.6 15.6 42.6 12L39.8 10.8ZM51.8 16.8H56.5L52.4 1.2H48.1C47.2 1.2 46.4 1.7 46.1 2.6L39.4 16.8H43.9L44.8 14.3H51.2L51.8 16.8ZM46.1 11L48.8 3.6L50.4 11H46.1ZM28.2 1.2L24.6 16.8H20.4L24 1.2H28.2Z"
                    fill="#1A1F71"
                  />
                  <path
                    d="M7.7 0H0.2L0 0.3C3 1.1 5.9 2.2 7.7 4.5L9.9 1.8C9.7 0.7 8.7 0 7.7 0Z"
                    fill="#F7B600"
                  />
                </svg>
              </div>

              {/* Mastercard */}
              <div
                className="h-9 px-3 bg-white rounded-xl shadow-xs border border-white/20 flex items-center gap-1.5 select-none hover:scale-105 hover:shadow-md transition-all cursor-default"
                title="Mastercard Payment"
              >
                <svg
                  viewBox="0 0 36 22"
                  className="h-4.5 w-auto shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="Mastercard"
                >
                  <circle cx="11" cy="11" r="9" fill="#EB001B" />
                  <circle cx="25" cy="11" r="9" fill="#F79E1B" />
                  <path
                    d="M18 4.2C20.2 5.9 21.6 8.8 21.6 11C21.6 13.2 20.2 16.1 18 17.8C15.8 16.1 14.4 13.2 14.4 11C14.4 8.8 15.8 5.9 18 4.2Z"
                    fill="#FF5F00"
                  />
                </svg>
                <span className="text-stone-900 font-bold text-[11px] tracking-tight">
                  mastercard
                </span>
              </div>

              {/* Cash on Delivery */}
              <div
                className="h-9 px-3 bg-white rounded-xl shadow-xs border border-emerald-600/30 flex items-center gap-2 select-none hover:scale-105 hover:shadow-md transition-all cursor-default"
                title="Cash on Delivery (ক্যাশ অন ডেলিভারি)"
              >
                <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Banknote className="w-3.5 h-3.5 text-emerald-700" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-stone-900 font-extrabold text-[11px] leading-tight">
                    Cash on Delivery
                  </span>
                  <span className="text-emerald-700 font-semibold text-[9px] leading-none">
                    ক্যাশ অন ডেলিভারি
                  </span>
                </div>
              </div>

              {/* SSLCommerz Gateway */}
              <div
                className="h-9 px-3 bg-white rounded-xl shadow-xs border border-white/20 flex items-center gap-1.5 select-none hover:scale-105 hover:shadow-md transition-all cursor-default"
                title="SSLCommerz Verified Payment Gateway"
              >
                <div className="w-5 h-5 rounded-full bg-[#1A4B8C] text-white flex items-center justify-center font-extrabold text-[9px] shrink-0">
                  SSL
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[#1A4B8C] font-black text-[11px] tracking-tight leading-tight">
                    SSLCommerz
                  </span>
                  <span className="text-stone-500 font-semibold text-[8px] leading-none uppercase">
                    Verified Gateway
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Minimal Copyright Bar */}
        <div className="border-t border-emerald-900/90 bg-emerald-950/70 py-5 px-4 pb-28 sm:pb-5 text-center text-xs text-emerald-300/70">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3 px-4">
            <span className="text-center lg:text-left lg:pl-48">
              © {new Date().getFullYear()} Sadyer Bazar (সাধ্যের বাজার). All rights reserved.
            </span>
            <div className="text-xs text-emerald-300/90">
              developed by{" "}
              <a
                href="https://abuhanifmia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-300 hover:text-white font-semibold transition hover:underline underline-offset-4"
              >
                &quot;Abu Hanif&quot;
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-emerald-200/80">
              <Link
                href="/about"
                className="hover:text-white transition"
              >
                About Us
              </Link>
              <span>•</span>
              <Link
                href="/contact"
                className="hover:text-white transition"
              >
                Contact
              </Link>
              <span>•</span>
              <Link
                href="/terms-and-conditions"
                className="hover:text-white transition"
              >
                Terms & Conditions
              </Link>
              <span>•</span>
              <Link
                href="/refund-policy"
                className="hover:text-white transition"
              >
                Refund Policy
              </Link>
              <span>•</span>
              <Link
                href="/privacy-policy"
                className="hover:text-white transition"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp & Direct Call Quick Pill */}
      <a
        href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
          "Hello Sadyer Bazar! I would like to pre-order fresh products."
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`fixed left-4 z-40 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xl border border-white/20 transition-all duration-200 hover:scale-105 no-print ${
          pathname !== "/checkout"
            ? "bottom-20 sm:bottom-4"
            : "bottom-4"
        }`}
        title="Chat with Sadyer Bazar on WhatsApp"
      >
        <MessageCircle className="w-4 h-4 fill-current shrink-0" />
        <span className="tabular-nums">{settings.supportPhone}</span>
      </a>

      {/* Mobile Sticky Bottom Thumb Navigation Dock (When Cart is Empty & not on checkout or PDP) */}
      {cartCount === 0 &&
        pathname !== "/checkout" &&
        !pathname?.startsWith("/product") && (
          <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-white/95 backdrop-blur-md border-t border-stone-200/90 px-2 py-1.5 shadow-2xl flex items-center justify-around no-print">
            <Link
              href="/"
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${
                pathname === "/"
                  ? "text-[#0F3D2E] font-bold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px]">হোম</span>
            </Link>

            <Link
              href="/shop"
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${
                pathname === "/shop"
                  ? "text-[#0F3D2E] font-bold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <Store className="w-5 h-5" />
              <span className="text-[10px]">সব পণ্য</span>
            </Link>

            <Link
              href="/pre-orders"
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${
                pathname === "/pre-orders"
                  ? "text-[#C83E2B] font-bold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <Flame className="w-5 h-5 text-[#C83E2B]" />
              <span className="text-[10px]">প্রি-অর্ডার</span>
            </Link>

            <Link
              href="/track-order"
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${
                pathname === "/track-order"
                  ? "text-[#0F3D2E] font-bold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <PackageSearch className="w-5 h-5" />
              <span className="text-[10px]">ট্র্যাকিং</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-stone-500 hover:text-stone-800 cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="text-[10px]">ব্যাগ</span>
            </button>
          </div>
        )}

      {/* Mobile Sticky Bottom Basket & Express 1-Click Checkout Ribbon (When Cart Has Items) */}
      {cartCount > 0 && pathname !== "/checkout" && (
        <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-[#0F3D2E] text-white border-t border-emerald-700/80 px-4 py-2.5 shadow-2xl flex items-center justify-between gap-3 no-print">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <div className="relative w-9 h-9 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-extrabold">
              <ShoppingBag className="w-4 h-4" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#C83E2B] text-white text-[9px] font-extrabold flex items-center justify-center">
                {cartCount}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-200 block leading-none">
                Your Organic Basket
              </span>
              <strong className="text-sm font-extrabold text-white">
                ৳{cartSubtotal.toLocaleString()}
              </strong>
            </div>
          </button>

          <Link
            href="/checkout"
            className="px-3.5 py-2 rounded-xl bg-[#C83E2B] hover:bg-[#b03221] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-lg active:scale-95 transition"
          >
            <span>1-Click Checkout</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </>
  );
}
