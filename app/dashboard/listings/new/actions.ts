"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { listingInputSchema } from "@/lib/validation/listing";
import { uniqueSlug } from "@/lib/slug";

export type ListingFormState = { error?: string };

export async function createListing(
  _prevState: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  // The seller comes from the session, never from the submitted form (TECH.md §12.5).
  const seller = await requireSeller();

  const rawPrice = formData.get("price");
  const parsed = listingInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    categoryId: formData.get("categoryId"),
    price: rawPrice === "" || rawPrice === null ? undefined : rawPrice,
    priceNegotiable: formData.get("priceNegotiable") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, listing_type")
    .eq("id", parsed.data.categoryId)
    .eq("is_active", true)
    .single();

  if (!category) {
    return { error: "الفئة غير موجودة" };
  }

  // The free-tier limit is also enforced by the listings_insert_own RLS policy
  // via can_create_listing(); this check only gives a friendlier message.
  const { error } = await supabase.from("listings").insert({
    seller_id: seller.id,
    category_id: category.id,
    listing_type: category.listing_type,
    title: parsed.data.title,
    slug: uniqueSlug(parsed.data.title),
    description: parsed.data.description ?? null,
    price: parsed.data.price ?? null,
    price_negotiable: parsed.data.priceNegotiable,
    status: "pending_review",
  });

  if (error) {
    return { error: "ما قدرنا نحفظ الإعلان — تأكد إنك ما تجاوزت الحد المجاني." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
