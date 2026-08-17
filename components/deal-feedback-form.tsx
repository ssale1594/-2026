"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitDealFeedback } from "@/app/my/deals/feedback-actions";

export default function DealFeedbackForm({
  dealId,
  sellerName,
  autoOpen = false,
}: {
  dealId: number;
  sellerName?: string | null;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm">
        وصل تقييمك — شكرًا لك. يساعد بقية أهل الزلفي يختارون بثقة.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs font-medium px-3 py-1.5"
      >
        ⭐ قيّم تجربتك — ٣٠ ثانية
      </button>
    );
  }

  function submit() {
    setError(null);
    if (stars < 1) {
      setError("اختر عدد النجوم أولًا.");
      return;
    }
    if (recommend === null) {
      setError("قل لنا: توصي فيه ولا لا؟");
      return;
    }
    start(async () => {
      const res = (await submitDealFeedback({
        dealId,
        ratingStars: stars,
        wouldRecommend: recommend,
        comment,
      })) as any;
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  const shown = hover || stars;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[.06] p-4 space-y-3">
      <div className="text-sm font-medium">
        كيف كانت تجربتك{sellerName ? ` مع ${sellerName}` : ""}؟
      </div>

      <div
        className="flex gap-1"
        onMouseLeave={() => setHover(0)}
        role="radiogroup"
        aria-label="تقييم بالنجوم"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} من ٥`}
            onMouseEnter={() => setHover(n)}
            onClick={() => setStars(n)}
            className={[
              "text-2xl leading-none transition-transform hover:scale-110",
              n <= shown ? "opacity-100" : "opacity-25",
            ].join(" ")}
          >
            ⭐
          </button>
        ))}
        {stars > 0 && (
          <span className="text-xs self-center mr-2 text-black/60 dark:text-white/60">
            {stars} من ٥
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-black/70 dark:text-white/70">توصي فيه؟</span>
        {[
          { v: true, label: "👍 نعم" },
          { v: false, label: "👎 لا" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => setRecommend(o.v)}
            className={[
              "rounded-lg border px-3 py-1.5 text-xs font-medium",
              recommend === o.v
                ? "border-sky-500 bg-sky-500/15"
                : "border-black/[.12] dark:border-white/[.2] hover:bg-black/5 dark:hover:bg-white/5",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={600}
        rows={2}
        placeholder="تعليق قصير (اختياري)"
        className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm"
      />

      {error && (
        <div className="text-xs text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-foreground text-background text-xs font-medium px-4 py-2 disabled:opacity-50"
        >
          {pending ? "جارٍ الإرسال…" : "أرسل التقييم"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] text-xs px-4 py-2"
        >
          لاحقًا
        </button>
      </div>

      <p className="text-[11px] text-black/50 dark:text-white/50">
        التقييم يُرسل مرة واحدة ولا يمكن تعديله بعدها.
      </p>
    </div>
  );
}
