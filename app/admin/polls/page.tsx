import Link from "next/link";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";
import AdminPollsClient from "./admin-polls-client";

export default async function AdminPollsPage() {
  await requireAdmin();
  const supabase = await createClient();

  // all polls + options
  const pollsQ = await supabase
    .from("polls")
    .select("id, title, description, status, week_start_date, week_end_date, winner_seller_id, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const polls = pollsQ.data ?? [];

  const pollIds = polls.map((p: any) => p.id);
  const optsQ = pollIds.length > 0
    ? await supabase
        .from("poll_options")
        .select("id, poll_id, seller_id, sort_order")
        .in("poll_id", pollIds as any)
        .order("sort_order", { ascending: true })
    : Promise.resolve({ data: [] } as any);
  const opts = (await optsQ).data ?? [];

  const votesQ = pollIds.length > 0
    ? await supabase
        .from("poll_votes")
        .select("option_id, poll_id")
        .in("poll_id", pollIds as any)
    : Promise.resolve({ data: [] } as any);
  const votes = (await votesQ).data ?? [];

  // Profiles for winners + all sellers in options
  const winners = polls.map((p: any) => p.winner_seller_id).filter(Boolean);
  const sellerIdsSet = new Set<string>();
  (opts as any[]).forEach((o) => o.seller_id && sellerIdsSet.add(o.seller_id));
  winners.forEach((w: any) => w && sellerIdsSet.add(w));
  const sellerIds = Array.from(sellerIdsSet);
  const profsQ = sellerIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, business_name, full_name, slug, trust_level, verification_status, vouch_count, average_rating, active_listings_count")
        .in("id", sellerIds as any)
    : Promise.resolve({ data: [] } as any);
  const profiles = (await profsQ).data ?? [];
  const profMap = new Map((profiles as any[]).map((p) => [p.id, p]));

  // All approved sellers (for adding options / creating new poll)
  const allSellersQ = await supabase
    .from("profiles")
    .select("id, business_name, full_name, slug, verification_status, trust_level, role")
    .in("verification_status", ["approved"])
    .order("business_name", { ascending: true })
    .limit(200);
  const allSellers = (allSellersQ.data ?? []).map((s: any) => ({
    ...s,
    display: s.business_name || s.full_name || s.id,
  }));

  const grouped = polls.map((p: any) => {
    const pollOptions = (opts as any[]).filter((o) => o.poll_id === p.id);
    const optionIds = pollOptions.map((o) => o.id);
    const optVotes = new Map<number, number>();
    optionIds.forEach((oid) => optVotes.set(oid, 0));
    (votes as any[]).forEach((v: any) => {
      if (v.poll_id === p.id) {
        optVotes.set(v.option_id, (optVotes.get(v.option_id) ?? 0) + 1);
      }
    });
    const total = optionIds.reduce((s, oid) => s + (optVotes.get(oid) ?? 0), 0);
    return {
      ...p,
      options: pollOptions.map((o) => ({
        ...o,
        seller: profMap.get(o.seller_id) ?? null,
        votes: optVotes.get(o.id) ?? 0,
        percent: total > 0 ? ((optVotes.get(o.id) ?? 0) / total) * 100 : 0,
      })),
      total_votes: total,
      winner_prof: p.winner_seller_id ? profMap.get(p.winner_seller_id) : null,
    };
  });

  const generatedAt = new Date().toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <AdminHeader active="polls" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold inline-flex items-center gap-2">
              🗳️ إدارة الاستفتاءات الأسبوعية
            </h1>
            <p className="text-sm text-black/60 dark:text-white/60 mt-1">
              إنشاء استفتاء، إضافة الباعة، فتح/إغلاق التصويت، وإعلان الفائز مع شارة الفوز. آخر تحديث {generatedAt}
            </p>
          </div>
          <Link
            href="/polls"
            target="_blank"
            className="text-sm rounded-lg border border-black/[.12] dark:border-white/[.2] px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            ↗ عرض الصفحة العامة للاستفتاءات
          </Link>
        </div>

        <AdminPollsClient
          polls={JSON.parse(JSON.stringify(grouped))}
          allSellers={JSON.parse(JSON.stringify(allSellers))}
        />
      </main>
    </>
  );
}
