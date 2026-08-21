"use client";

// window.print() needs an onClick, which a Server Component can't attach to a
// raw <button> — this exact bug ("Event handlers cannot be passed to Client
// Component props") took down /dashboard, /admin/pulse and (via a nested
// <Link onClick>) /search in production. Shared here since both dashboard and
// admin/pulse needed their own print button.
export default function PrintButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {children}
    </button>
  );
}
