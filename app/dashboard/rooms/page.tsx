import { Suspense } from "react";
import { RoomsScreen } from "@/components/rooms/rooms-screen";
export const metadata = { title: "Rooms & beds" };
export default function Page() {
  return <Suspense><RoomsScreen /></Suspense>;
}
