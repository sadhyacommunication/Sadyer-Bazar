"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Order } from "@/types";
import { maskAddress, maskPhoneNumber } from "@/lib/security";
import { generateQrMatrix, qrMatrixToSvgPath } from "@/lib/receipt/qrGenerator";
import { generateReceiptVerificationHash } from "@/lib/receipt/receiptGenerator";

interface PrintableInvoiceProps {
  order: Order;
  supportPhone: string;
}

export default function PrintableInvoice({
  order,
  supportPhone,
}: PrintableInvoiceProps) {
  const [verificationHash, setVerificationHash] = useState("");

  useEffect(() => {
    if (!order) return;
    void generateReceiptVerificationHash(
      order.orderCode,
      order.totalAmount,
      order.customerPhone
    ).then((hash) => setVerificationHash(hash));
  }, [order]);

  const qrSvgPath = useMemo(() => {
    if (!order?.orderCode) return "";
    try {
      const url = `https://sadhyerbazar.com/track-order?code=${encodeURIComponent(
        order.orderCode
      )}`;
      const matrix = generateQrMatrix(url);
      return qrMatrixToSvgPath(matrix, 3);
    } catch {
      return "";
    }
  }, [order?.orderCode]);

  return (
    <div className="hidden print:block relative p-8 bg-white text-stone-900 font-sans text-xs space-y-6 overflow-hidden">
      {/* Dynamic Company Logo Watermark (Subtle Anti-Forgery Background) */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        style={{ zIndex: 0, opacity: 0.05 }}
        aria-hidden="true"
      >
        <div className="transform -rotate-12 flex flex-col items-center justify-center text-center">
          <div className="w-80 h-80 rounded-full border-8 border-stone-800 flex flex-col items-center justify-center p-6 border-dashed">
            <span className="text-5xl font-black text-[#0F3D2E] tracking-tight">
              সাধ্যের বাজার
            </span>
            <span className="text-2xl font-black text-[#C83E2B] mt-1 tracking-wider uppercase">
              Sadhyer Bazar
            </span>
            <span className="text-[11px] font-bold text-stone-700 mt-2 tracking-widest uppercase">
              Official Tax Invoice • গ্রামে খাঁটি
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 space-y-6">
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
            <span className="inline-block px-3 py-1 bg-[#0F3D2E] text-white text-[11px] font-black uppercase rounded shadow-xs">
              Official Tax Invoice / চালান
            </span>
            <p className="text-base font-black font-mono text-[#C83E2B]">{order.orderCode}</p>
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

        {/* Financial Summary & Anti-Hacker QR Stamp */}
        <div className="grid grid-cols-2 gap-6 pt-2">
          {/* Left: QR Verification & Cold-Chain Guarantee */}
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 flex items-start gap-4">
            {qrSvgPath && (
              <div className="bg-white p-2 rounded-lg border border-stone-200 shadow-xs shrink-0">
                <svg
                  viewBox="0 0 100 100"
                  className="w-20 h-20 fill-[#0F3D2E]"
                  shapeRendering="crispEdges"
                >
                  <path d={qrSvgPath} />
                </svg>
                <p className="text-[8px] font-mono text-center text-stone-500 mt-1">
                  Scan to Verify
                </p>
              </div>
            )}

            <div className="space-y-1.5 flex-1">
              <h4 className="text-[11px] font-bold uppercase text-[#0F3D2E]">
                গুণগত মান ও ডিজিটাল সিকিউরিটি
              </h4>
              <p className="text-[10px] text-stone-600 leading-relaxed">
                সাধ্যের বাজারের সকল দেশি মাছ শতভাগ কেমিক্যালমুক্ত। ০°–৪°C তাপমাত্রায় কোল্ড-চেইন ডেলিভারিকৃত।
              </p>
              <div className="pt-1 text-[9px] font-mono text-emerald-900 space-y-0.5">
                <p>
                  <strong>ANTI-TAMPER HASH:</strong> {verificationHash || "SB-SEC-VERIFIED"}
                </p>
                <p className="text-stone-500">
                  URL: sadhyerbazar.com/track-order?code={order.orderCode}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Ledger Breakdown */}
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

        {/* Dual Signatures & Footer Notes */}
        <div className="grid grid-cols-2 gap-8 pt-8">
          <div className="text-center">
            <div className="border-t border-stone-400 w-44 mx-auto pt-1 font-mono text-[10px] text-stone-600">
              প্রস্তুতকারক ও কোয়ালিটি চেকার
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-stone-400 w-44 mx-auto pt-1 font-mono text-[10px] text-stone-600">
              অনুমোদিত স্বাক্ষর (সাধ্যের বাজার)
            </div>
          </div>
        </div>

        <div className="border-t border-stone-200 pt-3 text-[10px] text-stone-500 text-center">
          <p>
            ডেলিভারি গ্রহণের সময় মাছ ও পণ্যের ফ্রেশনেস যাচাই করে নিন। যেকোনো প্রয়োজনে কল করুন: {supportPhone}
          </p>
          <p className="mt-0.5 font-medium">
            ধন্যবাদ! সাধ্যের বাজার — গ্রামের পণ্য শহরে, আপনার ঘরে।
          </p>
        </div>
      </div>
    </div>
  );
}
