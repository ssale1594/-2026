import Link from "next/link";
import type { Metadata } from "next";
import { pageTitle, siteName } from "@/lib/seo";

export const metadata: Metadata = {
  title: pageTitle("سياسة الاسترجاع والاستبدال"),
};

export default function RefundPolicyPage() {
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
          سياسة الاسترجاع والاستبدال
        </h1>

        <div>
          <h2 className="font-semibold text-black dark:text-white mb-2">
            منتجات وخدمات البائعين
          </h2>
          <p>
            {siteName} وسيط عرض فقط — كل عملية بيع تتم مباشرة بين المشتري
            والبائع عبر واتساب خارج المنصة، وسياسة الاسترجاع أو الاستبدال أو
            الضمان لأي منتج أو خدمة تخضع لاتفاق الطرفين مباشرة، وليست تحت
            إدارة المنصة أو مسؤوليتها.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black dark:text-white mb-2">
            اشتراكات البائعين
          </h2>
          <p>
            الاشتراكات المدفوعة (رسوم فتح إعلانات إضافية) رسوم خدمة رقمية —
            إذا واجهت مشكلة بالدفع أو بالخدمة نفسها، تواصل معنا وبنراجع
            حالتك.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black dark:text-white mb-2">
            التواصل بخصوص شكوى
          </h2>
          <p>
            لأي شكوى عن بائع أو إعلان مخالف، تواصل معنا عبر لوحة الإدارة أو
            البريد المسجّل بحسابك وبنراجع الموضوع.
          </p>
        </div>
      </main>
    </div>
  );
}
