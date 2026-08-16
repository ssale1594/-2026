import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const referralCode = searchParams.get("ref");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // A referred seller goes straight to setup with the code prefilled; without
  // this the code would be dropped on the /dashboard → /dashboard/setup bounce.
  if (referralCode) {
    return NextResponse.redirect(
      `${origin}/dashboard/setup?ref=${encodeURIComponent(referralCode)}`
    );
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
