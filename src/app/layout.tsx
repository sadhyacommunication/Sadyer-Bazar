import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import Navbar from "@/components/layout/Navbar";
import SlideCart from "@/components/storefront/SlideCart";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      "https://sadyer-bazar.sadhyacommunication.workers.dev"
  ),
  title: {
    default:
      "Sadyer Bazar (সাধ্যের বাজার) | Fresh Jamuna River Fish, Pure Gawa Ghee & Bogura Doi",
    template: "%s | Sadyer Bazar (সাধ্যের বাজার)",
  },
  description:
    "Order 100% chemical-free wild Jamuna River Fish (যমুনা নদীর মাছ), Sirajganj Pure Gawa Ghee (গাওয়া ঘি), Authentic Bogura Shahi Doi (বগুড়ার দই), Free-Range Deshi Chicken, Eggs, Kataribhog, Basmati & Full-Fiber Red Rice with nationwide home delivery across Bangladesh.",
  keywords: [
    "Sadyer Bazar",
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
  openGraph: {
    type: "website",
    locale: "en_BD",
    siteName: "Sadyer Bazar (সাধ্যের বাজার)",
    title:
      "Sadyer Bazar (সাধ্যের বাজার) — Fresh Jamuna River Fish & Pure Organic Food",
    description:
      "Direct from Jamuna River fishermen & rural homesteads to your doorstep. Pre-order fresh river catch, Gawa Ghee, Bogura Doi & organic staples.",
    images: [
      {
        url: "/images/hero-banner-bn.jpg",
        width: 1200,
        height: 675,
        alt: "Sadyer Bazar (সাধ্যের বাজার) Fresh River Fish & Organic Food",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GroceryStore",
    name: "Sadyer Bazar (সাধ্যের বাজার)",
    description:
      "Nationwide pre-order and home delivery of wild Jamuna River fish, pure Gawa Ghee, authentic Bogura Shahi Doi, village Deshi chicken, eggs, and heritage organic rice.",
    telephone: "+8801713477780",
    url: "https://sadyer-bazar.sadhyacommunication.workers.dev",
    image:
      "https://sadyer-bazar.sadhyacommunication.workers.dev/images/hero-banner-bn.jpg",
    priceRange: "৳৳",
    address: {
      "@type": "PostalAddress",
      addressCountry: "BD",
      addressLocality: "Dhaka & Bogura",
    },
    paymentAccepted: "bKash, SSLCommerz, Nagad, Cash on Delivery",
    currenciesAccepted: "BDT",
  };

  return (
    <html lang="en">
      <head>
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
