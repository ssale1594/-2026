"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  adminSetReportStatus,
  adminTakeDownListing,
  adminWarnOrBanSeller,
} from "./moderation-actions";

type Report = {
  id: number;
  reporter_id: string;
  target_type: string;
  target_id: number;
  reason_code: string;
  details: string | null;
  status: "pending" | "reviewing" | "resolved" | "rejected" | "escalated";
  resolution: string | null;
  action_taken: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  reporter?: {
    id: string;
    business_name?: string | null;
    full_name?: string | null;
    slug?: string | null;
    verification_status?: string;
    trust_level?: number | null;
    role?: string;
  } | null;
  targetSeller?: {
    id: string;
    business_name?: string | null;
    full_name?: string | null;
    slug?: string | null;
    verification_status?: string;
    trust_level?: number | null;
  } | null;
  target?: any;
  target_listing_seller_id?: string | null;
};

const STATUS_FILTERS = [
  { key: "all", label: "الكل" },
  { key: "pending", label: "في الانتظار" },
  { key: "reviewing", label: "تحت الفحص" },
  { key: "resolved", label: "محلّلة" },
  { key: "rejected", label: "مرفوضة" },
  { key: "escalated", label: "مصعدة" },
];

const REASON_LABELS: Record<string, string> = {
  spam: "رسائل مزعجة / سبام",
  fraud: "نصب / احتيال",
  inappropriate: "محتوى غير لائق",
  wrong_price: "تسعير غير عادل",
  wrong_category: "تصنيف خاطئ",
  duplicate: "إعلان مكرر",
  expired: "غير متاح / تم بيعه",
  legal: "مخالفة قانونية",
  other: "أخرى",
};

const TARGET_LABELS: Record<string, string> = {
  listing: "إعلان",
  seller: "بائع / ملف بائع",
  review: "تقييم",
  comment: "تعليق",
  event: "فعالية",
  job: "وظيفة",
  need: "طلب / احتياج",
  offer: "عرض سعر",
};

