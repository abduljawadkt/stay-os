import type { NextConfig } from "next";

// Static export: the same build deploys to Vercel and ships inside the iOS app (Capacitor).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
