"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Compass, ShoppingBag } from "lucide-react";
import ProductDetailClient from "./product/[slug]/ProductDetailClient";

export default function NotFoundPage() {
  const pathname = usePathname();
  const [dynamicProductSlug, setDynamicProductSlug] = useState<string | null>(
    null
  );

  useEffect(() => {
    const currentPath =
      pathname ||
      (typeof window !== "undefined" ? window.location.pathname : "");
    if (currentPath.startsWith("/product/")) {
      const extracted = decodeURIComponent(
        currentPath.replace(/^\/product\//, "").replace(/\/$/, "")
      );
      if (extracted) {
        setDynamicProductSlug(extracted);
      }
    }
  }, [pathname]);

  // If this is a dynamically added Supabase product route (/product/<new-slug>), render it seamlessly!
  if (dynamicProductSlug) {
    return <ProductDetailClient slug={dynamicProductSlug} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-[#0F3D2E] flex items-center justify-center mx-auto shadow-xs">
        <Compass className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <span className="text-xs font-extrabold uppercase tracking-widest text-[#C83E2B]">
          সাধ্যের বাজার • Page Not Found
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900">
          We Couldn&apos;t Find That Page
        </h1>
        <p className="text-sm text-stone-600 max-w-md mx-auto">
          The page or item you are looking for may have been moved. Explore our
          fresh Jamuna River fish, Sirajganj Gawa Ghee, and Bogura Shahi Doi
          below.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#0F3D2E] hover:bg-[#165b44] text-white text-xs sm:text-sm font-bold transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#C83E2B] hover:bg-[#b03221] text-white text-xs sm:text-sm font-bold transition"
        >
          <ShoppingBag className="w-4 h-4" /> Browse All Organic Products
        </Link>
      </div>
    </div>
  );
}
