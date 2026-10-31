"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Printer,
  Download,
  Share2,
  Check,
  ShieldCheck,
  QrCode,
  Sparkles,
  FileText,
  Smartphone,
  PhoneCall,
  Loader2,
  Leaf,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Order, SiteSettings } from "@/types";
import { maskAddress, maskPhoneNumber } from "@/lib/security";
import {
  downloadReceiptAsHtml,
  downloadReceiptAsImage,
  generateReceiptVerificationHash,
  printReceipt,
} from "@/lib/receipt/receiptGenerator";
import { generateQrMatrix, qrMatrixToSvgPath } from "@/lib/receipt/qrGenerator";

interface OrderReceiptModalProps {
  order: Order;
  settings: SiteSettings;
  isOpen: boolean;
  onClose: () => void;
}

export default function OrderReceiptModal({
  order,
  settings,
  isOpen,
  onClose,
}: OrderReceiptModalProps) {
  const [downloadingImg, setDownloadingImg] = useState(false);
  const [downloadingHtml, setDownloadingHtml] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [verificationHash, setVerificationHash] = useState("");
  const [qrSvgPath, setQrSvgPath] = useState("");

  useEffect(() => {
    if (!order) return;
    void generateReceiptVerificationHash(
      order.orderCode,
      order.totalAmount,
      order.customerPhone
    ).then((hash) => setVerificationHash(hash));

    const qrUrl = `https://sadhyerbazar.com/track-order?code=${encodeURIComponent(
      order.orderCode
    )}`;
    try {
      const matrix = generateQrMatrix(qrUrl);
      const path = qrMatrixToSvgPath(matrix, 3.5);
      setQrSvgPath(path);
    } catch {
      // Fallback
    }
  }, [order]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownloadImage = async () => {
    try {
      setDownloadingImg(true);
      await downloadReceiptAsImage(order, settings);
    } catch (err) {
      console.error("Failed to generate image receipt:", err);
    } finally {
      setDownloadingImg(false);
    }
  };

  const handleDownloadHtml = async () => {
    try {
      setDownloadingHtml(true);
      await downloadReceiptAsHtml(order, settings);
    } catch (err) {
      console.error("Failed to generate HTML receipt:", err);
    } finally {
      setDownloadingHtml(false);
    }
  };

  const handleCopyShareLink = async () => {
    const url = `${window.location.origin}/track-order?code=${encodeURIComponent(
      order.orderCode
    )}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch {}
  };

  const formattedDate = new Date(order.createdAt).toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static"
    >
      <div className="relative w-full max-w-4xl bg-stone-100 rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full print:max-w-none">
        {/* Sticky Action Toolbar (Hidden in print) */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-white/95 backdrop-blur-md border-b border-stone-200 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
                <span>অফিসিয়াল ক্যাশ মেমো ও রসিদ</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                  Verified Tax Receipt
                </span>
              </h2>
              <p className="text-xs font-mono text-stone-500 font-bold">
                Order #{order.orderCode}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Print Button */}
            <button
              type="button"
              onClick={printReceipt}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-black text-white text-xs font-bold shadow-xs transition cursor-pointer"
              title="A4 অথবা POS থার্মাল প্রিন্ট করুন"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">প্রিন্ট / PDF</span>
            </button>

            {/* Download PNG Button */}
            <button
              type="button"
              disabled={downloadingImg}
              onClick={handleDownloadImage}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              title="উচ্চ রেজ্যুলেশন ছবি (PNG) ডাউনলোড করুন"
            >
              {downloadingImg ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">রসিদ ডাউনলোড (PNG)</span>
            </button>

            {/* Standalone HTML File Button */}
            <button
              type="button"
              disabled={downloadingHtml}
              onClick={handleDownloadHtml}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold transition cursor-pointer"
              title="অফলাইন চালান ফাইল ডাউনলোড করুন"
            >
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>HTML চালান</span>
            </button>

            {/* Share link button */}
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold transition cursor-pointer"
              title="ট্র্যাকিং ও রসিদের লিংক কপি করুন"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">কপি হয়েছে!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">শেয়ার</span>
                </>
              )}
            </button>

            {/* Close Modal */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition cursor-pointer"
              aria-label="Close receipt modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Canvas Body */}
        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-1 flex justify-center bg-stone-200/50 print:p-0 print:bg-white">
          <div className="relative w-full max-w-[800px] bg-white rounded-2xl p-6 sm:p-10 shadow-lg border border-stone-200 text-stone-900 overflow-hidden print:shadow-none print:border-none print:rounded-none print:p-0">
            {/* -------------------------------------------------------------
                COMPANY LOGO WATERMARK EMBEDDED IN BACKGROUND
                Pristine vector SVG watermark centered, rotated -15deg, with 6% opacity
            -------------------------------------------------------------- */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none select-none flex items-center justify-center z-0 overflow-hidden"
            >
              <div className="transform -rotate-12 opacity-[0.06] text-center space-y-4 max-w-sm">
                <div className="w-80 h-80 rounded-full border-8 border-dashed border-[#0F3D2E] flex flex-col items-center justify-center mx-auto p-4">
                  <Leaf className="w-20 h-20 text-[#0F3D2E] mb-2" />
                  <span className="text-4xl font-black text-[#0F3D2E] tracking-tight leading-none">
                    {settings.brandNameBn || "সাধ্যের বাজার"}
                  </span>
                  <span className="text-xl font-extrabold text-[#C83E2B] leading-tight mt-2 uppercase tracking-wider">
                    {settings.brandNameEn || "Sadhyer Bazar"}
                  </span>
                  <span className="text-xs font-black text-[#0F3D2E] uppercase tracking-wider mt-3">
                    {settings.sloganBn || "গ্রামের পণ্য শহরে, আপনার ঘরে"}
                  </span>
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-[#0F3D2E]">
                  AUTHENTIC COLD-CHAIN CERTIFIED • {settings.sloganEn || "Village Freshness in the City, at Your Home"}
                </p>
              </div>
            </div>

            {/* Receipt Content (z-10 sits safely above watermark) */}
            <div className="relative z-10 space-y-6 text-xs sm:text-sm">
              {/* 1. Official Header */}
              <div className="border-b-2 border-[#0F3D2E] pb-6 flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  {/* Brand Identity Logo / Emblem */}
                  {settings.logoMode === "custom" && settings.logoUrl ? (
                    <div className="w-14 h-14 rounded-2xl bg-white border border-stone-200 shadow-xs flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                      <img
                        src={settings.logoUrl}
                        alt={settings.brandNameEn || "Brand Logo"}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white border-2 border-[#0F3D2E] shadow-xs flex flex-col items-center justify-center shrink-0">
                      <Leaf className="w-3.5 h-3.5 text-emerald-600 -mb-0.5" />
                      <span className="text-[11px] font-black text-[#0F3D2E] leading-none">
                        {settings.brandNameBn ? settings.brandNameBn.split(" ")[0] : "সাধ্যের"}
                      </span>
                      <span className="text-[9px] font-extrabold text-[#C83E2B] leading-tight">
                        {settings.brandNameBn && settings.brandNameBn.split(" ").length > 1
                          ? settings.brandNameBn.split(" ").slice(1).join(" ")
                          : "বাজার"}
                      </span>
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <h1 className="text-xl sm:text-2xl font-black text-[#0F3D2E] tracking-tight">
                      {settings.brandNameBn || "সাধ্যের বাজার"}{" "}
                      <span className="text-[#C83E2B] font-extrabold text-lg sm:text-xl">
                        ({settings.brandNameEn || "Sadhyer Bazar"})
                      </span>
                    </h1>
                    <p className="text-xs font-bold text-stone-600">
                      {settings.sloganBn || "গ্রামের পণ্য শহরে, আপনার ঘরে"} — {settings.sloganEn || "Village Freshness in the City, at Your Home"}
                    </p>
                    <div className="text-[11px] text-stone-500 pt-1 space-y-0.5 leading-relaxed">
                      <p>
                        <strong>ঢাকা প্রধান কার্যালয়:</strong> বাড়ি ৯০, রোড ২, ব্লক এ, নিকেতন, গুলশান, ঢাকা-১২১২
                      </p>
                      <p>
                        <strong>গ্রামীণ ওয়্যারহাউস ও ঘাট হাব:</strong> ধুনট সদর, যমুনা নদী ঘাট, ধুনট বাজার, বগুড়া
                      </p>
                      <p>
                        <strong>হটলাইন:</strong> {settings.supportPhone || "01713477780-81"} •{" "}
                        <strong>ওয়েবসাইট:</strong> sadhyerbazar.com
                      </p>
                    </div>
                  </div>
                </div>

                <div className="sm:text-right space-y-1 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-200">
                  <span className="inline-block px-3 py-1 bg-[#0F3D2E] text-white text-[11px] font-black uppercase rounded-md tracking-wider shadow-2xs">
                    OFFICIAL INVOICE / চালান
                  </span>
                  <p className="text-base sm:text-lg font-black font-mono text-[#C83E2B]">
                    #{order.orderCode}
                  </p>
                  <p className="text-xs text-stone-500 font-medium">
                    ইস্যু তারিখ: {formattedDate}
                  </p>
                </div>
              </div>

              {/* 2. Recipient & Shipping Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-stone-50/80 border border-stone-200/90 text-xs">
                <div className="space-y-1">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-[#0F3D2E] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>গ্রাহকের তথ্য (Billed / Shipped To)</span>
                  </h3>
                  <p className="text-sm font-black text-stone-900">
                    {order.customerName}
                  </p>
                  <p className="font-mono text-stone-700 font-medium">
                    মোবাইল:{" "}
                    {order.customerPhone.includes("*")
                      ? order.customerPhone
                      : maskPhoneNumber(order.customerPhone)}
                  </p>
                  <p className="text-stone-700">
                    ঠিকানা:{" "}
                    {order.customerAddress.includes("*")
                      ? order.customerAddress
                      : maskAddress(order.customerAddress, order.customerDistrict)}
                  </p>
                  <p className="text-[11px] font-bold text-emerald-800 uppercase mt-1">
                    এলাকা:{" "}
                    {order.deliveryZone === "inside_dhaka"
                      ? "ঢাকা শহর (Inside Dhaka • ৳১০০)"
                      : "ঢাকার বাইরে (Outside Dhaka • ৳১৩০)"}
                  </p>
                </div>

                <div className="space-y-1 sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-200">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-500">
                    অর্ডার ও ডেলিভারি বিবরণ
                  </h3>
                  <p>
                    অর্ডার স্ট্যাটাস:{" "}
                    <span className="font-black uppercase text-[#0F3D2E]">
                      {order.orderStatus}
                    </span>
                  </p>
                  <p>
                    পেমেন্ট মাধ্যম:{" "}
                    <span className="font-black uppercase text-stone-900">
                      {order.paymentMethod}
                    </span>{" "}
                    ({order.paymentStatus.replace("_", " ").toUpperCase()})
                  </p>
                  {order.transactionId && (
                    <p className="font-mono text-[11px] text-stone-600">
                      TrxID: {order.transactionId}
                    </p>
                  )}
                  <p className="text-stone-600">
                    কুরিয়ার/রাইডার:{" "}
                    <strong>
                      {order.courierName || "Sadhyer Bazar Insulated Express"}
                    </strong>
                  </p>
                  {order.hasPreorderItems && (
                    <p className="text-[11px] font-bold text-amber-800 flex sm:justify-end items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>প্রি-অর্ডার যমুনা রিভার তাজা ক্যাচ ব্যাচ</span>
                    </p>
                  )}
                </div>
              </div>

              {/* 3. Itemized Products Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-stone-300 text-xs">
                  <thead>
                    <tr className="bg-[#0F3D2E] text-white uppercase text-[11px] font-bold">
                      <th className="p-2.5 border-r border-[#165b44] w-10 text-center">
                        #
                      </th>
                      <th className="p-2.5 border-r border-[#165b44]">
                        পণ্যের বিবরণ (Item & Preparation)
                      </th>
                      <th className="p-2.5 border-r border-[#165b44] w-24 text-center">
                        প্যাক সাইজ
                      </th>
                      <th className="p-2.5 border-r border-[#165b44] w-16 text-center">
                        পরিমাণ
                      </th>
                      <th className="p-2.5 border-r border-[#165b44] w-24 text-right">
                        একক মূল্য
                      </th>
                      <th className="p-2.5 w-24 text-right">মোট টাকা</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={
                          idx % 2 === 0
                            ? "bg-white border-b border-stone-200"
                            : "bg-stone-50/70 border-b border-stone-200"
                        }
                      >
                        <td className="p-2.5 border-r border-stone-200 text-center font-mono font-bold text-stone-500">
                          {idx + 1}
                        </td>
                        <td className="p-2.5 border-r border-stone-200">
                          <p className="font-bold text-stone-900">
                            {item.productTitleBn || item.productTitle}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {item.productTitle}
                          </p>
                          {item.cuttingPreference && (
                            <p className="text-[10px] font-bold text-emerald-800 mt-0.5">
                              কাটিং পছন্দ: {item.cuttingPreference}
                            </p>
                          )}
                        </td>
                        <td className="p-2.5 border-r border-stone-200 text-center text-stone-700">
                          {item.variantLabel}
                        </td>
                        <td className="p-2.5 border-r border-stone-200 text-center font-bold font-mono">
                          {item.quantity}
                        </td>
                        <td className="p-2.5 border-r border-stone-200 text-right font-mono">
                          ৳{item.unitPrice.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-black font-mono text-stone-900">
                          ৳{item.lineTotal.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 4. Financial Ledger & Authenticity Verification */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                {/* Left Card: 100% Quality Assurance, Cold-Chain Stamp & Dynamic QR */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-black text-xs uppercase tracking-wide">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>গুণগত মান ও ডিজিটাল সিকিউরিটি ভেরিফিকেশন</span>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed">
                    সাধ্যের বাজারের সকল দেশি মাছ ও দুগ্ধজাত পণ্য শতভাগ ফরমালিন ও কেমিক্যালমুক্ত।
                    খাদ্য নিরাপত্তা বজায় রাখতে ০°–৪°C তাপমাত্রায় সিলকৃত থার্মোকুল আইস বক্সে নিজস্ব কোল্ড-চেইন সিস্টেমে ডেলিভারিকৃত।
                  </p>

                  <div className="flex items-center gap-4 pt-1">
                    {/* Real SVG QR Code */}
                    <div className="w-20 h-20 p-1.5 bg-white rounded-xl border border-emerald-300 shadow-2xs shrink-0 flex items-center justify-center">
                      {qrSvgPath ? (
                        <svg
                          viewBox="0 0 116 116"
                          className="w-full h-full text-[#0F3D2E] fill-current"
                        >
                          <path d={qrSvgPath} />
                        </svg>
                      ) : (
                        <QrCode className="w-12 h-12 text-[#0F3D2E]" />
                      )}
                    </div>

                    <div className="space-y-0.5 text-xs">
                      <p className="font-bold text-stone-900 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-emerald-700" />
                        <span>ডিজিটাল সত্যতা যাচাই</span>
                      </p>
                      <p className="text-[11px] text-stone-500">
                        মোবাইল ক্যামেরা দিয়ে QR স্ক্যান করলেই লাইভ সার্ভারে চালান যাচাই হবে।
                      </p>
                      <p className="font-mono text-[10px] text-emerald-800 font-bold pt-1">
                        FINGERPRINT: {verificationHash || "SB-AUTHENTIC-2026"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Card: Financial Ledger */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>পণ্য উপমোট (Subtotal):</span>
                    <span className="font-mono font-bold">
                      ৳{order.subtotal.toLocaleString()}
                    </span>
                  </div>

                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>
                        প্রোমো ডিসকাউন্ট {order.couponCode ? `(${order.couponCode})` : ""}:
                      </span>
                      <span className="font-mono">
                        - ৳{order.discountAmount.toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-stone-600">
                    <span>কোল্ড-চেইন ডেলিভারি চার্জ:</span>
                    <span className="font-mono font-bold">
                      ৳{order.deliveryCharge.toLocaleString()}
                    </span>
                  </div>

                  {order.weightAdjustmentAmount !== undefined &&
                    order.weightAdjustmentAmount !== 0 && (
                      <div className="flex justify-between text-amber-900 font-bold">
                        <span>ডিজিটাল স্কেল সমন্বয়:</span>
                        <span className="font-mono">
                          {order.weightAdjustmentAmount > 0 ? "+" : ""}৳
                          {order.weightAdjustmentAmount.toLocaleString()}
                        </span>
                      </div>
                    )}

                  <div className="flex justify-between text-stone-900 font-bold border-t border-stone-300 pt-2 text-sm">
                    <span>সর্বমোট ইনভয়েস মূল্য:</span>
                    <span className="font-mono font-black text-[#0F3D2E]">
                      ৳{order.totalAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>অগ্রিম পরিশোধিত (Paid):</span>
                    <span className="font-mono font-black">
                      - ৳{order.advancePaid.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between text-stone-900 font-black border-t-2 border-stone-900 pt-2 text-sm bg-amber-50/60 p-2 rounded-xl">
                    <span className="text-[#C83E2B]">
                      বকেয়া দেয় টাকা (Due on Delivery):
                    </span>
                    <span className="font-mono text-base text-[#C83E2B]">
                      ৳{order.dueAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Signatures and Authorizations */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs text-stone-500">
                <div>
                  <div className="border-b border-dashed border-stone-400 w-48 mx-auto mb-1.5" />
                  <p className="font-semibold text-stone-700">গ্রাহকের স্বাক্ষর</p>
                  <p className="text-[10px]">পণ্য বুঝে পেয়ে স্বাক্ষর করুন</p>
                </div>
                <div>
                  <div className="border-b border-dashed border-stone-400 w-48 mx-auto mb-1.5" />
                  <p className="font-bold text-stone-800">অনুমোদিত কর্তৃপক্ষ</p>
                  <p className="text-[10px]">সাধ্যের বাজার ডেলিভারি ও অডিট সেল</p>
                </div>
              </div>

              {/* 6. Footer Notes */}
              <div className="border-t border-stone-200 pt-4 text-center text-[11px] text-stone-500 space-y-1">
                <p>
                  ডেলিভারি পাওয়ার পর পণ্য ও ওজন যাচাই করে নিন। এটি একটি সিস্টেম জেনারেটেড ডিজিটাল ইনভয়েস ও রসিদ।
                </p>
                <p className="font-bold text-[#0F3D2E]">
                  সাধ্যের বাজার — গ্রামের পণ্য শহরে, আপনার ঘরে। হেল্পলাইন: {settings.supportPhone || "01713477780-81"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
