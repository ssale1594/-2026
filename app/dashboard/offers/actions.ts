"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { offerInputSchema } from "@/lib/validation/offer";

export type OfferFormState = { error?: string; success?: boolean };

export async function createOffer(
  _prevState: OfferFormState,
  formData: FormData
): Promise<OfferFormState> {
  const seller = await requireSeller();

  if (seller.verification_status !== "approved") {
    return { error: "حسابك لسا تحت المراجعة — ما تقدر تنشر عروض بعد." };
  }

  const rawListingId = formData.get("listingId");
  const parsed = offerInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    listingId: rawListingId === null ? undefined : rawListingId,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("offers").insert({
    seller_id: seller.id,
    listing_id: parsed.data.listingId || null,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    starts_at: new Date(parsed.data.startsAt).toISOString(),
    ends_at: new Date(parsed.data.endsAt).toISOString(),
    status: "pending_review",
  });

  if (error) {
    return { error: "ما قدرنا نحفظ العرض — جرّب مرة ثانية." };
  }

  revalidatePath("/dashboard/offers");
  return { success: true };
}

export async function deleteOffer(offerId: number) {
  const seller = await requireSeller();
  const supabase = await createClient();

  const { error } = await supabase
    .from("offers")
    .delete()
    .eq("id", offerId)
    .eq("seller_id", seller.id);

  if (error) {
    throw new Error("ما قدرنا نحذف العرض — جرّب مرة ثانية.");
  }

  revalidatePath("/dashboard/offers");
}
