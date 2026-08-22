"use client";

import { useState, useTransition } from "react";
import { saveSellerSchedule } from "./booking-actions";
import type { DayRow } from "@/lib/schedule";

const DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export default function ScheduleForm({ initial }: { initial: DayRow[] }) {
  const [rows, setRows] = useState<DayRow[]>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function patch(day: number, p: Partial<DayRow>) {
    setRows((prev) => prev.map((r) => (r.day === day ? { ...r, ...p } : r)));
  }

  // Copies Sunday's hours down the week. Most shops here keep one schedule for
  // the working week and differ only on Friday, so filling seven rows by hand
  // is the common case worth removing.
  function copyFirstToAll() {
    const src = rows[0];
    setRows((prev) =>
      prev.map((r) =>
        r.day === 0 ? r : { ...r, ...src, day: r.day, enabled: src.enabled }
      )
    );
  }

  function submit() {
    setMsg(null);
    const invalid = rows.find((r) => r.enabled && r.endHm <= r.startHm);
    if (invalid) {
      setMsg({
        ok: false,
        text: `${DAYS[invalid.day]}: وقت الإغلاق لازم يكون بعد وقت الفتح.`,
      });
      return;
    }
    start(async () => {
      const res = await saveSellerSchedule(rows);
      if ((res as any).error) {
        setMsg({ ok: false, text: (res as any).error });
        return;
      }
      const n = (res as any).rows_written ?? 0;
      setMsg({
        ok: true,
        text: n === 0 ? "حُفظ — كل الأيام مغلقة حاليًا." : `حُفظ دوام ${n} يوم.`,
      });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-black/60 dark:text-white/60">
          حدّد أيام وساعات دوامك — المشتري ما يشوف إلا الفترات المتاحة داخلها.
        </p>
        <button
          type="button"
          onClick={copyFirstToAll}
          className="text-xs rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
        >
          انسخ دوام الأحد لبقية الأيام
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.day}
            className={[
              "rounded-xl border p-3 transition-colors",
              r.enabled
                ? "border-black/[.12] dark:border-white/[.2]"
                : "border-dashed border-black/[.1] dark:border-white/[.12] opacity-60",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 w-28 shrink-0 font-medium text-sm">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => patch(r.day, { enabled: e.target.checked })}
                />
                {DAYS[r.day]}
              </label>

              {r.enabled ? (
                <>
                  <label className="text-xs inline-flex items-center gap-1">
                    من
                    <input
                      type="time"
                      value={r.startHm}
                      onChange={(e) => patch(r.day, { startHm: e.target.value })}
                      className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs inline-flex items-center gap-1">
                    إلى
                    <input
                      type="time"
                      value={r.endHm}
                      onChange={(e) => patch(r.day, { endHm: e.target.value })}
                      className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs inline-flex items-center gap-1">
                    مدة الموعد
                    <select
                      value={r.slot}
                      onChange={(e) =>
                        patch(r.day, { slot: e.target.value as DayRow["slot"] })
                      }
                      className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-2 py-1 text-sm"
                    >
                      {["15", "30", "45", "60", "90", "120"].map((s) => (
                        <option key={s} value={s}>
                          {s} دقيقة
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs inline-flex items-center gap-1">
                    فاصل
                    <select
                      value={r.buffer}
                      onChange={(e) =>
                        patch(r.day, { buffer: Number(e.target.value) })
                      }
                      className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-2 py-1 text-sm"
                    >
                      {[0, 10, 15, 30, 60].map((b) => (
                        <option key={b} value={b}>
                          {b === 0 ? "بدون" : `${b} د`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs inline-flex items-center gap-1">
                    مواعيد متزامنة
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={r.parallel}
                      onChange={(e) =>
                        patch(r.day, {
                          parallel: Math.max(
                            1,
                            Math.min(20, Number(e.target.value) || 1)
                          ),
                        })
                      }
                      className="w-16 rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                </>
              ) : (
                <span className="text-xs text-black/50 dark:text-white/50">
                  مغلق
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {msg && (
        <div
          className={[
            "rounded-lg px-4 py-2 text-sm",
            msg.ok
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-red-500/10 text-red-700 dark:text-red-300",
          ].join(" ")}
        >
          {msg.text}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "جارٍ الحفظ…" : "احفظ الدوام"}
      </button>
    </div>
  );
}
