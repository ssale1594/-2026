"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createPaymentProofSignedUrl,
  cancelPayment,
} from "@/app/deals/payment-actions";

type Proof = {
  id: number;
  deal_id: number;
  submitted_by: string;
  paid_by_buyer: boolean;
  payment_method: string;
  amount_sar: number;
  reference_number: string | null;
  bank_name: string | null;
  transfer_date: string | null;
  payer_account_last4: string | null;
  proof_storage_path: string | null;
  proof_mime_type: string | null;
  proof_filename: string | null;
  proof_size_bytes: number | null;
  notes: string | null;
  status: string;
  verified_at: string | null;
  verification_notes: string | null;
  created_at: string;
  submitter?: { full_name?: string | null; id: string } | null;
};

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "🏦 تحويل بنكي",
  stc_pay: "💠 STC Pay / موبايل باي",
  cash_on_delivery: "💵 نقد عند التسليم",
  other: "📎 طريقة أخرى",
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: "قيد المراجعة", cls: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300/60" },
  verified: { label: "تمت المصادقة ✅", cls: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300/60" },
  rejected: { label: "مرفوض ❌", cls: "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-300/60" },
  refunded: { label: "مُرْتَدّ", cls: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border-indigo-300/60" },
  cancelled: { label: "أُلغي", cls: "bg-neutral-100 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300" },
};

export default function PaymentProofsList({
  proofs: initial,
  currentUserId,
}: {
  proofs: Proof[];
  currentUserId: string;
}) {
  const [signedUrls, setSignedUrls] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<Record<number, { ok?: string; err?: string }>>({});
  const [loading, setLoading] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();

  async function loadSigned(id: number, storagePath: string) {
    if (signedUrls[id]) return;
    const n = new Set(loading);
    n.add(id);
    setLoading(n);
    const r = (await createPaymentProofSignedUrl(storagePath)) as any;
    setLoading((s) => {
      const c = new Set(s);
      c.delete(id);
      return c;
    });
    if (r.ok) setSignedUrls((m) => ({ ...m, [id]: r.signedUrl }));
    else setMsg((m) => ({ ...m, [id]: { err: r.error } }));
  }

  function cancel(id: number) {
    setMsg((m) => ({ ...m, [id]: {} }));
    startTransition(async () => {
      const r = (await cancelPayment(id)) as any;
      if (r.ok) setMsg((m) => ({ ...m, [id]: { ok: "تم الإلغاء." } }));
      else setMsg((m) => ({ ...m, [id]: { err: r.error } }));
    });
  }

  if (!initial.length) return null;

  return (
    <div className="space-y-2">
      <h4 className="font-bold text-sm opacity-80 mt-2 mb-1">📑 الإيصالات والتحويلات المرفوعة ({initial.length})</h4>
      {initial.map((p) => {
        const submitterName =
          p.submitter?.full_name ??
          (p.paid_by_buyer ? "المشتري" : "البائع") + " #" + p.submitted_by.slice(0, 6);
        const canCancel = p.submitted_by === currentUserId && p.status === "submitted";
        const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.submitted;
        return (
          <div
            key={p.id}
            className="rounded-2xl border border-black/[.08] dark:border-white/[.12] bg-white dark:bg-neutral-900 p-4 space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-extrabold text-lg text-emerald-700 dark:text-emerald-300">
                {Number(p.amount_sar).toLocaleString("ar-SA")} ر.س
              </div>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border border-black/10 dark:border-white/10">
                {METHOD_LABEL[p.payment_method] ?? p.payment_method}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${st.cls}`}>
                {st.label}
              </span>
              <span className="text-xs opacity-60">
                👤 {submitterName} · 📅 {new Date(p.created_at).toLocaleString("ar-SA")}
              </span>
              {p.verified_at && (
                <span className="text-[11px] opacity-70">
                  مصادق عليه في {new Date(p.verified_at).toLocaleString("ar-SA")}
                </span>
              )}
              {canCancel && (
                <button
                  onClick={() => cancel(p.id)}
                  className="ml-auto rounded-full border border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-200 px-3 py-1 text-xs font-bold hover:bg-rose-500/20"
                >
                  إلغاء هذا الإيصال
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 text-xs opacity-80">
              {p.reference_number && <div>المرجع: <b>{p.reference_number}</b></div>}
              {p.bank_name && <div>البنك: <b>{p.bank_name}</b></div>}
              {p.transfer_date && <div>التاريخ: <b>{p.transfer_date}</b></div>}
              {p.payer_account_last4 && <div>آخر 4 أرقام: <b>{p.payer_account_last4}</b></div>}
            </div>

            {p.notes && (
              <div className="rounded-lg bg-black/[.03] dark:bg-white/[.05] px-3 py-2 text-xs">
                ملاحظات: {p.notes}
              </div>
            )}
            {p.verification_notes && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-xs">
                ملاحظة المصادقة: {p.verification_notes}
              </div>
            )}

            {p.proof_storage_path && (
              <div>
                {!signedUrls[p.id] ? (
                  <button
                    onClick={() => loadSigned(p.id, p.proof_storage_path!)}
                    className="rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-black text-xs font-bold px-4 py-2 hover:bg-black dark:hover:bg-neutral-100"
                    disabled={loading.has(p.id)}
                  >
                    {loading.has(p.id) ? "جارٍ التجهيز..." : "🔐 فتح معاينة الإيصال (رابط خاص لمدة ساعة)"}
                  </button>
                ) : p.proof_mime_type?.startsWith("image/") ? (
                  <a href={signedUrls[p.id]} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signedUrls[p.id]}
                      alt={p.proof_filename || "إيصال"}
                      className="max-h-72 rounded-xl border border-black/10 dark:border-white/10 shadow-sm"
                    />
                  </a>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={signedUrls[p.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-black text-xs font-bold px-4 py-2 hover:bg-black dark:hover:bg-neutral-100 inline-flex items-center gap-2"
                    >
                      📄 فتح {p.proof_filename || "الإيصال PDF"} في تبويب جديد
                    </a>
                    {p.proof_size_bytes && (
                      <span className="text-xs opacity-60">
                        {(p.proof_size_bytes / 1024 / 1024).toFixed(2)} ميجابايت
                      </span>
                    )}
                  </div>
                )}
                {msg[p.id] && (
                  <div
                    className={[
                      "mt-2 rounded-lg px-3 py-1.5 text-xs border",
                      msg[p.id].ok
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200",
                    ].join(" ")}
                  >
                    {msg[p.id].ok ?? msg[p.id].err}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
