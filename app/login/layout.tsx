import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Sign in", description: "Sign in to StayOS. For hostel owners, wardens, residents and parents.", path: "/login/" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
