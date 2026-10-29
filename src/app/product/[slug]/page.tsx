import React from "react";
import type { Metadata } from "next";
import { INITIAL_PRODUCTS } from "@/services/seedData";
import ProductDetailClient from "./ProductDetailClient";

export function generateStaticParams() {
  return INITIAL_PRODUCTS.map((product) => ({
    slug: product.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = INITIAL_PRODUCTS.find((p) => p.slug === slug);
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://sadhyerbazar.com";

  if (!product) {
    return {
      title: "Product Not Found | Sadhyer Bazar",
    };
  }

  const title = `${product.title} (${product.titleBn}) - দাম ও তাজা ডেলিভারি | সাধ্যের বাজার`;
  const description = `${product.title} (${product.titleBn}) কিনুন সরাসরি সাধ্যের বাজার থেকে। ${product.originSource} থেকে সংগৃহীত, ১০০% ফরমালিন ও কেমিক্যালমুক্ত। দাম ৳${product.variants[0]?.price || ""} থেকে শুরু। কোল্ড-চেইন হোম ডেলিভারি।`;

  const ogImages = [
    {
      url: product.primaryImage.startsWith("http")
        ? product.primaryImage
        : `${baseUrl}${product.primaryImage}`,
      width: 1000,
      height: 1000,
      alt: `${product.title} - ${product.titleBn}`,
    },
  ];

  return {
    title,
    description,
    keywords: [
      product.title,
      product.titleBn,
      product.categoryName,
      ...product.searchKeywords,
      "সাধ্যের বাজার",
      "Sadhyer Bazar",
      "Bangladesh organic food",
      "Home delivery Dhaka",
    ],
    alternates: {
      canonical: `${baseUrl}/product/${product.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/product/${product.slug}`,
      siteName: "Sadhyer Bazar (সাধ্যের বাজার)",
      locale: "en_BD",
      type: "website",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages.map((img) => img.url),
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = INITIAL_PRODUCTS.find((p) => p.slug === slug);
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://sadhyerbazar.com";

  // Google Rich Snippets Schema.org JSON-LD
  const jsonLd = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: `${product.title} (${product.titleBn})`,
        image: product.galleryImages.map((img) =>
          img.startsWith("http") ? img : `${baseUrl}${img}`
        ),
        description: product.description || product.shortDescription,
        sku: product.id,
        category: product.categoryName,
        brand: {
          "@type": "Brand",
          name: "সাধ্যের বাজার (Sadhyer Bazar)",
        },
        offers: {
          "@type": "Offer",
          url: `${baseUrl}/product/${product.slug}`,
          priceCurrency: "BDT",
          price: product.variants[0]?.price || 0,
          priceValidUntil: "2026-12-31",
          availability:
            product.isActive &&
            (product.isPreorder ||
              product.variants.some((v) => v.stockQty > 0))
              ? product.isPreorder
                ? "https://schema.org/PreOrder"
                : "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          seller: {
            "@type": "Organization",
            name: "Sadhyer Bazar (সাধ্যের বাজার)",
          },
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.9",
          reviewCount: String(product.reviewCount || 24),
          bestRating: "5",
          worstRating: "1",
        },
        breadcrumb: {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: baseUrl,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: product.categoryName,
              item: `${baseUrl}/shop?category=${product.categorySlug}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: product.titleBn,
              item: `${baseUrl}/product/${product.slug}`,
            },
          ],
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductDetailClient slug={slug} />
    </>
  );
}
