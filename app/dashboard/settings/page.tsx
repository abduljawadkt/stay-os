import { Suspense } from "react";
import { SettingsScreen } from "@/components/settings/settings-screen";
export const metadata = { title: "Settings" };
export default function Page() {
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  );
}
