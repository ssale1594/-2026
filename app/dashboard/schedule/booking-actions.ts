"use server";

import { revalidatePath } from "next/cache";
import { requireSeller, requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// تعريف الجدول الزمني للبائع (أيام الأسبوع + ساعات الدوام)
const DayAvailSchema = z.object({
  day: z.number().min(0).max(6),
  enabled: z.boolean(),
  startHm: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  endHm: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  slot: z.enum(["15", "30", "45", "60", "90", "120"]).default("60"),
  buffer: z.number().int().min(0).max(240).default(0),
  parallel: z.number().int().min(1).max(20).default(1),
});
const ScheduleSchema = z.array(DayAvailSchema);

function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

export async function saveSellerSchedule(raw: unknown) {
  const seller = await requireSeller();
  const parsed = ScheduleSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const supabase = await createClient();

  // حذف القديم ثم الإدراج من جديد
  await supabase.from("seller_availability").delete().eq("seller_id", seller.id);
  const rows = parsed.data
    .filter((r) => r.enabled && r.startHm && r.endHm)
    .map((r) => ({
      seller_id: seller.id,
      day_of_week: r.day,
      start_minute: hmToMin(r.startHm!),
      end_minute: hmToMin(r.endHm!),
      is_closed: false,
      slot_duration_minutes: parseInt(r.slot, 10),
      buffer_minutes: r.buffer,
      max_parallel_bookings: r.parallel,
    }));

  if (rows.length) {
    const err = (await supabase.from("seller_availability").insert(rows)).error;
    if (err) return { error: err.message };
  }
  revalidatePath("/dashboard/schedule");
  revalidatePath(`/booking`);
  return { ok: true, rows_written: rows.length };
}

// تقديم طلب حجز جديد من المشتري
const BookingSchema = z.object({
  sellerId: z.string().uuid(),
  listingId: z.string().uuid().optional().nullable(),
  bookingDateIso: z.string().min(8),
  startMinute: z.number().int().min(0).max(1439),
  durationMin: z.number().int().refine((v) => [15, 30, 45, 60, 90, 120].includes(v), "مدة غير مدعومة"),
  serviceTitle: z.string().trim().max(120).optional().or(z.literal("")),
  quotedPrice: z.coerce.number().positive().max(99_999_999).optional().nullable(),
  customerName: z.string().trim().max(80).optional().or(z.literal("")),
  customerPhone: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function submitBooking(raw: unknown) {
  const user = await requireUser();
  const p = BookingSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "بيانات حجز غير صالحة." };
  const v = p.data;
  if (v.sellerId === user.id) return { error: "لا تحجز لنفسك." };
  const dateObj = new Date(v.bookingDateIso);
  if (Number.isNaN(dateObj.getTime())) return { error: "تاريخ الحجز غير صالح." };
  const bookingDate = dateObj.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (bookingDate < today) return { error: "لا يمكن الحجز في تاريخ ماضٍ." };

  const supabase = await createClient();
  const sellerQ = await supabase
    .from("sellers")
    .select("id, slug")
    .eq("id", v.sellerId)
    .maybeSingle();
  if (!sellerQ.data) return { error: "البائع غير موجود." };
  const slug = (sellerQ.data as any).slug;

  // تحقق من أن الفترة المطلوبة ضمن دوام البائع وفترات متاحة
  const slotsQ = await (supabase.rpc as any)("seller_free_slots", {
    p_seller_id: v.sellerId,
    p_start_date: bookingDate,
    p_days: 1,
  });
  const daySlots = ((slotsQ.data as any[]) ?? []).filter(
    (s) =>
      s.slot_date &&
      String(s.slot_date).slice(0, 10) === bookingDate &&
      s.start_minute === v.startMinute
  );
  const slot = daySlots[0];
  if (!slot) return { error: "هذا اليوم مغلق لدى البائع." };
  if (!slot.is_available) return { error: "الفترة المطلوبة محجوزة بالفعل. اختر وقتاً آخر." };

  const insert = await supabase
    .from("seller_bookings")
    .insert({
      seller_id: v.sellerId,
      buyer_id: user.id,
      listing_id: v.listingId ?? null,
      booking_date: bookingDate,
      start_minute: v.startMinute,
      duration_minutes: Number(v.durationMin),
      status: "pending",
      service_title: v.serviceTitle || null,
      quoted_price_sar: v.quotedPrice ?? null,
      customer_name: v.customerName || null,
      customer_phone: v.customerPhone || null,
      notes: v.notes || null,
    })
    .select("id")
    .maybeSingle();
  if (insert.error) {
    if (/exclusion|overlap|conflict/i.test(insert.error.message))
      return { error: "تعارض في الحجوزات — جرّب وقتاً مختلفاً." };
    return { error: insert.error.message };
  }
  const id = (insert.data as any)?.id;
  revalidatePath("/my/bookings");
  revalidatePath("/dashboard/bookings");
  if (slug) revalidatePath(`/booking/${slug}`);
  return { ok: true, id };
}

// إدارة حالات الحجز من البائع
export async function sellerUpdateBookingStatus(
  bookingId: number,
  newStatus: "confirmed" | "completed" | "cancelled" | "no_show",
  cancelReason: string | null = null
) {
  const seller = await requireSeller();
  const supabase = await createClient();

  const q = await supabase
    .from("seller_bookings")
    .select("id, seller_id, buyer_id, status")
    .eq("id", bookingId)
    .single();
  if (q.error) return { error: "الحجز غير موجود." };
  const r = q.data as any;
  if (r.seller_id !== seller.id) return { error: "ليس حجزاً يخصك." };

  const patch: any = { status: newStatus };
  if (newStatus === "cancelled") {
    patch.cancel_reason = cancelReason?.slice(0, 300) ?? null;
    patch.cancelled_by = seller.id;
  }
  const u = await supabase.from("seller_bookings").update(patch).eq("id", bookingId);
  if (u.error) return { error: u.error.message };
  revalidatePath("/dashboard/bookings");
  revalidatePath("/my/bookings");
  return { ok: true };
}

// إلغاء الحجز من المشتري (أثناء pending فقط)
export async function buyerCancelBooking(bookingId: number, reason: string | null = null) {
  const user = await requireUser();
  const supabase = await createClient();
  const q = await supabase
    .from("seller_bookings")
    .select("id, buyer_id, status, seller_id")
    .eq("id", bookingId)
    .single();
  if (q.error) return { error: "الحجز غير موجود." };
  const r = q.data as any;
  if (r.buyer_id !== user.id) return { error: "ليس حجزاً لك." };
  if (r.status !== "pending") return { error: "يمكنك الإلغاء فقط إذا ما زال بانتظار التأكيد." };
  const u = await supabase
    .from("seller_bookings")
    .update({ status: "cancelled", cancel_reason: reason?.slice(0, 300) ?? null, cancelled_by: user.id })
    .eq("id", bookingId);
  if (u.error) return { error: u.error.message };
  revalidatePath("/my/bookings");
  revalidatePath("/dashboard/bookings");
  return { ok: true };
}

