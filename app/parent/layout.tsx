import { ParentLayout } from "@/components/mobile/layouts";
export const metadata = { title: "Parent app" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ParentLayout>{children}</ParentLayout>;
}
