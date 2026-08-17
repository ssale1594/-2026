import { NextResponse } from "next/server";
import { runEmailWorkerCron } from "@/lib/email/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  try {
    const stats = await runEmailWorkerCron(bearer);
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: err?.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

export async function GET(req: Request) {
  // Vercel Cron may call with GET too, allow with query token as fallback
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  try {
    const stats = await runEmailWorkerCron(token);
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: err?.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}
