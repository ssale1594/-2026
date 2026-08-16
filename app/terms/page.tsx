import Link from "next/link";
import type { Metadata } from "next";
import { pageTitle, siteName } from "@/lib/seo";

export const metadata: Metadata = {
  title: pageTitle("الشروط والأحكام"),
};

export default function TermsPage() {
  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 flex flex-col gap-6 text-sm leading-7 text-black/80 dark:text-white/80">
        <h1 className="text-xl font-semibold text-black dark:text-white">
          الشروط والأحكام
        </h1>

        <div>
          <h2 className="font-semibold text-black dark:text-white mb-2">
            طبيعة المنصة
          </h2>
          <p>
            {siteName} دليل محلي إلكتروني يعرض إعلانات المحلات والأسر المنتجة
            ومزودي الخدمات والعقار والسوق المستعمل بمدينة الزلفي. المنصة
            <strong> وسيط عرض فقط</strong> — ما تبيع ولا تشتري بنفسها، وما
            تضمن جودة المنتجات أو الخدمات أو دقة الأسعار المعروضة، والمسؤولية
            الكاملة عن التعامل التجاري تقع على البائع والمشتري مباشرة.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black dark:text-white mb-2">
            حسابات البائعين
          </h2>
          <ul className="list-disc pr-5 flex flex-col gap-1">
            <li>كل حساب بائع جديد وكل إعلان يخضع لمراجعة يدوية قبل النشر.</li>
            <li>
              يحق للإدارة رفض أو إيقاف أي حساب أو إعلان مخالف (معلومات كاذبة،
              محتوى مخالف للأنظمة، أو سلوك مسيء) بدون إشعار مسبق.
            </li>
            <li>
              البائع مسؤول عن دقة المعلومات اللي ينشرها (الأسعار، الوصف، حالة
              التوفر).
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-black dark:text-white mb-2">
            الاشتراكات المدفوعة
          </h2>
          <p>
            بعض المزايا (تجاوز الحد المجاني للإعلانات) تتطلب اشتراك مدفوع عبر
            بوابة دفع خارجية معتمدة. تفاصيل الأسعار والباقات تظهر بوضوح قبل
            أي عملية دفع.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black dark:text-white mb-2">
            التعديلات على الشروط
          </h2>
          <p>
            يحق لنا تحديث هذي الشروط من وقت لآخر، وأي استخدام مستمر للمنصة
            بعد التحديث يُعتبر موافقة على النسخة الجديدة.
          </p>
        </div>
      </main>
    </div>
  );
}
