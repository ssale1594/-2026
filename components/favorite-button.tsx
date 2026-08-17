"use client";

import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/my/favorites/favorites-actions";

export default function FavoriteButton({
  listingId,
  initialIsFav = false,
  size = "md",
  className = "",
}: {
  listingId: string;
  initialIsFav?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [isFav, setIsFav] = useState(initialIsFav);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const sizeCls =
    size === "sm"
      ? "w-8 h-8 text-base"
      : size === "lg"
      ? "w-12 h-12 text-2xl"
      : "w-10 h-10 text-lg";

  return (
    <button
      type="button"
      aria-pressed={isFav}
      aria-label={isFav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      title={isFav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      disabled={pending}
      onClick={() => {
        setErr(null);
        startTransition(async () => {
          const res = await toggleFavorite(listingId, isFav);
          if ((res as any).error) {
            setErr((res as any).error);
          } else {
            setIsFav(!isFav);
          }
        });
      }}
      className={[
        "inline-flex items-center justify-center rounded-full transition-all shrink-0",
        sizeCls,
        isFav
          ? "bg-rose-500 text-white shadow-md shadow-rose-500/20 hover:bg-rose-600"
          : "bg-white/90 dark:bg-black/60 text-black/60 dark:text-white/70 border border-black/[.08] dark:border-white/[.145] hover:border-rose-500/40 hover:text-rose-500 backdrop-blur",
        pending ? "opacity-60 cursor-wait" : "",
        className,
      ].join(" ")}
    >
      <span aria-hidden>{isFav ? "❤️" : "🤍"}</span>
      {err && (
        <span className="hidden">{err}</span>
      )}
    </button>
  );
}
