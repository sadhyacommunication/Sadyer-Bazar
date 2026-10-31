"use client";

import React from "react";
import { Order } from "@/types";
import { maskAddress, maskPhoneNumber } from "@/lib/security";

interface PrintableInvoiceProps {
  order: Order;
  supportPhone: string;
}

export default function PrintableInvoice({
  order,
  supportPhone,
}: PrintableInvoiceProps) {
  return (
    <div className="hidden print:block p-8 bg-white text-stone-900 font-sans text-xs space-y-6">
      {/* Official Invoice Header */}
      <div className="border-b-2 border-stone-900 pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0F3D2E] tracking-tight">
            সাধ্যের বাজার (Sadhyer Bazar)
          </h1>
          <p className="text-xs font-bold text-stone-600 mt-0.5">
            গ্রামের পণ্য শহরে, আপনার ঘরে — Village Freshness in the City, at Your Home
          </p>
          <div className="mt-2 text-[11px] text-stone-600 space-y-0.5">
            <p>
              <strong>ঢাকা প্রধান কার্যালয়:</strong> বাড়ি ৯০, রোড ২, ব্লক এ, নিকেতন, গুলশান, ঢাকা-১২১২
            </p>
            <p>
              <strong>গ্রামীণ ওয়্যারহাউস/ঘাট হাব:</strong> ধুনট সদর, ধুনট বাজার, বগুড়া
            </p>
            <p>
              <strong>হটলাইন:</strong> {supportPhone} • <strong>ওয়েবসাইট:</strong> sadhyerbazar.com
            </p>
          </div>
        </div>

        <div className="text-right space-y-1">
          <span className="inline-block px-3 py-1 bg-stone-900 text-white text-[11px] font-black uppercase rounded">
            Official Invoice / চালান
          </span>
          <p className="text-base font-black font-mono">{order.orderCode}</p>
          <p className="text-[11px] text-stone-500">
            তারিখ:{" "}
            {new Date(order.createdAt).toLocaleString("en-BD", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
      </div>

      {/* Recipient & Shipping Information */}
      <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-stone-50 border border-stone-200">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-500 mb-1">
            গ্রাহকের তথ্য (Billed / Shipped To)
          </h3>
          <p className="text-sm font-extrabold text-stone-900">
            {order.customerName}
          </p>
          <p className="font-mono text-xs">
            মোবাইল:{" "}
            {order.customerPhone.includes("*")
              ? order.customerPhone
              : maskPhoneNumber(order.customerPhone)}
          </p>
          <p className="text-xs text-stone-700 mt-1">
            ঠিকানা:{" "}
            {order.customerAddress.includes("*")
              ? order.customerAddress
              : maskAddress(order.customerAddress, order.customerDistrict)}
          </p>
          <p className="text-xs font-semibold text-stone-600 uppercase mt-0.5">
            জোন: {order.deliveryZone === "inside_dhaka" ? "Inside Dhaka (ঢাকা শহর)" : "Outside Dhaka (ঢাকার বাইরে)"}
          </p>
        </div>

        <div className="space-y-1 text-right">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-500 mb-1">
            অর্ডার ও ডেলিভারি বিবরণ
          </h3>
          <p className="text-xs">
            অর্ডার স্ট্যাটাস: <strong className="uppercase">{order.orderStatus}</strong>
          </p>
          <p className="text-xs">
            পেমেন্ট মাধ্যম:{" "}
            <strong className="uppercase">{order.paymentMethod}</strong>
          </p>
          <p className="text-xs">
            পেমেন্ট স্ট্যাটাস:{" "}
            <strong className="uppercase">{order.paymentStatus.replace("_", " ")}</strong>
          </p>
          {order.courierName && (
            <p className="text-xs">
              কুরিয়ার: <strong>{order.courierName}</strong>
              {order.trackingReference ? ` (Ref: ${order.trackingReference})` : ""}
            </p>
          )}
          {order.hasPreorderItems && (
            <p className="text-xs font-bold text-amber-800">
              * প্রি-অর্ডার যমুনা রিভার ক্যাচ ব্যাচ
            </p>
          )}
        </div>
      </div>

      {/* Itemized Table */}
      <div>
        <table className="w-full text-left border-collapse border border-stone-300">
          <thead>
            <tr className="bg-stone-100 text-stone-900 border-b border-stone-300 text-[11px] uppercase font-bold">
              <th className="p-2.5 border-r border-stone-300 w-12 text-center">#</th>
              <th className="p-2.5 border-r border-stone-300">পণ্যের বিবরণ (Item & Preparation)</th>
              <th className="p-2.5 border-r border-stone-300 w-24 text-center">প্যাক সাইজ</th>
              <th className="p-2.5 border-r border-stone-300 w-16 text-center">পরিমাণ</th>
              <th className="p-2.5 border-r border-stone-300 w-24 text-right">একক মূল্য</th>
              <th className="p-2.5 w-28 text-right">মোট টাকা</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={item.id} className="border-b border-stone-200">
                <td className="p-2.5 border-r border-stone-200 text-center font-mono">
                  {idx + 1}
                </td>
                <td className="p-2.5 border-r border-stone-200">
                  <p className="font-extrabold text-stone-900">
                    {item.productTitleBn || item.productTitle}
                  </p>
                  <p className="text-[10px] text-stone-500">{item.productTitle}</p>
                  {item.cuttingPreference && (
                    <p className="text-[10px] font-bold text-[#0F3D2E] mt-0.5">
                      কাটিং পছন্দ: {item.cuttingPreference}
                    </p>
                  )}
                </td>
                <td className="p-2.5 border-r border-stone-200 text-center font-medium">
                  {item.variantLabel}
                </td>
                <td className="p-2.5 border-r border-stone-200 text-center font-bold font-mono">
                  {item.quantity}
                </td>
                <td className="p-2.5 border-r border-stone-200 text-right font-mono">
                  ৳{item.unitPrice.toLocaleString()}
                </td>
                <td className="p-2.5 text-right font-black font-mono">
                  ৳{item.lineTotal.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial Summary & Stamp */}
      <div className="grid grid-cols-2 gap-6 pt-2">
        <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
          <h4 className="text-[11px] font-bold uppercase text-stone-600">
            গুণগত মান ও ফ্রেশনেস প্রত্যয়নপত্র
          </h4>
          <p className="text-[10px] text-stone-600 leading-relaxed">
            সাধ্যের বাজারের সকল দেশি মাছ শতভাগ ফরমালিন ও কেমিক্যালমুক্ত এবং যমুনা নদী থেকে সকালের তাজা ক্যাচ। খাদ্য নিরাপত্তা বজায় রাখতে ০°–৪°C তাপমাত্রায় সিলকৃত থার্মোকুল আইস বক্সে নিজস্ব কোল্ড-চেইন ডেলিভারি করা হয়েছে।
          </p>
          <div className="pt-2 flex items-center gap-3">
            <div className="w-16 h-16 rounded-full border-2 border-emerald-800 flex items-center justify-center text-center p-1">
              <span className="text-[9px] font-black uppercase text-emerald-900 leading-tight">
                100% PURE<br />COLD-CHAIN<br />VERIFIED
              </span>
            </div>
            <div className="text-[10px] text-stone-500">
              <p>অফিসিয়াল অনুমোদন সিল</p>
              <p className="font-mono text-[9px]">Hash: SB-CHALLAN-{order.orderCode.slice(-6)}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-1.5 text-right">
          <div className="flex justify-between text-stone-600">
            <span>পণ্য উপমোট (Subtotal):</span>
            <span className="font-mono">৳{order.subtotal.toLocaleString()}</span>
          </div>

          {order.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-800 font-semibold">
              <span>প্রোমো ডিসকাউন্ট {order.couponCode ? `(${order.couponCode})` : ""}:</span>
              <span className="font-mono">- ৳{order.discountAmount.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between text-stone-600">
            <span>কোল্ড-চেইন ডেলিভারি চার্জ:</span>
            <span className="font-mono">৳{order.deliveryCharge.toLocaleString()}</span>
          </div>

          {order.weightAdjustmentAmount !== undefined && order.weightAdjustmentAmount !== 0 && (
            <div className="flex justify-between text-amber-900 font-semibold">
              <span>ডিজিটাল স্কেল সমন্বয়:</span>
              <span className="font-mono">
                {order.weightAdjustmentAmount > 0 ? "+" : ""}৳{order.weightAdjustmentAmount.toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex justify-between text-stone-900 font-bold border-t border-stone-300 pt-1">
            <span>সর্বমোট ইনভয়েস মূল্য:</span>
            <span className="font-mono font-black text-sm">৳{order.totalAmount.toLocaleString()}</span>
          </div>

          <div className="flex justify-between text-emerald-800 font-bold">
            <span>অগ্রিম পরিশোধিত (Paid):</span>
            <span className="font-mono">- ৳{order.advancePaid.toLocaleString()}</span>
          </div>

          <div className="flex justify-between text-stone-900 font-black border-t-2 border-stone-900 pt-1.5 text-sm">
            <span>বকেয়া দেয় টাকা (Due on Delivery):</span>
            <span className="font-mono text-base">৳{order.dueAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Footer Notes */}
      <div className="border-t border-stone-200 pt-3 text-[10px] text-stone-500 text-center">
        <p>
          ডেলিভারি গ্রহণের সময় মাছ ও পণ্যের ফ্রেশনেস যাচাই করে নিন। যেকোনো প্রয়োজনে কল করুন: {supportPhone}
        </p>
        <p className="mt-0.5">
          ধন্যবাদ! সাধ্যের বাজার — গ্রামের পণ্য শহরে, আপনার ঘরে।
        </p>
      </div>
    </div>
  );
}