export default function ModerationClient({
  initialReports,
}: {
  initialReports: Report[];
}) {
  const [list, setList] = useState<Report[]>(initialReports);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [targetFilter, setTargetFilter] = useState<string>("all");
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [tr, setTr] = useTransition();

  const filtered = useMemo(() => {
    return list.filter(
      (r) =>
        (statusFilter === "all" || r.status === statusFilter) &&
        (reasonFilter === "all" || r.reason_code === reasonFilter) &&
        (targetFilter === "all" || r.target_type === targetFilter)
    );
  }, [list, statusFilter, reasonFilter, targetFilter]);

  function flashErr(e: string) {
    setMsg({ err: e });
    setTimeout(() => setMsg(null), 4500);
  }
  function flashOk(m: string) {
    setMsg({ ok: m });
    setTimeout(() => setMsg(null), 3500);
  }

  function updateReport(id: number, patch: Partial<Report>) {
    setList((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function setStatus(
    id: number,
    st: "reviewing" | "resolved" | "rejected" | "escalated" | "pending",
    resolution = "",
    action = ""
  ) {
    setTr(async () => {
      const res = await adminSetReportStatus(id, st, resolution, action);
      if ((res as any).error) return flashErr((res as any).error);
      flashOk(`تم تحديث حالة التقرير #${id}`);
      updateReport(id, { status: st, resolution, action_taken: action } as any);
    });
  }

  function takeDownListing(
    listingId: string,
    note: string,
    reportId: number,
    actionLog: string
  ) {
    setTr(async () => {
      const res = await adminTakeDownListing(listingId, "archived", note);
      if ((res as any).error) return flashErr((res as any).error);
      flashOk(`تمت أرشفة الإعلان #${listingId}`);
      updateReport(reportId, {
        status: "resolved",
        resolution: note || "أرشفة الإعلان من قبل الإدارة بناءً على البلاغ.",
        action_taken: actionLog,
      } as any);
    });
  }

  function banSeller(
    sellerId: string,
    reason: string,
    reportId: number,
    actionLog: string
  ) {
    if (!confirm("حظر البائع سيرفض حساب الهوية ويرشّف كل إعلاناته. هل أنت متأكد؟")) return;
    setTr(async () => {
      const res = await adminWarnOrBanSeller(sellerId, "ban", reason);
      if ((res as any).error) return flashErr((res as any).error);
      flashOk("تم حظر البائع وأرشفة إعلاناته");
      updateReport(reportId, {
        status: "resolved",
        resolution: reason || "حظر الحساب من قبل الإدارة.",
        action_taken: actionLog,
      } as any);
    });
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div
          className={[
            "rounded-xl px-4 py-3 text-sm border",
            msg.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200",
          ].join(" ")}
        >
          {msg.ok ?? msg.err}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-black/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterSelect
            label="الحالة"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS}
          />
          <FilterSelect
            label="نوع الهدف"
            value={targetFilter}
            onChange={setTargetFilter}
            options={[
              { key: "all", label: "الكل" },
              ...Object.entries(TARGET_LABELS).map(([k, v]) => ({ key: k, label: v })),
            ]}
          />
          <FilterSelect
            label="سبب البلاغ"
            value={reasonFilter}
            onChange={setReasonFilter}
            options={[
              { key: "all", label: "الكل" },
              ...Object.entries(REASON_LABELS).map(([k, v]) => ({ key: k, label: v })),
            ]}
          />
        </div>
        <div className="mt-3 text-xs opacity-70">
          عدد التقارير بعد التصفية: <b>{filtered.length}</b> من أصل {list.length}
        </div>
      </div>

      {/* Report list */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-12 rounded-2xl border border-dashed border-black/[.15] dark:border-white/[.25] text-sm opacity-70">
            لا تقارير في هذا الفلتر.
          </div>
        )}
        {filtered.map((r) => (
          <ReportRow
            key={r.id}
            r={r}
            onStatusChange={setStatus}
            onTakeDown={takeDownListing}
            onBanSeller={banSeller}
            pending={tr}
          />
        ))}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ s }: { s: Report["status"] }) {
  const map: Record<Report["status"], string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    reviewing: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    escalated: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  };
  const labels: Record<Report["status"], string> = {
    pending: "⏳ في الانتظار",
    reviewing: "🔎 تحت الفحص",
    resolved: "✅ محلّلة",
    rejected: "❌ مرفوضة",
    escalated: "⬆️ مصعدة",
  };
  return (
    <span
      className={[
        "text-[11px] rounded-full border px-2.5 py-0.5 font-bold inline-block",
        map[s],
      ].join(" ")}
    >
      {labels[s]}
    </span>
  );
}

