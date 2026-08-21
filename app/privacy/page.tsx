import Link from "next/link";
import type { Metadata } from "next";
import { pageTitle, siteName } from "@/lib/seo";

export const metadata: Metadata = {
  title: pageTitle("سياسة الخصوصية"),
};

export default function PrivacyPage() {
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
          سياسة الخصوصية
        </h1>

        <p>
          {siteName} دليل محلي يربط سكان الزلفي بالمحلات والأسر المنتجة ومزودي
          الخدمات — المنصة وسيط عرض فقط، ولا تتدخل بالمعاملة النهائية بين
          المشتري والبائع، ولا تعالج مدفوعات المستخدمين النهائيين مباشرة.
        </p>

        <div>
          <h2 className="font-semibold text-black dark:text-white mb-2">
            وش نجمع من بيانات؟
          </h2>
          <ul className="list-disc pr-5 flex flex-col gap-1">
            <li>
              <strong>الزوار (بدون تسجيل دخول):</strong> ما نجمع أي بيانات
              شخصية. التصفح والبحث والتواصل عبر واتساب مفتوح بالكامل بدون
              حساب.
            </li>
            <li>
              <strong>البائعون (بعد تسجيل الدخول):</strong> البريد الإلكتروني
              (لتسجيل الدخول عبر رابط بريدي بدون كلمة مرور)، اسم النشاط، رقم
              واتساب، ووصف مختصر — تُعرض هذي البيانات علنًا بصفحة البائع بعد
              اعتمادها من الإدارة.
            </li>
            <li>
              <strong>إحصائيات استخدام مجهولة:</strong> عدد مرات مشاهدة
              الإعلان وعدد نقرات زر التواصل، بدون ربطها بهوية الزائر (تُحفظ
              كعدّاد فقط لمنع التلاعب اليومي، مو كسجل تتبع شخصي).
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-black dark:text-white mb-2">
            كيف نستخدم البيانات؟
          </h2>
          <p>
            فقط لتشغيل المنصة: عرض الإعلانات، تسجيل دخول البائعين، ومراجعة
            الحسابات والإعلانات الجديدة قبل نشرها. ما نبيع ولا نشارك بيانات
            المستخدمين مع أي جهة خارجية لأغراض تسويقية.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black dark:text-white mb-2">
            التواصل بين المشتري والبائع
          </h2>
          <p>
            زر التواصل يفتح محادثة واتساب مباشرة بين المشتري والبائع خارج
            المنصة — {siteName} ما يشوف ولا يحفظ محتوى تلك المحادثات.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black dark:text-white mb-2">
            تواصل معنا
          </h2>
          <p>
            لأي استفسار عن الخصوصية أو طلب حذف بياناتك، تواصل معنا عبر
            البريد الإلكتروني المسجّل بحسابك أو عبر لوحة الإدارة.
          </p>
        </div>
      </main>
    </div>
  );
}
