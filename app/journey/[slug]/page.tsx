import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import {
  getJourneyBySlug,
  getJourneySteps,
  type JourneyStep,
} from "@/lib/data/journeys";
import { getSponsorship } from "@/lib/data/sponsorships";
import SponsorBanner from "@/components/sponsor-banner";

const PER_STEP_LIMIT = 4;

type StepResult = {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  price_negotiable: boolean;
  business_name: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const journey = await getJourneyBySlug(slug);

  if (!journey) {
    return { title: pageTitle("رحلة غير موجودة") };
  }

  return {
    title: pageTitle(journey.name_ar),
    description:
      journey.description ??
      `كل ما تحتاجه لـ${journey.name_ar} بالزلفي بمكان واحد.`,
  };
}

// Each step reuses the existing Arabic-normalized search RPC rather than a new
// query shape — that function already handles أ/إ/آ and ة/ه folding plus
// trigram fuzziness, which is exactly what matching a step keyword needs.
async function loadStep(step: JourneyStep): Promise<StepResult[]> {
  if (!step.search_query) return [];

  const supabase = await createClient();
  const { data } = await supabase.rpc("search_listings", {
    p_query: step.search_query,
    p_category_id: step.category_id,
    p_limit: PER_STEP_LIMIT,
  });

  return (data as StepResult[]) ?? [];
}

export default async function JourneyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const journey = await getJourneyBySlug(slug);

  if (!journey) {
    notFound();
  }

  const [steps, sponsorship] = await Promise.all([
    getJourneySteps(journey.id),
    getSponsorship("journey", journey.id),
  ]);
  const stepResults = await Promise.all(steps.map(loadStep));

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
          <nav className="text-sm text-black/60 dark:text-white/60">
            {journey.name_ar}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">{journey.name_ar}</h1>
        {journey.description && (
          <p className="text-sm text-black/60 dark:text-white/60 mb-6">
            {journey.description}
          </p>
        )}

        <SponsorBanner sponsorship={sponsorship} />

        <div className="flex flex-col gap-8">
          {steps.map((step, index) => {
            const results = stepResults[index];

            return (
              <section key={step.id}>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="font-semibold">{step.title_ar}</h2>
                  {step.search_query && (
                    <Link
                      href={`/search?q=${encodeURIComponent(step.search_query)}`}
                      className="text-xs text-black/50 dark:text-white/50 hover:underline"
                    >
                      عرض الكل
                    </Link>
                  )}
                </div>

                {results.length === 0 ? (
                  <p className="text-sm text-black/40 dark:text-white/40 rounded-lg border border-dashed border-black/[.12] dark:border-white/[.2] px-4 py-5">
                    ما فيه إعلانات بهذا القسم حاليًا — لو تعرف أحد يقدمها،{" "}
                    <Link href="/refer-a-business" className="underline">
                      رشّحه لنا
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {results.map((result) => (
                      <li key={result.id}>
                        <Link
                          href={`/listing/${result.slug}`}
                          className="block rounded-lg border border-black/[.08] dark:border-white/[.145] p-3 hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors h-full"
                        >
                          <div className="text-sm font-medium mb-1">
                            {result.title}
                          </div>
                          {result.price != null && (
                            <div className="text-xs text-black/60 dark:text-white/60">
                              {result.price} ر.س
                            </div>
                          )}
                          <div className="text-xs text-black/40 dark:text-white/40 mt-1">
                            {result.business_name}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
