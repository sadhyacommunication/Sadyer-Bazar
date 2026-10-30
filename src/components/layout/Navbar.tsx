"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  ShoppingBag,
  PhoneCall,
  Truck,
  Flame,
  ShieldCheck,
  PackageSearch,
  Menu,
  X,
  Leaf,
  ArrowRight,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    cartCount,
    cartSubtotal,
    setIsCartOpen,
    settings,
    products,
    toastMessage,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hide storefront navbar inside Admin routes
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const searchResults =
    searchQuery.trim().length > 1
      ? products
          .filter((p) => {
            if (!p.isActive) return false;
            const q = searchQuery.toLowerCase();
            return (
              p.title.toLowerCase().includes(q) ||
              p.titleBn.toLowerCase().includes(q) ||
              p.categoryName.toLowerCase().includes(q) ||
              p.searchKeywords.some((k) => k.toLowerCase().includes(q))
            );
          })
          .slice(0, 5)
      : [];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchFocused(false);
    router.push(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <>
      {/* Top Announcement & Live Delivery Rate Bar */}
      <div className="bg-[#0F3D2E] text-emerald-50 text-xs sm:text-sm border-b border-emerald-800/60 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C83E2B] text-white text-[11px] font-semibold tracking-wide uppercase">
              <Flame className="w-3 h-3 fill-current" /> Live Batch
            </span>
            <span className="truncate max-w-[260px] sm:max-w-none">
              {settings.announcementEn}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-5 text-xs text-emerald-100/90">
            <span className="inline-flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              Inside Dhaka:{" "}
              <strong className="text-white">৳{settings.insideDhakaFee}</strong>{" "}
              | Outside Dhaka:{" "}
              <strong className="text-white">
                ৳{settings.outsideDhakaFee}
              </strong>
            </span>
            <a
              href={`tel:${settings.supportPhone.split("-")[0]}`}
              className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-semibold transition"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Hotline: {settings.supportPhone}
            </a>
          </div>
        </div>
      </div>

      {/* Main Sticky Glass Header */}
      <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-stone-200/80 shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3 sm:gap-4">
          {/* Brand Logo (Matches the exact সাধ্যের বাজার circular logo identity) */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white border-2 border-[#0F3D2E] shadow-xs flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform">
              <Leaf className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 -mb-0.5" />
              <span className="text-[9px] sm:text-[11px] font-extrabold text-[#0F3D2E] leading-none tracking-tight">
                সাধ্যের
              </span>
              <span className="text-[8px] sm:text-[10px] font-bold text-[#C83E2B] leading-tight">
                বাজার
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="text-lg sm:text-2xl font-extrabold tracking-tight text-[#0F3D2E]">
                  Sadhyer
                </span>
                <span className="text-lg sm:text-2xl font-extrabold tracking-tight text-[#C83E2B]">
                  Bazar
                </span>
              </div>
              <p className="text-[9px] xs:text-[10px] sm:text-[11px] text-stone-500 font-medium tracking-tight sm:tracking-wide leading-none">
                Village Freshness in the City, at Your Home
              </p>
            </div>
          </Link>

          {/* Bilingual Instant Search Bar */}
          {/* Bilingual Instant Search Bar */}
          <div className="hidden md:block relative flex-1 max-w-sm lg:max-w-md mx-3 lg:mx-6">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search Jamuna fish, Gawa Ghee, গাওয়া ঘি, বগুড়ার দই..."
                className="w-full pl-10 pr-20 py-2.5 bg-white border border-stone-200/90 rounded-full text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-[#0F3D2E] focus:ring-2 focus:ring-[#0F3D2E]/10 transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-full bg-[#0F3D2E] text-white text-xs font-semibold hover:bg-[#165b44] transition"
                >
                  Search
                </button>
              )}
            </form>

            {/* Instant Live Dropdown Results */}
            {searchFocused && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-stone-200/80 overflow-hidden z-50">
                <div className="px-3.5 py-2 bg-stone-50 border-b border-stone-100 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Matching Organic Products
                </div>
                <div className="divide-y divide-stone-100">
                  {searchResults.map((item) => (
                    <Link
                      key={item.id}
                      href={`/product/${item.slug}`}
                      className="flex items-center gap-3 p-3 hover:bg-emerald-50/50 transition"
                    >
                      <img
                        src={item.primaryImage}
                        alt={item.title}
                        className="w-12 h-12 rounded-lg object-contain bg-stone-950 p-0.5 border border-stone-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-emerald-800 truncate">
                          {item.titleBn}
                        </p>
                        <p className="text-sm font-semibold text-stone-900 truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-stone-500">
                          From{" "}
                          <span className="font-bold text-[#0F3D2E]">
                            ৳{item.variants[0]?.price}
                          </span>
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-stone-400 shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Primary Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 lg:gap-2 shrink-0">
            <Link
              href="/"
              className={`px-3.5 py-2 rounded-full text-sm font-semibold transition ${
                pathname === "/"
                  ? "bg-[#0F3D2E] text-white shadow-xs"
                  : "text-stone-700 hover:text-stone-900 hover:bg-stone-200/60"
              }`}
            >
              Home
            </Link>
            <Link
              href="/shop"
              className={`px-3.5 py-2 rounded-full text-sm font-semibold transition ${
                pathname === "/shop"
                  ? "bg-[#0F3D2E] text-white shadow-xs"
                  : "text-stone-700 hover:text-stone-900 hover:bg-stone-200/60"
              }`}
            >
              All Products
            </Link>
            <Link
              href="/pre-orders"
              className={`px-3.5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 transition ${
                pathname === "/pre-orders"
                  ? "bg-[#C83E2B] text-white shadow-xs"
                  : "text-[#C83E2B] bg-red-50 hover:bg-red-100/80 border border-red-200/50"
              }`}
            >
              <Flame className="w-3.5 h-3.5 fill-current" />
              Pre-Order Catch
            </Link>
            <Link
              href="/track-order"
              className={`px-3.5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 transition ${
                pathname === "/track-order"
                  ? "bg-[#0F3D2E] text-white shadow-xs"
                  : "text-stone-700 hover:text-stone-900 hover:bg-stone-200/60"
              }`}
            >
              <PackageSearch className="w-4 h-4 text-emerald-700" />
              Track Order
            </Link>
          </nav>

          {/* Right Actions: Slide Cart Button & Mobile Menu Trigger */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative inline-flex items-center gap-2.5 pl-3.5 pr-4 py-2.5 rounded-full bg-[#0F3D2E] hover:bg-[#165b44] text-white text-sm font-semibold shadow-sm transition cursor-pointer"
              aria-label="Open shopping basket"
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[#C83E2B] text-white text-[10px] font-bold flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline">
                {cartCount > 0 ? `৳${cartSubtotal.toLocaleString()}` : "Basket"}
              </span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu & Search Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-stone-200 px-4 pt-3 pb-5 space-y-3">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Jamuna fish, Gawa Ghee, বগুড়ার দই..."
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm"
              />
            </form>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl bg-stone-50 text-stone-800 font-semibold text-sm"
              >
                Home
              </Link>
              <Link
                href="/shop"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl bg-stone-50 text-stone-800 font-semibold text-sm"
              >
                All Products
              </Link>
              <Link
                href="/pre-orders"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl bg-red-50 text-[#C83E2B] font-semibold text-sm flex items-center gap-1.5"
              >
                <Flame className="w-4 h-4" /> Pre-Order Catch
              </Link>
              <Link
                href="/track-order"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-50 text-[#0F3D2E] font-semibold text-sm flex items-center gap-1.5"
              >
                <PackageSearch className="w-4 h-4" /> Track Order
              </Link>
              <a
                href={`tel:${settings.supportPhone.split("-")[0]}`}
                className="col-span-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 text-[#0F3D2E] font-semibold text-sm flex items-center justify-center gap-2 border border-emerald-200"
              >
                <PhoneCall className="w-4 h-4 text-emerald-700" />
                হটলাইন: {settings.supportPhone}
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-[#0F3D2E] text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-700 flex items-center gap-3 animate-bounce no-print">
          <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-xs sm:text-sm font-medium">{toastMessage}</p>
        </div>
      )}
    </>
  );
}
