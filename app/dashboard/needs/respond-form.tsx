"use client";

import { useActionState } from "react";
import { respondToNeed, type NeedResponseFormState } from "./actions";

const initialState: NeedResponseFormState = {};

export default function RespondForm({
  requestId,
  contactWhatsapp,
  requestTitle,
}: {
  requestId: number;
  contactWhatsapp: string;
  requestTitle: string;
}) {
  const [state, formAction, isPending] = useActionState(
    respondToNeed.bind(null, requestId),
    initialState
  );

  const waMessage = encodeURIComponent(
    `السلام عليكم، شفت طلبك "${requestTitle}" وأقدر أساعدك فيه.`
  );

  if (state.success) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-green-700 dark:text-green-500">
          تم تسجيل ردك.
        </p>
        <a
          href={`https://wa.me/${contactWhatsapp}?text=${waMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-green-600 text-white text-xs font-medium px-3 py-1.5"
        >
          تواصل واتساب
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 mt-3">
      <textarea
        name="message"
        required
        rows={2}
        maxLength={600}
        placeholder="اكتب ردك — وش تقدر تقدم وبكم تقريبًا."
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-foreground text-background text-sm font-medium px-3 py-1.5 disabled:opacity-50"
        >
          {isPending ? "جارٍ الإرسال..." : "رد على الطلب"}
        </button>
        <a
          href={`https://wa.me/${contactWhatsapp}?text=${waMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-black/60 dark:text-white/60 hover:underline"
        >
          أو تواصل واتساب مباشرة
        </a>
      </div>
    </form>
  );
}
