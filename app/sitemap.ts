import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [categories, neighborhoods, journeys, questions, sellers, listings] =
    await Promise.all([
    supabase.from("categories").select("slug").eq("is_active", true),
    supabase.from("neighborhoods").select("slug"),
    supabase.from("journeys").select("slug").eq("is_active", true),
    supabase
      .from("questions")
      .select("id, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("sellers")
      .select("slug, updated_at")
      .eq("verification_status", "approved"),
    supabase
      .from("listings")
      .select("slug, updated_at")
      .eq("status", "published"),
  ]);

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/whats-new`,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/offers`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/ask`,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/jobs`,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/events`,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/needs`,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/needs/new`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/refer-a-business`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/terms`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/refund`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    ...(categories.data ?? []).map((category) => ({
      url: `${siteUrl}/category/${category.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...(neighborhoods.data ?? []).map((neighborhood) => ({
      url: `${siteUrl}/neighborhood/${neighborhood.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...(journeys.data ?? []).map((journey) => ({
      url: `${siteUrl}/journey/${journey.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...(questions.data ?? []).map((question) => ({
      url: `${siteUrl}/ask/${question.id}`,
      lastModified: new Date(question.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...(sellers.data ?? []).map((seller) => ({
      url: `${siteUrl}/seller/${seller.slug}`,
      lastModified: new Date(seller.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...(listings.data ?? []).map((listing) => ({
      url: `${siteUrl}/listing/${listing.slug}`,
      lastModified: new Date(listing.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
