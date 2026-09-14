"use client";

import { useState, useTransition } from "react";
import { claimAsSeller } from "./actions";

export default function MatchCandidateCard({
  id,
  businessName,
  categoryName,
  neighborhoodName,
  addressNote,
}: {
  id: number;
  businessName: string;
  categoryName: string | null;
  neighborhoodName: string | null;
  addressNote: string | null;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (dismissed) return null;

  return (
    <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-4">
      <div className="font-bold">{businessName}</div>
      <p className="text-xs text-black/55 dark:text-white/55 mt-0.5">
        {categoryName}
        {neighborhoodName && ` · ${neighborhoodName}`}
      </p>
      {addressNote && (
        <p className="text-xs text-black/60 dark:text-white/60 mt-1">{addressNote}</p>
      )}

      {error && (
        <p className="text-xs text-rose-700 dark:text-rose-300 mt-2">{error}</p>
      )}

      {sent ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-3">
          ✅ تم إرسال الطلب — بنراجعه ونتواصل معك.
        </p>
      ) : (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await claimAsSeller(id);
                if (result.error) setError(result.error);
                else setSent(true);
              })
            }
            className="rounded-full bg-brand-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-brand-700 disabled:opacity-60"
          >
            نعم، هذا محلي
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-full border border-black/[.12] dark:border-white/[.2] text-xs px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            ليس هذا
          </button>
        </div>
      )}
    </div>
  );
}
