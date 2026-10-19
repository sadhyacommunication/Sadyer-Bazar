import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "শর্তাবলী ও নীতিমালা (Terms & Conditions) | সাধ্যের বাজার",
  description:
    "সাধ্যের বাজার প্ল্যাটফর্ম ব্যবহারের নিয়মাবলি, পণ্যের অর্ডার, ডিজিটাল ওজন স্লিপ ও ডেলিভারির আইনি শর্তাবলী।",
  alternates: {
    canonical: "https://sadhyerbazar.com/terms-and-conditions",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsLayout({
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
        name: "শর্তাবলী (Terms & Conditions)",
        item: `${baseUrl}/terms-and-conditions`,
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
