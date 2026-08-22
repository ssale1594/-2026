import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";
import { setReferralStatus } from "../actions";
import ReferralActions from "./referral-actions";

export default async function AdminReferralsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: referrals } = await supabase
    .from("referrals")
    .select("id, referrer_name, business_name, business_description, business_whatsapp, created_at")
    .eq("status", "pending")
    .order("created_at");

  return (
    <div className="min-h-screen font-sans">
      <AdminHeader active="referrals" />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-6">ترشيحات بانتظار المتابعة</h1>

        {!referrals || referrals.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">ما فيه ترشيحات جديدة.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {referrals.map((referral) => (
              <li
                key={referral.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">{referral.business_name}</div>
                  {referral.business_whatsapp && (
                    <a
                      href={`https://wa.me/${referral.business_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `مرحبًا، معك فريق سوق الزلفي. أحد الأعضاء رشّح "${referral.business_name}" للانضمام لمنصتنا — يسعدنا لو تنضمّون وتعرضون منتجاتكم للزلفي كلها.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400 hover:underline mt-1"
                    >
                      📱 {referral.business_whatsapp} — تواصل واتساب
                    </a>
                  )}
                  {referral.business_description && (
                    <p className="text-sm text-black/60 dark:text-white/60 mt-2">
                      {referral.business_description}
                    </p>
                  )}
                  {referral.referrer_name && (
                    <p className="text-xs text-black/40 dark:text-white/40 mt-2">
                      رشّحه: {referral.referrer_name}
                    </p>
                  )}
                </div>
                <ReferralActions
                  onContacted={setReferralStatus.bind(null, referral.id, "contacted")}
                  onDismiss={setReferralStatus.bind(null, referral.id, "dismissed")}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
