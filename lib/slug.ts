// TECH.md §12.4 — a listing/seller keeps a stable immutable id; the slug is only
// a descriptive URL segment. Arabic is kept as-is (browsers encode it fine).
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueSlug(input: string): string {
  const base = slugify(input) || "listing";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}
