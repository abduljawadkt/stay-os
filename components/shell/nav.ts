import { BedDouble, ChartNoAxesColumn, DoorOpen, Home, IndianRupee, MessageSquareWarning, ReceiptText, Settings, Soup, UserCog, Users } from "lucide-react";

export type NavKey = "home" | "rooms" | "residents" | "rent" | "mess" | "complaints" | "gate" | "expenses" | "staff" | "reports" | "settings";
export const NAV: { group: "overview" | "operations" | "money" | "team"; items: { key: NavKey; href: string; icon: React.ElementType; ownerOnly?: boolean }[] }[] = [
  { group: "overview", items: [{ key: "home", href: "/dashboard/", icon: Home }] },
  {
    group: "operations",
    items: [
      { key: "rooms", href: "/dashboard/rooms/", icon: BedDouble },
      { key: "residents", href: "/dashboard/residents/", icon: Users },
      { key: "mess", href: "/dashboard/mess/", icon: Soup },
      { key: "complaints", href: "/dashboard/complaints/", icon: MessageSquareWarning },
      { key: "gate", href: "/dashboard/gate/", icon: DoorOpen },
    ],
  },
  {
    group: "money",
    items: [
      { key: "rent", href: "/dashboard/rent/", icon: IndianRupee },
      { key: "expenses", href: "/dashboard/expenses/", icon: ReceiptText, ownerOnly: true },
      { key: "reports", href: "/dashboard/reports/", icon: ChartNoAxesColumn, ownerOnly: true },
    ],
  },
  { group: "team", items: [{ key: "staff", href: "/dashboard/staff/", icon: UserCog }, { key: "settings", href: "/dashboard/settings/", icon: Settings, ownerOnly: true }] },
];
