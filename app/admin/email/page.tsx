import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "@/app/admin/admin-header";
import { relativeTimeAr } from "@/lib/relative-time";
import EmailAdminActions from "./email-actions";

export const metadata: Metadata = {
  title: "إدارة البريد الإلكتروني",
  robots: { index: false, follow: false },
};

export default async function AdminEmailPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("email_log")
    .select("id, user_id, email_to, notification_type, subject, status, provider, error_message, is_digest, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<
      {
        id: number;
        user_id: string | null;
        email_to: string;
        notification_type: string | null;
        subject: string;
        status: string;
        provider: string | null;
        error_message: string | null;
        is_digest: boolean;
        sent_at: string | null;
        created_at: string;
      }[]
    >();

  // Stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: statsData } = await supabase
    .from("email_log")
    .select("status, is_digest")
    .gte("created_at", today.toISOString());

  const sent = statsData?.filter((l) => l.status === "sent").length ?? 0;
  const failed = statsData?.filter((l) => l.status === "failed").length ?? 0;
  const pending = statsData?.filter((l) => l.status === "pending").length ?? 0;
  const digestsSent = statsData?.filter((l) => l.status === "sent" && l.is_digest).length ?? 0;

  const resendKey = process.env.RESEND_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;
  const configuredProvider = resendKey ? "Resend (مفعل)" : brevoKey ? "Brevo (مفعل)" : "غير مُحدد — سيتم التسجيل في الكونسول أثناء التطوير فقط";

  return (
    <div className="min-h-screen font-sans">
      <AdminHeader active="email" />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold mb-2">إدارة البريد الإلكتروني</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          تحكم في إرسال الإشعارات عبر البريد + مراجعة سجل الإرسال + تشغيل الـWorker يدويًا.
        </p>

        {/* Status banner */}
        <div className="mb-6 rounded-xl border border-black/[.08] dark:border-white/[.145] overflow-hidden">
          <div className="p-4 bg-sky-50 dark:bg-sky-900/20 border-b border-black/[.08] dark:border-white/[.145]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold mb-1">📮 مزود البريد الحالي</div>
                <div className="text-sm text-black/70 dark:text-white/70">
                  {configuredProvider}
                </div>
              </div>
              <div className="text-xs text-black/50 dark:text-white/50 text-left max-w-xs">
                لتفعيل الإرسال الحقيقي: أضف <code className="px-1 bg-black/5 dark:bg-white/10 rounded">RESEND_API_KEY</code> أو{" "}
                <code className="px-1 bg-black/5 dark:bg-white/10 rounded">BREVO_API_KEY</code> في متغيرات البيئة (Vercel + .env.local).
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-black/[.08] dark:divide-white/[.145]">
            <Stat label="أرسلت اليوم" value={sent} color="emerald" />
            <Stat label="فشلت اليوم" value={failed} color="red" />
            <Stat label="قيد الانتظار" value={pending} color="amber" />
            <Stat label="ملخصات يومية" value={digestsSent} color="sky" />
          </div>
        </div>

        {/* Actions */}
        <EmailAdminActions />

        {/* Log */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">سجل آخر 50 عملية إرسال</h2>
          {!logs || logs.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">لا يوجد سجلات بعد — شغّل الـWorker أولاً.</p>
          ) : (
            <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/[.03] dark:bg-white/[.04]">
                    <tr className="text-black/60 dark:text-white/60">
                      <th className="text-right p-3 font-medium">التاريخ</th>
                      <th className="text-right p-3 font-medium">المستقبل</th>
                      <th className="text-right p-3 font-medium">الموضوع</th>
                      <th className="text-right p-3 font-medium">النوع</th>
                      <th className="text-right p-3 font-medium">الحالة</th>
                      <th className="text-right p-3 font-medium">المزود</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[.08] dark:divide-white/[.145]">
                    {logs.map((l) => (
                      <tr key={l.id} className="hover:bg-black/[.02] dark:hover:bg-white/[.02]">
                        <td className="p-3 whitespace-nowrap text-xs text-black/50 dark:text-white/50">
                          {relativeTimeAr(l.created_at)}
                        </td>
                        <td className="p-3 whitespace-nowrap font-mono text-xs max-w-[140px] truncate">
                          {l.email_to}
                        </td>
                        <td className="p-3 max-w-[240px] truncate" title={l.subject}>
                          {l.subject}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {l.is_digest ? (
                            <span className="text-xs rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 px-2 py-0.5">ملخص يومي</span>
                          ) : (
                            <span className="text-xs text-black/60 dark:text-white/60">{l.notification_type || "-"}</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <StatusBadge status={l.status} error={l.error_message} />
                        </td>
                        <td className="p-3 whitespace-nowrap text-xs text-black/50 dark:text-white/50">
                          {l.provider || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Cron help */}
        <div className="mt-8 rounded-xl border border-black/[.08] dark:border-white/[.145] p-5 bg-black/[.02] dark:bg-white/[.03]">
          <h3 className="font-semibold mb-2">⏰ تشغيل تلقائي (Cron)</h3>
          <p className="text-sm text-black/60 dark:text-white/60 mb-2">
            لإرسال الإشعارات تلقائيًا كل 15 دقيقة + الملخص يوميًا: استخدم Vercel Cron أو أي خدمة cron خارجية.
          </p>
          <div className="text-xs bg-black/[.04] dark:bg-white/[.05] p-3 rounded-lg font-mono break-all leading-relaxed">
            POST /api/email-worker<br />
            Header: Authorization: Bearer {process.env.EMAIL_WORKER_TOKEN ? "*** (موضوع)" : "⚠️ غير مُحدد - أضف EMAIL_WORKER_TOKEN في متغيرات البيئة"}
          </div>
          <div className="mt-3 text-xs text-black/50 dark:text-white/50">
            الموصى به: تشغيل كل 15 دقيقة للإشعارات الفورية، وكل صباح 9 صباحًا للملخص اليومي.
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
    sky: "text-sky-600",
  };
  return (
    <div className="p-4">
      <div className={`text-2xl font-bold ${colors[color] || ""}`}>{value}</div>
      <div className="text-xs text-black/50 dark:text-white/50 mt-1">{label}</div>
    </div>
  );
}

function StatusBadge({ status, error }: { status: string; error: string | null }) {
  const config: Record<string, { label: string; cls: string }> = {
    sent: { label: "✓ أرسل", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
    failed: { label: "✗ فشل", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
    pending: { label: "⏳ قيد الانتظار", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
    skipped: { label: "← تخطى", cls: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200" },
  };
  const c = config[status] || config.pending;
  return (
    <span
      className={`text-xs rounded-full px-2 py-0.5 inline-flex items-center ${c.cls}`}
      title={error || undefined}
    >
      {c.label}
    </span>
  );
}
