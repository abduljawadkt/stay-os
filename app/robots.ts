import type { MetadataRoute } from "next";
import { PRIVATE_AREAS, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

/** Search engines may list the public pages; the apps behind sign-in stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_AREAS] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
