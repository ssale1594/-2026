"use server";

import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Not exported: a "use server" file may only export async functions.
const SaveSearchSchema = z.object({
  name: z.string().trim().min(3, "اسم البحث قصير جداً").max(60, "اسم البحث طويل جداً"),
  keyword: z.string().trim().max(150).nullable().optional(),
  category_id: z.number().int().positive().nullable().optional(),
  neighborhood_id: z.number().int().positive().nullable().optional(),
  min_price_sar: z.number().int().nonnegative().nullable().optional(),
  max_price_sar: z.number().int().nonnegative().nullable().optional(),
  seller_id: z.string().uuid().nullable().optional(),
});

export async function saveCurrentSearch(input: unknown) {
  const user = await requireUser();
  const supabase = await createClient();
  const parsed = SaveSearchSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const p = parsed.data;

  const ins = await supabase.from("saved_searches").insert({
    user_id: user.id,
    name: p.name,
    keyword: p.keyword || null,
    category_id: p.category_id ?? null,
    neighborhood_id: p.neighborhood_id ?? null,
    min_price_sar: p.min_price_sar ?? null,
    max_price_sar: p.max_price_sar ?? null,
    seller_id: p.seller_id ?? null,
    last_checked_at: new Date().toISOString(),
  });
  if (ins.error) {
    if (/duplicate|unique/i.test(ins.error.message))
      return { error: "هناك بحث محفوظ بنفس الاسم. جرّب اسماً مختلفاً." };
    return { error: ins.error.message };
  }
  revalidatePath("/my/saved-searches");
  revalidatePath("/search");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteSavedSearch(id: number) {
  const user = await requireUser();
  const supabase = await createClient();
  const q = await supabase.from("saved_searches").delete().eq("id", id).eq("user_id", user.id);
  if (q.error) return { error: q.error.message };
  revalidatePath("/my/saved-searches");
  revalidatePath("/search");
  return { ok: true };
}

export async function runMatcherOnce() {
  const supabase = await createClient();
  // تستدعى من الـ Cron أو من الـ admin
  const q = await (supabase.rpc as any)("match_new_listings_to_saved_searches");
  return { ok: true, rows: (q.data as any[]) ?? [] };
}

export async function markAlertRead(alertId: number, dismiss = false) {
  const user = await requireUser();
  const supabase = await createClient();
  const patch: any = { read_at: new Date().toISOString() };
  if (dismiss) patch.dismissed = true;
  const q = await supabase
    .from("search_alerts")
    .update(patch)
    .eq("id", alertId)
    .eq("user_id", user.id);
  if (q.error) return { error: q.error.message };
  revalidatePath("/my/saved-searches");
  revalidatePath("/");
  return { ok: true };
}

export async function markAllAlertsRead() {
  const user = await requireUser();
  const supabase = await createClient();
  const q = await supabase
    .from("search_alerts")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (q.error) return { error: q.error.message };
  revalidatePath("/my/saved-searches");
  revalidatePath("/");
  return { ok: true };
}

const _u = requireUser;
