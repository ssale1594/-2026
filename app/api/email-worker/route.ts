import { NextResponse } from "next/server";
import { runEmailWorkerCron } from "@/lib/email/worker";
import { assertCronAuthorized, cronErrorResponse } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Scheduled from vercel.json. Vercel Cron authenticates with
// `Authorization: Bearer $CRON_SECRET`, which is what assertCronAuthorized
// checks — the route used to compare against EMAIL_WORKER_TOKEN instead, so a
// real cron call would have been rejected as unauthorized had one ever been
// scheduled.
//
// ⚠️ Vercel's Hobby plan runs cron jobs once per day at most, so notification
// emails currently go out as one daily batch. Change this entry to
// "*/15 * * * *" in vercel.json after upgrading to Pro (which TECH.md §9
// already flags as required at commercial launch).
async function run(request: Request) {
  assertCronAuthorized(request);
  const stats = await runEmailWorkerCron();
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), stats });
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
