"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, Flame, CheckCircle2 } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import ProductCard from "@/components/storefront/ProductCard";

function ShopContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "all";
  const initialQuery = searchParams.get("q") || "";

  const { products, categories } = useStore();
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [availabilityFilter, setAvailabilityFilter] = useState<
    "all" | "preorder" | "instock"
  >("all");
  const [sortBy, setSortBy] = useState<"featured" | "price-asc" | "price-desc">(
    "featured"
  );

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (!p.isActive) return false;
        if (selectedCategory !== "all" && p.categorySlug !== selectedCategory) {
          return false;
        }
        if (availabilityFilter === "preorder" && !p.isPreorder) return false;
        if (availabilityFilter === "instock" && p.isPreorder) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = p.title.toLowerCase().includes(q);
          const matchBn = p.titleBn.toLowerCase().includes(q);
          const matchCat = p.categoryName.toLowerCase().includes(q);
          const matchKeywords = p.searchKeywords.some((k) =>
            k.toLowerCase().includes(q)
          );
          return matchTitle || matchBn || matchCat || matchKeywords;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = a.variants[0]?.price || 0;
        const priceB = b.variants[0]?.price || 0;
        if (sortBy === "price-asc") return priceA - priceB;
        if (sortBy === "price-desc") return priceB - priceA;
        return Number(b.isFeatured) - Number(a.isFeatured);
      });
  }, [products, selectedCategory, availabilityFilter, searchQuery, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="bg-[#0F3D2E] text-white rounded-3xl p-7 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-widest text-amber-300">
            সাধ্যের বাজার • Complete Organic Store
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold">
            Fresh River Fish, Pure Ghee & Organic Staples
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/85 max-w-2xl">
            Browse our full collection of chemical-free Jamuna River fish,
            Sirajganj Gawa Ghee, Bogura Shahi Doi, village Deshi poultry, eggs,
            and unpolished red rice.
          </p>
        </div>

        {/* Search Input */}
        <div className="w-full md:w-80 relative shrink-0">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in English or বাংলা..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white text-stone-900 text-sm focus:outline-none"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 flex flex-wrap items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === "all"
                ? "bg-[#0F3D2E] text-white"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.slug
                  ? "bg-[#0F3D2E] text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {cat.name} ({cat.nameBn})
            </button>
          ))}
        </div>

        {/* Availability & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-xl bg-stone-100 p-1 text-xs font-bold">
            <button
              onClick={() => setAvailabilityFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                availabilityFilter === "all"
                  ? "bg-white text-stone-900 shadow-2xs"
                  : "text-stone-600"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setAvailabilityFilter("preorder")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                availabilityFilter === "preorder"
                  ? "bg-[#C83E2B] text-white shadow-2xs"
                  : "text-stone-600"
              }`}
            >
              <Flame className="w-3 h-3 fill-current" /> Pre-Order
            </button>
            <button
              onClick={() => setAvailabilityFilter("instock")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                availabilityFilter === "instock"
                  ? "bg-[#0F3D2E] text-white shadow-2xs"
                  : "text-stone-600"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" /> Ready Stock
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500" />
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as "featured" | "price-asc" | "price-desc"
                )
              }
              className="bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 font-semibold text-stone-800 focus:outline-none"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-3">
          <h3 className="text-lg font-bold text-stone-800">
            No matching products found
          </h3>
          <p className="text-xs text-stone-500">
            Try clearing your search filter or switching categories.
          </p>
          <button
            onClick={() => {
              setSelectedCategory("all");
              setAvailabilityFilter("all");
              setSearchQuery("");
            }}
            className="px-5 py-2.5 rounded-xl bg-[#0F3D2E] text-white text-xs font-bold cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-stone-500">
          Loading Sadyer Bazar Catalog...
        </div>
      }
    >
      <ShopContent />
    </Suspense>
  );
}
