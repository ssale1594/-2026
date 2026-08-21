import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import DashboardHeader from "@/app/dashboard/dashboard-header";
import SettingsForm from "./settings-form";

export const metadata: Metadata = {
  title: pageTitle("إعدادات الإشعارات"),
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      full_name,
      email_notifications_enabled,
      email_digest_enabled,
      notify_email_listing_published,
      notify_email_listing_rejected,
      notify_email_seller_approved,
      notify_email_seller_rejected,
      notify_email_transaction_claimed,
      notify_email_review_received,
      notify_email_vouch_received,
      notify_email_answer_received,
      notify_email_offer_published,
      notify_email_offer_rejected,
      notify_email_need_response
    `
    )
    .eq("id", user.id)
    .single();

  const defaults = {
    email_notifications_enabled: true,
    email_digest_enabled: true,
    notify_email_listing_published: true,
    notify_email_listing_rejected: true,
    notify_email_seller_approved: true,
    notify_email_seller_rejected: true,
    notify_email_transaction_claimed: true,
    notify_email_review_received: true,
    notify_email_vouch_received: true,
    notify_email_answer_received: true,
    notify_email_offer_published: true,
    notify_email_offer_rejected: true,
    notify_email_need_response: true,
  };

  const prefs = { ...defaults, ...(profile || {}) };

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader title="إعدادات الإشعارات" />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold mb-1">إعدادات الإشعارات</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            اختر الإشعارات اللي تريد أن تصل لك على بريدك الإلكتروني. الإشعارات الداخلية داخل المنصة تبقى دائمًا مفعّلة.
          </p>
        </div>

        <SettingsForm initialPrefs={prefs} email={user.email} />

        <div className="mt-10">
          <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-5 bg-black/[.02] dark:bg-white/[.03]">
            <h3 className="font-semibold mb-2">📬 الملخص اليومي</h3>
            <p className="text-sm text-black/60 dark:text-white/60 mb-3">
              بدل ما توصل لك إشعارات كثيرة طول اليوم، اختر الملخص اليومي ليصلك بريد واحد كل صباح يجمع كل ما حدث خلال 24 ساعة.
            </p>
            <div className="text-xs text-black/40 dark:text-white/40">
              البريد مسجل عليك: <code className="bg-black/[.05] dark:bg-white/[.07] px-1.5 py-0.5 rounded">{user.email}</code>
              <div className="mt-1">
                <Link
                  href="/notifications"
                  className="text-sky-700 hover:underline"
                >
                  عرض كل الإشعارات الداخلية →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
