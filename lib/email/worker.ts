"use server";

import { createClient as createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "./provider";
import { renderInstantEmail, renderDigestEmail } from "./templates";
import { siteName, siteUrl } from "@/lib/seo";
import { requireAdmin } from "@/lib/auth/permissions";

export type WorkerStats = {
  instant: { processed: number; sent: number; failed: number; skipped: number };
  digest: { processed: number; sent: number; failed: number };
};

const YEAR = new Date().getFullYear();

// ---------- Batch: instant notifications ----------
async function processInstantBatch(batchSize = 50): Promise<WorkerStats["instant"]> {
  const supabase = await createServiceClient();
  const res = await supabase.rpc("get_instant_email_batch", { p_batch_size: batchSize });
  const rows: Array<{
    notification_id: number;
    user_id: string;
    user_email: string;
    notification_type: string;
    title: string;
    body: string | null;
    link: string | null;
    created_at: string;
  }> = res.data || [];

  const stats = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  for (const row of rows) {
    stats.processed++;

    if (!row.user_email) {
      stats.skipped++;
      continue;
    }

    // 1) Insert pending log row with provider null
    const { data: log } = await supabase
      .from("email_log")
      .insert({
        user_id: row.user_id,
        email_to: row.user_email,
        notification_type: row.notification_type,
        subject: row.title,
        status: "pending",
        notification_id: row.notification_id,
        is_digest: false,
      })
      .select("id")
      .single();

    if (!log) {
      stats.failed++;
      continue;
    }

    // 2) Get user's full_name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", row.user_id)
      .maybeSingle();

    // 3) Render template
    const { html, subject } = renderInstantEmail({
      siteName: siteName,
      siteUrl: siteUrl,
      userEmail: row.user_email,
      userName: profile?.full_name || undefined,
      year: YEAR,
      notification: {
        id: row.notification_id,
        type: row.notification_type,
        title: row.title,
        body: row.body,
        link: row.link,
        created_at: row.created_at,
      },
    });

    // 4) Send
    const result = await sendEmail({
      to: row.user_email,
      subject,
      html,
    });

    // 5) Update log
    await supabase.rpc("mark_email_sent", {
      p_log_id: log.id,
      p_provider: result.provider || null,
      p_provider_msg_id: result.messageId || null,
      p_error: result.error || null,
    });

    if (result.success) stats.sent++;
    else stats.failed++;
  }

  return stats;
}

// ---------- Batch: daily digest ----------
async function processDigestBatch(batchSize = 50): Promise<WorkerStats["digest"]> {
  const supabase = await createServiceClient();
  const res = await supabase.rpc("get_email_digest_batch", { p_batch_size: batchSize });
  const rows: Array<{
    user_id: string;
    user_email: string;
    user_full_name: string | null;
    notifications: Array<{
      id: number;
      type: string;
      title: string;
      body: string | null;
      link: string | null;
      created_at: string;
      is_read: boolean;
    }>;
  }> = res.data || [];

  const stats = { processed: 0, sent: 0, failed: 0 };

  for (const row of rows) {
    stats.processed++;
    if (!row.user_email || !row.notifications || row.notifications.length === 0) continue;

    // 1) Create a pending log (aggregated)
    const { data: log } = await supabase
      .from("email_log")
      .insert({
        user_id: row.user_id,
        email_to: row.user_email,
        notification_type: "digest",
        subject: `ملخص إشعارات اليوم - ${row.notifications.length} عنصر`,
        status: "pending",
        is_digest: true,
      })
      .select("id")
      .single();

    if (!log) {
      stats.failed++;
      continue;
    }

    const unreadCount = row.notifications.filter((n) => !n.is_read).length;

    // 2) Render
    const { html, subject } = renderDigestEmail({
      siteName: siteName,
      siteUrl: siteUrl,
      userEmail: row.user_email,
      userName: row.user_full_name || undefined,
      year: YEAR,
      notifications: row.notifications,
      unreadCount,
    });

    // 3) Send
    const result = await sendEmail({
      to: row.user_email,
      subject,
      html,
    });

    // 4) Update
    await supabase.rpc("mark_email_sent", {
      p_log_id: log.id,
      p_provider: result.provider || null,
      p_provider_msg_id: result.messageId || null,
      p_error: result.error || null,
    });

    if (result.success) stats.sent++;
    else stats.failed++;
  }

  return stats;
}

// ---------- Public entry points ----------

export async function runEmailWorker(): Promise<WorkerStats> {
  await requireAdmin();
  const instant = await processInstantBatch(100);
  const digest = await processDigestBatch(50);
  return { instant, digest };
}

// Non-admin protected: used by cron webhook secured via bearer token.
export async function runEmailWorkerCron(bearerToken: string | null): Promise<WorkerStats> {
  const expected = process.env.EMAIL_WORKER_TOKEN;
  if (!expected || expected.length < 16 || bearerToken !== expected) {
    throw new Error("Unauthorized cron call: invalid EMAIL_WORKER_TOKEN");
  }
  const instant = await processInstantBatch(100);
  const digest = await processDigestBatch(50);
  return { instant, digest };
}

// ---------- Admin: test email sending ----------
export async function sendTestEmail(to: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();

  const { html, subject } = renderInstantEmail({
    siteName: siteName,
    siteUrl: siteUrl,
    userEmail: to,
    userName: "مستخدم تجريبي",
    year: YEAR,
    notification: {
      id: 0,
      type: "listing_published",
      title: "اختبار إرسال البريد الإلكتروني",
      body: "إذا وصلتك هذه الرسالة، فهذا يعني أن إعدادات البريد الإلكتروني تعمل بشكل صحيح!",
      link: "/notifications",
      created_at: new Date().toISOString(),
    },
  });

  const result = await sendEmail({ to, subject, html });
  return {
    ok: result.success,
    message: result.success
      ? `تم الإرسال بنجاح عبر ${result.provider} - الرسالة: ${result.messageId || "-"}`
      : `فشل الإرسال: ${result.error || "سبب غير معروف"}`,
  };
}
