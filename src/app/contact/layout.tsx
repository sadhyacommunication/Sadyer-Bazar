import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "যোগাযোগ ও কাস্টমার কেয়ার হেল্পডেস্ক (Contact Us) | সাধ্যের বাজার",
  description:
    "সাধ্যের বাজার কাস্টমার সাপোর্ট হটলাইন (01713-477780), ১-ক্লিক হোয়াটসঅ্যাপ সাপোর্ট, সিরাজগঞ্জ ও বগুড়ার সোর্সিং হাবের ঠিকানা এবং তেজগাঁও সেন্ট্রাল ডিসপ্যাচ অফিসের তথ্য।",
  keywords: [
    "সাধ্যের বাজার ফোন নম্বর",
    "সাধ্যের বাজার কাস্টমার কেয়ার",
    "Sadyer Bazar contact hotline",
    "Sadyer Bazar customer support",
  ],
  alternates: {
    canonical: "https://sadyer-bazar.sadhyacommunication.workers.dev/contact",
  },
  openGraph: {
    title: "যোগাযোগ ও হেল্পডেস্ক | সাধ্যের বাজার (Sadyer Bazar)",
    description:
      "আপনার যেকোনো প্রশ্ন, বাল্ক অর্ডার কিংবা মাছের কাটিং পছন্দের জন্য সরাসরি যোগাযোগ করুন।",
    url: "https://sadyer-bazar.sadhyacommunication.workers.dev/contact",
    siteName: "Sadyer Bazar (সাধ্যের বাজার)",
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
