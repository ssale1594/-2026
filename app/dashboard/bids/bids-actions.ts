"use server";

import { requireUser as requireUser, requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const OfferSchema = z.object({
  listingId: z.string().uuid(),
  price: z.coerce.number().positive().max(99_999_999, "السعر مرتفع جداً"),
  message: z.string().trim().max(1000, "الرسالة طويلة جداً").optional(),
});

export async function submitOffer(input: unknown) {
  const user = await requireUser();
  const parsed = OfferSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "عرض غير صالح" };
  const supabase = await createClient();
  const p = parsed.data;

  const lQ = await supabase
    .from("listings")
    .select("id, seller_id, status, title, price, slug")
    .eq("id", p.listingId)
    .single();
  if (lQ.error) return { error: "الإعلان غير موجود" };
  const l = lQ.data as any;
  if (l.status !== "published") return { error: "الإعلان غير متاح حالياً" };
  if (l.seller_id === user.id) return { error: "لا تقدم عرضاً على إعلانك" };

  const insert = await supabase.from("listing_offers").insert({
    listing_id: p.listingId,
    seller_id: l.seller_id,
    offerer_id: user.id,
    offer_price_sar: p.price,
    message: p.message || null,
  });
  if (insert.error) {
    if (/15|minute|duplicate/i.test(insert.error.message))
      return { error: "لقد أرسلت عرضاً لهذا الإعلان قبل أقل من 15 دقيقة — انتظر قليلاً." };
    return { error: insert.error.message };
  }
  try {
    await (supabase.rpc as any)("notify", {
      p_user_id: l.seller_id,
      p_type: "offer_received",
      p_title: "عرض سعر جديد على إعلانك",
      p_body: `عرض ${p.price.toLocaleString("ar-SA")} ر.س على "${l.title?.slice(0, 60)}"`,
      p_link: "/dashboard/bids",
    });
  } catch {
    /* ignore */
  }

  revalidatePath("/dashboard/bids");
  revalidatePath("/my/offers");
  revalidatePath(`/listing/${l.slug ?? ""}`);
  return { ok: true };
}

export async function sellerRespondOffer(
  offerId: number,
  response: "accept" | "reject" | "counter",
  counterPrice: number | null,
  counterMessage: string | null
) {
  const seller = await requireSeller();
  const supabase = await createClient();

  const oQ = await supabase
    .from("listing_offers")
    .select("id, status, seller_id, offerer_id, offer_price_sar, listing_id, valid_until, counter_valid_until")
    .eq("id", offerId)
    .single();
  if (oQ.error) return { error: "العرض غير موجود" };
  const o = oQ.data as any;
  if (o.seller_id !== seller.id) return { error: "ليس عرضاً يخصك" };
  if (!["pending", "countered"].includes(o.status))
    return { error: "هذا العرض لم يعد متاحاً للرد عليه." };
  const base = o.status === "countered" ? o.counter_valid_until : o.valid_until;
  if (base && new Date(base) < new Date()) return { error: "انتهت صلاحية هذا العرض." };

  const patch: any = {};
  if (response === "accept") patch.status = "accepted";
  else if (response === "reject") patch.status = "rejected";
  else {
    if (!counterPrice || counterPrice <= 0) return { error: "لابد من سعر في العرض المضاد." };
    patch.status = "countered";
    patch.counter_price_sar = counterPrice;
    patch.counter_message = counterMessage?.slice(0, 1000) ?? null;
    patch.counter_valid_until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  }

  const updQ = await supabase.from("listing_offers").update(patch).eq("id", offerId);
  if (updQ.error) return { error: updQ.error.message };

  let title: string;
  if (response === "accept") title = "🎉 البائع وافق على عرضك!";
  else if (response === "reject") title = "الأسف، البائع رفض عرضك.";
  else title = `🔄 البائع يقدّم عرضاً مضاداً بـ ${counterPrice?.toLocaleString("ar-SA")} ر.س`;
  try {
    await (supabase.rpc as any)("notify", {
      p_user_id: o.offerer_id,
      p_type: "offer_response",
      p_title: title,
      p_body: response === "counter" && counterMessage ? counterMessage.slice(0, 180) : undefined,
      p_link: "/my/offers",
    });
  } catch {
    /* ignore */
  }

  if (response === "accept") {
    const price = Number(o.offer_price_sar);
    const listingQ = await supabase.from("listings").select("title").eq("id", o.listing_id).single();
    const t = (listingQ.data as any)?.title ?? "عرض مقبول";
    const inserted = await supabase.from("deals").insert({
      listing_id: o.listing_id,
      seller_id: o.seller_id,
      buyer_id: o.offerer_id,
      title: `صفقة: ${t}`,
      description: `أنشئت تلقائياً بعد قبول عرض ${price.toLocaleString("ar-SA")} ر.س`,
      price_agreed_sar: price,
      status: "pending",
    }).select("id").maybeSingle();
    const dealId = (inserted.data as any)?.id;
    if (dealId) {
      await supabase
        .from("listing_offers")
        .update({ status: "deal_created", deal_id: dealId })
        .eq("id", offerId);
    }
  }
  revalidatePath("/dashboard/bids");
  revalidatePath("/my/offers");
  revalidatePath("/my/deals");
  revalidatePath("/dashboard/deals");
  return { ok: true };
}

