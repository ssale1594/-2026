"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { parseCoordinates, looksOutsideZulfi, swapped } from "@/lib/geo";

export type LocationFormState = { error?: string; ok?: string };

export async function saveLocation(
  _prevState: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  const seller = await requireSeller();
  const supabase = await createClient();

  const rawLocation = String(formData.get("mapLink") ?? "").trim();
  const addressNote = String(formData.get("addressNote") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const rawNeighborhood = String(formData.get("neighborhoodId") ?? "").trim();

  let latitude: number | null = null;
  let longitude: number | null = null;

  if (rawLocation) {
    const parsed = parseCoordinates(rawLocation);

    if (!parsed) {
      return {
        error:
          "ما قدرنا نقرأ الموقع من هذا الرابط. افتح الموقع بخرائط قوقل، انسخ الرابط الكامل من شريط العنوان، أو الصق الإحداثيات بصيغة: 26.2994, 44.8144",
      };
    }

    // A backwards pair is the single most common mistake here, and it puts the
    // shop in the middle of nowhere silently. Catch it and say so.
    if (looksOutsideZulfi(parsed)) {
      const flipped = swapped(parsed);
      if (!looksOutsideZulfi(flipped)) {
        return {
          error: `يبدو أن خط الطول وخط العرض معكوسان. جرّب: ${flipped.latitude}, ${flipped.longitude}`,
        };
      }
      return {
        error:
          "هذا الموقع يبدو خارج الزلفي. تأكد أنك نسخت الرابط الصحيح — أو تجاهل هذي الرسالة وتواصل معنا لو محلك فعلاً خارج الزلفي.",
      };
    }

    latitude = parsed.latitude;
    longitude = parsed.longitude;
  }

  if (phone && !/^[\d\s+()-]{7,20}$/.test(phone)) {
    return { error: "رقم الهاتف غير صالح." };
  }

  if (addressNote.length > 300) {
    return { error: "وصف الموقع طويل — 300 حرف كحد أقصى." };
  }

  const neighborhoodId =
    rawNeighborhood && Number.isFinite(Number(rawNeighborhood))
      ? Number(rawNeighborhood)
      : null;

  const { error } = await supabase
    .from("sellers")
    .update({
      latitude,
      longitude,
      address_note: addressNote || null,
      phone: phone || null,
      neighborhood_id: neighborhoodId,
    })
    // Scoped by id even though RLS enforces it too — the seller comes from the
    // session, never from the form (TECH.md §12.5).
    .eq("id", seller.id);

  if (error) {
    return { error: "ما قدرنا نحفظ الموقع — جرّب مرة ثانية." };
  }

  revalidatePath("/dashboard/location");
  revalidatePath("/map");
  revalidatePath(`/seller/${seller.slug}`);

  return {
    ok: latitude
      ? "تم حفظ الموقع ✅ محلك صار يظهر على دليل الخريطة."
      : "تم الحفظ. أضف رابط الموقع عشان تظهر على الخريطة.",
  };
}
