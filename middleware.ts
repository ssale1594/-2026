import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on every request.
// NOTE (TECH.md §11 / Kimi's CVE-2025-29927 warning): this middleware is a
// convenience layer only, not a security boundary. Every protected route
// and Server Action must re-check auth/role itself.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

// Narrowed to the sections that actually need a refreshed session cookie —
// public browsing (/, /category, /listing, /seller, /search, sitemap.xml,
// robots.txt) is most of this app's traffic and doesn't touch auth state, so
// it no longer pays a Supabase Auth network round trip per request.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/my/:path*",
    "/notifications",
    "/ask/:path*",
    "/seller/:path*",
    "/login",
    "/auth/:path*",
  ],
};
