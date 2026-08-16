import Link from "next/link";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { relativeTimeAr } from "@/lib/relative-time";
import DashboardHeader from "../dashboard-header";
import RespondForm from "./respond-form";

export default async function DashboardNeedsPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  // RLS restricts this to open, unexpired requests; the contact number comes
  // through because answering a need is exactly what a seller account is for.
  const [{ data: requests }, { data: myResponses }] = await Promise.all([
    supabase
      .from("need_requests")
      .select(
        "id, title, description, contact_whatsapp, created_at, categories(name_ar), neighborhoods(name_ar)"
      )
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<
        {
          id: number;
          title: string;
          description: string | null;
          contact_whatsapp: string;
          created_at: string;
          categories: { name_ar: string } | null;
          neighborhoods: { name_ar: string } | null;
        }[]
      >(),
    supabase.from("need_responses").select("request_id").eq("seller_id", seller.id),
  ]);

  const respondedIds = new Set((myResponses ?? []).map((row) => row.request_id));
  const isApproved = seller.verification_status === "approved";

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader backHref="/dashboard" backLabel="رجوع للوحة" />

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">طلبات تنتظر ردك</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          طلبات نشرها أهل الزلفي. رد على اللي تقدر تقدمه.
        </p>

        {!isApproved && (
          <p className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-4 py-3 text-sm text-black/60 dark:text-white/60 mb-6">
            حسابك لسا تحت المراجعة — تقدر تشوف الطلبات، لكن الرد يفتح بعد
            اعتماد حسابك.
          </p>
        )}

        {!requests || requests.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه طلبات مفتوحة حاليًا.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => {
              const alreadyResponded = respondedIds.has(request.id);

              return (
                <li
                  key={request.id}
                  className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4"
                >
                  <div className="font-medium mb-1">{request.title}</div>
                  {request.description && (
                    <p className="text-sm text-black/70 dark:text-white/70 whitespace-pre-line mb-2">
                      {request.description}
                    </p>
                  )}
                  <div className="text-xs text-black/40 dark:text-white/40 flex flex-wrap gap-x-3">
                    <span>{relativeTimeAr(request.created_at)}</span>
                    {request.categories && <span>{request.categories.name_ar}</span>}
                    {request.neighborhoods && (
                      <span>حي {request.neighborhoods.name_ar}</span>
                    )}
                  </div>

                  {alreadyResponded ? (
                    <p className="text-sm text-black/50 dark:text-white/50 mt-3">
                      رديت على هذا الطلب.
                    </p>
                  ) : isApproved ? (
                    <RespondForm
                      requestId={request.id}
                      contactWhatsapp={request.contact_whatsapp}
                      requestTitle={request.title}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-sm text-black/40 dark:text-white/40 mt-8">
          <Link href="/needs" className="hover:underline">
            عرض الصفحة العامة للطلبات
          </Link>
        </p>
      </main>
    </div>
  );
}
