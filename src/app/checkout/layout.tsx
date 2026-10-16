import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "নিরাপদ ১-ক্লিক চেকআউট (Secure Checkout) | সাধ্যের বাজার",
  description:
    "সাধ্যের বাজার নিরাপদ চেকআউট। ক্যাশ অন ডেলিভারি, বিকাশ ও এসএসএলকমার্জ ডিজিটাল পেমেন্ট।",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
