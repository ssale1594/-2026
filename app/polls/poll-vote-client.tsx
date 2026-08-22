"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { castPollVote } from "./polls-actions";
import { profileImageUrl } from "@/lib/storage";

type Seller = {
  id?: string;
  business_name?: string | null;
  full_name?: string | null;
  slug?: string | null;
  trust_level?: number | null;
  profile_image?: string | null;
  thumbnail_storage_path?: string | null;
  category_name?: string | null;
  verified_company_id?: string | null;
  verification_status?: string | null;
  vouch_count?: number | null;
  average_rating?: number | null;
};

type Option = {
  id: number;
  seller: Seller | null;
};

type ResultRow = {
  option_id: number;
  seller_id?: string | null;
  seller_name?: string | null;
  seller_slug?: string | null;
  votes_count: number;
  percent_of_total: number;
  seller?: Seller | null;
};

export default function PollVoteClient({
  pollId,
  status,
  totalVotes,
  myVoteOptionId,
  options,
  results,
  viewerId,
}: {
  pollId: number;
  status: string;
  totalVotes: number;
  myVoteOptionId: number | null;
  options: Option[];
  results: ResultRow[];
  // Not read inside this component — castPollVote() resolves the voter from
  // the session server-side. Kept as an explicit null-friendly prop rather
  // than dropped, in case a future UI variant (e.g. showing "صوّتّ كـ...")
  // needs it.
  viewerId: string | null;
}) {
  const [selected, setSelected] = useState<number | null>(myVoteOptionId);
  const [hasVoted, setHasVoted] = useState<boolean>(myVoteOptionId != null);
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const showResults = status === "closed" || hasVoted;

  const votesMap = new Map<number, ResultRow>();
  results.forEach((r) => votesMap.set(r.option_id, r));

  function submit() {
    if (selected == null || status !== "active" || hasVoted) return;
    startTransition(async () => {
      setMsg(null);
      const res = await castPollVote(pollId, selected);
      if ((res as any).error) {
        setMsg({ err: (res as any).error });
      } else {
        setHasVoted(true);
        setMsg({ ok: "شكراً لتصويتك! نرى النتائج الآن." });
      }
    });
  }

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-6 bg-white dark:bg-black/10 text-sm">
        لم يتم إضافة مرشحين لهذا الاستفتاء بعد - يرجى الانتظار حتى يتم إعداد الإدارة للخيارات.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black/10 p-6">
      {msg && (
        <div
          className={
            msg.ok
              ? "rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 px-4 py-3 text-sm mb-4"
              : "rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 px-4 py-3 text-sm mb-4"
          }
        >
          {msg.ok ?? msg.err}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {options.map((opt) => {
        const s = opt.seller;
        const sellerName =
          s?.business_name || s?.full_name || `بائع ${s?.id ?? ""}`;
        const slug = s?.slug || s?.id || undefined;
        const selectedVal = opt.id === selected;
        const votedFor = opt.id === myVoteOptionId;
        const resRow = votesMap.get(opt.id);
        const pct = resRow ? resRow.percent_of_total ?? 0 : 0;
        const votes = resRow ? resRow.votes_count ?? 0 : 0;

        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              if (status !== "active" || hasVoted) return;
              setSelected(opt.id);
            }}
            disabled={status !== "active" || hasVoted}
            className={[
              "text-right relative group rounded-2xl border p-4 transition",
              status === "active" && !hasVoted
                ? "cursor-pointer"
                : "cursor-default",
              selectedVal
                ? "border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/40 shadow-sm"
                : "border-black/[.08] dark:border-white/[.145] hover:border-sky-500/40",
            ].join(" ")}
          >
            <div className="flex items-start gap-3 mb-3 relative z-10">
              <div className="w-14 h-14 shrink-0 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                {s?.thumbnail_storage_path || s?.profile_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImageUrl(s.thumbnail_storage_path || s.profile_image || undefined)}
                    alt={sellerName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">
                    {sellerName.charAt(0) || "👤"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate flex items-center gap-2">
                  {sellerName}
                  {s?.verification_status === "approved" && (
                    <span className="text-[10px] rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2 py-0.5 font-bold">
                      موثوق
                    </span>
                  )}
                </div>
                <div className="text-[11px] opacity-70 mt-0.5">
                  {s?.trust_level ? `مستوى الثقة ${s.trust_level}` : null}
                  {s?.category_name ? ` · ${s.category_name}` : null}
                </div>
                {s?.average_rating != null && s.average_rating > 0 && (
                  <div className="text-[11px] mt-0.5 opacity-70">
                    ⭐ {Number(s.average_rating).toFixed(1)}
                    {s?.vouch_count ? ` · ${s.vouch_count} توصيات` : null}
                  </div>
                )}
                {slug && (
                  <Link
                    href={`/seller/${slug}`}
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 text-[11px] text-sky-600 hover:underline inline-block"
                  >
                    زيارة صفحة البائع ↗
                  </Link>
                )}
              </div>
            </div>

            {/* vote tag + progress */}
            <div className="relative z-10 mt-2 flex items-center justify-between text-xs">
              {votedFor ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-emerald-700 dark:text-emerald-300 font-bold">
                  ✓ صوتك هنا
                </span>
              ) : status === "active" && !hasVoted ? (
                <span className={[
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
                  selectedVal
                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                    : "bg-black/5 text-black/60 dark:text-white/60 dark:bg-white/10",
                ].join(" ")}>
                  {selectedVal ? "✓ محدد" : "اضغط للتصويت"}
                </span>
              ) : null}
              {showResults && (
                  <span className="opacity-80 font-bold">
                    {votes.toLocaleString("ar-SA")} صوت · {pct.toFixed(1)}%
                  </span>
                )}
            </div>

            {showResults && (
              <div className="mt-3 h-2 w-full rounded-full bg-black/[.06] dark:bg-white/[.08] overflow-hidden relative z-10">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                />
              </div>
            )}
          </button>
        );
      })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm opacity-70">
          {showResults ? (
            <span>
              إجمالي الأصوات: <b>{totalVotes.toLocaleString("ar-SA")}</b> صوت
            </span>
          ) : (
            <span>
              {hasVoted ? "شكراً لتصويتك!" : "يتبقى فقط النقر على أحد البائع ثم تأكيد التصويت أدناه."}
            </span>
          )}
        </div>

        {status === "active" && !hasVoted && (
          <button
            type="button"
            onClick={submit}
            disabled={selected == null || pending}
            className={[
              "rounded-xl px-5 py-2.5 text-sm font-bold transition",
              selected != null && !pending
                ? "bg-sky-600 hover:bg-sky-700 text-white shadow"
                : "bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40 cursor-not-allowed",
            ].join(" ")}
          >
            {pending ? "جاري تسجيل التصويت..." : "✓ تأكيد تصويتي"}
          </button>
        )}
      </div>
    </div>
  );
}
