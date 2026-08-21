// Plain data helpers shared between the server page (which loads saved rows)
// and the client form (which edits them). This used to live inside
// schedule-form.tsx, but that file is "use client" — every export from a
// "use client" module becomes an opaque client reference on import, so the
// server page couldn't actually call rowsFromDb() at all ("Attempted to call
// rowsFromDb() from the server but rowsFromDb is on the client").

const DAYS_COUNT = 7;

export type DayRow = {
  day: number;
  enabled: boolean;
  startHm: string;
  endHm: string;
  slot: "15" | "30" | "45" | "60" | "90" | "120";
  buffer: number;
  parallel: number;
};

function minToHm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60
  ).padStart(2, "0")}`;
}

export function rowsFromDb(
  saved: {
    day_of_week: number;
    start_minute: number;
    end_minute: number;
    is_closed: boolean;
    slot_duration_minutes: number;
    buffer_minutes: number;
    max_parallel_bookings: number;
  }[]
): DayRow[] {
  return Array.from({ length: DAYS_COUNT }, (_, day) => {
    const row = saved.find((s) => s.day_of_week === day);
    if (!row || row.is_closed) {
      return {
        day,
        enabled: false,
        startHm: "09:00",
        endHm: "17:00",
        slot: "60" as const,
        buffer: 0,
        parallel: 1,
      };
    }
    return {
      day,
      enabled: true,
      startHm: minToHm(row.start_minute),
      endHm: minToHm(row.end_minute),
      slot: String(row.slot_duration_minutes) as DayRow["slot"],
      buffer: row.buffer_minutes,
      parallel: row.max_parallel_bookings,
    };
  });
}
