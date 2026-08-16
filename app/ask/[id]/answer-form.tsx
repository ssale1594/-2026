"use client";

import Link from "next/link";
import { useActionState } from "react";
import { answerQuestion, type AnswerFormState } from "../actions";

const initialState: AnswerFormState = {};

export default function AnswerForm({
  questionId,
  isSignedIn,
  sellers,
}: {
  questionId: number;
  isSignedIn: boolean;
  sellers: { id: string; business_name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    answerQuestion.bind(null, questionId),
    initialState
  );

  if (!isSignedIn) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        <Link href="/login" className="underline">
          سجّل دخولك
        </Link>{" "}
        عشان تقدر ترد.
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="text-sm text-green-700 dark:text-green-500">نُشر ردك.</p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <textarea
        name="body"
        required
        rows={3}
        maxLength={1000}
        placeholder="اكتب ردك أو توصيتك..."
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full"
      />

      <label className="flex flex-col gap-1">
        <span className="text-sm">توصي ببائع معيّن؟ — اختياري</span>
        <select
          name="recommendedSellerId"
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full"
        >
          <option value="">بدون تحديد</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.business_name}
            </option>
          ))}
        </select>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 self-start disabled:opacity-50"
      >
        {isPending ? "جارٍ النشر..." : "انشر ردي"}
      </button>
    </form>
  );
}
