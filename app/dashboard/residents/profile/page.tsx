import { Suspense } from "react";
import { ProfileScreen } from "@/components/residents/profile-screen";
export const metadata = { title: "Resident" };
export default function Page() {
  return <Suspense><ProfileScreen /></Suspense>;
}
