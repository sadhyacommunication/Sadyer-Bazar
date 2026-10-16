"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Zap,
  Flame,
  Star,
  MapPin,
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
    <div className="group bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-xs hover:shadow-xl hover:border-emerald-800/30 transition-all duration-300 flex flex-col overflow-hidden">
      {/* Square Bangla Poster Container (Zero Border Cropping) */}
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

        {/* Top Left Status Badges */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1 sm:gap-1.5 pointer-events-none">
          {product.isPreorder ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[#C83E2B]/95 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-bold shadow-md">
              <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
              <span>PRE-ORDER</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[#0F3D2E]/95 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-bold shadow-md">
              <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>READY STOCK</span>
            </span>
          )}

          {discountPercent > 0 && (
            <span className="inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[9px] sm:text-[10px] font-extrabold shadow-xs w-fit">
              SAVE {discountPercent}%
            </span>
          )}
        </div>
      </div>

      {/* Product Content */}
      <div className="p-2.5 sm:p-5 flex-1 flex flex-col justify-between space-y-2 sm:space-y-4">
        <div className="space-y-1.5 sm:space-y-2.5">
          {/* Pre-Order Live Booking Bar (Cleanly Below Poster Image) */}
          {product.isPreorder && (
            <div className="bg-stone-950 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl border border-stone-800">
              <div className="flex items-center justify-between text-[9px] sm:text-[11px] font-semibold mb-0.5 sm:mb-1">
                <span className="text-amber-300 truncate max-w-[65%]">
                  {product.expectedDeliveryDate || "Next Catch"}
                </span>
                <span className="text-emerald-300 shrink-0">
                  {remainingSlots} {product.unitType} left
                </span>
              </div>
              <div className="w-full h-1 sm:h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-[#C83E2B]"
                  style={{ width: `${bookedPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Category & Rating */}
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-stone-500 gap-1">
            <span className="inline-flex items-center gap-1 font-medium text-emerald-800 bg-emerald-50 px-1.5 sm:px-2.5 py-0.5 rounded-full truncate">
              <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
              <span className="truncate">{product.originSource.split("(")[0]}</span>
            </span>
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-600 shrink-0">
              <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
              <span className="hidden sm:inline">({product.reviewCount})</span>
            </span>
          </div>

          {/* Bangla Subtitle & Clean English Title */}
          <div>
            <span className="text-[10px] sm:text-xs font-extrabold text-[#C83E2B] tracking-wide block truncate">
              {product.titleBn}
            </span>
            <Link
              href={`/product/${product.slug}`}
              className="text-xs sm:text-base font-bold text-stone-900 hover:text-[#0F3D2E] line-clamp-2 leading-tight sm:leading-snug mt-0.5 transition"
            >
              {product.title}
            </Link>
          </div>

          {/* Instant Weight / Variant Switcher Pills */}
          {product.variants.length > 0 && (
            <div className="pt-0.5 sm:pt-1">
              <span className="text-[9px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                Pack / Weight:
              </span>
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {product.variants.map((variant) => {
                  const active = variant.id === activeVariant?.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                        active
                          ? "bg-[#0F3D2E] text-white shadow-xs"
                          : "bg-stone-100 text-stone-700 hover:bg-stone-200/80"
                      }`}
                    >
                      {variant.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Price & Action Buttons */}
        <div className="pt-2 sm:pt-3 border-t border-stone-100 space-y-2 sm:space-y-3">
          <div className="flex items-baseline justify-between gap-1">
            <div className="min-w-0">
              <span className="text-[9px] sm:text-xs text-stone-400 font-medium block truncate">
                Price ({activeVariant?.label})
              </span>
              <div className="flex items-baseline gap-1 sm:gap-2">
                <span className="text-base sm:text-2xl font-extrabold text-[#0F3D2E]">
                  ৳{activeVariant?.price.toLocaleString()}
                </span>
                {activeVariant?.compareAtPrice && (
                  <span className="text-[10px] sm:text-xs text-stone-400 line-through font-semibold">
                    ৳{activeVariant.compareAtPrice.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                activeVariant && addToCart(product, activeVariant, 1)
              }
              className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 text-[#0F3D2E] hover:bg-[#0F3D2E] hover:text-white transition cursor-pointer shrink-0"
              title="Add to Basket"
              aria-label="Add to Basket"
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* 1-Click Direct Order Button */}
          <button
            type="button"
            onClick={handleOneClickOrder}
            className="w-full py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl sm:rounded-2xl bg-[#C83E2B] hover:bg-[#ad3221] text-white font-bold text-[11px] sm:text-sm shadow-sm flex items-center justify-center gap-1 sm:gap-1.5 transition cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current shrink-0" />
            <span className="truncate">
              {product.isPreorder ? (
                <>
                  <span className="sm:hidden">প্রি-অর্ডার</span>
                  <span className="hidden sm:inline">1-Click Pre-Order</span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">অর্ডার করুন</span>
                  <span className="hidden sm:inline">1-Click Order Now</span>
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
