import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { relativeTimeAr } from "@/lib/relative-time";
import ApplyForm from "./apply-form";

export const metadata: Metadata = {
  title: pageTitle("وظائف بالزلفي"),
  description: "وظائف شاغرة بمحلات وأنشطة الزلفي — قدّم مباشرة عبر المنصة.",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  temporary: "مؤقت",
};

export default async function JobsPage() {
  const supabase = await createClient();

  const [{ data: jobs }, { data: { user } }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, description, job_type, salary_text, created_at, sellers(business_name, slug), neighborhoods(name_ar, slug)")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<
        {
          id: number;
          title: string;
          description: string | null;
          job_type: string;
          salary_text: string | null;
          created_at: string;
          sellers: { business_name: string; slug: string } | null;
          neighborhoods: { name_ar: string; slug: string } | null;
        }[]
      >(),
    supabase.auth.getUser(),
  ]);

  // One query for every job the signed-in user already applied to, instead of
  // one per card.
  const { data: myApplications } = user
    ? await supabase
        .from("job_applications")
        .select("job_id")
        .eq("applicant_id", user.id)
    : { data: null };

  const appliedIds = new Set((myApplications ?? []).map((row) => row.job_id));

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
        <h1 className="text-xl font-semibold mb-2">وظائف بالزلفي</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          وظائف شاغرة من محلات وأنشطة مسجلة بالمنصة.
        </p>

        {!jobs || jobs.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه وظائف معلنة حاليًا.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4"
              >
                <div className="font-medium mb-1">{job.title}</div>
                {job.description && (
                  <p className="text-sm text-black/70 dark:text-white/70 whitespace-pre-line mb-2">
                    {job.description}
                  </p>
                )}
                <div className="text-xs text-black/40 dark:text-white/40 flex flex-wrap gap-x-3 gap-y-1">
                  <span>{JOB_TYPE_LABELS[job.job_type]}</span>
                  {job.salary_text && <span>{job.salary_text}</span>}
                  {job.sellers && (
                    <Link
                      href={`/seller/${job.sellers.slug}`}
                      className="hover:underline"
                    >
                      {job.sellers.business_name}
                    </Link>
                  )}
                  {job.neighborhoods && (
                    <span>حي {job.neighborhoods.name_ar}</span>
                  )}
                  <span>{relativeTimeAr(job.created_at)}</span>
                </div>

                <ApplyForm
                  jobId={job.id}
                  isSignedIn={Boolean(user)}
                  alreadyApplied={appliedIds.has(job.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
