"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export type DirectoryFormState = { error?: string; ok?: string };

export async function upsertDirectoryEntry(
  _prevState: DirectoryFormState,
  formData: FormData
): Promise<DirectoryFormState> {
  await requireAdmin();
  const supabase = await createClient();

  const rawId = String(formData.get("id") ?? "").trim();
  const rawLat = String(formData.get("latitude") ?? "").trim();
  const rawLon = String(formData.get("longitude") ?? "").trim();
  const rawCategory = String(formData.get("categoryId") ?? "").trim();
  const rawNeighborhood = String(formData.get("neighborhoodId") ?? "").trim();

  const { error } = await supabase.rpc("admin_upsert_directory_entry", {
    p_id: rawId ? Number(rawId) : null,
    p_business_name: String(formData.get("businessName") ?? "").trim(),
    p_category_id: rawCategory ? Number(rawCategory) : null,
    p_neighborhood_id: rawNeighborhood ? Number(rawNeighborhood) : null,
    p_phone: String(formData.get("phone") ?? "").trim() || null,
    p_whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
    p_latitude: rawLat ? Number(rawLat) : null,
    p_longitude: rawLon ? Number(rawLon) : null,
    p_address_note: String(formData.get("addressNote") ?? "").trim() || null,
    p_source_note: String(formData.get("sourceNote") ?? "").trim(),
    p_status: String(formData.get("status") ?? "published"),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/directory");
  revalidatePath("/map");
  return { ok: "تم الحفظ." };
}

export async function setDirectoryEntryStatus(id: number, status: "published" | "hidden") {
  await requireAdmin();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("directory_entries")
    .select(
      "business_name, category_id, neighborhood_id, phone, whatsapp_number, latitude, longitude, address_note, source_note"
    )
    .eq("id", id)
    .single();

  if (!current) throw new Error("السجل غير موجود");

  const { error } = await supabase.rpc("admin_upsert_directory_entry", {
    p_id: id,
    p_business_name: current.business_name,
    p_category_id: current.category_id,
    p_neighborhood_id: current.neighborhood_id,
    p_phone: current.phone,
    p_whatsapp: current.whatsapp_number,
    p_latitude: current.latitude,
    p_longitude: current.longitude,
    p_address_note: current.address_note,
    p_source_note: current.source_note,
    p_status: status,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/directory");
  revalidatePath("/map");
}

export async function decideDirectoryClaim(
  claimId: number,
  status: "approved" | "rejected",
  sellerId?: string
) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_decide_directory_claim", {
    p_claim_id: claimId,
    p_status: status,
    p_seller_id: sellerId || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/directory/claims");
  revalidatePath("/map");
}
