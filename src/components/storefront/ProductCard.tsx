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
    <div className="group bg-white rounded-3xl border border-stone-200/80 shadow-xs hover:shadow-xl hover:border-emerald-800/30 transition-all duration-300 flex flex-col overflow-hidden">
      {/* Square Bangla Poster Container (Zero Border Cropping) */}
      <div className="relative aspect-square overflow-hidden bg-stone-950 p-1.5">
        <Link
          href={`/product/${product.slug}`}
          className="flex items-center justify-center w-full h-full rounded-2xl overflow-hidden bg-stone-900"
        >
          <img
            src={product.primaryImage}
            alt={`${product.title} - ${product.titleBn}`}
            className="w-full h-full object-contain block"
            loading="lazy"
          />
        </Link>

        {/* Top Left Status Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
          {product.isPreorder ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#C83E2B]/95 backdrop-blur-xs text-white text-[10px] font-bold shadow-md">
              <Flame className="w-3 h-3 fill-current" />
              PRE-ORDER BATCH
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0F3D2E]/95 backdrop-blur-xs text-white text-[10px] font-bold shadow-md">
              <CheckCircle2 className="w-3 h-3" />
              READY STOCK
            </span>
          )}

          {discountPercent > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-extrabold shadow-xs w-fit">
              SAVE {discountPercent}%
            </span>
          )}
        </div>
      </div>

      {/* Product Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2.5">
          {/* Pre-Order Live Booking Bar (Cleanly Below Poster Image) */}
          {product.isPreorder && (
            <div className="bg-stone-950 text-white px-3 py-2 rounded-xl border border-stone-800">
              <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                <span className="text-amber-300">
                  {product.expectedDeliveryDate || "Next Fresh Catch"}
                </span>
                <span className="text-emerald-300">
                  Only {remainingSlots} {product.unitType} left!
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-[#C83E2B]"
                  style={{ width: `${bookedPercentage}%` }}
                />
              </div>
            </div>
          )}
          {/* Category & Rating */}
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span className="inline-flex items-center gap-1 font-medium text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              <MapPin className="w-3 h-3" />
              {product.originSource.split("(")[0]}
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-amber-600">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {product.rating} ({product.reviewCount})
            </span>
          </div>

          {/* Bangla Subtitle & Clean English Title */}
          <div>
            <span className="text-xs font-extrabold text-[#C83E2B] tracking-wide block">
              {product.titleBn}
            </span>
            <Link
              href={`/product/${product.slug}`}
              className="text-base font-bold text-stone-900 hover:text-[#0F3D2E] line-clamp-2 leading-snug mt-0.5 transition"
            >
              {product.title}
            </Link>
          </div>

          {/* Instant Weight / Variant Switcher Pills */}
          {product.variants.length > 0 && (
            <div className="pt-1">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1.5">
                Select Pack / Weight:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {product.variants.map((variant) => {
                  const active = variant.id === activeVariant?.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
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
        <div className="pt-3 border-t border-stone-100 space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-xs text-stone-400 font-medium block">
                Price ({activeVariant?.label})
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-[#0F3D2E]">
                  ৳{activeVariant?.price.toLocaleString()}
                </span>
                {activeVariant?.compareAtPrice && (
                  <span className="text-xs text-stone-400 line-through font-semibold">
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
              className="p-2.5 rounded-2xl bg-emerald-50 text-[#0F3D2E] hover:bg-[#0F3D2E] hover:text-white transition cursor-pointer"
              title="Add to Basket"
              aria-label="Add to Basket"
            >
              <ShoppingBag className="w-5 h-5" />
            </button>
          </div>

          {/* 1-Click Direct Order Button */}
          <button
            type="button"
            onClick={handleOneClickOrder}
            className="w-full py-2.5 px-4 rounded-2xl bg-[#C83E2B] hover:bg-[#ad3221] text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>
              {product.isPreorder
                ? "1-Click Pre-Order Now"
                : "1-Click Order Now"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
