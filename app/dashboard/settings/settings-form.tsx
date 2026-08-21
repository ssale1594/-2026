"use client";

import { useState, useTransition } from "react";
import { saveNotificationPrefs, type NotificationPrefs } from "./actions";

type Props = {
  initialPrefs: NotificationPrefs;
  email: string | undefined;
};

const TYPE_ITEMS: { key: keyof NotificationPrefs; label: string; desc?: string; group: string }[] = [
  { key: "notify_email_listing_published", group: "إعلاناتي", label: "تم نشر إعلانك", desc: "إشعار عندما يوافق الأدمن على إعلان جديد" },
  { key: "notify_email_listing_rejected", group: "إعلاناتي", label: "إعلانك محتاج تعديل", desc: "إشعار عندما يطلب الأدمن تعديلًا على إعلان" },
  { key: "notify_email_offer_published", group: "إعلاناتي", label: "تم نشر عرضك اليومي", desc: "عندما يوافق الأدمن على عرض تجاري جديد" },
  { key: "notify_email_offer_rejected", group: "إعلاناتي", label: "عرضك محتاج تعديل" },
  { key: "notify_email_seller_approved", group: "حسابك", label: "تم اعتماد حسابك كبائع", desc: "عندما يوافق الأدمن على حسابك لأول مرة" },
  { key: "notify_email_seller_rejected", group: "حسابك", label: "حسابك قيد المراجعة", desc: "عندما يطلب الأدمن معلومات إضافية" },
  { key: "notify_email_transaction_claimed", group: "العملاء", label: "عميل يقول إنه تعامل معك", desc: "اطلب منك تأكيد الصفقة عشان يقدر يقيّمك" },
  { key: "notify_email_review_received", group: "العملاء", label: "وصلك تقييم جديد من عميل" },
  { key: "notify_email_vouch_received", group: "العملاء", label: "أحد الجيران وصّى فيك" },
  { key: "notify_email_answer_received", group: "المجتمع", label: "وصلك رد على سؤالك في المنتدى" },
  { key: "notify_email_need_response", group: "الطلبات", label: "بائع رد على طلبك في زر أحتاج" },
];

export default function SettingsForm({ initialPrefs, email }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  function toggle<K extends keyof NotificationPrefs>(key: K) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  function save() {
    setStatus("idle");
    startTransition(async () => {
      try {
        await saveNotificationPrefs(prefs);
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2500);
      } catch {
        setStatus("error");
      }
    });
  }

  const groups = Array.from(new Set(TYPE_ITEMS.map((i) => i.group)));

  const globalDisabled = !prefs.email_notifications_enabled;

  return (
    <form action={save} className="space-y-6">
      {/* Global switches */}
      <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] divide-y divide-black/[.08] dark:divide-white/[.145] overflow-hidden">
        <SwitchRow
          label="تفعيل الإشعارات بالبريد الإلكتروني"
          description={email ? `سيتم الإرسال إلى: ${email}` : "يجب أن يكون بريدك مسجلًا"}
          checked={prefs.email_notifications_enabled}
          onChange={() => toggle("email_notifications_enabled")}
        />
        <SwitchRow
          label="إرسال الملخص اليومي (Digest)"
          description="يرسل بريدًا واحدًا كل صباح يجمع كل الإشعارات، بدل إرسالها فورًا واحدة تلو الأخرى"
          checked={prefs.email_digest_enabled}
          onChange={() => toggle("email_digest_enabled")}
          disabled={!prefs.email_notifications_enabled}
        />
      </div>

      {/* Per-type switches grouped */}
      {groups.map((group) => (
        <div key={group}>
          <h3 className="text-sm font-semibold mb-2 text-black/70 dark:text-white/70">{group}</h3>
          <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] divide-y divide-black/[.08] dark:divide-white/[.145] overflow-hidden">
            {TYPE_ITEMS.filter((i) => i.group === group).map((item) => (
              <SwitchRow
                key={item.key}
                label={item.label}
                description={item.desc}
                checked={prefs[item.key]}
                onChange={() => toggle(item.key)}
                disabled={globalDisabled}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition"
        >
          {isPending ? "جاري الحفظ..." : "💾 حفظ التغييرات"}
        </button>
        {status === "saved" && (
          <span className="text-sm text-emerald-600">✅ تم الحفظ بنجاح</span>
        )}
        {status === "error" && (
          <span className="text-sm text-red-600">❌ فشل الحفظ، أعد المحاولة</span>
        )}
      </div>
    </form>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-4 p-4 transition-colors ${
        disabled ? "opacity-50 bg-black/[.01] dark:bg-white/[.02]" : "cursor-pointer hover:bg-black/[.02] dark:hover:bg-white/[.03]"
      }`}
    >
      <div className="flex-1">
        <div className={`text-sm font-medium ${checked ? "" : "text-black/80 dark:text-white/80"}`}>
          {label}
        </div>
        {description && (
          <div className="text-xs text-black/50 dark:text-white/50 mt-0.5">{description}</div>
        )}
      </div>
      <div className="relative pt-0.5">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
        />
        <div
          className={`w-11 h-6 rounded-full transition-colors ${
            checked
              ? "bg-sky-600"
              : "bg-black/20 dark:bg-white/20 peer-disabled:bg-black/10 dark:peer-disabled:bg-white/10"
          } ${disabled ? "opacity-60" : ""}`}
        />
        <div
          className={`absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "-translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </label>
  );
}
