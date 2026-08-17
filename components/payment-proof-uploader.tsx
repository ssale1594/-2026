"use client";

import { useRef, useState, useTransition } from "react";
import { uploadPaymentProof } from "@/lib/storage";
import { submitPaymentProof } from "@/app/deals/payment-actions";

const METHODS: { k: any; label: string; hint: string }[] = [
  { k: "bank_transfer", label: "🏦 تحويل بنكي", hint: "اسم البنك، رقم العملية، آخر 4 أرقام الحساب" },
  { k: "stc_pay", label: "💠 STC Pay / موبايل باي", hint: "رقم العملية في التطبيق" },
  { k: "cash_on_delivery", label: "💵 نقداً عند التسليم", hint: "إثبات استلام النقدية (مطلوب إذا كان غير جاهز في المكان)" },
  { k: "other", label: "📎 طريقة أخرى", hint: "اذكر الطريقة في الملاحظات + صورة إثبات" },
];

export default function PaymentProofUploader({
  dealId,
  priceAgreedSar,
  userId,
  role,
}: {
  dealId: number;
  priceAgreedSar: number | null;
  userId: string;
  role: "buyer" | "seller";
}) {
  const [file, setFile] = useState<File | null>(null);
  const [method, setMethod] = useState<typeof METHODS[number]["k"]>("bank_transfer");
  const [amount, setAmount] = useState<string>(priceAgreedSar ? String(priceAgreedSar) : "");
  const [ref, setRef] = useState("");
  const [bank, setBank] = useState("");
  const [dateIso, setDateIso] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [last4, setLast4] = useState("");
  const [notes, setNotes] = useState("");

  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [isPending, setTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!file) return setMsg({ err: "اختر صورة أو ملف PDF لإيصال الدفع." });
    const amtNum = Number(amount);
    if (!amtNum || amtNum <= 0) return setMsg({ err: "أدخل المبلغ المدفوع." });
    setMsg(null);

    setIsUploading(true);
    let uploaded: any = null;
    try {
      uploaded = await uploadPaymentProof(dealId, userId, file);
    } catch (e: any) {
      setIsUploading(false);
      return setMsg({ err: e?.message ?? "فشل رفع الملف." });
    }
    setIsUploading(false);

    setTransition(async () => {
      const res = await submitPaymentProof({
        dealId,
        storagePath: uploaded.path,
        proofMime: uploaded.mime,
        proofFilename: uploaded.filename,
        proofSizeBytes: uploaded.bytes,
        paymentMethod: method,
        amount: amtNum,
        referenceNumber: ref,
        bankName: bank,
        transferDateIso: dateIso,
        payerAccountLast4: last4,
        notes,
      });
      if ((res as any).error) {
        setMsg({ err: (res as any).error });
      } else {
        setMsg({ ok: "✅ تم رفع الإيصال وإبلاغ الطرف الآخر." });
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        setAmount(priceAgreedSar ? String(priceAgreedSar) : "");
        setRef("");
        setBank("");
        setLast4("");
        setNotes("");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 space-y-3">
      <h3 className="font-bold inline-flex items-center gap-2">
        💾 أرفع {role === "buyer" ? "إيصال دفعي" : "إثبات تسديد / إيصال"} للصفقة
      </h3>
      <p className="text-xs opacity-70 -mt-2">
        بعد الرفع يظهر الإيصال للطرف الآخر مع أرقام التحويل، ويمكن الإدارة التحقق منه
        لاحقاً. تقبل الصور (JPG/PNG/WebP) أو PDF - والصور تُضغَط تلقائياً حسب سياسة TECH.md.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="md:col-span-2">
          <span className="block text-xs opacity-70 mb-1">طريقة الدفع</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {METHODS.map((m) => (
              <button
                type="button"
                key={m.k}
                onClick={() => setMethod(m.k)}
                className={[
                  "text-left rounded-xl border p-2.5 text-sm transition",
                  method === m.k
                    ? "border-emerald-500 bg-emerald-500/15 shadow-inner"
                    : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5",
                ].join(" ")}
              >
                <div className="font-bold">{m.label}</div>
                <div className="text-[10px] opacity-60 leading-tight mt-0.5">{m.hint}</div>
              </button>
            ))}
          </div>
        </label>

        <label>
          <span className="block text-xs opacity-70 mb-1">المبلغ المدفوع (ر.س)</span>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 bg-white dark:bg-neutral-900"
          />
        </label>

        <label>
          <span className="block text-xs opacity-70 mb-1">المرجع / رقم العملية</span>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value.slice(0, 120))}
            placeholder="مثال: TFR20250117A0148"
            className="w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 bg-white dark:bg-neutral-900 text-sm"
          />
        </label>

        <label>
          <span className="block text-xs opacity-70 mb-1">
            {method === "bank_transfer" ? "اسم البنك" : "الجهة (اختياري)"}
          </span>
          <input
            value={bank}
            onChange={(e) => setBank(e.target.value.slice(0, 120))}
            placeholder="مثال: الراجحي، البنك الأول، الإنماء..."
            className="w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 bg-white dark:bg-neutral-900 text-sm"
          />
        </label>

        <label>
          <span className="block text-xs opacity-70 mb-1">تاريخ التحويل / الدفع</span>
          <input
            type="date"
            value={dateIso}
            onChange={(e) => setDateIso(e.target.value)}
            className="w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 bg-white dark:bg-neutral-900 text-sm"
          />
        </label>

        <label>
          <span className="block text-xs opacity-70 mb-1">آخر 4 أرقام لحساب المرسل (اختياري)</span>
          <input
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            placeholder="مثال: 1234"
            className="w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 bg-white dark:bg-neutral-900 text-sm"
          />
        </label>

        <label className="md:col-span-2">
          <span className="block text-xs opacity-70 mb-1">ملاحظات (اختياري)</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            placeholder="مثال: حولت المبلغ من حساب زوجي، أنا مالك الصفقة. رقم التواصل 05xxxxxxxx للاستفسار."
            className="w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 bg-white dark:bg-neutral-900 text-sm"
          />
          <div className="text-[10px] opacity-50 mt-0.5">{notes.length} / 500</div>
        </label>

        <label className="md:col-span-2">
          <span className="block text-xs opacity-70 mb-1">صورة الإيصال / ملف PDF</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/5 px-4 py-2 text-sm hover:bg-emerald-500/10 cursor-pointer">
              📎 {file ? "ابدل الملف" : "اختر ملفًا"}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setMsg(null);
                }}
                className="hidden"
              />
            </label>
            {file && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs">
                {/\.(jpe?g|png|webp)$/i.test(file.name) || file.type.startsWith("image/") ? "🖼️" : "📄"}{" "}
                <b>{file.name}</b> · {(file.size / 1024 / 1024).toFixed(2)} ميجابايت
              </div>
            )}
          </div>
        </label>
      </div>

      {msg && (
        <div
          className={[
            "rounded-xl px-3 py-2 text-sm border",
            msg.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200",
          ].join(" ")}
        >
          {msg.ok ?? msg.err}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={() => {
            setFile(null);
            if (fileRef.current) fileRef.current.value = "";
          }}
          className="rounded-lg px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
        >
          مسح النموذج
        </button>
        <button
          onClick={submit}
          disabled={isUploading || isPending || !file}
          className={[
            "rounded-lg px-5 py-2 text-sm font-bold shadow",
            isUploading || isPending || !file
              ? "bg-black/10 dark:bg-white/10 opacity-50 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 text-white",
          ].join(" ")}
        >
          {isUploading ? "جارٍ رفع الملف..." : isPending ? "جارٍ الحفظ..." : "📤 إرسال الإيصال للطرف الآخر"}
        </button>
      </div>
    </div>
  );
}
