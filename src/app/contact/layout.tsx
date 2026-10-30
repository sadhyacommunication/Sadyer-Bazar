import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "যোগাযোগ ও কাস্টমার কেয়ার হেল্পডেস্ক (Contact Us) | সাধ্যের বাজার",
  description:
    "সাধ্যের বাজার কাস্টমার সাপোর্ট হটলাইন (01713-477780), ১-ক্লিক হোয়াটসঅ্যাপ সাপোর্ট, ঢাকা প্রধান কার্যালয় (নিকেতন, গুলশান) ও বগুড়ার ধুনট ওয়্যারহাউজ/স্টোরের ঠিকানা।",
  keywords: [
    "সাধ্যের বাজার ফোন নম্বর",
    "সাধ্যের বাজার কাস্টমার কেয়ার",
    "Sadhyer Bazar contact hotline",
    "Sadhyer Bazar customer support",
  ],
  alternates: {
    canonical: "https://sadhyerbazar.com/contact",
  },
  openGraph: {
    title: "যোগাযোগ ও হেল্পডেস্ক | সাধ্যের বাজার (Sadhyer Bazar)",
    description:
      "আপনার যেকোনো প্রশ্ন, বাল্ক অর্ডার কিংবা মাছের কাটিং পছন্দের জন্য সরাসরি যোগাযোগ করুন।",
    url: "https://sadhyerbazar.com/contact",
    siteName: "Sadhyer Bazar (সাধ্যের বাজার)",
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "যমুনা নদীর তাজা মাছ কীভাবে ডেলিভারি দেওয়া হয়?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "আমাদের জেলেরা যমুনা নদী থেকে মাছ শিকারের পর তৎক্ষণাৎ বাছাই করে ইনসুলেটেড আইস-বক্সে খাদ্য-নিরাপদ বরফে সংরক্ষণ করা হয়। কোনো ফরমালিন বা রাসায়নিক ব্যবহার করা হয় না। আপনার চাহিদামতো আঁশ ও নাড়িভুঁড়ি পরিষ্কার করে ঢাকায় নিজস্ব কোল্ড-চেইনে দ্রুততম সময়ে পৌঁছে দেওয়া হয়।",
        },
      },
      {
        "@type": "Question",
        name: "বগুড়ার ঐতিহ্যবাহী দই ও গাওয়া ঘি এর বিশুদ্ধতার নিশ্চয়তা কী?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "আমাদের ঘি ১০০% দেশি গরুর দুধের খাঁটি সর জ্বাল দিয়ে সনাতন পদ্ধতিতে তৈরি। আর বগুড়ার দই সরাসরি বগুড়ার কারিগরদের মাটির সরায় জমানো টাটকা পাঠানো হয়। কোনো কৃত্রিম মিষ্টি বা প্রিজারভেটিভ দেওয়া হয় না।",
        },
      },
      {
        "@type": "Question",
        name: "ঢাকা ও ঢাকার বাইরে ডেলিভারি কত সময়ে পৌঁছায়?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "ঢাকা সিটির ভেতরে অর্ডার কনফার্মেশনের ২৪ থেকে ৩৬ ঘণ্টার মধ্যে স্লট অনুযায়ী হোম ডেলিভারি পৌঁছে যায়। প্রি-অর্ডারের তাজা মাছ নদীর জোয়ার ও ধরার টাইমিং অনুযায়ী নির্ধারিত দিনে সকালে সরাসরি আপনার ঠিকানায় পাঠানো হয়।",
        },
      },
      {
        "@type": "Question",
        name: "পেমেন্ট কীভাবে করা যায়? ক্যাশ অন ডেলিভারি আছে কি?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "হ্যাঁ, ক্যাশ অন ডেলিভারি (পণ্য পেয়ে মূল্য পরিশোধ) রয়েছে। এছাড়া বিকাশ, নগদ ও ডেবিট/ক্রেডিট কার্ডের মাধ্যমেও যেকোনো সময় সহজে ডিজিটাল পেমেন্ট সম্পন্ন করতে পারেন।",
        },
      },
    ],
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "হোম (Home)",
        item: "https://sadhyerbazar.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "যোগাযোগ (Contact)",
        item: "https://sadhyerbazar.com/contact",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
