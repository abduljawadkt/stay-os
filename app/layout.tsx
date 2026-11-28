import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Malayalam } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { brand } from "@/config/brand";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const notoMl = Noto_Sans_Malayalam({ subsets: ["malayalam"], variable: "--font-ml", display: "swap" });

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: `${brand.name} · Hostel and PG software for Kerala`, template: `%s · ${brand.name}` },
  description: `${brand.name} collects rent by UPI on WhatsApp and runs rooms, mess, complaints and gate passes for hostels and PGs, in English and Malayalam.`,
  alternates: { canonical: "/" },
  applicationName: brand.name,
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  openGraph: {
    title: `${brand.name} · Hostel operations, on WhatsApp`,
    description: "Rent by UPI, WhatsApp reminders, rooms, mess, complaints and gate passes, in English and Malayalam. 14-day free trial and a live demo hostel.",
    images: [{ url: "/og.jpg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F5" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0E0D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} ${notoMl.variable}`}>
      <head>
        {/* Inside the iOS app, Capacitor is present before any page script runs. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())document.documentElement.setAttribute('data-native','')}catch(e){}" }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
