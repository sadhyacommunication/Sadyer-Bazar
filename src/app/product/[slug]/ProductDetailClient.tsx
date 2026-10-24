"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ShoppingBag,
  Zap,
  Flame,
  Star,
  MapPin,
  ShieldCheck,
  Truck,
  CheckCircle2,
  ArrowLeft,
  Scissors,
  Plus,
  Minus,
  PhoneCall,
  MessageSquarePlus,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { checkRateLimit, sanitizeText } from "@/lib/security";
import { submitReviewViaEdgeApi } from "@/services/supabaseSync";
import ProductCard from "@/components/storefront/ProductCard";

export default function ProductDetailClient({
  slug: initialSlug,
}: {
  slug: string;
}) {
  const params = useParams<{ slug?: string }>();
  const slug = params?.slug || initialSlug;
  const router = useRouter();
  const {
    products,
    reviews,
    settings,
    addToCart,
    addProductReview,
    findOrderByCode,
  } = useStore();

  const product = products.find((p) => p.slug === slug);

  const defaultVariant =
    product?.variants.find((v) => v.isDefault) || product?.variants[0];

  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    defaultVariant?.id || ""
  );
  const [selectedCutting, setSelectedCutting] = useState<string>(
    product?.cuttingOptions[0] || ""
  );
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    if (product) {
      const defVar =
        product.variants.find((v) => v.isDefault) || product.variants[0];
      if (defVar) setSelectedVariantId(defVar.id);
      setSelectedCutting(product.cuttingOptions[0] || "");
    }
  }, [product?.id]);

  // Verified Order-ID Review Form State
  const [revOrderCode, setRevOrderCode] = useState("");
  const [revPhoneLast4, setRevPhoneLast4] = useState("");
  const [revName, setRevName] = useState("");
  const [revDistrict, setRevDistrict] = useState("Dhaka");
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState("");
  const [revError, setRevError] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-stone-900">
          Product Not Found
        </h1>
        <p className="text-sm text-stone-600">
          The product you are looking for may have been moved or sold out.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F3D2E] text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Store
        </Link>
      </div>
    );
  }

  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) ||
    product.variants[0];

  const productReviews = reviews.filter((r) => r.productId === product.id);

  const relatedProducts = products
    .filter((p) => p.isActive && p.id !== product.id)
    .slice(0, 4);

  const bookedPercentage = Math.min(
    98,
    Math.round(
      (product.batchBookedQty / Math.max(1, product.batchTargetQty)) * 100
    )
  );

  const handleDirectOrder = () => {
    if (!activeVariant) return;
    addToCart(
      product,
      activeVariant,
      quantity,
      selectedCutting || undefined,
      false
    );
    router.push("/checkout");
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRevError(null);
    const cleanCode = revOrderCode.trim().toUpperCase();
    const cleanLast4 = revPhoneLast4.replace(/\D/g, "").slice(-4);
    if (!/^SB-\d{4}-[A-Z0-9]{5,10}$/.test(cleanCode)) {
      setRevError(
        "Please enter a valid Sadyer Bazar Order ID (e.g., SB-2610-XXXXXXXXXX) to verify your purchase."
      );
      return;
    }

    if (cleanLast4.length !== 4) {
      setRevError(
        "Please enter the last 4 digits of the mobile number used for this order."
      );
      return;
    }

    const rl = checkRateLimit(`review_${cleanCode}`, 5, 60_000);
    if (!rl.allowed) {
      setRevError("Too many attempts. Please wait a minute and try again.");
      return;
    }

    const cleanComment = sanitizeText(revComment);
    if (cleanComment.length < 4) {
      setRevError("Please write a short review comment (at least 4 characters).");
      return;
    }

    setSubmittingReview(true);
    try {
      const serverRes = await submitReviewViaEdgeApi({
        productId: product.id,
        orderCode: cleanCode,
        phoneLast4: cleanLast4,
        rating: revRating,
        comment: cleanComment,
      });

      if (!serverRes.success) {
        // Fallback only for local seed orders during offline preview
        const matchedOrder = findOrderByCode(cleanCode);
        if (
          !matchedOrder ||
          !matchedOrder.customerPhone.replace(/\D/g, "").endsWith(cleanLast4)
        ) {
          setRevError(
            serverRes.error ||
              "Order ID and phone last 4 digits did not match a verified purchase for this product."
          );
          return;
        }
      }

      addProductReview({
        id: `rev-${Date.now()}`,
        productId: product.id,
        orderCode: cleanCode,
        customerName: sanitizeText(revName) || "Verified Buyer",
        customerDistrict: sanitizeText(revDistrict) || "Dhaka",
        rating: revRating,
        comment: cleanComment,
        isVerifiedPurchase: true,
        createdAt: new Date().toISOString(),
      });
      setRevOrderCode("");
      setRevPhoneLast4("");
      setRevName("");
      setRevComment("");
    } finally {
      setSubmittingReview(false);
    }
  };

  // JSON-LD Product Schema for Google Rich Results
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${product.title} (${product.titleBn})`,
    image: product.primaryImage,
    description: product.seoDescription || product.shortDescription,
    brand: {
      "@type": "Brand",
      name: "Sadyer Bazar (সাধ্যের বাজার)",
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "BDT",
      price: activeVariant?.price || 0,
      availability: product.isPreorder
        ? "https://schema.org/PreOrder"
        : "https://schema.org/InStock",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-28 sm:pb-16 space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-stone-500 font-medium">
        <Link href="/" className="hover:text-[#0F3D2E]">
          Home
        </Link>
        <span>/</span>
        <Link
          href={`/shop?category=${product.categorySlug}`}
          className="hover:text-[#0F3D2E]"
        >
          {product.categoryName}
        </Link>
        <span>/</span>
        <span className="text-stone-900 font-bold truncate">
          {product.title}
        </span>
      </nav>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Bangla Product Poster Showcase (Zero Border Cropping) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative aspect-square rounded-3xl overflow-hidden bg-stone-950 p-2 border-2 border-stone-200/80 shadow-lg">
            <img
              src={product.primaryImage}
              alt={`${product.title} - ${product.titleBn}`}
              className="w-full h-full object-contain rounded-2xl block"
            />
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {product.isPreorder ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#C83E2B] text-white text-xs font-extrabold shadow-md">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  PRE-ORDER BATCH ({product.expectedDeliveryDate})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0F3D2E] text-white text-xs font-extrabold shadow-md">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  READY FOR EXPRESS DISPATCH
                </span>
              )}
            </div>
          </div>

          {/* Purity & Sourcing Highlights */}
          <div className="grid grid-cols-3 gap-3">
            {product.nutritionHighlights.map((highlight, idx) => (
              <div
                key={idx}
                className="bg-white p-3.5 rounded-2xl border border-stone-200/80 text-center space-y-1"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700 mx-auto" />
                <p className="text-[11px] font-bold text-stone-800 leading-snug">
                  {highlight}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Product Configuration & 1-Click Order */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#0F3D2E] text-xs font-bold">
                <MapPin className="w-3.5 h-3.5" />
                Source: {product.originSource}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {product.rating} ({product.reviewCount} Verified Reviews)
              </span>
            </div>

            <p className="text-base font-extrabold text-[#C83E2B] pt-1">
              {product.titleBn}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 leading-tight">
              {product.title}
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              {product.shortDescription}
            </p>
          </div>

          {/* Pre-Order Batch Progress Box */}
          {product.isPreorder && (
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#C83E2B] fill-current" />
                  Next Dispatch: {product.expectedDeliveryDate}
                </span>
                <span>
                  {product.batchBookedQty} / {product.batchTargetQty}{" "}
                  {product.unitType} Booked ({bookedPercentage}%)
                </span>
              </div>
              <div className="w-full h-2 bg-amber-200/70 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-[#C83E2B]"
                  style={{ width: `${bookedPercentage}%` }}
                />
              </div>
              <p className="text-[11px] text-amber-900">
                Book your pre-order now to lock in your allocation from the next
                fresh harvest.
              </p>
            </div>
          )}

          {/* Price Display */}
          <div className="flex items-baseline gap-3 py-3 border-y border-stone-100">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#0F3D2E]">
              ৳{((activeVariant?.price || 0) * quantity).toLocaleString()}
            </span>
            {activeVariant?.compareAtPrice && (
              <span className="text-base text-stone-400 line-through font-semibold">
                ৳{(activeVariant.compareAtPrice * quantity).toLocaleString()}
              </span>
            )}
            <span className="text-xs font-semibold text-stone-500 ml-auto">
              ৳{activeVariant?.price} per {activeVariant?.label}
            </span>
          </div>

          {/* 1. Select Weight / Pack Variant */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold uppercase tracking-wider text-stone-700 block">
              1. Choose Weight / Pack Size:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {product.variants.map((variant) => {
                const isSelected = variant.id === activeVariant?.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-2 border-[#0F3D2E] bg-emerald-50/50"
                        : "border-stone-200 hover:border-stone-300 bg-stone-50/50"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-extrabold text-stone-900">
                        {variant.label}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        In Stock ({variant.stockQty} available)
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-[#0F3D2E]">
                      ৳{variant.price}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Cutting / Preparation Preference */}
          {product.cuttingOptions.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-[#C83E2B]" />
                2. Select Preparation / Cutting Preference:
              </label>
              <div className="flex flex-wrap gap-2">
                {product.cuttingOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSelectedCutting(option)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedCutting === option
                        ? "bg-[#0F3D2E] text-white"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity & Action CTAs */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center border border-stone-200 rounded-2xl bg-stone-50 p-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-2.5 text-stone-600 hover:text-stone-950 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 text-sm font-extrabold text-stone-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(25, q + 1))}
                  className="p-2.5 text-stone-600 hover:text-stone-950 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  activeVariant &&
                  addToCart(
                    product,
                    activeVariant,
                    quantity,
                    selectedCutting || undefined,
                    true
                  )
                }
                className="flex-1 py-3.5 px-5 rounded-2xl bg-[#0F3D2E] hover:bg-[#165b44] text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add to Basket</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleDirectOrder}
              className="w-full py-4 px-6 rounded-2xl bg-[#C83E2B] hover:bg-[#b03221] text-white font-extrabold text-sm sm:text-base shadow-lg shadow-red-950/15 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Zap className="w-5 h-5 fill-current" />
              <span>
                1-Click {product.isPreorder ? "Pre-Order" : "Order"} Now —{" "}
                ৳{((activeVariant?.price || 0) * quantity).toLocaleString()}
              </span>
            </button>
          </div>

          {/* Delivery Charge & Payment Transparency Box */}
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200/80 space-y-2 text-xs text-stone-600">
            <div className="flex items-center justify-between font-semibold text-stone-800">
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#0F3D2E]" />
                Home Delivery Charge:
              </span>
              <span>
                Inside Dhaka: <strong>৳{settings.insideDhakaFee}</strong> |
                Outside Dhaka: <strong>৳{settings.outsideDhakaFee}</strong>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Accepted Payments:
              </span>
              <span className="font-bold text-stone-800">
                bKash Merchant • Nagad Merchant • Cash on Delivery
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-stone-200/60">
              <span className="flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-[#C83E2B]" />
                Direct Phone Order:
              </span>
              <a
                href={`tel:${settings.supportPhone.split("-")[0]}`}
                className="font-extrabold text-[#C83E2B] hover:underline"
              >
                {settings.supportPhone}
              </a>
            </div>
          </div>

          {/* Full Product Description */}
          <div className="pt-3 border-t border-stone-100 space-y-2">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-stone-800">
              About This Organic Product
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              {product.description}
            </p>
          </div>
        </div>
      </div>

      {/* ORDER-ID VERIFIED BUYER REVIEWS SECTION (v2.0 Upgrade) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 border-t border-stone-200">
        {/* Left 7 Cols: Verified Reviews List */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F3D2E]">
              100% Order-ID Verified Feedback
            </span>
            <h2 className="text-2xl font-extrabold text-stone-900">
              Customer Reviews ({productReviews.length})
            </h2>
          </div>

          {productReviews.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-stone-200 text-xs text-stone-500">
              Be the first verified buyer to review {product.titleBn} using your
              Order ID!
            </div>
          ) : (
            <div className="space-y-3">
              {productReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 rounded-2xl bg-white border border-stone-200/90 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(rev.rating)].map((_, idx) => (
                        <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#0F3D2E] text-[10px] font-extrabold">
                      <CheckCircle2 className="w-3 h-3" /> Verified Order (
                      {rev.orderCode})
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                  <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1">
                    <strong className="text-stone-900">
                      {rev.customerName} • {rev.customerDistrict}
                    </strong>
                    <span>
                      {new Date(rev.createdAt).toLocaleDateString("en-BD")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 5 Cols: Submit Order-ID Verified Review */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-stone-200/90 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-stone-900">
            <MessageSquarePlus className="w-4 h-4 text-[#C83E2B]" />
            <span>Write a Verified Buyer Review</span>
          </div>
          <p className="text-xs text-stone-500">
            Enter your Order ID (e.g.,{" "}
            <code className="font-mono font-bold text-stone-800">
              SB-2610-XXXXXXXXXX
            </code>
            ) and last 4 digits of your phone number to post a verified review.
          </p>

          {revError && (
            <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
              {revError}
            </p>
          )}

          <form onSubmit={handleReviewSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Order ID *
                </label>
                <input
                  type="text"
                  required
                  value={revOrderCode}
                  onChange={(e) =>
                    setRevOrderCode(e.target.value.toUpperCase())
                  }
                  placeholder="SB-2610-XXXXXXXXXX"
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Phone Last 4 Digits *
                </label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={revPhoneLast4}
                  onChange={(e) =>
                    setRevPhoneLast4(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="7780"
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  value={revName}
                  onChange={(e) => setRevName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  District / Area
                </label>
                <input
                  type="text"
                  value={revDistrict}
                  onChange={(e) => setRevDistrict(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Rating
                </label>
                <select
                  value={revRating}
                  onChange={(e) => setRevRating(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 font-bold"
                >
                  <option value={5}>★★★★★ (5/5)</option>
                  <option value={4}>★★★★☆ (4/5)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">
                Your Experience with {product.titleBn} *
              </label>
              <textarea
                rows={3}
                required
                value={revComment}
                onChange={(e) => setRevComment(e.target.value)}
                placeholder="Share how fresh the product was..."
                className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200"
              />
            </div>

            <button
              type="submit"
              disabled={submittingReview}
              className="w-full py-3 rounded-xl bg-[#0F3D2E] hover:bg-[#165b44] disabled:opacity-60 text-white font-extrabold transition cursor-pointer"
            >
              {submittingReview
                ? "Verifying Order on Server..."
                : "Submit Verified Review"}
            </button>
          </form>
        </div>
      </div>

      {/* Related Products */}
      <div className="space-y-6 pt-8 border-t border-stone-200">
        <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">
          Customers Also Ordered With This
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
          {relatedProducts.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </div>

      {/* Mobile Sticky Bottom Quick-Buy Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-white/95 backdrop-blur-md border-t border-stone-200/90 px-3.5 py-2.5 shadow-2xl flex items-center justify-between gap-2.5 no-print">
        <div className="min-w-0 flex items-center gap-2">
          <img
            src={product.primaryImage}
            alt={product.title}
            className="w-10 h-10 rounded-xl object-contain bg-stone-950 p-0.5 border border-stone-200 shrink-0"
          />
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-stone-500 block truncate">
              {activeVariant?.label}
            </span>
            <span className="text-base font-extrabold text-[#0F3D2E] block leading-tight">
              ৳{((activeVariant?.price || 0) * quantity).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              activeVariant &&
              addToCart(
                product,
                activeVariant,
                quantity,
                selectedCutting || undefined,
                true
              )
            }
            className="p-2.5 rounded-xl bg-emerald-50 text-[#0F3D2E] border border-emerald-200 active:scale-95 transition cursor-pointer"
            title="Add to Basket"
            aria-label="Add to Basket"
          >
            <ShoppingBag className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDirectOrder}
            className="py-2.5 px-3.5 rounded-xl bg-[#C83E2B] hover:bg-[#b03221] text-white font-extrabold text-xs shadow-md flex items-center gap-1 active:scale-95 transition cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{product.isPreorder ? "প্রি-অর্ডার" : "১-ক্লিক অর্ডার"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
