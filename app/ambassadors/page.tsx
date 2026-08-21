import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import SiteNav from "@/components/site-nav";
import AmbassadorForm from "./ambassador-form";

export const metadata = {
  title: pageTitle("سفراء الأحياء"),
  description:
    "كن سفيرًا غير رسمي لحيّك — عرّف جيرانك بالمنصة واحصل على تقدير خاص.",
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  pending: { label: "طلبك قيد المراجعة", tone: "bg-amber-500/10 text-amber-800 dark:text-amber-200" },
  approved: { label: "أنت سفير معتمد ✅", tone: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" },
  revoked: { label: "تم إلغاء صفة السفير", tone: "bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60" },
};

export default async function AmbassadorsPage() {
  const supabase = await createClient();

  const [{ data: user }, hoodsQ] = await Promise.all([
    supabase.auth.getUser().then((r) => ({ data: r.data.user })),
    supabase.from("neighborhoods").select("id, name_ar").order("name_ar"),
  ]);

  const myApplicationsQ = user
    ? await supabase.rpc("my_ambassador_applications")
    : { data: null };

  const myApplications =
    (myApplicationsQ.data as {
      neighborhood_id: number;
      neighborhood_name: string;
      status: string;
      applied_at: string;
    }[]) ?? [];

  return (
    <div className="min-h-screen font-sans">
      <header className="relative border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold shrink-0">
            {siteName}
          </Link>
          <SiteNav />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-extrabold mb-2">🙌 سفراء الأحياء</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6 leading-relaxed">
          أنت أعرف بحيّك من أي حد — تعرف المحلات والأسر المنتجة اللي ما انضمّت
          بعد. كن سفيرًا غير رسمي: عرّفهم بالمنصة وساعدهم يبدأون. مقابلها،
          نضيفك لقائمة سفراء حيّك (يشوفها الجميع)، ولو كنت بائعًا نمنحك شرائح
          إعلانات إضافية مجانية.
        </p>

        {myApplications.length > 0 && (
          <div className="mb-6 space-y-2">
            {myApplications.map((app) => {
              const status = STATUS_LABEL[app.status] ?? STATUS_LABEL.pending;
              return (
                <div
                  key={app.neighborhood_id}
                  className={`rounded-lg px-4 py-2.5 text-sm ${status.tone}`}
                >
                  {app.neighborhood_name} — {status.label}
                </div>
              );
            })}
          </div>
        )}

        {user ? (
          <AmbassadorForm
            neighborhoods={
              (hoodsQ.data ?? []) as { id: number; name_ar: string }[]
            }
          />
        ) : (
          <div className="rounded-lg border border-black/[.08] dark:border-white/[.145] px-4 py-4 text-sm">
            <p className="mb-3">سجّل دخولك أول عشان تقدر تقدّم كسفير.</p>
            <Link
              href="/login"
              className="inline-block rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2"
            >
              تسجيل الدخول
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
