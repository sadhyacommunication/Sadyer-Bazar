import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "লাইভ অর্ডার আইডি ট্র্যাকিং (Live Order Tracking) | সাধ্যের বাজার",
  description:
    "আপনার অর্ডার কোড (যেমন: SB-1024) ও মোবাইল নম্বর দিয়ে পণ্যের সংগ্রহ, ডিজিটাল স্কেলের ওজন পরিমাপ ও কোল্ড-চেইন রাইডার ডেলিভারি স্ট্যাটাস সরাসরি ট্র্যাক করুন।",
  keywords: [
    "সাধ্যের বাজার অর্ডার ট্র্যাকিং",
    "Track order Sadyer Bazar",
    "Live delivery status BD",
  ],
  alternates: {
    canonical: "https://sadyer-bazar.sadhyacommunication.workers.dev/track-order",
  },
  openGraph: {
    title: "লাইভ অর্ডার আইডি ট্র্যাকিং | সাধ্যের বাজার",
    description: "আপনার খাদ্যপণ্যের ডেলিভারি অগ্রগতি সরাসরি ট্র্যাক করুন।",
    url: "https://sadyer-bazar.sadhyacommunication.workers.dev/track-order",
    siteName: "Sadyer Bazar (সাধ্যের বাজার)",
  },
};

export default function TrackOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const baseUrl = "https://sadyer-bazar.sadhyacommunication.workers.dev";
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "হোম (Home)",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "অর্ডার ট্র্যাকিং (Track Order)",
        item: `${baseUrl}/track-order`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
