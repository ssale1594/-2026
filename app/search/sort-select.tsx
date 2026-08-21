"use client";

import { useRouter } from "next/navigation";
import type { SearchSort, FilterState } from "./page";

// Its own file with "use client" because the <select> needs an onChange, and
// the search page it sits on is a Server Component — event handlers cannot
// cross that boundary.
export default function SortSelect({
  current,
  state,
}: {
  current: SearchSort;
  hasQuery?: boolean;
  state: FilterState;
}) {
  const router = useRouter();

  const opts: { value: SearchSort; label: string }[] = [
    { value: "newest", label: "الأحدث أولاً" },
    { value: "views_desc", label: "الأكثر مشاهدة" },
    { value: "contact_desc", label: "الأكثر تواصلًا" },
    { value: "rating_desc", label: "الأعلى تقييمًا" },
    { value: "price_asc", label: "السعر: الأقل أولاً" },
    { value: "price_desc", label: "السعر: الأعلى أولاً" },
    { value: "oldest", label: "الأقدم أولاً" },
  ];

  function buildUrl(v: SearchSort) {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.min != null) params.set("min", String(state.min));
    if (state.max != null) params.set("max", String(state.max));
    if (state.n) params.set("n", state.n);
    if (state.c) params.set("c", state.c);
    if (state.ng) params.set("ng", "1");
    if (state.img) params.set("img", "1");
    if (state.t) params.set("t", String(state.t));
    if (state.r != null) params.set("r", String(state.r));
    params.set("sort", v);
    return `/search?${params.toString()}`;
  }

  return (
    <label className="text-sm inline-flex items-center gap-2">
      <span className="text-black/60 dark:text-white/60 shrink-0">ترتيب:</span>
      <select
        value={current}
        onChange={(e) => router.push(buildUrl(e.target.value as SearchSort))}
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm focus:border-sky-500 outline-none"
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
