import Link from "next/link";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";
import ModerationClient from "./moderation-client";

export default async function AdminModerationPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [statsQ, reportsQ] = await Promise.all([
    supabase.rpc("moderation_stats"),
    supabase
      .from("content_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const stats = (statsQ.data ?? []).reduce((acc: any, row: any) => {
    acc[row.kpi] = Number(row.val);
    return acc;
  }, {} as Record<string, number>);

  const reports = reportsQ.data ?? [];

  // احضر تفاصيل الاهداف (الإعلانات / الباعة)
  const listingIds: string[] = [];
  const sellerIds: string[] = [];
  (reports as any[]).forEach((r) => {
    if (r.target_type === "listing") listingIds.push(r.target_id);
    if (r.target_type === "seller") sellerIds.push(String(r.target_id));
    sellerIds.push(String(r.reporter_id));
  });

  const [listQ, sellersQ, reportersQ] = await Promise.all([
    listingIds.length > 0
      ? supabase
          .from("listings")
          .select("id, title, slug, status, seller_id, price, view_count, created_at")
          .in("id", Array.from(new Set(listingIds)) as any)
      : Promise.resolve({ data: [] } as any),
    sellerIds.length > 0
      ? supabase
          // business_name/slug/verification_status تعيش في sellers لا في
          // profiles — profiles ما فيه إلا id/role/full_name/phone.
          .from("sellers")
          .select("id, business_name, slug, verification_status, profiles(full_name)")
          .in("id", Array.from(new Set(sellerIds)) as any)
      : Promise.resolve({ data: [] } as any),
    // المبلّغ قد لا يكون بائعًا أصلاً، فنجلب اسمه من profiles مستقلاً
    // عن صفوف البائعين — وإلا ظهر معرّفه الخام بدل اسمه.
    sellerIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(new Set(sellerIds)) as any)
      : Promise.resolve({ data: [] } as any),
  ]);

  const listMap = new Map(((listQ as any).data ?? []).map((l: any) => [l.id, l]));
  const nameMap = new Map(
    ((reportersQ as any).data ?? []).map((p: any) => [p.id, p.full_name])
  );
  const sellerMap = new Map(
    ((sellersQ as any).data ?? []).map((s: any) => [
      s.id,
      { ...s, full_name: s.profiles?.full_name ?? nameMap.get(s.id) ?? null },
    ])
  );
  // من ليس بائعًا يأخذ صفًا اسميًا فقط
  for (const [id, full_name] of nameMap) {
    if (!sellerMap.has(id)) sellerMap.set(id, { id, full_name });
  }

  const richReports = (reports as any[]).map((r) => {
    const reporter = sellerMap.get(r.reporter_id);
    let target: any = null;
    let targetListingSellerId = null;
    if (r.target_type === "listing") {
      target = listMap.get(r.target_id);
      targetListingSellerId = target?.seller_id ?? null;
    } else if (r.target_type === "seller") {
      target = sellerMap.get(String(r.target_id));
    }
    const targetSeller =
      r.target_type === "seller"
        ? target
        : targetListingSellerId
        ? sellerMap.get(String(targetListingSellerId))
        : null;
    return {
      ...r,
      reporter,
      target,
      target_listing_seller_id: targetListingSellerId,
      targetSeller,
    };
  });

  return (
    <>
      <AdminHeader active="moderation" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold inline-flex items-center gap-2">
            🛡️ مركز التدقيق والإبلاغات
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            مراجعة تقارير المجتمع واتخاذ الإجراءات اللازمة على المحتوى.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Kpi label="⏳ في الانتظار" value={stats.pending ?? 0} cls="from-amber-500/15 to-amber-500/0 text-amber-700 dark:text-amber-300 border-amber-500/20" />
          <Kpi label="🔎 تحت الفحص" value={stats.reviewing ?? 0} cls="from-sky-500/15 to-sky-500/0 text-sky-700 dark:text-sky-300 border-sky-500/20" />
          <Kpi label="📥 اليوم" value={stats.today ?? 0} cls="from-emerald-500/15 to-emerald-500/0 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" />
          <Kpi label="📅 آخر 7 أيام" value={stats.week ?? 0} cls="from-indigo-500/15 to-indigo-500/0 text-indigo-700 dark:text-indigo-300 border-indigo-500/20" />
          <Kpi label="✅ مُحلّلة" value={stats.resolved ?? 0} cls="from-emerald-500/15 to-emerald-500/0 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" />
          <Kpi label="❌ مرفوضة" value={stats.rejected ?? 0} cls="from-rose-500/15 to-rose-500/0 text-rose-700 dark:text-rose-300 border-rose-500/20" />
        </div>

        <ModerationClient initialReports={JSON.parse(JSON.stringify(richReports))} />
      </main>
    </>
  );
}

function Kpi({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-2xl border p-4 bg-gradient-to-br ${cls}`}>
      <div className="text-[11px] font-medium mb-1">{label}</div>
      <div className="text-2xl font-extrabold leading-none">
        {Number(value).toLocaleString("ar-SA")}
      </div>
    </div>
  );
}
