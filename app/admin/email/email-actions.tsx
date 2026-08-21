"use client";

import { useState, useTransition } from "react";
import { runEmailWorker, sendTestEmail, type WorkerStats } from "@/lib/email/worker";

export default function EmailAdminActions() {
  const [isRunning, startRun] = useTransition();
  const [result, setResult] = useState<WorkerStats | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);

  const [testEmail, setTestEmail] = useState("");
  const [isTesting, startTest] = useTransition();
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);

  function runWorker() {
    setRunErr(null);
    setResult(null);
    startRun(async () => {
      try {
        const r = await runEmailWorker();
        setResult(r);
      } catch (e: any) {
        setRunErr(e?.message || String(e));
      }
    });
  }

  function doTest() {
    if (!testEmail.trim() || !/^\S+@\S+\.\S+$/.test(testEmail)) return;
    setTestResult(null);
    startTest(async () => {
      const r = await sendTestEmail(testEmail.trim());
      setTestResult(r);
    });
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Worker runner */}
      <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-5">
        <h3 className="font-semibold mb-1">⚡ تشغيل وحدة الإرسال يدويًا</h3>
        <p className="text-sm text-black/60 dark:text-white/60 mb-3">
          يعالج الإشعارات الفورية المعلقة + ملخصات اليوم للمستخدمين.
        </p>
        <button
          onClick={runWorker}
          disabled={isRunning}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isRunning ? "جاري التشغيل..." : "▶️ شغّل الآن"}
        </button>

        {result && (
          <div className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm">
            <div className="font-semibold mb-1 text-emerald-800 dark:text-emerald-200">✅ اكتمل التشغيل</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-black/70 dark:text-white/70">
              <span>فوري معالج: {result.instant.processed}</span>
              <span>فوري أُرسل: {result.instant.sent}</span>
              <span>فوري فاشل: {result.instant.failed}</span>
              <span>فوري متخطى: {result.instant.skipped}</span>
              <span>ملخص معالج: {result.digest.processed}</span>
              <span>ملخص أُرسل: {result.digest.sent}</span>
              <span>ملخص فاشل: {result.digest.failed}</span>
            </div>
          </div>
        )}
        {runErr && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
            ❌ {runErr}
          </div>
        )}
      </div>

      {/* Test email */}
      <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-5">
        <h3 className="font-semibold mb-1">🧪 إرسال بريد تجريبي</h3>
        <p className="text-sm text-black/60 dark:text-white/60 mb-3">
          للتأكد من عمل المزود بشكل صحيح قبل الاعتماد عليه.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            placeholder="your@email.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 text-sm bg-transparent"
          />
          <button
            onClick={doTest}
            disabled={isTesting || !testEmail}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {isTesting ? "جاري الإرسال..." : "📨 ارسل اختبار"}
          </button>
        </div>
        {testResult && (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              testResult.ok
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200"
                : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
            }`}
          >
            {testResult.ok ? "✅ " : "❌ "}
            {testResult.message || (testResult.ok ? "تم الإرسال بنجاح" : "فشل الإرسال")}
          </div>
        )}
      </div>
    </div>
  );
}
