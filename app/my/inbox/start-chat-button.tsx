"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { getOrCreateThread } from "./inbox-actions";

export default function StartChatButton({
  listingId,
  dealId,
  sellerId,
  sellerName,
  buyerName,
  subject,
  label = "💬 تواصل داخل المنصة",
  className = "",
  variant = "default",
}: {
  listingId?: string | null;
  dealId?: number | null;
  sellerId?: string | null;
  buyerName?: string | null;
  sellerName?: string | null;
  subject?: string | null;
  buyerId?: string | null;
  label?: string;
  className?: string;
  variant?: "default" | "primary" | "subtle";
}) {
  const [open, setOpen] = useState(false);
  const [firstMsg, setFirstMsg] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const res = await getOrCreateThread({
        listingId: listingId ?? null,
        dealId: dealId ?? null,
        sellerId: sellerId ?? null,
        buyerId: null, // نعتمد على الـ listing/deal للاستدلال
        subject: subject ?? null,
      });
      if ((res as any).error) {
        setMsg({ err: (res as any).error });
        return;
      }
      const tid: number = (res as any).threadId;
      // بعد الإنشاء: نوجه المستخدم لصفحة المحادثة
      if (firstMsg.trim()) {
        // إرسال أول رسالة عبر URL state لاحقاً أو تركها للمستخدم في الصفحة التالية
        sessionStorage.setItem(`chat_first_${tid}`, firstMsg.trim());
      }
      setMsg({ ok: "تم فتح المحادثة، تم التحويل..." });
      setTimeout(() => {
        // التوجيه إلى /my/chat (عميل) أو /dashboard/chat (بائع) حسب توفر الصفحات:
        window.location.href = `/my/chat/${tid}`;
      }, 400);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMsg(null);
          setFirstMsg("");
        }}
        className={[
          variant === "primary"
            ? "rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 shadow"
            : variant === "subtle"
              ? "rounded-lg border border-black/[.12] dark:border-white/[.2] text-sm font-semibold px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"
              : "rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200 text-sm font-semibold px-4 py-2 hover:bg-sky-500/20 shadow-sm",
          className,
        ].join(" ")}
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-black/[.08] dark:border-white/[.145] bg-white dark:bg-neutral-900 shadow-2xl">
            <div className="p-5 border-b border-black/[.06] dark:border-white/[.08]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-extrabold inline-flex items-center gap-2">
                    💬 بدء محادثة
                  </h3>
                  <p className="text-xs opacity-60 mt-1">
                    مع <b>{sellerName || buyerName || "الطرف الآخر"}</b> عبر الدردشة
                    الداخلية في المنصة.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-2xl opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <label className="block">
                <span className="block text-sm font-semibold mb-1">
                  رسالة أولى (اختيارية)
                </span>
                <textarea
                  rows={3}
                  autoFocus
                  value={firstMsg}
                  onChange={(e) => setFirstMsg(e.target.value.slice(0, 500))}
                  className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
                  placeholder="مثال: السلام عليكم، عندي استفسار بسيط حول هذا الإعلان..."
                />
              </label>
              {msg && (
                <div
                  className={[
                    "rounded-xl px-3 py-2 text-xs border",
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
                    ? "bg-black/10 dark:bg-white/10 text-black/40 dark:text-white/40"
                    : "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700",
                ].join(" ")}
              >
                {pending ? "جاري التجهيز..." : "💬 افتح المحادثة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// silence unused for useMemo import that might be needed later
const _m = useMemo;
