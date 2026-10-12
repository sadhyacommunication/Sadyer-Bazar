"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Gift,
  Sparkles,
  Check,
  Plus,
  ShoppingBag,
  Zap,
  Tag,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";

export default function FamilyComboBuilder() {
  const router = useRouter();
  const { products, addToCart, showToast } = useStore();

  const activeProducts = products.filter((p) => p.isActive);
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "prod-jamuna-small-fish",
    "prod-gawa-ghee",
    "prod-bogura-shahi-doi",
  ]);

  const toggleProductSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedProducts = activeProducts.filter((p) =>
    selectedIds.includes(p.id)
  );

  const rawBundleTotal = selectedProducts.reduce(
    (sum, p) => sum + (p.variants[0]?.price || 0),
    0
  );

  const discountRate =
    selectedProducts.length >= 4 ? 0.08 : selectedProducts.length >= 3 ? 0.05 : 0;
  const bundleSavings = Math.round(rawBundleTotal * discountRate);
  const finalBundlePrice = rawBundleTotal - bundleSavings;

  const handleAddCustomBundle = (directCheckout: boolean) => {
    if (selectedProducts.length === 0) return;
    selectedProducts.forEach((prod, idx) => {
      const variant = prod.variants[0];
      if (variant) {
        addToCart(
          prod,
          variant,
          1,
          prod.cuttingOptions[0],
          !directCheckout && idx === selectedProducts.length - 1
        );
      }
    });
    try {
      sessionStorage.setItem("sb_auto_coupon", "FAMILYBOX8");
    } catch {}
    showToast(
      `Added ${selectedProducts.length}-Item Family Box! Use promo FAMILYBOX8 at checkout!`
    );
    if (directCheckout) {
      router.push("/checkout");
    }
  };

  const handleQuickCuratedCombo = (productIds: string[], comboName: string) => {
    const comboProds = activeProducts.filter((p) => productIds.includes(p.id));
    comboProds.forEach((prod, idx) => {
      if (prod.variants[0]) {
        addToCart(
          prod,
          prod.variants[0],
          1,
          prod.cuttingOptions[0],
          idx === comboProds.length - 1
        );
      }
    });
    try {
      sessionStorage.setItem("sb_auto_coupon", "FAMILYBOX8");
    } catch {}
    showToast(`${comboName} added with FAMILYBOX8 discount unlocked!`);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-gradient-to-br from-[#0F3D2E] via-[#124534] to-[#0a291f] text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-emerald-800/70 space-y-8">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-emerald-800/80 pb-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-stone-950 text-xs font-extrabold uppercase tracking-wider">
              <Gift className="w-3.5 h-3.5" /> সাপ্তাহিক পারিবারিক বাজার বক্স •
              Family Combo Builder
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold">
              Build Your Weekly Organic Family Box & Save Up to 8%
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/85 max-w-2xl">
              Combine any 3 or more pure essentials (Jamuna Fish, Gawa Ghee,
              Bogura Doi, Deshi Chicken, Red Rice) to unlock instant bundle
              savings with promo code{" "}
              <code className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono font-bold">
                FAMILYBOX8
              </code>
              .
            </p>
          </div>

          {/* Active Promo Pill */}
          <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-700 px-4 py-3 rounded-2xl shrink-0">
            <Tag className="w-4 h-4 text-amber-400" />
            <div className="text-xs">
              <span className="text-emerald-300 block">
                Active Promo Codes at Checkout:
              </span>
              <span className="font-mono font-bold text-white">
                SADYER100 • JAMUNA10 • FAMILYBOX8
              </span>
            </div>
          </div>
        </div>

        {/* 2 Ready-Made 1-Click Curated Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Most Popular Friday Box
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                Jamuna River & Ghee Royal Feast Box
              </h3>
              <p className="text-xs text-emerald-100/85">
                1kg Jamuna Small Fish + 1.5kg Wild Ayer Fish + 500g Pure Gawa
                Ghee
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleQuickCuratedCombo(
                  [
                    "prod-jamuna-small-fish",
                    "prod-jamuna-big-fish",
                    "prod-gawa-ghee",
                  ],
                  "Jamuna River Royal Feast Box"
                )
              }
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-extrabold shrink-0 transition cursor-pointer"
            >
              + Add Feast Box
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Healthy Family Staple Combo
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                Bogura Doi & Village Breakfast Box
              </h3>
              <p className="text-xs text-emerald-100/85">
                500g Bogura Shahi Doi + 2kg Red Rice + 12 Deshi Eggs + 500g Raw
                Honey
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleQuickCuratedCombo(
                  [
                    "prod-bogura-shahi-doi",
                    "prod-red-rice",
                    "prod-deshi-eggs",
                    "prod-sundarban-honey",
                  ],
                  "Bogura & Village Breakfast Box"
                )
              }
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-extrabold shrink-0 transition cursor-pointer"
            >
              + Add Breakfast Box
            </button>
          </div>
        </div>

        {/* Interactive Custom Box Item Picker */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Cols: Selectable Product Tiles */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {activeProducts.slice(0, 8).map((prod) => {
              const isSelected = selectedIds.includes(prod.id);
              const firstVar = prod.variants[0];
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => toggleProductSelection(prod.id)}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? "bg-white text-stone-900 border-2 border-amber-400 shadow-lg"
                      : "bg-emerald-950/60 text-white border-emerald-800/80 hover:bg-emerald-900/60"
                  }`}
                >
                  <div>
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-stone-950 p-1 mb-2">
                      <img
                        src={prod.primaryImage}
                        alt={prod.title}
                        className="w-full h-full object-contain rounded-lg block"
                      />
                      <span
                        className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isSelected
                            ? "bg-[#0F3D2E] text-white"
                            : "bg-black/60 text-white"
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] font-extrabold truncate ${
                        isSelected ? "text-[#C83E2B]" : "text-amber-300"
                      }`}
                    >
                      {prod.titleBn}
                    </p>
                    <p className="text-xs font-bold line-clamp-1">
                      {prod.title}
                    </p>
                  </div>

                  <div className="pt-2 mt-2 border-t border-current/10 flex items-center justify-between text-xs">
                    <span className="opacity-75 truncate">
                      {firstVar?.label.split(" ")[0]}
                    </span>
                    <strong className="font-extrabold">
                      ৳{firstVar?.price}
                    </strong>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right 4 Cols: Live Custom Box Summary */}
          <div className="lg:col-span-4 bg-white text-stone-900 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase text-[#0F3D2E]">
                  Your Custom Family Box
                </span>
                <h3 className="text-lg font-extrabold">
                  {selectedProducts.length} Organic Items Selected
                </h3>
              </div>
              {discountRate > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold">
                  {Math.round(discountRate * 100)}% OFF
                </span>
              )}
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto text-xs">
              {selectedProducts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1 border-b border-stone-100 last:border-b-0"
                >
                  <span className="font-semibold text-stone-800 truncate pr-2">
                    {item.titleBn} ({item.variants[0]?.label})
                  </span>
                  <span className="font-bold text-stone-900 shrink-0">
                    ৳{item.variants[0]?.price}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1 text-xs">
              <div className="flex justify-between text-stone-500">
                <span>Regular Price:</span>
                <span>৳{rawBundleTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Bundle Savings (FAMILYBOX8):</span>
                <span>- ৳{bundleSavings.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-stone-900 pt-1 border-t border-stone-200">
                <span>Box Total:</span>
                <span className="text-[#0F3D2E]">
                  ৳{finalBundlePrice.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleAddCustomBundle(false)}
                className="w-full py-3 px-4 rounded-xl bg-[#0F3D2E] hover:bg-[#165b44] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add Family Box to Basket</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddCustomBundle(true)}
                className="w-full py-3 px-4 rounded-xl bg-[#C83E2B] hover:bg-[#b03221] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>1-Click Order This Box Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
