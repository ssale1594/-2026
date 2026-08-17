"use client";

import { useState, useTransition } from "react";

type Tier = "free" | "silver" | "gold" | "diamond";

export default function SubscriptionClient({
  currentTier,
  thisTier,
  price,
  simulateUpgradeTier,
  setSubscriptionAutoRenew,
  autoRenew,
}: {
  currentTier: Tier;
  thisTier: Tier;
  price: number;
  simulateUpgradeTier: (t: Tier, months: number) => Promise<any>;
  setSubscriptionAutoRenew: (enable: boolean, reason?: string) => Promise<any>;
  autoRenew?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [months, setMonths] = useState<number>(1);

  const tierRank: Record<Tier, number> = { free: 0, silver: 1, gold: 2, diamond: 3 };
  const isCurrent = currentTier === thisTier;
  const isUpgrade = tierRank[thisTier] > tierRank[currentTier];
  const isDowngrade = tierRank[thisTier] < tierRank[currentTier];

  function runUpgrade() {
    if (!isUpgrade || thisTier === "free") return;
    setMsg(null);
    startTransition(async () => {
      const res = await simulateUpgradeTier(thisTier, months);
      if ((res as any).error) {
        setMsg({ err: (res as any).error });
      } else {
        setMsg({
          ok: `🎉 تمت ترقية العضوية (وضع ديمو) بقيمة ${(res as any).amount} ر.س لمدة ${months} أشهر! سيظهر التغيير فوراً على ملفك.`,
        });
      }
    });
  }

  function runDowngrade() {
    if (!isDowngrade) return;
    if (!confirm(`هذا سيُلغي عضويتك الحالية عند انتهائها وتحويلك لـ: ${thisTier}. متأكد؟`)) return;
    setMsg(null);
    startTransition(async () => {
      if (thisTier === "free") {
        const res = await setSubscriptionAutoRenew(false, "خفض إلى المجانية");
        if ((res as any).error) setMsg({ err: (res as any).error });
        else setMsg({ ok: "تم إيقاف التجديد التلقائي. سيُحفظ ملفك كمجاني عند انتهاء الصلاحية." });
      } else {
        setMsg({ err: "الخفض بين الطبقات غير مُمكّن حالياً — تواصل مع الإدارة." });
      }
    });
  }

  function toggleAutoRenew() {
    setMsg(null);
    startTransition(async () => {
      const res = await setSubscriptionAutoRenew(!autoRenew);
      if ((res as any).error) setMsg({ err: (res as any).error });
      else setMsg({ ok: autoRenew ? "تم إيقاف التجديد التلقائي." : "تم تفعيل التجديد التلقائي." });
    });
  }

  return (
    <div className="space-y-2">
      {isCurrent && price > 0 && (
        <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-800 dark:text-indigo-200 px-3 py-2 text-xs font-semibold">
          طبقتك الحالية
          <label className="mt-2 flex items-center gap-2 font-normal cursor-pointer">
            <input
              type="checkbox"
              checked={!!autoRenew}
              onChange={toggleAutoRenew}
              className="accent-indigo-600"
              disabled={pending}
            />
            {autoRenew ? "التجديد التلقائي مُفعّل" : "التجديد التلقائي متوقف"}
          </label>
        </div>
      )}

      {isUpgrade && price > 0 && (
        <div className="space-y-2">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 text-sm">
            <span>المدة:</span>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              disabled={pending}
              className="bg-transparent font-bold"
            >
              {[1, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m} أشهر · {(m * price).toLocaleString("ar-SA")} ر.س
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={runUpgrade}
            disabled={pending}
            className={[
              "w-full rounded-xl px-4 py-2.5 text-sm font-extrabold shadow transition",
              !pending
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white"
                : "bg-black/10 dark:bg-white/10 text-black/40 dark:text-white/40 cursor-not-allowed",
            ].join(" ")}
          >
            {pending ? "جاري المعالجة..." : "🚀 ترقية الآن"}
          </button>
        </div>
      )}

      {isDowngrade && (
        <button
          onClick={runDowngrade}
          disabled={pending}
          className={[
            "w-full rounded-xl px-4 py-2 text-sm font-semibold border border-black/[.12] dark:border-white/[.2] hover:bg-black/5 dark:hover:bg-white/10",
            pending ? "opacity-50 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {thisTier === "free" ? "🚫 ألغِ العضوية (عودة للمجانية)" : `خفض إلى ${thisTier}`}
        </button>
      )}

      {isCurrent && price === 0 && (
        <button
          onClick={() => {
            const resMsg = "انتظر! زر الترقية موجود في الطبقات الأعلى.";
            alert(resMsg);
          }}
          className="w-full rounded-xl px-4 py-2 text-xs font-bold border border-dashed border-black/15 dark:border-white/20 opacity-50 cursor-not-allowed"
        >
          — هذي طبقتك الحالية —
        </button>
      )}

      {msg && (
        <div
          className={[
            "rounded-lg px-3 py-1.5 text-xs border",
            msg.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200",
          ].join(" ")}
        >
          {msg.ok ?? msg.err}
        </div>
      )}
    </div>
  );
}
