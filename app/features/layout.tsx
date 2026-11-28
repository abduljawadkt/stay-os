import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Features", description: "Everything StayOS does for a hostel or PG: rent by UPI with WhatsApp reminders, rooms and beds, residents and KYC, mess, complaints, gate passes, staff and reports, in English and Malayalam.", path: "/features/" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
