import { Suspense } from "react";
import { ResidentsScreen } from "@/components/residents/residents-screen";
export const metadata = { title: "Residents" };
export default function Page() {
  return <Suspense><ResidentsScreen /></Suspense>;
}