export async function offererCancel(offerId: number) {
  const user = await requireUser();
  const supabase = await createClient();
  const oQ = await supabase
    .from("listing_offers")
    .select("id, status, offerer_id")
    .eq("id", offerId)
    .single();
  if (oQ.error) return { error: "العرض غير موجود" };
  const o = oQ.data as any;
  if (o.offerer_id !== user.id) return { error: "ليس عرضك" };
  if (!["pending", "countered"].includes(o.status)) return { error: "لا يمكن إلغاؤه" };
  const u = await supabase
    .from("listing_offers")
    .update({ status: "cancelled" })
    .eq("id", offerId);
  if (u.error) return { error: u.error.message };
  revalidatePath("/my/offers");
  revalidatePath("/dashboard/bids");
  return { ok: true };
}

export async function buyerAcceptsCounter(offerId: number) {
  const user = await requireUser();
  const supabase = await createClient();
  const oQ = await supabase
    .from("listing_offers")
    .select("id, status, offerer_id, seller_id, counter_price_sar, listing_id")
    .eq("id", offerId)
    .single();
  if (oQ.error) return { error: "العرض غير موجود" };
  const o = oQ.data as any;
  if (o.offerer_id !== user.id) return { error: "ليس عرضك" };
  if (o.status !== "countered") return { error: "ليس هناك عرض مضاد لقبوله" };

  const price = Number(o.counter_price_sar);
  const updQ = await supabase
    .from("listing_offers")
    .update({ status: "accepted" })
    .eq("id", offerId);
  if (updQ.error) return { error: updQ.error.message };

  const listingQ = await supabase.from("listings").select("title").eq("id", o.listing_id).single();
  const t = (listingQ.data as any)?.title ?? "عرض";
  const inserted = await supabase.from("deals").insert({
    listing_id: o.listing_id,
    seller_id: o.seller_id,
    buyer_id: user.id,
    title: `صفقة: قبول عرض مضاد - ${t}`,
    description: `عند قبول العرض المضاد بسعر ${price.toLocaleString("ar-SA")} ر.س`,
    price_agreed_sar: price,
    status: "pending",
  }).select("id").maybeSingle();
  const dealId = (inserted.data as any)?.id;
  if (dealId) {
    await supabase
      .from("listing_offers")
      .update({ status: "deal_created", deal_id: dealId })
      .eq("id", offerId);
  }
  revalidatePath("/my/offers");
  revalidatePath("/dashboard/bids");
  revalidatePath("/my/deals");
  revalidatePath("/dashboard/deals");
  return { ok: true };
}

export const _u = requireUser;
