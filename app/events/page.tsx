import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { getNeighborhoods } from "@/lib/data/neighborhoods";
import EventForm from "./event-form";

export const metadata: Metadata = {
  title: pageTitle("فعاليات الزلفي"),
  description:
    "تقويم فعاليات ومناسبات وبازارات الزلفي — وش صاير بالبلد هالأسبوع.",
};

export default async function EventsPage() {
  const supabase = await createClient();

  // RLS already limits this to reviewed events that haven't finished.
  const [{ data: events }, { data: { user } }, neighborhoods] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, title, description, location_text, starts_at, ends_at, neighborhoods(name_ar, slug)")
        .order("starts_at")
        .limit(50)
        .returns<
          {
            id: number;
            title: string;
            description: string | null;
            location_text: string | null;
            starts_at: string;
            ends_at: string | null;
            neighborhoods: { name_ar: string; slug: string } | null;
          }[]
        >(),
      supabase.auth.getUser(),
      getNeighborhoods(),
    ]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ar", {
      dateStyle: "full",
      timeStyle: "short",
    });

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">فعاليات الزلفي</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          بازارات، مناسبات، وأنشطة محلية — الفعالية تختفي تلقائيًا بعد ما تنتهي.
        </p>

        {!events || events.length === 0 ? (
          <p className="text-black/60 dark:text-white/60 mb-10">
            ما فيه فعاليات قادمة حاليًا.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 mb-10">
            {events.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4"
              >
                <div className="font-medium mb-1">{event.title}</div>
                {event.description && (
                  <p className="text-sm text-black/70 dark:text-white/70 whitespace-pre-line mb-2">
                    {event.description}
                  </p>
                )}
                <div className="text-xs text-black/50 dark:text-white/50">
                  {formatDate(event.starts_at)}
                </div>
                <div className="text-xs text-black/40 dark:text-white/40 mt-1 flex flex-wrap gap-x-3">
                  {event.location_text && <span>{event.location_text}</span>}
                  {event.neighborhoods && (
                    <Link
                      href={`/neighborhood/${event.neighborhoods.slug}`}
                      className="hover:underline"
                    >
                      حي {event.neighborhoods.name_ar}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="border-t border-black/[.08] dark:border-white/[.145] pt-8">
          <h2 className="font-semibold mb-1">أضف فعالية</h2>
          <p className="text-sm text-black/60 dark:text-white/60 mb-4">
            تعرف فعالية قادمة بالزلفي؟ أضفها وبنراجعها قبل النشر.
          </p>
          <EventForm neighborhoods={neighborhoods} isSignedIn={Boolean(user)} />
        </section>
      </main>
    </div>
  );
}
