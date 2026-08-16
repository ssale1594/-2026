"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { eventInputSchema } from "@/lib/validation/community";

export type EventFormState = { error?: string; success?: boolean };

export async function submitEvent(
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const user = await requireUser();

  const rawNeighborhoodId = formData.get("neighborhoodId");
  const rawEndsAt = formData.get("endsAt");

  const parsed = eventInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    locationText: formData.get("locationText") || undefined,
    neighborhoodId:
      rawNeighborhoodId === "" || rawNeighborhoodId === null
        ? undefined
        : rawNeighborhoodId,
    startsAt: formData.get("startsAt"),
    endsAt: rawEndsAt === "" || rawEndsAt === null ? undefined : rawEndsAt,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({
    created_by: user.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    location_text: parsed.data.locationText ?? null,
    neighborhood_id: parsed.data.neighborhoodId ?? null,
    starts_at: new Date(parsed.data.startsAt).toISOString(),
    ends_at: parsed.data.endsAt
      ? new Date(parsed.data.endsAt).toISOString()
      : null,
    status: "pending_review",
  });

  if (error) {
    return { error: "ما قدرنا نحفظ الفعالية — جرّب مرة ثانية." };
  }

  revalidatePath("/events");
  return { success: true };
}
