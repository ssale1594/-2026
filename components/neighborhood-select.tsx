"use client";

import { useRouter } from "next/navigation";

export default function NeighborhoodSelect({
  neighborhoods,
}: {
  neighborhoods: { slug: string; name_ar: string }[];
}) {
  const router = useRouter();

  return (
    <select
      defaultValue=""
      onChange={(event) => {
        const slug = event.target.value;
        if (slug) router.push(`/neighborhood/${slug}`);
      }}
      className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full sm:w-auto"
    >
      <option value="" disabled>
        تصفح حسب الحي
      </option>
      {neighborhoods.map((neighborhood) => (
        <option key={neighborhood.slug} value={neighborhood.slug}>
          {neighborhood.name_ar}
        </option>
      ))}
    </select>
  );
}