function ReportRow({
  r,
  onStatusChange,
  onTakeDown,
  onBanSeller,
  pending,
}: {
  r: Report;
  onStatusChange: (
    id: number,
    st: Report["status"],
    resolution?: string,
    action?: string
  ) => void;
  onTakeDown: (
    listingId: string,
    note: string,
    reportId: number,
    actionLog: string
  ) => void;
  onBanSeller: (
    sellerId: string,
    reason: string,
    reportId: number,
    actionLog: string
  ) => void;
  pending: boolean;
}) {
  const [showActions, setShowActions] = useState(r.status === "pending");
  const [note, setNote] = useState<string>(
    r.resolution ||
      (r.target_type === "listing"
        ? "تم إزالته بناءً على طلب البلاغ"
        : r.target_type === "seller"
        ? "حظر حساب بسبب مخالفة شروط المنصة"
        : "")
  );

  const reporterName = r.reporter
    ? r.reporter.business_name || r.reporter.full_name || r.reporter.id
    : r.reporter_id;
  const targetSellerName = r.targetSeller
    ? r.targetSeller.business_name || r.targetSeller.full_name || r.targetSeller.id
    : null;

  return (
    <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] overflow-hidden bg-white dark:bg-black/10">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <StatusBadge s={r.status} />
              <span className="text-[11px] rounded-full bg-black/[.05] dark:bg-white/10 px-2.5 py-0.5 font-bold opacity-85">
                #{r.id} · {TARGET_LABELS[r.target_type] || r.target_type}
              </span>
              <span className="text-[11px] rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 px-2.5 py-0.5 font-bold border border-rose-500/20">
                السبب: {REASON_LABELS[r.reason_code] || r.reason_code}
              </span>
              <span className="text-[10px] opacity-65">
                تاريخ التبليغ:{" "}
                {new Date(r.created_at).toLocaleString("ar-SA", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </div>
            {r.details && (
              <p className="text-sm border-r-2 border-rose-400/40 pr-3 my-2 text-black/80 dark:text-white/80">
                ❝ {r.details} ❞
              </p>
            )}
          </div>
          <button
            onClick={() => setShowActions((v) => !v)}
            className="text-xs rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
          >
            {showActions ? "إخفاء الإجراءات" : "⚡ إظهار الإجراءات"}
          </button>
        </div>

        {/* Reporter + target cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <MiniCard title="المُبلغ" icon="📣">
            <div className="font-semibold text-sm truncate">{reporterName}</div>
            {r.reporter?.trust_level != null && (
              <div className="text-[11px] opacity-65">ثقة {r.reporter.trust_level}</div>
            )}
            {r.reporter?.slug && (
              <Link
                href={`/seller/${r.reporter.slug}`}
                className="text-[11px] text-sky-600 hover:underline"
                target="_blank"
              >
                زيارة ملفه ↗
              </Link>
            )}
          </MiniCard>
          <MiniCard title="الهدف المُبلغ عنه" icon="🎯">
            {r.target_type === "listing" && r.target ? (
              <>
                <Link
                  href={`/listing/${r.target.slug ?? "#"}`}
                  className="font-semibold text-sm line-clamp-2 hover:text-sky-700 dark:hover:text-sky-300 block"
                  target="_blank"
                >
                  📦 {r.target.title}
                </Link>
                <div className="text-[11px] opacity-65 mt-0.5">
                  الحالة: {r.target.status} · ID #{r.target_id}
                  {r.target.price != null ? ` · ${r.target.price} ر.س` : ""}
                </div>
                {targetSellerName && (
                  <div className="mt-1 text-[11px] opacity-80">
                    البائع:{" "}
                    {r.targetSeller?.slug ? (
                      <Link
                        href={`/seller/${r.targetSeller.slug}`}
                        className="hover:underline font-semibold"
                        target="_blank"
                      >
                        🏪 {targetSellerName}
                      </Link>
                    ) : (
                      <span className="font-semibold">🏪 {targetSellerName}</span>
                    )}
                  </div>
                )}
              </>
            ) : r.target_type === "seller" && r.targetSeller ? (
              <>
                {r.targetSeller.slug ? (
                  <Link
                    href={`/seller/${r.targetSeller.slug}`}
                    className="font-semibold text-sm hover:underline"
                    target="_blank"
                  >
                    🏪 {targetSellerName}
                  </Link>
                ) : (
                  <div className="font-semibold text-sm">🏪 {targetSellerName}</div>
                )}
                <div className="text-[11px] opacity-65 mt-0.5">
                  ثقة {r.targetSeller.trust_level ?? 0} ·{" "}
                  {r.targetSeller.verification_status || "—"}
                </div>
              </>
            ) : (
              <div className="text-sm opacity-70">
                رقم الهدف: #{r.target_id}
                {r.target?.title ? ` · ${r.target.title}` : ""}
              </div>
            )}
          </MiniCard>
        </div>

        {r.resolution && !showActions && (
          <div className="rounded-xl bg-black/[.03] dark:bg-white/[.05] p-3 text-xs">
            <b>القرار السابق:</b> {r.resolution}
            {r.action_taken && (
              <>
                {" "}· <b>الإجراء:</b> {r.action_taken}
              </>
            )}
            {r.handled_at && (
              <>
                {" "}·{" "}
                <span className="opacity-65">
                  في{" "}
                  {new Date(r.handled_at).toLocaleString("ar-SA", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </>
            )}
          </div>
        )}

        {showActions && (
          <div className="border-t border-black/[.06] dark:border-white/[.08] pt-4 mt-2 space-y-3">
            <label className="block">
              <span className="block text-xs font-semibold mb-1">
                📝 ملاحظات القرار / سبب الإجراء
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 2000))}
                rows={2}
                className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={pending || r.status === "reviewing"}
                onClick={() =>
                  (onStatusChange as any)(
                    r.id,
                    "reviewing",
                    r.resolution || "تحال عليه الفحص.",
                    "فتحت التحقيق بواسطة الإدارة."
                  )
                }
                className="text-xs rounded-lg bg-sky-600 disabled:opacity-50 text-white px-3 py-2 font-bold"
              >
                🔎 ابدأ الفحص
              </button>
              {r.target_type === "listing" && r.target_id && (
                <button
                  disabled={pending}
                  onClick={() =>
                    (onTakeDown as any)(
                      r.target_id,
                      note,
                      r.id,
                      "إزالة و أرشفة الإعلان #" + r.target_id
                    )
                  }
                  className="text-xs rounded-lg bg-amber-600 disabled:opacity-50 text-white px-3 py-2 font-bold"
                >
                  📦 أرشفة الإعلان
                </button>
              )}
              {(r.target_type === "seller" || r.targetSeller) && (
                <button
                  disabled={pending}
                  onClick={() =>
                    (onBanSeller as any)(
                      (r.target_type === "seller" ? String(r.target_id) : r.targetSeller?.id) as string,
                      note,
                      r.id,
                      "حظر البائع و أرشفة إعلاناته (ID=" + (r.target_type === "seller" ? r.target_id : r.targetSeller?.id) + ")"
                    )
                  }
                  className="text-xs rounded-lg bg-rose-600 disabled:opacity-50 text-white px-3 py-2 font-bold"
                >
                  🚫 حظر البائع
                </button>
              )}
              <button
                disabled={pending || r.status === "resolved"}
                onClick={() =>
                  (onStatusChange as any)(
                    r.id,
                    "resolved",
                    note || "تم الفحص، واتخذت الإجراءات اللازمة.",
                    "اعتبار البلاغ مغلقاً."
                  )
                }
                className="text-xs rounded-lg bg-emerald-600 disabled:opacity-50 text-white px-3 py-2 font-bold"
              >
                ✅ إغلاق (محلّل)
              </button>
              <button
                disabled={pending || r.status === "rejected"}
                onClick={() =>
                  (onStatusChange as any)(
                    r.id,
                    "rejected",
                    note || "البلاغ غير صحيح، أو لم تتوفر أدلة على مخالفة.",
                    "رفض البلاغ من قبل الإدارة."
                  )
                }
                className="text-xs rounded-lg border border-black/[.12] dark:border-white/[.2] disabled:opacity-50 px-3 py-2 font-bold"
              >
                ❌ رفض البلاغ
              </button>
              <button
                disabled={pending || r.status === "escalated"}
                onClick={() =>
                  (onStatusChange as any)(
                    r.id,
                    "escalated",
                    note || "تم رفعه لمستوى أعلى للمراجعة.",
                    "رفع البلاغ لفريق الإدارة العليا."
                  )
                }
                className="text-xs rounded-lg border border-black/[.12] dark:border-white/[.2] disabled:opacity-50 px-3 py-2 font-bold"
              >
                ⬆️ تصعيد للمشرف الأعلى
              </button>
              <button
                disabled={pending || r.status === "pending"}
                onClick={() =>
                  (onStatusChange as any)(
                    r.id,
                    "pending",
                    "",
                    "إعادة فتح البلاغ إلى الانتظار."
                  )
                }
                className="text-xs rounded-lg border border-black/[.12] dark:border-white/[.2] disabled:opacity-50 px-3 py-2 font-bold"
              >
                ↩️ إعادة للانتظار
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-black/[.02] dark:bg-white/[.04] border border-black/[.06] dark:border-white/[.08] p-3">
      <div className="text-[11px] font-bold opacity-70 mb-1.5 inline-flex items-center gap-1.5">
        <span aria-hidden>{icon}</span> {title}
      </div>
      <div>{children}</div>
    </div>
  );
}
