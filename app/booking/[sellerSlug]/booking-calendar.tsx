"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitBooking } from "@/app/dashboard/schedule/booking-actions";

export type Slot = {
  slot_date: string;
  start_minute: number;
  end_minute: number;
  is_available: boolean;
};

const DAY_NAMES = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

function hm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60
  ).padStart(2, "0")}`;
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export default function BookingCalendar({
  sellerId,
  sellerName,
  slots,
  isSignedIn,
  loginHref,
}: {
  sellerId: string;
  sellerName: string;
  slots: Slot[];
  isSignedIn: boolean;
  loginHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [serviceTitle, setServiceTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Grouped once rather than per render pass: a 14-day window at 30-minute
  // slots is a few hundred rows, and the group is stable while the form is open.
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = String(s.slot_date).slice(0, 10);
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [slots]);

  const [openDay, setOpenDay] = useState<string | null>(
    byDay.find(([, list]) => list.some((s) => s.is_available))?.[0] ?? null
  );

  function submit() {
    if (!picked) return;
    setError(null);
    start(async () => {
      const res = await submitBooking({
        sellerId,
        bookingDateIso: String(picked.slot_date).slice(0, 10),
        startMinute: picked.start_minute,
        durationMin: picked.end_minute - picked.start_minute,
        serviceTitle,
        customerName,
        customerPhone,
        notes,
      });
      if ((res as any).error) {
        setError((res as any).error);
        return;
      }
      router.push("/my/bookings?booked=1");
      router.refresh();
    });
  }

  if (byDay.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/[.15] dark:border-white/[.25] p-8 text-center">
        <div className="text-4xl mb-3">🗓️</div>
        <p className="font-medium mb-1">ما فيه مواعيد متاحة حاليًا</p>
        <p className="text-sm text-black/60 dark:text-white/60">
          {sellerName} ما حدّد ساعات دوامه بعد، أو كل المواعيد محجوزة. تواصل معه
          مباشرة من صفحته.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* الأيام */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {byDay.map(([day, list]) => {
          const free = list.filter((s) => s.is_available).length;
          const active = openDay === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => {
                setOpenDay(day);
                setPicked(null);
              }}
              disabled={free === 0}
              className={[
                "shrink-0 rounded-xl border px-4 py-3 text-center transition-colors",
                active
                  ? "border-sky-500 bg-sky-500/10"
                  : "border-black/[.12] dark:border-white/[.2] hover:bg-black/5 dark:hover:bg-white/5",
                free === 0 ? "opacity-40 cursor-not-allowed" : "",
              ].join(" ")}
            >
              <div className="text-sm font-medium">{dayLabel(day)}</div>
              <div className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                {free === 0 ? "مكتمل" : `${free} موعد`}
              </div>
            </button>
          );
        })}
      </div>

      {/* الفترات */}
      {openDay && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            مواعيد {dayLabel(openDay)}
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {(byDay.find(([d]) => d === openDay)?.[1] ?? []).map((s) => {
              const sel =
                picked?.slot_date === s.slot_date &&
                picked?.start_minute === s.start_minute;
              return (
                <button
                  key={`${s.slot_date}-${s.start_minute}`}
                  type="button"
                  disabled={!s.is_available}
                  onClick={() => setPicked(s)}
                  className={[
                    "rounded-lg border px-2 py-2 text-sm tabular-nums transition-colors",
                    sel
                      ? "border-sky-500 bg-sky-500/15 font-semibold"
                      : "border-black/[.12] dark:border-white/[.2]",
                    s.is_available
                      ? "hover:bg-black/5 dark:hover:bg-white/5"
                      : "opacity-35 line-through cursor-not-allowed",
                  ].join(" ")}
                >
                  {hm(s.start_minute)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* نموذج التأكيد */}
      {picked && (
        <div className="rounded-xl border border-black/[.12] dark:border-white/[.2] p-4 space-y-3">
          <div className="text-sm">
            <b>الموعد المختار:</b> {dayLabel(String(picked.slot_date).slice(0, 10))}{" "}
            من {hm(picked.start_minute)} إلى {hm(picked.end_minute)}
          </div>

          {!isSignedIn ? (
            <div className="rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-200 px-4 py-3 text-sm">
              لازم تسجّل دخول قبل الحجز.{" "}
              <a href={loginHref} className="underline font-medium">
                سجّل الدخول
              </a>
            </div>
          ) : (
            <>
              <input
                value={serviceTitle}
                onChange={(e) => setServiceTitle(e.target.value)}
                maxLength={120}
                placeholder="الخدمة المطلوبة (اختياري) — مثال: قص شعر"
                className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  maxLength={80}
                  placeholder="اسمك"
                  className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm"
                />
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  maxLength={30}
                  inputMode="tel"
                  placeholder="جوالك للتواصل"
                  className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="ملاحظات للبائع (اختياري)"
                className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm"
              />

              {error && (
                <div className="rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 px-4 py-2 text-sm">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="rounded-lg bg-foreground text-background text-sm font-medium px-5 py-2.5 disabled:opacity-50"
              >
                {pending ? "جارٍ الإرسال…" : "أرسل طلب الحجز"}
              </button>
              <p className="text-xs text-black/50 dark:text-white/50">
                الحجز يبقى معلّقًا حتى يؤكده {sellerName}. الدفع يتم بينك وبينه
                مباشرة — المنصة وسيط فقط.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
