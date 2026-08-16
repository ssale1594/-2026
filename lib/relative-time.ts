// Small Arabic relative-time formatter — Intl.RelativeTimeFormat's Arabic
// output ("قبل ٣ أيام" with Eastern Arabic numerals, awkward dual/plural
// grammar) doesn't match this app's plain Western-numeral style elsewhere
// (see prices), so this hand-rolls a simpler version instead of pulling in
// a formatting library for one string.
export function relativeTimeAr(dateIso: string): string {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "قبل لحظات";
  if (diffMinutes < 60) return `قبل ${diffMinutes} دقيقة`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `قبل ${diffHours} ساعة`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "قبل يوم";
  if (diffDays < 30) return `قبل ${diffDays} يوم`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `قبل ${diffMonths} شهر`;

  const diffYears = Math.floor(diffMonths / 12);
  return `قبل ${diffYears} سنة`;
}
