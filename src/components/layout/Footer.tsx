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
                  Track Your Order by ID
                </Link>
              </li>
              <li>
                <Link
                  href="/pre-orders"
                  className="hover:text-amber-300 transition"
                >
                  Live Pre-Order Schedule
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
                  href="/checkout"
                  className="hover:text-amber-300 transition"
                >
                  1-Click Express Checkout
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-amber-300 transition">
                  Merchant Management Portal
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Verified Payment & Security
            </h4>
            <p className="text-xs text-emerald-100/80 mb-3">
              256-Bit SSL Encrypted Checkout powered by automated bKash &
              SSLCommerz Gateway.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-pink-600 text-white text-xs font-extrabold">
                bKash AutoPay
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-extrabold">
                SSLCommerz
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-extrabold">
                Nagad / Rocket
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-800 border border-emerald-600 text-emerald-100 text-xs font-bold">
                Cash on Delivery
              </span>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/80 flex items-center gap-2 text-[11px] text-emerald-200">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              Protected by Supabase RLS & Cloudflare Edge WAF
            </div>
          </div>
        </div>

        <div className="border-t border-emerald-900/90 bg-emerald-950/60 py-5 text-center text-xs text-emerald-300/70">
          © {new Date().getFullYear()} Sadyer Bazar (সাধ্যের বাজার). Built with
          Next.js, TypeScript & Supabase for Cloudflare Pages.
        </div>
      </footer>

      {/* Floating WhatsApp & Direct Call Quick Pill */}
      <a
        href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
          "Hello Sadyer Bazar! I would like to pre-order fresh products."
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`fixed left-4 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xl border border-white/20 transition no-print ${
          cartCount > 0 && pathname !== "/checkout"
            ? "bottom-20 sm:bottom-5"
            : "bottom-5"
        }`}
      >
        <MessageCircle className="w-4 h-4 fill-current" />
        <span>WhatsApp: {settings.supportPhone}</span>
      </a>

      {/* Mobile Sticky Bottom Basket & Express 1-Click Checkout Ribbon */}
      {cartCount > 0 && pathname !== "/checkout" && (
        <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-[#0F3D2E] text-white border-t border-emerald-700/80 px-4 py-3 shadow-2xl flex items-center justify-between gap-3 no-print">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <div className="relative w-10 h-10 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-extrabold">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#C83E2B] text-white text-[10px] font-extrabold flex items-center justify-center">
                {cartCount}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-emerald-200 block leading-none">
                Your Organic Basket
              </span>
              <strong className="text-sm font-extrabold text-white">
                ৳{cartSubtotal.toLocaleString()}
              </strong>
            </div>
          </button>

          <Link
            href="/checkout"
            className="px-4 py-2.5 rounded-xl bg-[#C83E2B] hover:bg-[#b03221] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-lg"
          >
            <span>1-Click Checkout</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </>
  );
}
