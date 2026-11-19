import { AppGate } from "@/components/auth/app-gate";
import { ResidentLayout } from "@/components/mobile/layouts";
export const metadata = { title: "Resident app" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppGate area="resident">
      <ResidentLayout>{children}</ResidentLayout>
    </AppGate>
  );
}
