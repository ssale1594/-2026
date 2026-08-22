import QRCode from "qrcode";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName, siteUrl } from "@/lib/seo";
import DashboardHeader from "@/app/dashboard/dashboard-header";
import PrintButton from "@/components/print-button";

export const metadata = { title: pageTitle("ملصق QR للمحل") };

// ROADMAP المرحلة 2 §7 — تكررت بـ4 مصادر مستقلة. الفكرة: البائع يطبع ملصقًا
// ويعلّقه على واجهة محله، والزبون يصوّره فيوصل مباشرة لصفحته.
//
// الـQR يُولَّد على السيرفر كـSVG (data URI) بدل مكتبة بالمتصفح: الصفحة تبقى
// Server Component، وما نحمّل جافاسكربت إضافي على الزائر، والـSVG يطبع بجودة
// كاملة مهما كان حجم الورقة — بعكس PNG اللي يتبكسل بالطباعة.
async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
}

export default async function QrPosterPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  // ?src=qr يفرّق زيارات الملصق عن بقية الزيارات — بدونه ما فيه طريقة نعرف
  // فيها هل الملصق يجيب أحدًا فعلاً، والفكرة كلها تصير مجرد إحساس.
  const profileUrl = `${siteUrl}/seller/${seller.slug}?src=qr`;
  const svg = await qrSvg(profileUrl);

  const { data: clicks } = await supabase.rpc("seller_contact_summary", {
    p_days: 90,
  });
  const qrVisits =
    ((clicks ?? []) as { channel: string; clicks: number }[]).find(
      (row) => row.channel === "qr"
    )?.clicks ?? 0;

  return (
    <div className="min-h-screen font-sans">
      <div className="print:hidden">
        <DashboardHeader
          sellerName={seller.business_name}
          title="🏷️ ملصق QR للمحل"
          subtitle="اطبعه وعلّقه على الواجهة — الزبون يصوّره ويوصل لصفحتك مباشرة."
          breadcrumb={[
            { label: "الرئيسية", href: "/" },
            { label: "لوحة البائع", href: "/dashboard" },
            { label: "ملصق QR" },
          ]}
        />
      </div>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-black/60 dark:text-white/60">
            {qrVisits > 0
              ? `وصلك ${qrVisits} زائر من الملصق آخر 90 يوم.`
              : "ما وصل أحد من الملصق بعد — اطبعه وعلّقه بمكان واضح."}
          </p>
          <PrintButton className="rounded-lg bg-foreground text-background text-sm font-medium px-5 py-2.5">
            🖨️ اطبع الملصق
          </PrintButton>
        </div>

        {/* الملصق نفسه — أبيض دائمًا وبإطار، عشان يطلع صح بالطباعة بغض النظر
            عن وضع الليل بالمتصفح. */}
        <div className="rounded-2xl border-2 border-black bg-white text-black p-8 text-center print:border-black print:rounded-none">
          <p className="text-sm font-semibold tracking-wide">{siteName}</p>

          <h2 className="text-3xl font-extrabold mt-4 leading-tight">
            {seller.business_name}
          </h2>

          <p className="text-base mt-2 text-black/70">
            صوّر الرمز وشوف كل منتجاتنا وتواصل معنا مباشرة
          </p>

          <div
            className="mx-auto my-7 w-[240px] h-[240px] [&>svg]:w-full [&>svg]:h-full"
            // qrcode's SVG output is generated from a URL we build ourselves —
            // no user-supplied markup reaches this.
            dangerouslySetInnerHTML={{ __html: svg }}
          />

          <p className="text-sm font-mono text-black/60 break-all" dir="ltr">
            {siteUrl.replace(/^https?:\/\//, "")}/seller/{seller.slug}
          </p>

          <p className="text-xs text-black/50 mt-6">
            وجّه كاميرا جوالك على الرمز — ما يحتاج تطبيق
          </p>
        </div>

        <div className="print:hidden mt-6 rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 text-sm text-black/70 dark:text-white/70 space-y-2">
          <p className="font-semibold">وين تحطه؟</p>
          <ul className="list-disc pr-5 space-y-1">
            <li>على باب المحل أو الواجهة الزجاجية من الداخل</li>
            <li>عند الكاشير أو مكان الدفع</li>
            <li>على أكياس الطلبات أو الفواتير</li>
            <li>بلوحة إعلانات الحي أو المسجد (بعد أخذ الإذن)</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
