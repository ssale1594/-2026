import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { assertCronAuthorized, cronErrorResponse } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TECH.md §5/§6: when a subscription lapses we do NOT delete or hide at random.
// The first `free_listing_limit` listings stay published; anything beyond that
// is paused with a message telling the seller how to bring it back. Until this
// route existed, that decision was documented but never implemented — a lapsed
// subscription simply kept every listing published for free, forever.
async function run(request: Request) {
  assertCronAuthorized(request);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("expire_due_subscriptions");

  if (error) {
    throw new Error(error.message);
  }

  const affected = (data ?? []) as { seller_id: string; paused_count: number }[];

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    sellersAffected: affected.length,
    listingsPaused: affected.reduce((sum, row) => sum + row.paused_count, 0),
  });
}

export async function GET(request: Request) {
  try {
    return await run(request);
  } catch (err) {
    return cronErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    return await run(request);
  } catch (err) {
    return cronErrorResponse(err);
  }
}
