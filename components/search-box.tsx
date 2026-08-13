"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBox({
  defaultValue = "",
}: {
  defaultValue?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = query.trim();
        if (trimmed) {
          router.push(`/search?q=${encodeURIComponent(trimmed)}`);
        }
      }}
      className="flex gap-2"
    >
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ابحث عن منتج، خدمة، أو محل..."
        className="flex-1 rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2"
      >
        بحث
      </button>
    </form>
  );
}
