import { relativeTimeAr } from "@/lib/relative-time";
import type { SellerActivity } from "@/lib/data/activity";

// Shows how alive this seller is *before* the buyer spends effort on a message.
// Deliberately states the raw facts (last activity, measured response time)
// rather than a marketing label — an invented "سريع الرد" badge would be the
// kind of unearned claim the trust layer exists to avoid.
export default function ActivityIndicator({
  activity,
}: {
  activity: SellerActivity | null;
}) {
  if (!activity?.last_active_at) return null;

  const parts: string[] = [];

  parts.push(
    activity.is_recently_active
      ? "نشط مؤخرًا"
      : `آخر نشاط ${relativeTimeAr(activity.last_active_at)}`
  );

  if (activity.avg_response_hours != null) {
    const hours = activity.avg_response_hours;
    parts.push(
      hours < 1
        ? "يرد خلال أقل من ساعة"
        : hours < 24
          ? `يرد خلال ${Math.round(hours)} ساعة تقريبًا`
          : `يرد خلال ${Math.round(hours / 24)} يوم تقريبًا`
    );
  }

  if (activity.responses_30d > 0) {
    parts.push(`رد على ${activity.responses_30d} طلب هالشهر`);
  }

  return (
    <div className="text-xs text-black/50 dark:text-white/50">
      {parts.join(" · ")}
    </div>
  );
}
