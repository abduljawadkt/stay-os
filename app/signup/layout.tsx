import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Start a free trial", description: "Set up your hostel or PG on StayOS with a 14-day free trial: rent by UPI, WhatsApp reminders, rooms, mess and gate passes.", path: "/signup/" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
