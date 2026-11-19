import { DashboardShell } from "@/components/shell/dashboard-shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
