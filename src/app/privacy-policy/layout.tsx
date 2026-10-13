import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "গোপনীয়তা নীতিমালা (Privacy Policy) | সাধ্যের বাজার",
  description:
    "সাধ্যের বাজার ডেটা সুরক্ষা ও গোপনীয়তা নীতিমালা। গ্রাহকের ব্যক্তিগত তথ্যের নিরাপত্তা ও PCI-DSS পেমেন্ট এনক্রিপশন স্ট্যান্ডার্ড।",
  alternates: {
    canonical: "https://sadyer-bazar.sadhyacommunication.workers.dev/privacy-policy",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
