import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "সকল প্রাকৃতিক খাদ্যপণ্য ও নদীর তাজা মাছ (All Products) | সাধ্যের বাজার",
  description:
    "যমুনা নদীর তাজা দেশি মাছ, খাঁটি গাওয়া ঘি, আসল বগুড়ার শাহী দই, চলনবিলের দেশি হাঁস ও মুরগি, সুগন্ধি কাটারিভোগ ও লাল চালের লাইভ দাম ও হোম ডেলিভারি ক্যাটালগ।",
  keywords: [
    "যমুনা নদীর মাছ",
    "গাওয়া ঘি",
    "বগুড়ার দই",
    "দেশি মুরগি",
    "অর্গানিক খাবার বাংলাদেশ",
    "Jamuna river fish price BD",
    "Pure gawa ghee Dhaka",
    "Bogura shahi doi online",
    "Organic food catalog BD",
  ],
  alternates: {
    canonical: "https://sadhyerbazar.com/shop",
  },
  openGraph: {
    title: "সকল অর্গানিক খাদ্যপণ্য ও তাজা মাছের বাজার দর | সাধ্যের বাজার",
    description:
      "১০০% কেমিক্যাল ও ফরমালিনমুক্ত যমুনার মাছ, খাঁটি ঘি, বগুড়ার দই ও আদি শস্যের অনলাইন ক্যাটালগ।",
    url: "https://sadhyerbazar.com/shop",
    siteName: "Sadhyer Bazar (সাধ্যের বাজার)",
    images: [
      {
        url: "/images/banners/jamuna-fisherman-banner.jpg",
        width: 1200,
        height: 675,
        alt: "Sadhyer Bazar Organic Food Catalog",
      },
    ],
  },
};

import { INITIAL_PRODUCTS } from "@/services/seedData";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sadhyerbazar.com";

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "সাধ্যের বাজার অর্গানিক খাদ্যপণ্য ও তাজা মাছের ক্যাটালগ",
    description:
      "১০০% কেমিক্যাল ও ফরমালিনমুক্ত যমুনার মাছ, খাঁটি ঘি, বগুড়ার দই ও আদি শস্যের অনলাইন সংগ্রহ।",
    numberOfItems: INITIAL_PRODUCTS.length,
    itemListElement: INITIAL_PRODUCTS.map((product, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: `${product.title} (${product.titleBn})`,
      url: `${baseUrl}/product/${product.slug}`,
      image: product.primaryImage.startsWith("http")
        ? product.primaryImage
        : `${baseUrl}${product.primaryImage}`,
    })),
  };

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
        name: "সকল পণ্য (All Products)",
        item: `${baseUrl}/shop`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
