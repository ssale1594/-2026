"use client";

import { useState, useTransition } from "react";
import { submitReport } from "@/app/admin/moderation/moderation-actions";
import {
  REPORT_REASONS as REASONS,
  type ReportTargetType,
} from "@/lib/validation/report";

export default function ReportDialog({
  targetType,
  targetId,
  label = "الإبلاغ عن محتوى",
  className = "",
}: {
  targetType: ReportTargetType;
  targetId: number | string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setReason("");
    setDetails("");
    setMsg(null);
    setOpen(false);
  }

  function submit() {
    if (!reason) {
      setMsg({ err: "اختر سببًا على الأقل" });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await submitReport(targetType, targetId, reason, details);
      if ((res as any).error) {
        setMsg({ err: (res as any).error });
      } else {
        setMsg({ ok: "تم إرسال البلاغ بنجاح، فريق الإدارة سيراجعه خلال 24 ساعة. شكراً لمساهمتك 🤝" });
        setTimeout(reset, 1800);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMsg(null);
        }}
        className={[
          "text-xs rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-1.5 hover:bg-rose-500/10 hover:border-rose-500/40 hover:text-rose-600 dark:hover:text-rose-300 transition-colors",
          className,
        ].join(" ")}
        title="إبلاغ الإدارة عن هذا المحتوى"
      >
        🚩 {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={reset}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 text-black dark:text-white shadow-2xl border border-black/[.08] dark:border-white/[.145] max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-black/[.06] dark:border-white/[.08]">
              <div>
                <h3 className="text-lg font-bold inline-flex items-center gap-2">
                  🚩 إبلاغ عن محتوى
                </h3>
                <p className="text-xs text-black/50 dark:text-white/60 mt-1">
                  سنراجع البلاغ خلال 24 ساعة. نرجو ذكر التفاصيل الدقيقة لتسريع الفحص.
                </p>
              </div>
              <button
                onClick={reset}
                className="text-xl opacity-60 hover:opacity-100 shrink-0"
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              {msg && (
                <div
                  className={[
                    "rounded-xl px-3 py-2 text-sm border",
                    msg.ok
                      ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-800 dark:text-rose-200 border-rose-500/30",
                  ].join(" ")}
                >
                  {msg.ok ?? msg.err}
                </div>
              )}

              <div>
                <div className="text-sm font-semibold mb-2">ما سبب الإبلاغ؟</div>
                <div className="space-y-2">
                  {REASONS.map((r) => (
                    <label
                      key={r.code}
                      className={[
                        "block rounded-xl border p-3 cursor-pointer transition",
                        reason === r.code
                          ? "border-rose-500/50 bg-rose-500/10"
                          : "border-black/[.08] dark:border-white/[.145] hover:border-black/20 dark:hover:border-white/30",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="reportReason"
                          value={r.code}
                          checked={reason === r.code}
                          onChange={() => setReason(r.code)}
                          className="mt-1.5 accent-rose-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-bold">{r.label}</div>
                          <div className="text-xs opacity-65 mt-0.5">{r.desc}</div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="block text-sm font-semibold mb-1.5">
                  تفاصيل إضافية (اختياري، لأعلى سرعة)
                </span>
                <textarea
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 2000))}
                  placeholder="مثال: البائع طلب تحويل مبلغ قبل التسليم ولم يرسل البضاعة..."
                  className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
                />
                <div className="text-[10px] opacity-60 text-left mt-0.5">
                  {details.length}/2000
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-black/[.06] dark:border-white/[.08]">
              <button
                onClick={reset}
                className="rounded-lg px-4 py-2 text-sm border border-black/[.12] dark:border-white/[.2] hover:bg-black/5 dark:hover:bg-white/10"
              >
                إلغاء
              </button>
              <button
                onClick={submit}
                disabled={pending || !reason}
                className={[
                  "rounded-lg px-5 py-2 text-sm font-bold transition",
                  !pending && reason
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow"
                    : "bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40 cursor-not-allowed",
                ].join(" ")}
              >
                {pending ? "جاري الإرسال..." : "🚩 إرسال البلاغ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
