import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";
import ReviewButtons from "../review-buttons";
import { setEventStatus } from "../actions";

export default async function AdminEventsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, title, description, location_text, starts_at, neighborhoods(name_ar)")
    .eq("status", "pending_review")
    .order("starts_at")
    .returns<
      {
        id: number;
        title: string;
        description: string | null;
        location_text: string | null;
        starts_at: string;
        neighborhoods: { name_ar: string } | null;
      }[]
    >();

  return (
    <div className="min-h-screen font-sans">
      <AdminHeader active="events" />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-6">فعاليات بانتظار المراجعة</h1>

        {!events || events.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">ما فيه فعاليات جديدة.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">{event.title}</div>
                  {event.description && (
                    <p className="text-sm text-black/60 dark:text-white/60 mt-1">
                      {event.description}
                    </p>
                  )}
                  <div className="text-xs text-black/40 dark:text-white/40 mt-2 flex flex-wrap gap-x-3">
                    <span>
                      {new Date(event.starts_at).toLocaleString("ar", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    {event.location_text && <span>{event.location_text}</span>}
                    {event.neighborhoods && (
                      <span>حي {event.neighborhoods.name_ar}</span>
                    )}
                  </div>
                </div>
                <ReviewButtons
                  onApprove={setEventStatus.bind(null, event.id, "published")}
                  onReject={setEventStatus.bind(null, event.id, "rejected")}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
