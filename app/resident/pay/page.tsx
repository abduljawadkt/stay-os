import { Suspense } from "react";
import { PayFlow } from "@/components/mobile/pay-flow";
export default function Page() { return <Suspense><PayFlow base="/resident" /></Suspense>; }
