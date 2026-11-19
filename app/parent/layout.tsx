import { AppGate } from "@/components/auth/app-gate";
import { ParentLayout } from "@/components/mobile/layouts";
export const metadata = { title: "Parent app" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppGate area="parent">
      <ParentLayout>{children}</ParentLayout>
    </AppGate>
  );
}
