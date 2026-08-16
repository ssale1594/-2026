import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // TECH.md §8 — private areas and zero-value dynamic search pages stay out.
      disallow: [
        "/dashboard",
        "/admin",
        "/my",
        "/notifications",
        "/ask/new",
        "/api",
        "/auth",
        "/login",
        "/search",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
