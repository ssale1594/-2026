// Shared guard for the scheduled routes under /api/cron/*.
//
// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
// set on the project. We also accept `?token=` so the same endpoint can be
// triggered manually (curl, an external scheduler) while testing.
//
// Refusing to run when the secret is missing is deliberate: an unauthenticated
// endpoint that mutates listings and sends email is worse than one that doesn't
// run at all, and a silently-open route is exactly the kind of thing nobody
// notices until it is abused.
export function assertCronAuthorized(request: Request): void {
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error("CRON_SECRET غير مضبوط (32 حرفًا على الأقل) — المهمة موقوفة.");
  }

  const header =
    request.headers.get("Authorization") ?? request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const queryToken = new URL(request.url).searchParams.get("token");

  if (bearer !== secret && queryToken !== secret) {
    throw new Error("Unauthorized");
  }
}

export function cronErrorResponse(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  const status = message === "Unauthorized" ? 401 : 500;

  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
