import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

/** The public pages, for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : path === "/pricing/" || path === "/features/" || path === "/demo/" ? 0.8 : 0.5,
  }));
}
