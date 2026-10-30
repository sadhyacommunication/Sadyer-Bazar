import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import Navbar from "@/components/layout/Navbar";
import SlideCart from "@/components/storefront/SlideCart";
import Footer from "@/components/layout/Footer";

export const viewport: Viewport = {
  themeColor: "#0F3D2E",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://sadhyerbazar.com"
  ),
  title: {
    default:
      "Sadhyer Bazar (সাধ্যের বাজার) | Fresh Jamuna River Fish, Pure Gawa Ghee & Bogura Doi",
    template: "%s | Sadhyer Bazar (সাধ্যের বাজার)",
  },
  description:
    "Order 100% chemical-free wild Jamuna River Fish (যমুনা নদীর মাছ), Sirajganj Pure Gawa Ghee (গাওয়া ঘি), Authentic Bogura Shahi Doi (বগুড়ার দই), Free-Range Deshi Chicken, Eggs, Kataribhog, Basmati & Full-Fiber Red Rice with nationwide home delivery across Bangladesh.",
  keywords: [
    "Sadhyer Bazar",
    "সাধ্যের বাজার",
    "Jamuna river fish online Bangladesh",
    "যমুনা নদীর মাছ",
    "Pure Gawa Ghee price in BD",
    "গাওয়া ঘি",
    "Bogurar Shahi Doi online delivery",
    "বগুড়ার দই",
    "Deshi chicken meat",
    "দেশি মুরগির ডিম",
    "Kataribhog rice",
    "কাটারিভোগ চাল",
    "Basmati rice",
    "বাসমতি চাল",
    "Full fiber red rice",
    "লাল চাল",
    "Organic food Bangladesh",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_BD",
    siteName: "Sadhyer Bazar (সাধ্যের বাজার)",
    title:
      "Sadhyer Bazar (সাধ্যের বাজার) — গ্রামের পণ্য শহরে, আপনার ঘরে",
    description:
      "Direct from Jamuna River fishermen & rural homesteads to your doorstep. Pre-order fresh river catch, Gawa Ghee, Bogura Doi & organic staples.",
    images: [
      {
        url: "/images/hero-banner-bn.jpg",
        width: 1200,
        height: 675,
        alt: "Sadhyer Bazar (সাধ্যের বাজার) — গ্রামের পণ্য শহরে, আপনার ঘরে",
      },
    ],
  },
  alternates: {
    canonical: "https://sadhyerbazar.com",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Sadhyer Bazar (সাধ্যের বাজার) — গ্রামের পণ্য শহরে, আপনার ঘরে",
    description:
      "Direct from Jamuna River fishermen & rural homesteads to your doorstep. Pre-order fresh river catch, Gawa Ghee, Bogura Doi & organic staples.",
    images: ["/images/hero-banner-bn.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Sadhyer Bazar (সাধ্যের বাজার)",
    url: "https://sadhyerbazar.com",
    description:
      "100% formalin-free Jamuna River fish, pure Gawa Ghee, and authentic Bogura Shahi Doi online store in Bangladesh.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate:
          "https://sadhyerbazar.com/shop?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };

  const storeSchema = {
    "@context": "https://schema.org",
    "@type": "GroceryStore",
    name: "Sadhyer Bazar (সাধ্যের বাজার)",
    alternateName: "Sadhyer Bazar",
    description:
      "Nationwide pre-order and home delivery of wild Jamuna River fish, pure Gawa Ghee, authentic Bogura Shahi Doi, village Deshi chicken, eggs, and heritage organic rice.",
    telephone: "+8801713477780",
    url: "https://sadhyerbazar.com",
    image:
      "https://sadhyerbazar.com/images/hero-banner-bn.jpg",
    logo: "https://sadhyerbazar.com/images/hero-banner-bn.jpg",
    priceRange: "৳৳",
    currenciesAccepted: "BDT",
    paymentAccepted: "bKash, SSLCommerz, Nagad, Cash on Delivery",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Tejgaon Industrial Area",
      addressLocality: "Dhaka",
      postalCode: "1208",
      addressCountry: "BD",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "23.7639",
      longitude: "90.3889",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "08:00",
        closes: "22:00",
      },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+8801713477780",
      contactType: "customer service",
      availableLanguage: ["bn", "en"],
      areaServed: "BD",
    },
    brand: {
      "@type": "Brand",
      name: "Sadhyer Bazar (সাধ্যের বাজার)",
      alternateName: "সাধ্যের বাজার",
    },
    sameAs: [
      "https://facebook.com/sadhyerbazar",
      "https://wa.me/8801713477780",
    ],
  };

  return (
    <html lang="bn">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(storeSchema) }}
        />
        <StoreProvider>
          <Navbar />
          <SlideCart />
          <main className="flex-1">{children}</main>
          <Footer />
        </StoreProvider>
      </body>
    </html>
  );
}
