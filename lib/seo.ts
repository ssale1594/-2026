// TODO: اسم مؤقت لين يتحدد الاسم النهائي — غيّره من هنا فقط، كل الصفحات تقرأ منه.
export const siteName = "سوق الزلفي";

// Set NEXT_PUBLIC_SITE_URL in production; the fallback only serves local dev.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// TECH.md §8 — every page needs its own descriptive title, never a shared generic one.
export function pageTitle(specific: string): string {
  return `${specific} | ${siteName}`;
}
