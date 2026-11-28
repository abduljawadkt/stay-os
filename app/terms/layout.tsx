import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Terms of service", description: "The terms for using StayOS: accounts, the free trial, plans and payment, and your hostel's data.", path: "/terms/" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
