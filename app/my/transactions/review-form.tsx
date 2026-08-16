"use client";

import { useActionState } from "react";
import { submitReview, type ReviewFormState } from "../actions";

const initialState: ReviewFormState = {};

export default function ReviewForm({
  transactionId,
  sellerId,
}: {
  transactionId: number;
  sellerId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    submitReview.bind(null, transactionId, sellerId),
    initialState
  );

  if (state.success) {
    return (
      <p className="text-sm text-green-700 dark:text-green-500 mt-3">
        شكرًا، نُشر تقييمك.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 mt-3">
      <label className="flex items-center gap-2 text-sm">
        <span>التقييم</span>
        <select
          name="rating"
          required
          defaultValue="5"
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-2 py-1 text-sm"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <textarea
        name="comment"
        rows={2}
        maxLength={600}
        placeholder="كيف كان تعاملك معه؟ — اختياري"
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full"
      />

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-3 py-1.5 self-start disabled:opacity-50"
      >
        {isPending ? "جارٍ النشر..." : "انشر التقييم"}
      </button>
    </form>
  );
}
