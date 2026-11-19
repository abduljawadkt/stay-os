import { ResidentLayout } from "@/components/mobile/layouts";
export const metadata = { title: "Resident app" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ResidentLayout>{children}</ResidentLayout>;
}
