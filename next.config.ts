import type { NextConfig } from "next";

// The web app deploys to Vercel as a normal Next.js app (it needs one server route: /api/auth, see
// app/api/auth). The iOS app (Capacitor) ships a static export of the same pages: STATIC_EXPORT=1.
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
  // keep the dev server's compile cache in memory: on-disk it grows to ~1 GB
  experimental: { turbopackFileSystemCacheForDev: false },
};

export default nextConfig;
