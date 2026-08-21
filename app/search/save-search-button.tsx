"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveSearch, type SaveSearchState } from "@/app/my/saved-searches/actions";

export default function SaveSearchButton({
  query,
  isSignedIn,
  resultsCount,
}: {
  query: string;
  isSignedIn: boolean;
  resultsCount: number;
}) {
  const [state, setState] = useState<SaveSearchState>({});
  const [isPending, startTransition] = useTransition();

  // The prompt is worth most on a zero-result search — that is exactly the case
  // where the visitor would otherwise leave and never learn the thing arrived.
  const prompt =
    resultsCount === 0
      ? "ما فيه نتائج الآن — احفظ البحث ونبلغك أول ما يوصل شي مطابق."
      : "احفظ هذا البحث ونبلغك بأي إعلان جديد يطابقه.";

  if (!isSignedIn) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        <Link href="/login" className="underline">
          سجّل دخولك
        </Link>{" "}
        عشان تحفظ هذا البحث ونبلغك بالجديد.
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="text-sm text-green-700 dark:text-green-500">
        حفظنا بحثك — بنبلغك أول ما يوصل شي مطابق.{" "}
        <Link href="/my/saved-searches" className="underline">
          بحوثاتي المحفوظة
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-black/50 dark:text-white/50">{prompt}</span>
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setState(await saveSearch(query));
          })
        }
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] text-sm px-3 py-1.5 disabled:opacity-50"
      >
        {isPending ? "جارٍ الحفظ..." : "احفظ البحث"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </div>
  );
}
