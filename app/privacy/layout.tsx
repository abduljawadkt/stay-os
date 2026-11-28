import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Privacy policy", description: "What StayOS collects about owners, staff, residents and parents, how it is used and kept safe, and how to reach us about it.", path: "/privacy/" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
