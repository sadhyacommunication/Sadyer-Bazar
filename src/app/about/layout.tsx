import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "আমাদের গল্প — নদী ও খামার থেকে খাঁটি খাদ্য (About Our Story) | সাধ্যের বাজার",
  description:
    "সাধ্যের বাজারের শুরুর কথা, যমুনা নদীর জেলে ও বগুড়ার খামারিদের থেকে সরাসরি সংগ্রহের গল্প। মধ্যস্বত্বভোগীহীন স্বচ্ছতা, ৬টি মানদণ্ড এবং নিজস্ব কোল্ড-চেইন নেটওয়ার্ক।",
  keywords: [
    "সাধ্যের বাজার পরিচিতি",
    "যমুনা নদীর জেলে সোর্সিং",
    "বগুড়ার খাঁটি ঘি কারিগর",
    "About Sadyer Bazar",
    "Direct source food Bangladesh",
  ],
  alternates: {
    canonical: "https://sadyer-bazar.sadhyacommunication.workers.dev/about",
  },
  openGraph: {
    title: "সাধ্যের বাজার — নদী ও প্রান্তিক খামারের খাঁটি আস্থার প্রতীক",
    description:
      "ভেজালমুক্ত খাঁটি খাবারের স্বাদ ফিরিয়ে আনার এক আন্তরিক যাত্রা। আমাদের নিজস্ব ৪টি সোর্সিং হাব ও মান নিয়ন্ত্রণ।",
    url: "https://sadyer-bazar.sadhyacommunication.workers.dev/about",
    siteName: "Sadyer Bazar (সাধ্যের বাজার)",
    images: [
      {
        url: "/images/banners/jamuna-fisherman-banner.jpg",
        width: 1200,
        height: 675,
        alt: "About Sadyer Bazar Story",
      },
    ],
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
