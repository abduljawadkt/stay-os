import { AppGate } from "@/components/auth/app-gate";
import { ParentLayout } from "@/components/mobile/layouts";
import { PRIVATE } from "@/lib/seo";
export const metadata = { title: "Parent app", ...PRIVATE };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppGate area="parent">
      <ParentLayout>{children}</ParentLayout>
    </AppGate>
  );
}
