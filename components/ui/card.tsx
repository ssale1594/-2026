import type { HTMLAttributes } from "react";

// The one card shell every content box should use — replaces the ad-hoc
// "rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4"
// string copy-pasted across dozens of files with slightly different padding
// and radius each time.
export function Card({
  className = "",
  padding = "md",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { padding?: "sm" | "md" | "lg" | "none" }) {
  const pad = { none: "", sm: "p-3", md: "p-4", lg: "p-6" }[padding];
  return (
    <div
      className={[
        "rounded-[--radius-card] border border-black/[.08] dark:border-white/[.145] bg-surface",
        pad,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}
