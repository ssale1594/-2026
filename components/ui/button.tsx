import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT_CLS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50 shadow-sm",
  secondary:
    "border border-black/[.12] dark:border-white/[.2] bg-transparent hover:bg-black/5 dark:hover:bg-white/5",
  ghost: "bg-transparent hover:bg-black/5 dark:hover:bg-white/5",
  danger: "bg-danger-600 text-white hover:bg-danger-700 disabled:bg-danger-600/50",
};

const SIZE_CLS: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
  lg: "text-sm px-5 py-2.5 gap-2",
};

const BASE =
  "inline-flex items-center justify-center rounded-[--radius-control] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

function cls(variant: Variant, size: Size, className?: string) {
  return [BASE, VARIANT_CLS[variant], SIZE_CLS[size], className]
    .filter(Boolean)
    .join(" ");
}

type BaseProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
};

// Button renders a real <button> — use it for form submits and client
// actions. LinkButton renders an <a> via next/link — use it for navigation.
// Two components instead of one polymorphic one because a submit button
// and a navigation link have different a11y roles and keyboard behavior,
// and papering over that with an `as` prop just hides the distinction.
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cls(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...rest
}: BaseProps &
  Omit<React.ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link href={href} className={cls(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
