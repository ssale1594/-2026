"use server";

import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleFavorite(listingId: string, isFav: boolean) {
  const user = await requireUser();
  const supabase = await createClient();

  if (isFav) {
    const delQ = await supabase
      .from("favorite_listings")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", listingId);
    if (delQ.error) return { error: delQ.error.message };
  } else {
    const insQ = await supabase.from("favorite_listings").insert({
      user_id: user.id,
      listing_id: listingId,
    });
    if (insQ.error) return { error: insQ.error.message };
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/my/favorites");
  revalidatePath(`/listing`);
  return { ok: true, nowFav: !isFav };
}

export async function removeFavorite(listingId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const delQ = await supabase
    .from("favorite_listings")
    .delete()
    .eq("user_id", user.id)
    .eq("listing_id", listingId);
  if (delQ.error) return { error: delQ.error.message };
  revalidatePath("/my/favorites");
  return { ok: true };
}
