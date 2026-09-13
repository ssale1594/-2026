import type { BadgeTone } from "@/components/ui/badge";

// Shared between the seller board (/dashboard/bookings) and the buyer list
// (/my/bookings) so a status never renders with two different labels — or,
// now, two different colors for the same state.

export const BOOKING_STATUS: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  pending: { label: "⏳ بانتظار التأكيد", tone: "warning" },
  confirmed: { label: "✅ مؤكّد", tone: "success" },
  completed: { label: "🎉 تم", tone: "info" },
  cancelled: { label: "⛔ ملغى", tone: "danger" },
  no_show: { label: "🚫 لم يحضر", tone: "neutral" },
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
