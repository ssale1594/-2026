import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { assertCronAuthorized, cronErrorResponse } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email/provider";
import { renderNewsletterEmail } from "@/lib/email/templates";
import { siteName, siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Weekly "وش الجديد بالزلفي" digest — the periodic half of ROADMAP phase 2's
// newsletter idea. /whats-new (the page) only reaches someone who thinks to
// visit it; this reaches an inbox instead.
async function run(request: Request) {
  assertCronAuthorized(request);

  const supabase = createServiceRoleClient();

  const [listingsQ, recipientsQ] = await Promise.all([
    supabase.rpc("newsletter_weekly_listings", { p_limit: 12 }),
    supabase.rpc("newsletter_active_recipients"),
  ]);

  if (listingsQ.error) throw new Error(listingsQ.error.message);
  if (recipientsQ.error) throw new Error(recipientsQ.error.message);

  const listings = (listingsQ.data ?? []) as {
    title: string;
    slug: string;
    price: number | null;
    price_negotiable: boolean;
    category_name: string | null;
    seller_name: string | null;
  }[];

  const recipients = (recipientsQ.data ?? []) as {
    email: string;
    unsubscribe_token: string;
  }[];

  // No point mailing an empty digest — a subscriber who gets "nothing new"
  // every week for a while is a subscriber who unsubscribes.
  if (listings.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no new listings this week" });
  }

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const { html, subject } = renderNewsletterEmail({
      siteName,
      siteUrl,
      year: new Date().getFullYear(),
      unsubscribeUrl: `${siteUrl}/newsletter/unsubscribe?token=${recipient.unsubscribe_token}`,
      listings: listings.map((l) => ({
        title: l.title,
        slug: l.slug,
        price: l.price,
        priceNegotiable: l.price_negotiable,
        categoryName: l.category_name,
        sellerName: l.seller_name,
      })),
    });

    const result = await sendEmail({ to: recipient.email, subject, html });
    if (result.success) sent++;
    else failed++;
  }

  return NextResponse.json({
    ok: true,
    listingsIncluded: listings.length,
    recipients: recipients.length,
    sent,
    failed,
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
