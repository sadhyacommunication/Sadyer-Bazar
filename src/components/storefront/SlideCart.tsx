"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Truck,
  Flame,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";

export default function SlideCart() {
  const router = useRouter();
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateCartQty,
    cartSubtotal,
    settings,
    products,
    addToCart,
  } = useStore();

  if (!isCartOpen) return null;

  const threshold = settings.freeDeliveryThreshold || 3000;
  const remainingForFree = Math.max(0, threshold - cartSubtotal);
  const progressPercent = Math.min(
    100,
    Math.round((cartSubtotal / threshold) * 100)
  );

  // Suggest 1 complementary product not currently in cart
  const upsellProduct = products.find(
    (p) => p.isActive && !cart.some((c) => c.productId === p.id)
  );

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    router.push("/checkout");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden no-print">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#FAF8F5] shadow-2xl flex flex-col justify-between border-l border-stone-200">
          {/* Header */}
          <div className="p-5 bg-white border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#0F3D2E] flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Your Organic Basket
                </h2>
                <p className="text-xs text-stone-500">
                  Inside Dhaka ৳{settings.insideDhakaFee} • Outside Dhaka ৳
                  {settings.outsideDhakaFee}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
              aria-label="Close basket"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Delivery Progress Bar */}
          {settings.enableFreeDelivery && (
            <div className="px-5 py-3 bg-emerald-950 text-white">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <Truck className="w-4 h-4 text-amber-400" />
                  {remainingForFree === 0 ? (
                    <span className="text-amber-300 font-bold">
                      Unlocked! You get FREE Home Delivery!
                    </span>
                  ) : (
                    <>
                      Add{" "}
                      <strong className="text-amber-300">
                        ৳{remainingForFree.toLocaleString()}
                      </strong>{" "}
                      more for{" "}
                      <span className="underline">FREE Home Delivery</span>
                    </>
                  )}
                </span>
                <span className="font-bold text-emerald-300">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-emerald-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-14 space-y-4">
                <div className="w-16 h-16 rounded-full bg-stone-200/70 text-stone-500 flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-800">
                    Your basket is empty
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
                    Explore fresh Jamuna river fish, pure Sirajganj Gawa Ghee,
                    and authentic Bogura Shahi Doi.
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F3D2E] text-white text-xs font-semibold hover:bg-[#165b44] transition cursor-pointer"
                >
                  Browse Fresh Products <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                {cart.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs flex gap-3.5"
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-20 h-20 rounded-xl object-cover border border-stone-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-bold text-[#0F3D2E] block">
                            {item.titleBn}
                          </span>
                          <Link
                            href={`/product/${item.slug}`}
                            onClick={() => setIsCartOpen(false)}
                            className="text-xs font-bold text-stone-900 hover:text-[#0F3D2E] line-clamp-1"
                          >
                            {item.title}
                          </Link>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.cartItemId)}
                          className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px] font-semibold">
                          {item.variantLabel}
                        </span>
                        {item.isPreorder && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5 fill-current" />{" "}
                            Pre-Order
                          </span>
                        )}
                      </div>

                      {item.cuttingPreference && (
                        <p className="text-[11px] text-stone-500 mt-1 truncate">
                          Prep: {item.cuttingPreference}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-stone-100">
                        <div className="inline-flex items-center border border-stone-200 rounded-lg bg-stone-50">
                          <button
                            onClick={() =>
                              updateCartQty(item.cartItemId, item.quantity - 1)
                            }
                            className="p-1.5 text-stone-600 hover:text-stone-950 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2.5 text-xs font-bold text-stone-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateCartQty(item.cartItemId, item.quantity + 1)
                            }
                            className="p-1.5 text-stone-600 hover:text-stone-950 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-sm font-extrabold text-[#0F3D2E]">
                          ৳{(item.unitPrice * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Smart Upsell Card */}
                {upsellProduct && upsellProduct.variants[0] && (
                  <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-emerald-50/60 border border-amber-200/80">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Goes Great With Your Order
                    </div>
                    <div className="flex items-center gap-3">
                      <img
                        src={upsellProduct.primaryImage}
                        alt={upsellProduct.title}
                        className="w-14 h-14 rounded-xl object-cover border border-amber-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#0F3D2E]">
                          {upsellProduct.titleBn}
                        </p>
                        <p className="text-xs font-semibold text-stone-800 truncate">
                          {upsellProduct.title}
                        </p>
                        <p className="text-xs font-bold text-stone-900 mt-0.5">
                          ৳{upsellProduct.variants[0].price} ({upsellProduct.variants[0].label})
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          addToCart(
                            upsellProduct,
                            upsellProduct.variants[0],
                            1,
                            undefined,
                            true
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-[#0F3D2E] text-white text-xs font-bold hover:bg-[#165b44] transition shrink-0 cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer / 1-Click Checkout Trigger */}
          {cart.length > 0 && (
            <div className="p-5 bg-white border-t border-stone-200 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600 font-medium">
                  Basket Subtotal
                </span>
                <span className="text-lg font-extrabold text-stone-900">
                  ৳{cartSubtotal.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                1-Click Guest Checkout • Pay via bKash, SSLCommerz or Cash on
                Delivery
              </p>
              <button
                onClick={handleProceedToCheckout}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#C83E2B] hover:bg-[#b03221] text-white font-bold text-sm shadow-lg shadow-red-900/15 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>Proceed to 1-Click Order</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
