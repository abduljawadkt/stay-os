import { AppGate } from "@/components/auth/app-gate";
import { ResidentLayout } from "@/components/mobile/layouts";
import { PRIVATE } from "@/lib/seo";
export const metadata = { title: "Resident app", ...PRIVATE };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppGate area="resident">
      <ResidentLayout>{children}</ResidentLayout>
    </AppGate>
  );
}
