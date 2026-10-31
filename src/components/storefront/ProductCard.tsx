"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Zap,
  Flame,
  Star,
  CheckCircle2,
} from "lucide-react";
import { Product } from "@/types";
import { useStore } from "@/context/StoreContext";

export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const { addToCart } = useStore();

  const defaultVariant =
    product.variants.find((v) => v.isDefault) || product.variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    defaultVariant?.id || ""
  );

  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) || defaultVariant;

  const bookedPercentage = Math.min(
    98,
    Math.round((product.batchBookedQty / Math.max(1, product.batchTargetQty)) * 100)
  );

  const remainingSlots = Math.max(
    1,
    product.batchTargetQty - product.batchBookedQty
  );

  const discountPercent =
    activeVariant?.compareAtPrice &&
    activeVariant.compareAtPrice > activeVariant.price
      ? Math.round(
          ((activeVariant.compareAtPrice - activeVariant.price) /
            activeVariant.compareAtPrice) *
            100
        )
      : 0;

  const handleOneClickOrder = () => {
    if (!activeVariant) return;
    addToCart(product, activeVariant, 1, undefined, false);
    router.push("/checkout");
  };

  return (
    <div className="group bg-white rounded-2xl sm:rounded-3xl border border-stone-200/90 shadow-2xs hover:shadow-lg hover:border-emerald-800/30 transition-all duration-300 flex flex-col justify-between overflow-hidden h-full">
      {/* 1. Square Bangla Poster Container with Integrated Overlays */}
      <div className="relative aspect-square overflow-hidden bg-stone-950 p-1 sm:p-1.5">
        <Link
          href={`/product/${product.slug}`}
          className="flex items-center justify-center w-full h-full rounded-xl sm:rounded-2xl overflow-hidden bg-stone-900"
        >
          <img
            src={product.primaryImage}
            alt={`${product.title} - ${product.titleBn}`}
            className="w-full h-full object-contain block group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </Link>

        {/* Top Badges: Pre-Order / Ready Stock & Save % */}
        <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 flex items-center gap-1.5 pointer-events-none z-10">
          {product.isPreorder ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full bg-[#C83E2B]/95 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-extrabold shadow-xs">
              <Flame className="w-2.5 h-2.5 fill-current text-amber-300" />
              <span>PRE-ORDER</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full bg-[#0F3D2E]/95 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-extrabold shadow-xs">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300" />
              <span>IN STOCK</span>
            </span>
          )}

          {discountPercent > 0 && (
            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[9px] sm:text-[10px] font-black shadow-xs">
              -{discountPercent}%
            </span>
          )}
        </div>

        {/* Bottom Image Overlay: Live Batch Cut-off & Capacity Progress */}
        {product.isPreorder && (
          <div className="absolute bottom-0 inset-x-0 bg-stone-950/85 backdrop-blur-xs px-2 sm:px-2.5 py-1 sm:py-1.5 border-t border-white/10 text-white z-10">
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold leading-tight">
              <span className="text-amber-300 truncate max-w-[65%]">
                {product.expectedDeliveryDate || "Next Catch"}
              </span>
              <span className="text-emerald-300 shrink-0">
                {remainingSlots} {product.unitType} left
              </span>
            </div>
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-[#C83E2B]"
                style={{ width: `${bookedPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Compact Product Body Content */}
      <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col justify-between gap-2">
        <div className="space-y-1 sm:space-y-1.5">
          {/* Row 1: Bangla Tag & Rating (Single Line) */}
          <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px]">
            <span className="font-extrabold text-[#C83E2B] truncate tracking-tight">
              {product.titleBn}
            </span>
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-600 shrink-0">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
              <span className="hidden sm:inline text-stone-400 font-normal">
                ({product.reviewCount})
              </span>
            </span>
          </div>

          {/* Row 2: English Title */}
          <Link
            href={`/product/${product.slug}`}
            className="text-xs sm:text-sm font-bold text-stone-900 hover:text-[#0F3D2E] line-clamp-1 leading-tight transition block"
            title={product.title}
          >
            {product.title}
          </Link>

          {/* Row 3: Weight / Variant Switcher (Single-line horizontal scroll) */}
          {product.variants.length > 0 && (
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap">
              {product.variants.map((variant) => {
                const active = variant.id === activeVariant?.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                      active
                        ? "bg-[#0F3D2E] text-white shadow-2xs"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200/80"
                    }`}
                  >
                    {variant.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Row 4: Combined Price & Dual Action Bar (Strictly Single Compact Row) */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1.5 mt-auto">
          {/* Price Stack */}
          <div className="min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-sm sm:text-base font-extrabold text-[#0F3D2E] leading-none">
                ৳{activeVariant?.price.toLocaleString()}
              </span>
              {activeVariant?.compareAtPrice && (
                <span className="text-[9px] sm:text-[10px] text-stone-400 line-through font-semibold leading-none">
                  ৳{activeVariant.compareAtPrice.toLocaleString()}
                </span>
              )}
            </div>
            <span className="text-[9px] sm:text-[10px] text-stone-400 font-medium truncate block leading-tight mt-0.5">
              {activeVariant?.label}
            </span>
          </div>

          {/* Action Group: Add to Bag + 1-Click Order */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => activeVariant && addToCart(product, activeVariant, 1)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 text-[#0F3D2E] hover:bg-[#0F3D2E] hover:text-white transition flex items-center justify-center cursor-pointer shadow-2xs"
              title="Add to Basket"
              aria-label="Add to Basket"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleOneClickOrder}
              className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg sm:rounded-xl bg-[#C83E2B] hover:bg-[#ad3221] text-white font-extrabold text-[10px] sm:text-[11px] shadow-2xs flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
              title={product.isPreorder ? "1-Click Pre-Order" : "1-Click Order"}
            >
              <Zap className="w-3 h-3 fill-current shrink-0" />
              <span>{product.isPreorder ? "Pre-Order" : "Order"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
