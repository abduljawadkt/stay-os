import type { NextConfig } from "next";

// The web app deploys to Vercel as a normal Next.js app (it needs one server route: /api/auth, see
// app/api/auth). The iOS app (Capacitor) ships a static export of the same pages: STATIC_EXPORT=1.
const staticExport = process.env.STATIC_EXPORT === "1";

// Sent with every page on the web. No other site may show StayOS inside a frame (which could trick someone
// into tapping "Mark paid" or "Approve"). Camera and microphone stay available to StayOS itself: complaint
// photos and asking StayOS by voice.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const } : { headers: async () => [{ source: "/:path*", headers: securityHeaders }] }),
  trailingSlash: true,
  images: { unoptimized: true },
  // keep the dev server's compile cache in memory: on-disk it grows to ~1 GB
  experimental: { turbopackFileSystemCacheForDev: false },
};

export default nextConfig;
