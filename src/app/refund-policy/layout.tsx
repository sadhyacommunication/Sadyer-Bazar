import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "রিফান্ড ও রিটার্ন নীতিমালা (Refund & Return Policy) | সাধ্যের বাজার",
  description:
    "সাধ্যের বাজার ১০০% সন্তুষ্টি গ্যারান্টি, অভিযোগ জানানোর সময়সীমা ও SSLCommerz/bKash মাধ্যমে রিফান্ড নিষ্পত্তির নিয়মাবলী।",
  alternates: {
    canonical: "https://sadyer-bazar.sadhyacommunication.workers.dev/refund-policy",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RefundPolicyLayout({
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
        name: "রিফান্ড ও রিটার্ন পলিসি (Refund Policy)",
        item: `${baseUrl}/refund-policy`,
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
