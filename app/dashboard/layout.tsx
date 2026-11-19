import { AppGate } from "@/components/auth/app-gate";
import { DashboardShell } from "@/components/shell/dashboard-shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppGate area="dashboard">
      <DashboardShell>{children}</DashboardShell>
    </AppGate>
  );
}
