import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS entirely. Only ever import this from code
// that authenticates by something *other* than a user session — a webhook
// signature, or a cron secret. Never from a page, a component, or a Server
// Action reachable by a logged-in user.
//
// Everything else in this app must keep using lib/supabase/server.ts, which is
// scoped to the caller's session and therefore governed by RLS.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Failing loudly beats a client that silently behaves like `anon`: the email
  // worker did exactly that (it imported the session client by mistake) and
  // just reported "0 sent" forever instead of erroring.
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL غير مضبوطين — لا يمكن تشغيل مهمة الخلفية."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
