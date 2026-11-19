import { Suspense } from "react";
import { GateScreen } from "@/components/gate/gate-screen";
export const metadata = { title: "Gate pass & attendance" };
export default function Page() {
  return <Suspense><GateScreen /></Suspense>;
}
