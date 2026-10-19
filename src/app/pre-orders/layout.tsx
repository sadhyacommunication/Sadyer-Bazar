import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ভোরের তাজা নদীর মাছ প্রি-অর্ডার ক্যাচ (Live Pre-Order Catch) | সাধ্যের বাজার",
  description:
    "যমুনা নদী থেকে ভোরবেলায় ধরা পড়া বুনো আইড়, বোয়াল, রুই, কাতল, চিতল ও গলদা চিংড়ি সরাসরি বুকিং করুন। সীমিত শিকার, বরফে প্যাকিং এবং নিজস্ব কোল্ড-চেইন ডেলিভারি।",
  keywords: [
    "নদীর মাছ প্রি অর্ডার",
    "যমুনার বোয়াল মাছ",
    "তাজা আইড় মাছ",
    "চিতল মাছ বুকিং",
    "Live river fish preorder Dhaka",
    "Fresh Jamuna fish catch",
  ],
  alternates: {
    canonical: "https://sadhyerbazar.com/pre-orders",
  },
  openGraph: {
    title: "ভোরের তাজা নদীর মাছ প্রি-অর্ডার ক্যাচ | সাধ্যের বাজার",
    description:
      "যমুনা নদী থেকে ভোরের বুনো শিকার সরাসরি আপনার রান্নাঘরে। ফরমালিনমুক্ত ও নিজস্ব কোল্ড-চেইনে ডেলিভারি।",
    url: "https://sadhyerbazar.com/pre-orders",
    siteName: "Sadyer Bazar (সাধ্যের বাজার)",
    images: [
      {
        url: "/images/products/jamuna-big-fish.jpg",
        width: 1000,
        height: 1000,
        alt: "Live Jamuna River Catch Pre-order",
      },
    ],
  },
};

export default function PreOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sadhyerbazar.com";

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
        name: "প্রি-অর্ডার ক্যাচ (Pre-Orders)",
        item: `${baseUrl}/pre-orders`,
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
