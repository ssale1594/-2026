"use client";

import { useState, useTransition } from "react";
import { saveCurrentSearch } from "./saved-searches-actions";

type Filters = {
  keyword?: string | null;
  category_id?: number | null;
  neighborhood_id?: number | null;
  min_price_sar?: number | null;
  max_price_sar?: number | null;
  seller_id?: string | null;
};

function summarizeFilters(f: Filters): string[] {
  const out: string[] = [];
  if (f.keyword) out.push(`"${f.keyword}"`);
  if (f.min_price_sar != null || f.max_price_sar != null) {
    out.push(
      `السعر ${f.min_price_sar ?? 0}–${f.max_price_sar ?? "∞"} ر.س`
    );
  }
  return out;
}

export default function SaveSearchFab({
  filters,
  defaultName,
  compact = false,
}: {
  filters: Filters;
  defaultName?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName || "");
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const summary = summarizeFilters(filters);

  function run() {
    const finalName = (name || defaultName || "").trim();
    if (!finalName) {
      setMsg({ err: "أكتب اسماً للبحث أولاً." });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await saveCurrentSearch({ name: finalName, ...filters });
      if ((res as any).error) setMsg({ err: (res as any).error });
      else {
        setMsg({ ok: "تم حفظ البحث! سيُشعرك فور صدور أي إعلان يطابقه." });
        setTimeout(() => {
          setOpen(false);
          setMsg(null);
        }, 1200);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setName(defaultName || "");
          setMsg(null);
        }}
        className={[
          compact
            ? "rounded-full border border-black/[.12] dark:border-white/[.2] text-xs font-semibold px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 inline-flex items-center gap-1.5"
            : "rounded-xl border border-indigo-500/40 bg-gradient-to-br from-indigo-500/10 via-white to-indigo-500/10 dark:from-indigo-950/30 dark:via-neutral-900 dark:to-indigo-950/30 text-sm font-bold px-4 py-2.5 hover:shadow inline-flex items-center gap-2 shadow",
        ].join(" ")}
        title="احفظ البحث وتبيّن عند صدور إعلانات جديدة تطابقه"
      >
        💾 حفظ هذا البحث
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-black/[.08] dark:border-white/[.145] bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-black/[.06] dark:border-white/[.08]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-extrabold inline-flex items-center gap-2">
                    💾 احفظ معايير البحث الحالية
                  </h3>
                  <p className="text-xs opacity-60 mt-1">
                    سنشعرك فور نشر إعلان جديد يطابق هذه المعايير — بدون الحاجة لمراجعة البحث يومياً.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-2xl opacity-60 hover:opacity-100"
                  aria-label="إغلاق"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {summary.length > 0 && (
                <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 text-xs space-y-0.5">
                  <div className="font-bold opacity-80 mb-0.5">المعايير التي سيتم حفظها:</div>
                  {summary.map((s, i) => (
                    <div key={i}>· {s}</div>
                  ))}
                </div>
              )}
              <label className="block">
                <span className="block text-sm font-semibold mb-1">اسم للبحث</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 60))}
                  className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
                  placeholder="مثال: شقق حي الصالحية 250 ألف"
                />
              </label>
              {msg && (
                <div
                  className={[
                    "rounded-xl px-3 py-2 text-sm border",
                    msg.ok
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200",
                  ].join(" ")}
                >
                  {msg.ok ?? msg.err}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-black/[.06] dark:border-white/[.08]">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm border border-black/[.12] dark:border-white/[.2] hover:bg-black/5 dark:hover:bg-white/10"
              >
                إلغاء
              </button>
              <button
                onClick={run}
                disabled={pending}
                className={[
                  "rounded-lg px-5 py-2 text-sm font-bold shadow",
                  pending
                    ? "bg-black/10 text-black/40 dark:text-white/40"
                    : "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700",
                ].join(" ")}
              >
                {pending ? "جاري الحفظ..." : "💾 حفظ البحث"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
