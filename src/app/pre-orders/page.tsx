"use client";

import React from "react";
import { Flame, Calendar, Truck, ShieldCheck, Fish } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import ProductCard from "@/components/storefront/ProductCard";

export default function PreOrdersPage() {
  const { products, settings } = useStore();
  const preorderProducts = products.filter((p) => p.isActive && p.isPreorder);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#0F3D2E] via-[#134b39] to-[#C83E2B]/90 text-white rounded-3xl p-8 sm:p-12 shadow-xl space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-xs text-amber-300 text-xs font-bold uppercase tracking-wider">
          <Flame className="w-4 h-4 fill-current" />
          Live Nationwide Pre-Order Campaign
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold max-w-3xl leading-tight">
          Why We Take Pre-Orders for Jamuna River Fish & Bogura Shahi Doi
        </h1>
        <p className="text-sm sm:text-base text-emerald-50/90 max-w-2xl leading-relaxed">
          True wild river fish and clay-pot Bogura Doi cannot sit on warehouse
          shelves. We aggregate family pre-orders across Bangladesh, harvest
          fresh at dawn from the Jamuna River & Sherpur Bogura artisans, and
          dispatch straight to your doorstep the exact same day.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-black/25 backdrop-blur-xs p-4 rounded-2xl border border-white/15 flex items-start gap-3">
            <Calendar className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Batch Cut-Off Schedule</h3>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Orders close Wednesday 10:00 PM for Friday Morning Delivery.
              </p>
            </div>
          </div>
          <div className="bg-black/25 backdrop-blur-xs p-4 rounded-2xl border border-white/15 flex items-start gap-3">
            <Truck className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Insulated Ice-Box Delivery</h3>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Inside Dhaka ৳{settings.insideDhakaFee} • Outside Dhaka ৳
                {settings.outsideDhakaFee} nationwide.
              </p>
            </div>
          </div>
          <div className="bg-black/25 backdrop-blur-xs p-4 rounded-2xl border border-white/15 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">
                Flexible {settings.preorderAdvancePercent}% Advance or Full Pay
              </h3>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Confirm your slot via bKash / SSLCommerz or Cash on Delivery.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Pre-Order Batch Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#C83E2B] flex items-center gap-1.5">
              <Fish className="w-4 h-4" /> Limited Batch Allocation
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-1">
              Active Pre-Order Products ({preorderProducts.length})
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {preorderProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
