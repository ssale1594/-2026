"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGES_PER_LISTING = 8;

async function assertOwnsListing(sellerId: string, listingId: string) {
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("seller_id", sellerId)
    .single();

  if (!listing) throw new Error("الإعلان غير موجود");
  return supabase;
}

export async function addListingImage(listingId: string, storagePath: string) {
  const seller = await requireSeller();
  const supabase = await assertOwnsListing(seller.id, listingId);

  const { count } = await supabase
    .from("listing_images")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);

  if ((count ?? 0) >= MAX_IMAGES_PER_LISTING) {
    // The uploaded file already sits in storage; drop it since we won't link it.
    await supabase.storage.from("listing-images").remove([storagePath]);
    throw new Error(`الحد الأقصى ${MAX_IMAGES_PER_LISTING} صور لكل إعلان`);
  }

  const { error } = await supabase.from("listing_images").insert({
    listing_id: listingId,
    storage_path: storagePath,
    is_primary: (count ?? 0) === 0,
    sort_order: count ?? 0,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/listings/${listingId}/edit`);
}

export async function deleteListingImage(
  listingId: string,
  imageId: string,
  storagePath: string
) {
  const seller = await requireSeller();
  const supabase = await assertOwnsListing(seller.id, listingId);

  const { error } = await supabase.from("listing_images").delete().eq("id", imageId);
  // Only remove the storage object once the DB row is confirmed gone — otherwise
  // a failed DB delete leaves listing_images pointing at a missing file.
  if (!error) {
    await supabase.storage.from("listing-images").remove([storagePath]);
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
}
