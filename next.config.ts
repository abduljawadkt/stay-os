import type { NextConfig } from "next";

// Static export: the same build deploys to Vercel and ships inside the iOS app (Capacitor).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // keep the dev server's compile cache in memory: on-disk it grows to ~1 GB
  experimental: { turbopackFileSystemCacheForDev: false },
};

export default nextConfig;
