import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";
import ReviewButtons from "../review-buttons";
import { setJobStatus } from "../actions";

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  temporary: "مؤقت",
};

export default async function AdminJobsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, description, job_type, salary_text, sellers(business_name)")
    .eq("status", "pending_review")
    .order("created_at")
    .returns<
      {
        id: number;
        title: string;
        description: string | null;
        job_type: string;
        salary_text: string | null;
        sellers: { business_name: string } | null;
      }[]
    >();

  return (
    <div className="min-h-screen font-sans">
      <AdminHeader active="jobs" />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-6">وظائف بانتظار المراجعة</h1>

        {!jobs || jobs.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">ما فيه وظائف جديدة.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">{job.title}</div>
                  <div className="text-sm text-black/60 dark:text-white/60 mt-1">
                    {job.sellers?.business_name}
                  </div>
                  {job.description && (
                    <p className="text-sm text-black/60 dark:text-white/60 mt-2">
                      {job.description}
                    </p>
                  )}
                  <div className="text-xs text-black/40 dark:text-white/40 mt-2 flex flex-wrap gap-x-3">
                    <span>{JOB_TYPE_LABELS[job.job_type]}</span>
                    {job.salary_text && <span>{job.salary_text}</span>}
                  </div>
                </div>
                <ReviewButtons
                  onApprove={async () => {
                    "use server";
                    await setJobStatus(job.id, "published");
                  }}
                  onReject={async () => {
                    "use server";
                    await setJobStatus(job.id, "rejected");
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
