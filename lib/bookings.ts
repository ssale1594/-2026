// Shared between the seller board (/dashboard/bookings) and the buyer list
// (/my/bookings) so a status never renders with two different labels.

export const BOOKING_STATUS: Record<
  string,
  { label: string; cls: string }
> = {
  pending: {
    label: "⏳ بانتظار التأكيد",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  confirmed: {
    label: "✅ مؤكّد",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  completed: {
    label: "🎉 تم",
    cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  cancelled: {
    label: "⛔ ملغى",
    cls: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  },
  no_show: {
    label: "🚫 لم يحضر",
    cls: "bg-black/10 dark:bg-white/10 text-black/60 dark:text-white/60 border-black/20 dark:border-white/20",
  },
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

export function minutesToHm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60
  ).padStart(2, "0")}`;
}

export function bookingWhen(
  dateIso: string,
  startMinute: number,
  durationMinutes: number
): string {
  const d = new Date(`${String(dateIso).slice(0, 10)}T00:00:00`);
  const day = `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  return `${day} · ${minutesToHm(startMinute)} — ${minutesToHm(
    startMinute + durationMinutes
  )}`;
}

// Upcoming means confirmed or still pending and not in the past. Used to split
// both lists so the part that needs action sits at the top.
export function isUpcoming(dateIso: string, status: string): boolean {
  if (status === "cancelled" || status === "no_show" || status === "completed")
    return false;
  return String(dateIso).slice(0, 10) >= new Date().toISOString().slice(0, 10);
}
