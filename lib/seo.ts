import type { Metadata } from "next";
import { brand } from "@/config/brand";

export const SITE_URL = `https://${brand.domain}`;

/** The public pages search engines should list, for the sitemap. */
export const PUBLIC_PAGES = ["/", "/features/", "/pricing/", "/demo/", "/signup/", "/login/", "/terms/", "/privacy/"] as const;

/** Areas behind sign-in: never listed by search engines. */
export const PRIVATE_AREAS = ["/dashboard/", "/resident/", "/parent/", "/admin/", "/onboarding/", "/start/", "/api/"] as const;

/** A public page's own tab title, description and link preview (the root layout adds " · StayOS" to the title). */
export function pageMeta({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} · ${brand.name}`,
      description,
      url: path,
      siteName: brand.name,
      images: [{ url: "/og.jpg", width: 1200, height: 630 }],
      type: "website",
    },
  };
}

/** Left out of search results, with no canonical link (the root layout points "/" at itself). */
export const PRIVATE: Metadata = { robots: { index: false, follow: false }, alternates: { canonical: null } };

/** A page with its own tab title that search engines should leave out (sign-in steps, private areas). */
export function privateMeta(title: string): Metadata {
  return { title, ...PRIVATE };
}
