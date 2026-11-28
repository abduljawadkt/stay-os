import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Pricing", description: "StayOS plans per hostel: Starter ₹1,999, Growth ₹4,999 and Scale ₹9,999 a month plus GST, two months free when paid yearly. Start with a 14-day free trial.", path: "/pricing/" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
