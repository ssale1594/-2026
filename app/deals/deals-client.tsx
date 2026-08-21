"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  buyerConfirmOrDispute,
  sellerMarkComplete,
  sellerRespondToDeal,
} from "@/app/deals/deals-actions";
import PaymentProofsList from "@/components/payment-proofs-list";
import PaymentProofUploader from "@/components/payment-proof-uploader";

export type Role = "buyer" | "seller";

export function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return {
        text: "⏳ بانتظار موافقة البائع",
        cls: "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30",
      };
    case "accepted":
      return {
        text: "✅ تمت الموافقة - جاري التنفيذ",
        cls: "bg-sky-500/10 text-sky-800 dark:text-sky-200 border-sky-500/30",
      };
    case "buyer_confirmed":
      return {
        text: "📦 العميل أكد استلامه - قيد الإغلاق النهائي",
        cls: "bg-indigo-500/10 text-indigo-800 dark:text-indigo-200 border-indigo-500/30",
      };
    case "completed":
      return {
        text: "🎉 تم إنهاؤها بنجاح",
        cls: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
      };
    case "rejected":
      return {
        text: "❌ رفضها البائع",
        cls: "bg-rose-500/10 text-rose-800 dark:text-rose-200 border-rose-500/30",
      };
    case "disputed":
      return {
        text: "⚠️ تحت مراجعة الإدارة (خصومة)",
        cls: "bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-200 border-fuchsia-500/30",
      };
    case "cancelled":
      return {
        text: "🚫 ملغاة",
        cls: "bg-neutral-500/10 text-neutral-700 dark:text-neutral-300 border-neutral-500/30",
      };
    default:
      return {
        text: status,
        cls: "bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/70 border-black/10",
      };
  }
}

