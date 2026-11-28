import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Live demo", description: "Try StayOS as the owner, warden, resident or parent of a 300-bed sample hostel. No sign-up needed.", path: "/demo/" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
