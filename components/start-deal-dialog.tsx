"use client";

import { useState, useTransition } from "react";
import { buyerInitiateDeal } from "@/app/deals/deals-actions";

export default function StartDealDialog({
  listingId,
  listingTitle,
  listingPrice,
  sellerId,
  sellerName,
  className = "",
}: {
  listingId?: string | null;
  listingTitle?: string | null;
  listingPrice?: number | null;
  sellerId: string;
  sellerName?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(listingTitle ? `صفقة: ${listingTitle}` : "");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState<string>(listingPrice ? String(listingPrice) : "");
  const [deadline, setDeadline] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [pending, setTransition] = useTransition();

  function close() {
    setOpen(false);
    setMsg(null);
  }

  function openDialog() {
    setOpen(true);
    setMsg(null);
  }

  function submit() {
    if (!title) {
      setMsg({ err: "أدخل عنوان للصفقة على الأقل" });
      return;
    }
    setTransition(async () => {
      const priceNum = price ? Number(price) : null;
      const res = await buyerInitiateDeal(
        listingId ?? null,
        sellerId,
        title,
        desc,
        priceNum,
        deadline || null,
        notes
      );
      if ((res as any).error) {
        setMsg({ err: (res as any).error });
      } else {
        setMsg({
          ok: "تم إرسال طلب الصفقة إلى البائع! سيظهر لك إشعار بمجرد قبوله أو رفضه.",
        });
        setTimeout(close, 1500);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={[
          "rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-semibold shadow transition",
          className,
        ].join(" ")}
      >
        📝 ابدأ صفقة تعاقد رسمية
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={close}
          />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-neutral-900 text-black dark:text-white shadow-2xl border border-black/[.08] dark:border-white/[.145] max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-black/[.06] dark:border-white/[.08]">
              <div>
                <h3 className="text-xl font-extrabold inline-flex items-center gap-2">
                  📝 بدء صفقة تعاقد رسمية
                </h3>
                <p className="text-xs text-black/55 dark:text-white/60 mt-1 max-w-lg">
                  احفظ حقوقك: صفقة موثّقة في المنصة بينك وبين{" "}
                  <b>{sellerName || "البائع"}</b> — بما فيها السعر المتفق عليه
                  وموعد التسليم — تستخدمها لاحقاً في حالة الخصومة.
                </p>
              </div>
              <button
                onClick={close}
                className="text-2xl opacity-60 hover:opacity-100 shrink-0"
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
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200",
                  ].join(" ")}
                >
                  {msg.ok ?? msg.err}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block md:col-span-2">
                  <span className="block text-sm font-semibold mb-1">عنوان الصفقة</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 250))}
                    className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent"
                    placeholder="مثال: صفقة شراء دفاية غاز 12 كجم"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-semibold mb-1">
                    السعر المتفق عليه (ر.س - اختياري)
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent"
                    placeholder="350"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-semibold mb-1">
                    موعد التسليم المطلوب (اختياري)
                  </span>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="block text-sm font-semibold mb-1">
                    تفاصيل الصفقة (ماذا تشمل؟ ماذا تتوقع؟)
                  </span>
                  <textarea
                    rows={3}
                    value={desc}
                    onChange={(e) => setDesc(e.target.value.slice(0, 2000))}
                    className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
                    placeholder="مثال: توصيل للحي القديم، الضمان 6 أشهر، يشمل التركيب..."
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="block text-sm font-semibold mb-1">
                    ملاحظات توصيل أو تنسيق الدفع (اختياري)
                  </span>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
                    className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
                    placeholder="مثال: نقد عند الاستلام، التوصيل بعد صلاة العصر..."
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 p-5 border-t border-black/[.06] dark:border-white/[.08]">
              <button
                onClick={close}
                className="rounded-lg px-4 py-2 text-sm border border-black/[.12] dark:border-white/[.2] hover:bg-black/5 dark:hover:bg-white/10"
              >
                إلغاء
              </button>
              <button
                onClick={submit}
                disabled={pending || !title}
                className={[
                  "rounded-lg px-5 py-2 text-sm font-bold",
                  !pending && title
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow"
                    : "bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40 cursor-not-allowed",
                ].join(" ")}
              >
                {pending ? "جاري الإرسال..." : "📨 أرسل طلب الصفقة للبائع"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
