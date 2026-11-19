import { Suspense } from "react";
import { RentScreen } from "@/components/rent/rent-screen";
export const metadata = { title: "Rent & invoices" };
export default function Page() {
  return <Suspense><RentScreen /></Suspense>;
}
