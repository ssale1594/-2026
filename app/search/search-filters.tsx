"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SearchParamsObj, SearchSort } from "./page";

type Neighborhood = { id: number; name_ar: string; slug: string };
type Category = { id: number; name_ar: string; slug: string; listing_count: number };

type State = Required<
  Pick<SearchParamsObj, "ng" | "img">
> & {
  q: string;
  min: number | null;
  max: number | null;
  n: string | null;
  c: string | null;
  sort: SearchSort;
  t: number;
  r: number | null;
};

type Props = {
  neighborhoods: Neighborhood[];
  popularCategories: Category[];
  state: {
    q: string;
    min: number | null;
    max: number | null;
    n: string | null;
    c: string | null;
    sort: SearchSort;
    ng: boolean;
    img: boolean;
    t: number;
    r: number | null;
  };
};

export default function SearchFilters({ neighborhoods, popularCategories, state }: Props) {
  const router = useRouter();
  const [neighborhood, setNeighborhood] = useState(state.n || "");
  const [category, setCategory] = useState(state.c || "");
  const [min, setMin] = useState<string>(state.min != null ? String(state.min) : "");
  const [max, setMax] = useState<string>(state.max != null ? String(state.max) : "");
  const [negotiable, setNegotiable] = useState(state.ng);
  const [imagesOnly, setImagesOnly] = useState(state.img);
  const [trust, setTrust] = useState<number>(state.t || 0);
  const [rating, setRating] = useState<string>(state.r != null ? String(state.r) : "");

  function buildUrl(): string {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.sort) params.set("sort", state.sort);
    if (min.trim()) params.set("min", min.trim());
    if (max.trim()) params.set("max", max.trim());
    if (neighborhood) params.set("n", neighborhood);
    if (category) params.set("c", category);
    if (negotiable) params.set("ng", "1");
    if (imagesOnly) params.set("img", "1");
    if (trust > 0) params.set("t", String(trust));
    if (rating.trim()) params.set("r", rating.trim());
    return `/search?${params.toString()}`;
  }

  function apply() {
    router.push(buildUrl());
  }

  function reset() {
    setNeighborhood("");
    setCategory("");
    setMin("");
    setMax("");
    setNegotiable(false);
    setImagesOnly(false);
    setTrust(0);
    setRating("");
    router.push(state.q ? `/search?q=${encodeURIComponent(state.q)}` : "/search");
  }

  return (
    <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] overflow-hidden">
      <div className="p-4 border-b border-black/[.08] dark:border-white/[.145] bg-black/[.02] dark:bg-white/[.03] flex items-center justify-between">
        <h3 className="font-semibold inline-flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          الفلاتر
        </h3>
        <button
          onClick={reset}
          className="text-xs text-red-600 hover:underline"
          type="button"
        >
          مسح الكل
        </button>
      </div>

      <div className="divide-y divide-black/[.06] dark:divide-white/[.1]">
        {/* Price */}
        <FilterSection title="💰 السعر" icon="">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-black/50 dark:text-white/50 block mb-1">أدنى سعر</label>
              <input
                type="number"
                min={0}
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-black/15 dark:border-white/20 px-2 py-1.5 text-sm bg-transparent"
              />
            </div>
            <span className="text-black/40 pt-5">—</span>
            <div className="flex-1">
              <label className="text-[10px] text-black/50 dark:text-white/50 block mb-1">أعلى سعر</label>
              <input
                type="number"
                min={0}
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="9999"
                className="w-full rounded-lg border border-black/15 dark:border-white/20 px-2 py-1.5 text-sm bg-transparent"
              />
            </div>
          </div>
          <p className="text-[11px] text-black/40 mt-1">٪ السعر بالريال السعودي</p>
        </FilterSection>

        {/* Neighborhood */}
        <FilterSection title="📍 الحي" icon="">
          <select
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            className="w-full rounded-lg border border-black/15 dark:border-white/20 px-2 py-2 text-sm bg-transparent"
          >
            <option value="">كل الأحياء</option>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.slug}>{n.name_ar}</option>
            ))}
          </select>
        </FilterSection>

        {/* Category */}
        <FilterSection title="📂 التصنيف" icon="">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-black/15 dark:border-white/20 px-2 py-2 text-sm bg-transparent"
          >
            <option value="">كل التصنيفات</option>
            {popularCategories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name_ar} ({c.listing_count})
              </option>
            ))}
          </select>
        </FilterSection>

        {/* Trust + Rating */}
        <FilterSection title="⭐ الثقة والتقييم" icon="">
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1.5 text-black/70">أقل مستوى ثقة</label>
            <div className="flex gap-1 flex-wrap">
              {[0, 1, 2, 3, 4].map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setTrust(lvl)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    trust === lvl
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {lvl === 0 ? "الكل" : `مستوى ${lvl}+`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5 text-black/70">أقل تقييم نجمات</label>
            <div className="flex gap-1 flex-wrap">
              {[
                { v: "", l: "الكل" },
                { v: "3", l: "★ 3+" },
                { v: "4", l: "★ 4+" },
                { v: "4.5", l: "★ 4.5+" },
              ].map((o) => (
                <button
                  type="button"
                  key={o.v}
                  onClick={() => setRating(o.v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    rating === o.v
                      ? "bg-amber-500 text-white border-amber-500"
                      : "border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </FilterSection>

        {/* Boolean toggles */}
        <FilterSection title="🎯 خيارات سريعة" icon="">
          <label className="flex items-start gap-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={imagesOnly}
              onChange={(e) => setImagesOnly(e.target.checked)}
              className="mt-1 rounded border-black/20"
            />
            <div>
              <span className="text-sm font-medium">إعلانات مع صور فقط</span>
              <p className="text-[11px] text-black/40">لأفضل تجربة تصفح</p>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={negotiable}
              onChange={(e) => setNegotiable(e.target.checked)}
              className="mt-1 rounded border-black/20"
            />
            <div>
              <span className="text-sm font-medium">قابل للتفاوض فقط</span>
              <p className="text-[11px] text-black/40">عروض من الباعة يقبلون المساومة</p>
            </div>
          </label>
        </FilterSection>
      </div>

      {/* Apply */}
      <div className="p-4 bg-black/[.02] dark:bg-white/[.03] border-t border-black/[.08] dark:border-white/[.145]">
        <button
          onClick={apply}
          type="button"
          className="w-full rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold py-2.5 transition inline-flex items-center justify-center gap-2"
        >
          ✓ تطبيق الفلاتر
        </button>
      </div>
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}
