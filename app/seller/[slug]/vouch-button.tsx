"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  vouchForSeller,
  removeVouch,
  type VouchState,
} from "./vouch-actions";

const RELATIONS: { k: string; label: string }[] = [
  { k: "customer", label: "زبون" },
  { k: "repeated_customer", label: "زبون دائم" },
  { k: "neighbour", label: "جارٍ في الحي" },
  { k: "family", label: "أقارب / عائلة" },
  { k: "friend", label: "صديق" },
  { k: "service_provider", label: "مقدم خدمات له" },
  { k: "other", label: "آخر" },
];

export default function VouchButton({
  sellerId,
  isSignedIn,
  alreadyVouched,
  isSelf,
}: {
  sellerId: string;
  isSignedIn: boolean;
  alreadyVouched: boolean;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [vouched, setVouched] = useState(alreadyVouched);
  const [state, setState] = useState<VouchState>({});
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [rel, setRel] = useState<string>("customer");

  if (isSelf) return null;

  if (!isSignedIn) {
    return (
      <p className="text-xs text-black/40 dark:text-white/40">
        <Link href="/login" className="hover:underline">
          سجّل دخولك
        </Link>{" "}
        عشان توصّي بهذا البائع لجيرانك.
      </p>
    );
  }

  function submitVouch() {
    setState({});
    startTransition(async () => {
      const r = await vouchForSeller(sellerId, { comment, relation: rel });
      setState(r);
      if (r.success) setVouched(true);
    });
  }
  function unVouch() {
    setState({});
    startTransition(async () => {
      const r = await removeVouch(sellerId);
      setState(r);
      if (r.success) setVouched(false);
    });
  }

  if (vouched && !open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-green-700 dark:text-green-500 font-bold">
          ✓ وصّيت بهذا البائع. شكراً لك يا جارٍ!
        </p>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full border border-black/10 dark:border-white/15 text-[11px] px-2.5 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
        >
          عدّل تعليقي
        </button>
        <button
          disabled={isPending}
          onClick={unVouch}
          className="rounded-full border border-rose-400/30 text-rose-600 dark:text-rose-300 text-[11px] px-2.5 py-0.5 hover:bg-rose-500/10"
        >
          إلغاء التوصية
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        disabled={isPending}
        onClick={() => (vouched ? setOpen(true) : setOpen(true))}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 shadow-sm disabled:opacity-50"
      >
        {isPending ? "جارٍ..." : vouched ? "عدّل توصيتي" : "👥 أوصّي بهذا البائع"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-xl rounded-2xl border border-black/[.08] dark:border-white/[.14] bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-black/[.06] dark:border-white/[.08]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold inline-flex items-center gap-2">
                    👥 أضف توصيتك للبائع
                  </h3>
                  <p className="text-xs opacity-60 mt-1">
                    رأيك يهمنا! شارك تجربتك ليرى باقي الجيران مدى جودة هذا البائع.
                    التعليق اختياري لكنه يزيد الثقة بشكل كبير.
                  </p>
                </div>
                <button onClick={() => setOpen(false)} className="text-2xl opacity-60 hover:opacity-100">×</button>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <label className="block">
                <span className="block text-sm font-bold mb-1">
                  ما هي علاقتك بالبائع؟
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {RELATIONS.map((r) => (
                    <button
                      type="button"
                      key={r.k}
                      onClick={() => setRel(r.k)}
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-bold transition",
                        rel === r.k
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white/60 border-black/10 hover:bg-white dark:bg-white/5 dark:border-white/15 dark:hover:bg-white/10",
                      ].join(" ")}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </label>

              <label className="block">
                <span className="block text-sm font-bold mb-1">
                  تعليقك عن تجربتك (اختياري · 400 حرف أقصى)
                </span>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 400))}
                  placeholder="مثال: سريع، أمين، أسعاره مناسبة. تعاملت معه أكثر من مرة وكل مرة راضٍ 100%. أنصحه بصراحة."
                  className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 text-sm bg-transparent"
                />
                <div className="text-[10px] opacity-50 text-left mt-0.5">
                  {comment.length} / 400 حرف
                </div>
              </label>

              {state.error && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 px-3 py-2 text-sm">
                  {state.error}
                </div>
              )}
              {state.success && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 px-3 py-2 text-sm">
                  ✅ تم حفظ توصيتك!
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
                onClick={() => {
                  submitVouch();
                  setTimeout(() => {
                    if (!state.error) setOpen(false);
                  }, 700);
                }}
                disabled={isPending}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-sm font-bold shadow disabled:opacity-50"
              >
                {isPending ? "جارٍ الحفظ..." : "📣 شارك توصيتك"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
