"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { listingInputSchema } from "@/lib/validation/listing";

export type EditFormState = { error?: string };

export async function updateListing(
  listingId: string,
  _prevState: EditFormState,
  formData: FormData
): Promise<EditFormState> {
  const seller = await requireSeller();

  const rawPrice = formData.get("price");
  const rawNeighborhoodId = formData.get("neighborhoodId");
  const parsed = listingInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    categoryId: formData.get("categoryId"),
    neighborhoodId:
      rawNeighborhoodId === "" || rawNeighborhoodId === null
        ? undefined
        : rawNeighborhoodId,
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

  // Edits send the listing back for review, so a published listing cannot be
  // swapped for different content after approval.
  const { error } = await supabase
    .from("listings")
    .update({
      category_id: category.id,
      neighborhood_id: parsed.data.neighborhoodId ?? null,
      listing_type: category.listing_type,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      price: parsed.data.price ?? null,
      price_negotiable: parsed.data.priceNegotiable,
      status: "pending_review",
    })
    .eq("id", listingId)
    // Scoping by seller_id keeps one seller from editing another's listing even
    // if the id is tampered with (RLS enforces this too).
    .eq("seller_id", seller.id);

  if (error) {
    return { error: "ما قدرنا نحفظ التعديل — جرّب مرة ثانية." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// TECH.md §12.7 — soft delete: keep the row for disputes and accidental deletes.
export async function archiveListing(listingId: string) {
  const seller = await requireSeller();
  const supabase = await createClient();

  const { error } = await supabase
    .from("listings")
    .update({ status: "archived" })
    .eq("id", listingId)
    .eq("seller_id", seller.id);

  // Swallowing this made a rejected archive look identical to a successful one:
  // the page revalidated and the listing was simply still there, with nothing
  // telling the seller why.
  if (error) {
    throw new Error("ما قدرنا نأرشف الإعلان — جرّب مرة ثانية.");
  }

  revalidatePath("/dashboard");
}