export function formatSar(v: number | null) {
  if (v == null) return "—";
  return `${Number(v).toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
}

export function formatDate(d: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type DealRow = any;

export default function DealsClient({
  role,
  deals,
  userId,
  paymentsByDeal = {},
}: {
  role: Role;
  deals: DealRow[];
  userId: string;
  paymentsByDeal?: Record<number, any[]>;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: deals.length };
    for (const d of deals) c[d.status] = (c[d.status] ?? 0) + 1;
    return c;
  }, [deals]);

  const filtered = useMemo(
    () => (filter === "all" ? deals : deals.filter((d) => d.status === filter)),
    [deals, filter]
  );

  const FILTERS: { key: string; label: string }[] = [
    { key: "all", label: "الكل" },
    { key: "pending", label: "⏳ بانتظار رد" },
    { key: "accepted", label: "✅ قيد التنفيذ" },
    { key: "buyer_confirmed", label: "📦 أُكد الاستلام" },
    { key: "completed", label: "🎉 مكتملة" },
    { key: "disputed", label: "⚠️ خصومة" },
    { key: "rejected", label: "❌ مرفوضة" },
    { key: "cancelled", label: "🚫 ملغاة" },
  ];

  function runAction(id: number, fn: () => Promise<any>) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await fn();
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.filter((f) => f.key === "all" || (counts[f.key] ?? 0) > 0).map(
          (f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={[
                "px-3 py-1.5 text-xs rounded-full border transition whitespace-nowrap",
                filter === f.key
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-black/[.12] dark:border-white/[.2] text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10",
              ].join(" ")}
            >
              {f.label} · {counts[f.key] ?? 0}
            </button>
          )
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[.15] dark:border-white/[.2] p-10 text-center">
          <div className="text-3xl mb-2">🛒</div>
          <div className="font-bold mb-1">لا توجد صفقات في هذا القسم</div>
          <div className="text-sm text-black/55 dark:text-white/60 mb-4">
            {role === "buyer"
              ? "ابدأ صفقتك الأولى من صفحة أي إعلان بالضغط على زر «ابدأ صفقة»."
              : "بمجرد أن يرسل العملاء صفقات جديدة، ستظهر هنا للرد عليها."}
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black/[.06] dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-sm font-bold"
          >
            تصفح الإعلانات →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((d) => {
            const badge = statusBadge(d.status);
            const otherParty =
              role === "buyer"
                ? { name: d.sellers?.business_name || "بائع", slug: d.sellers?.slug }
                : { name: d.buyers?.full_name || "عميل", slug: undefined };
            const disabled = pendingId === d.id;

            return (
              <div
                key={d.id}
                className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 flex flex-col gap-3 bg-white/60 dark:bg-neutral-900/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={[
                          "text-xs px-2 py-0.5 rounded-full border font-semibold",
                          badge.cls,
                        ].join(" ")}
                      >
                        {badge.text}
                      </span>
                      <span className="text-[11px] text-black/50 dark:text-white/50">
                        رقم #{d.id}
                      </span>
                    </div>
                    <h3 className="font-bold text-base leading-tight">
                      {d.title || "صفقة بدون عنوان"}
                    </h3>
                    <div className="text-xs text-black/55 dark:text-white/60 mt-1">
                      <span>{role === "buyer" ? "البائع" : "العميل"}: </span>
                      {otherParty.slug ? (
                        <Link
                          href={
                            role === "buyer"
                              ? `/seller/${otherParty.slug}`
                              : `/seller/${otherParty.slug}`
                          }
                          className="underline hover:no-underline"
                        >
                          {otherParty.name}
                        </Link>
                      ) : (
                        <b>{otherParty.name}</b>
                      )}
                      <span className="mx-1.5 opacity-40">·</span>
                      <span>أنشئت: {formatDate(d.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-sm opacity-60">المبلغ المتفق</div>
                    <div className="text-lg font-extrabold">
                      {formatSar(d.price_agreed_sar)}
                    </div>
                    {d.deadline_date && (
                      <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                        📅 موعد: {formatDate(d.deadline_date)}
                      </div>
                    )}
                  </div>
                </div>

                {(d.description || d.delivery_notes) && (
                  <div className="rounded-lg bg-black/[.04] dark:bg-white/[.04] p-3 text-sm text-black/70 dark:text-white/70 space-y-1.5">
                    {d.description && (
                      <div>
                        <b className="text-xs opacity-70">التفاصيل: </b>
                        {d.description}
                      </div>
                    )}
                    {d.delivery_notes && (
                      <div>
                        <b className="text-xs opacity-70">ملاحظات التوصيل: </b>
                        {d.delivery_notes}
                      </div>
                    )}
                    {d.rejected_reason && (
                      <div className="text-rose-700 dark:text-rose-300">
                        <b className="text-xs opacity-70">سبب الرفض: </b>
                        {d.rejected_reason}
                      </div>
                    )}
                    {d.dispute_reason && (
                      <div className="text-fuchsia-700 dark:text-fuchsia-300">
                        <b className="text-xs opacity-70">سبب الخصومة: </b>
                        {d.dispute_reason}
                      </div>
                    )}
                    {d.cancelled_reason && (
                      <div className="text-neutral-700 dark:text-neutral-300">
                        <b className="text-xs opacity-70">سبب الإلغاء: </b>
                        {d.cancelled_reason}
                      </div>
                    )}
                  </div>
                )}

                {d.listings && (
                  <Link
                    href={`/listing/${d.listings.slug}`}
                    className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-3 flex items-center gap-3 hover:bg-black/[.03] dark:hover:bg-white/[.04]"
                  >
                    <div className="w-12 h-12 shrink-0 rounded-lg bg-black/5 dark:bg-white/10 grid place-items-center">
                      🧾
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {d.listings.title}
                      </div>
                      <div className="text-xs opacity-60">
                        {d.listings.categories?.name_ar} · {formatSar(d.listings.price)}
                      </div>
                    </div>
                  </Link>
                )}

                <DealActions
                  role={role}
                  deal={d}
                  disabled={disabled}
                  onRun={(fn) => runAction(d.id, fn)}
                />

                {paymentsByDeal[d.id] && (
                  <PaymentProofsList
                    proofs={paymentsByDeal[d.id]}
                    currentUserId={userId}
                  />
                )}

                {["pending", "accepted", "buyer_confirmed"].includes(d.status) && (
                  <PaymentProofUploader
                    dealId={d.id}
                    priceAgreedSar={d.price_agreed_sar}
                    userId={userId}
                    role={role}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DealActions({
  role,
  deal,
  disabled,
  onRun,
}: {
  role: Role;
  deal: DealRow;
  disabled: boolean;
  onRun: (fn: () => Promise<any>) => void;
}) {
  const Btn = ({
    onClick,
    children,
    danger = false,
    primary = false,
  }: {
    onClick: () => void;
    children: React.ReactNode;
    danger?: boolean;
    primary?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "text-xs px-3 py-1.5 rounded-lg font-semibold border transition disabled:opacity-50 disabled:cursor-not-allowed",
        primary
          ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
          : danger
            ? "bg-rose-600/10 text-rose-700 dark:text-rose-200 border-rose-600/30 hover:bg-rose-600/20"
            : "bg-black/[.05] dark:bg-white/10 border-black/[.12] dark:border-white/[.2] hover:bg-black/10 dark:hover:bg-white/15",
      ].join(" ")}
    >
      {children}
    </button>
  );

  const sellerRespond = (res: "accepted" | "rejected") => {
    let reason = "";
    if (res === "rejected") {
      reason =
        prompt(
          "لماذا ترفض هذه الصفقة؟ (سيظهر سبب الرفض للعميل، اتركه فارغاً لسبب عام)"
        ) ?? "";
    }
    onRun(() => sellerRespondToDeal(deal.id, res, reason));
  };

  const sellerComplete = () => {
    const note = prompt("أي ملاحظة نهائية على الإغلاق؟ (اختياري)") ?? "";
    onRun(() => sellerMarkComplete(deal.id, note));
  };

  const buyerConfirm = () =>
    onRun(() =>
      buyerConfirmOrDispute(
        deal.id,
        "confirm",
        ""
      )
    );
  const buyerDispute = () => {
    const r =
      prompt("اذكر سبب الخصومة باختصار (مطلوب):") ?? "";
    if (!r) return;
    onRun(() => buyerConfirmOrDispute(deal.id, "dispute", r));
  };
  const buyerCancel = () => {
    const r =
      prompt("سبب الإلغاء؟ (سيظهر للبائع، اتركه فارغاً لسبب عام)") ?? "";
    onRun(() => buyerConfirmOrDispute(deal.id, "cancel", r));
  };

  // Seller actions
  if (role === "seller") {
    if (deal.status === "pending") {
      return (
        <div className="flex flex-wrap gap-2">
          <Btn primary onClick={() => sellerRespond("accepted")}>
            ✅ أقبل الصفقة
          </Btn>
          <Btn danger onClick={() => sellerRespond("rejected")}>
            ❌ أرفضها
          </Btn>
        </div>
      );
    }
    if (deal.status === "accepted") {
      return (
        <div className="flex flex-wrap gap-2">
          <Btn primary onClick={sellerComplete}>
            🎉 أعلن إكمال التنفيذ
          </Btn>
          <div className="text-xs text-black/50 dark:text-white/50 self-center">
            بعد الاستلام سيتم إغلاقها تلقائياً بنجاح.
          </div>
        </div>
      );
    }
    if (deal.status === "buyer_confirmed") {
      return (
        <div className="flex flex-wrap gap-2">
          <Btn primary onClick={sellerComplete}>
            ✅ إغلاق نهائي + احتسابها كمعاملة ناجحة
          </Btn>
          <Btn danger onClick={() => {
            const r = prompt("سبب رفع الخصومة (البائع)؟") ?? "";
            if (!r) return;
            // تحويلها لمنطقة buyer_confirmed → disputed ليس محفوظاً في RLS،
            // نستخدم confirm+dispute بديلاً (سيظهر تنبيه)
            alert("إذا رغبت في رفعها كخصومة يرجى التواصل مع الإدارة مباشرة.");
          }}>
            ⚠️ أطلب تدخل إدارة
          </Btn>
        </div>
      );
    }
  }

  // Buyer actions
  if (role === "buyer") {
    if (deal.status === "pending") {
      return (
        <div className="flex flex-wrap gap-2">
          <Btn danger onClick={buyerCancel}>
            🚫 ألغِ الطلب قبل الموافقة
          </Btn>
          <div className="text-xs text-amber-700 dark:text-amber-300 self-center">
            بانتظار موافقة البائع على تفاصيل الصفقة.
          </div>
        </div>
      );
    }
    if (deal.status === "accepted") {
      return (
        <div className="flex flex-wrap gap-2">
          <Btn primary onClick={buyerConfirm}>
            📦 أؤكد أنني استلمت الطلب
          </Btn>
          <Btn danger onClick={buyerCancel}>
            🚫 ألغِ الصفقة
          </Btn>
          <Btn onClick={buyerDispute} danger>
            ⚠️ خلاف - أطلب تدخل الإدارة
          </Btn>
        </div>
      );
    }
    if (deal.status === "buyer_confirmed") {
      return (
        <div className="flex flex-wrap gap-2">
          <Btn danger onClick={buyerDispute}>
            ⚠️ خلاف بعد التأكيد - أطلب تدخل الإدارة
          </Btn>
          <div className="text-xs text-black/50 dark:text-white/50 self-center">
            سيقوم البائع بإغلاقها كصفقة ناجحة قريباً.
          </div>
        </div>
      );
    }
  }

  return null;
}
