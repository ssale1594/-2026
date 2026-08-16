import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getNeighborhoods } from "@/lib/data/neighborhoods";
import { relativeTimeAr } from "@/lib/relative-time";
import DashboardHeader from "../dashboard-header";
import JobForm from "./job-form";
import CloseJobButton from "./close-job-button";
import { closeJob } from "@/app/jobs/actions";

const STATUS_LABELS: Record<string, string> = {
  pending_review: "قيد المراجعة",
  published: "منشورة",
  closed: "مقفلة",
  rejected: "مرفوضة",
};

export default async function DashboardJobsPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  const [neighborhoods, { data: jobs }] = await Promise.all([
    getNeighborhoods(),
    supabase
      .from("jobs")
      .select("id, title, status, created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .returns<
        { id: number; title: string; status: string; created_at: string }[]
      >(),
  ]);

  // Applications for this seller's jobs — RLS scopes it to jobs they own.
  const { data: applications } = await supabase
    .from("job_applications")
    .select("id, message, contact_whatsapp, created_at, job_id, jobs(title)")
    .order("created_at", { ascending: false })
    .returns<
      {
        id: number;
        message: string | null;
        contact_whatsapp: string;
        created_at: string;
        job_id: number;
        jobs: { title: string } | null;
      }[]
    >();

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader backHref="/dashboard" backLabel="رجوع للوحة" />

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">وظائفي</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          الوظيفة تنتهي تلقائيًا بعد 45 يوم من نشرها.
        </p>

        {seller.verification_status === "approved" ? (
          <JobForm neighborhoods={neighborhoods} />
        ) : (
          <p className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-4 py-3 text-sm text-black/60 dark:text-white/60 mb-8">
            نشر الوظائف يفتح بعد اعتماد حسابك.
          </p>
        )}

        <h2 className="font-semibold mb-3">كل وظائفك</h2>
        {!jobs || jobs.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60 mb-8">
            ما نشرت أي وظيفة بعد.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 mb-10">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">{job.title}</div>
                  <div className="text-xs text-black/40 dark:text-white/40 mt-1">
                    {STATUS_LABELS[job.status]} · {relativeTimeAr(job.created_at)}
                  </div>
                </div>
                {job.status !== "closed" && (
                  <CloseJobButton
                    onClose={async () => {
                      "use server";
                      await closeJob(job.id);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        <h2 className="font-semibold mb-3">الطلبات الواردة</h2>
        {!applications || applications.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            ما وصلك أي طلب توظيف بعد.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {applications.map((application) => (
              <li
                key={application.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4"
              >
                <div className="text-sm font-medium">
                  {application.jobs?.title}
                </div>
                {application.message && (
                  <p className="text-sm text-black/70 dark:text-white/70 mt-1">
                    {application.message}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <a
                    href={`https://wa.me/${application.contact_whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-green-600 text-white text-xs font-medium px-3 py-1.5"
                  >
                    تواصل واتساب
                  </a>
                  <span className="text-xs text-black/40 dark:text-white/40">
                    {relativeTimeAr(application.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
