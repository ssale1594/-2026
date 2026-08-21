"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  adminCreatePoll,
  adminSetPollStatus,
  adminAddOption,
  adminRemoveOption,
} from "@/app/polls/polls-actions";

type Seller = {
  id: string;
  business_name?: string | null;
  full_name?: string | null;
  slug?: string | null;
  verification_status?: string;
  trust_level?: number | null;
  role?: string;
  display?: string;
  vouch_count?: number;
  average_rating?: number | null;
  active_listings_count?: number | null;
};

type Opt = {
  id: number;
  poll_id: number;
  seller_id: string;
  sort_order: number;
  votes: number;
  percent: number;
  seller: Seller | null;
};

type Poll = {
  id: number;
  title: string;
  description?: string | null;
  status: "draft" | "active" | "closed";
  week_start_date: string;
  week_end_date: string;
  winner_seller_id: string | null;
  winner_prof?: Seller | null;
  created_at: string;
  updated_at: string;
  options: Opt[];
  total_votes: number;
};

export default function AdminPollsClient({
  polls,
  allSellers,
}: {
  polls: Poll[];
  allSellers: Seller[];
}) {
  const [list, setList] = useState<Poll[]>(polls);
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [tr, setTr] = useTransition();

  // --- New poll form state ---
  const [newTitle, setNewTitle] = useState("من هو أفضل بائع في الزلفي هذا الأسبوع؟");
  const [newDesc, setNewDesc] = useState(
    "صوّت لبائعك المفضل الذي زوّنك بالمنتج والخدمة الممتازة هذا الأسبوع. نتائج الاستفتاء تظهر صباح يوم السبت مع منح الفائز شارة الفوز في ملفه الشخصي."
  );
  const [newSellers, setNewSellers] = useState<string[]>([]);
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [searchSeller, setSearchSeller] = useState("");

  const filtered = allSellers.filter(
    (s) =>
      s.display &&
      s.display.toLowerCase().includes(searchSeller.toLowerCase()) &&
      !newSellers.includes(s.id)
  );

  function flashErr(err: string) {
    setMsg({ err });
    setTimeout(() => setMsg(null), 4000);
  }
  function flashOk(ok: string) {
    setMsg({ ok });
    setTimeout(() => setMsg(null), 4000);
  }

  function createPoll() {
    setTr(async () => {
      setMsg(null);
      if (newSellers.length < 2) return flashErr("أضف على الأقل بائعين للاستفتاء");
      const res = await adminCreatePoll(newTitle, newDesc, newSellers, weekStart, weekEnd);
      if ((res as any).error) return flashErr((res as any).error);
      flashOk("تم إنشاء الاستفتاء! اضغط فتح للبدء بالتصويت");
      setNewSellers([]);
      setSearchSeller("");
      // refresh by reloading for simplicity
      setTimeout(() => window.location.reload(), 700);
    });
  }

  function setStatus(id: number, status: Poll["status"]) {
    setTr(async () => {
      const res = await adminSetPollStatus(id, status);
      if ((res as any).error) return flashErr((res as any).error);
      flashOk(
        status === "closed"
          ? "تم إغلاق الاستفتاء، تحديد الفائز، ومنح شارة الفوز له!"
          : status === "active"
          ? "تم فتح الاستفتاء للتصويت"
          : "تم تحويل الاستفتاء إلى مسودة"
      );
      // update locally
      setList((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status } : p))
      );
    });
  }

  function addOption(pollId: number, sellerId: string) {
    setTr(async () => {
      const res = await adminAddOption(pollId, sellerId);
      if ((res as any).error) return flashErr((res as any).error);
      flashOk("تمت إضافة البائع كخيار للاستفتاء");
      setTimeout(() => window.location.reload(), 500);
    });
  }

  function removeOption(optionId: number) {
    setTr(async () => {
      const res = await adminRemoveOption(optionId);
      if ((res as any).error) return flashErr((res as any).error);
      flashOk("تم حذف الخيار");
      setList((prev) =>
        prev.map((p) => ({
          ...p,
          options: p.options.filter((o) => o.id !== optionId),
        }))
      );
    });
  }

  return (
    <div className="space-y-8">
      {msg && (
        <div
          className={[
            "rounded-xl px-4 py-3 text-sm border",
            msg.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200",
          ].join(" ")}
        >
          {msg.ok ?? msg.err}
        </div>
      )}

      {/* Create new poll card */}
      <section className="rounded-2xl border border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black/10 p-6">
        <h2 className="text-lg font-bold mb-3 inline-flex items-center gap-2">
          ➕ إنشاء استفتاء أسبوعي جديد
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <label className="block text-sm">
            <span className="block mb-1 font-medium">عنوان الاستفتاء</span>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent"
              placeholder="من هو أفضل بائع هذا الأسبوع؟"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              <span className="block mb-1 font-medium">بداية الأسبوع</span>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent"
              />
            </label>
            <label className="block text-sm">
              <span className="block mb-1 font-medium">نهاية الأسبوع</span>
              <input
                type="date"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
                className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent"
              />
            </label>
          </div>
        </div>
        <label className="block text-sm mb-4">
          <span className="block mb-1 font-medium">الوصف</span>
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent"
          />
        </label>

        <div className="rounded-xl border border-dashed border-black/[.15] dark:border-white/[.25] p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold inline-flex items-center gap-2">
              🧾 اختيار مرشحي الاستفتاء ({newSellers.length})
            </h3>
            <span className="text-xs opacity-60">اختر 2-10 باعة معتمدين للاستفتاء</span>
          </div>
          <input
            placeholder="🔍 ابحث عن بائع بالاسم ثم اضف..."
            value={searchSeller}
            onChange={(e) => setSearchSeller(e.target.value)}
            className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent mb-3"
          />
          {searchSeller && filtered.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 mb-3 pr-1">
              {filtered.slice(0, 50).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setNewSellers((prev) => [...prev, s.id]);
                    setSearchSeller("");
                  }}
                  className="w-full text-right rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between"
                >
                  <div className="text-sm">
                    <div className="font-semibold">{s.display}</div>
                    <div className="text-[11px] opacity-60">
                      مستوى الثقة {s.trust_level ?? 0}
                      {s.verification_status === "approved" ? " · موثوق" : ""}
                      {s.active_listings_count ? ` · ${s.active_listings_count} إعلان` : ""}
                    </div>
                  </div>
                  <span className="text-xs rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2.5 py-0.5 font-bold">
                    + إضافة
                  </span>
                </button>
              ))}
            </div>
          )}
          {newSellers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {newSellers.map((id) => {
                const s = allSellers.find((x) => x.id === id);
                return (
                  <span
                    key={id}
                    className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold inline-flex items-center gap-2"
                  >
                    ✓ {s?.display ?? id}
                    <button
                      type="button"
                      onClick={() =>
                        setNewSellers((prev) => prev.filter((x) => x !== id))
                      }
                      className="hover:text-rose-600"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs opacity-70">
            سيبدأ الاستفتاء كمسودة — افتحه للتصويت بعد أن تتأكد من جميع الخيارات.
          </p>
          <button
            type="button"
            disabled={tr || newSellers.length < 2}
            className={[
              "rounded-xl px-5 py-2.5 text-sm font-bold transition",
              !tr && newSellers.length >= 2
                ? "bg-foreground text-background hover:opacity-90"
                : "bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40 cursor-not-allowed",
            ].join(" ")}
            onClick={createPoll}
          >
            {tr ? "جاري الإنشاء..." : "إنشاء الاستفتاء (مسودة)"}
          </button>
        </div>
      </section>

      {/* Existing polls list */}
      <section className="space-y-5">
        <h2 className="text-lg font-bold inline-flex items-center gap-2">
          🗃️ جميع الاستفتاءات ({list.length})
        </h2>
        {list.length === 0 && (
          <p className="text-sm text-black/50">لا توجد استفتاءات بعد. أنشئ أول استفتاء عبر البطاقة أعلاه.</p>
        )}
        {list.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black/10 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg truncate">{p.title}</h3>
                  <span
                    className={[
                      "text-[11px] rounded-full px-2.5 py-0.5 font-bold",
                      p.status === "active"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        : p.status === "closed"
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                        : "bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/70 border border-black/10",
                    ].join(" ")}
                  >
                    {p.status === "active"
                      ? "✓ مفتوح للتصويت"
                      : p.status === "closed"
                      ? "🔒 مكتمل ومغلق"
                      : "📋 مسودة"}
                  </span>
                  {p.winner_prof && p.status === "closed" && (
                    <span className="text-[11px] rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2.5 py-0.5 font-bold inline-flex items-center gap-1">
                      👑 فاز بالاستفتاء: {p.winner_prof.business_name || p.winner_prof.full_name || p.winner_prof.id}
                    </span>
                  )}
                </div>
                <div className="text-[11px] opacity-60 mt-1">
                  الأسبوع: {new Date(p.week_start_date).toLocaleDateString("ar-SA")} ↔ {new Date(p.week_end_date).toLocaleDateString("ar-SA")}
                  {p.description ? ` · ${p.description.slice(0, 120)}` : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {p.status !== "active" && (
                  <button
                    disabled={tr}
                    onClick={() => setStatus(p.id, "active")}
                    className="text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 font-bold disabled:opacity-50"
                  >
                    ▶️ افتح للتصويت
                  </button>
                )}
                {p.status !== "closed" && (
                  <button
                    disabled={tr}
                    onClick={() => setStatus(p.id, "closed")}
                    className="text-xs rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 font-bold disabled:opacity-50"
                  >
                    🔒 أغلق وأعلن الفائز
                  </button>
                )}
                {p.status !== "draft" && (
                  <button
                    disabled={tr}
                    onClick={() => setStatus(p.id, "draft")}
                    className="text-xs rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-1.5 font-bold disabled:opacity-50 hover:bg-black/5"
                  >
                    عودة لمسودة
                  </button>
                )}
              </div>
            </div>

            {/* Options / results */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {p.options.length === 0 && (
                <div className="text-xs text-black/50 md:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-black/[.15] dark:border-white/[.25] p-4">
                  لم تتم إضافة مرشحين لهذا الاستفتاء بعد.
                </div>
              )}
              {p.options
                .sort((a, b) => (p.status === "closed" ? b.votes - a.votes : a.sort_order - b.sort_order))
                .map((o, idx) => {
                  const s = o.seller;
                  const nm = s?.business_name || s?.full_name || o.seller_id;
                  const winning = p.status === "closed" && o.votes > 0 && idx === 0;
                  return (
                    <div
                      key={o.id}
                      className={[
                        "rounded-xl p-3 border relative overflow-hidden",
                        winning
                          ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent"
                          : "border-black/[.08] dark:border-white/[.145] bg-black/[.02] dark:bg-white/[.03]",
                      ].join(" ")}
                    >
                      {winning && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold">
                          👑 الفائز
                        </span>
                      )}
                      <div className="flex items-center justify-between mb-1">
                        <Link
                          href={s?.slug ? `/seller/${s.slug}` : "#"}
                          className="font-semibold text-sm hover:underline truncate"
                        >
                          {nm}
                        </Link>
                        <button
                          onClick={() => removeOption(o.id)}
                          className="text-[10px] text-rose-500 hover:underline disabled:opacity-50"
                          disabled={tr || p.status !== "draft"}
                          title="حذف الخيار (فقط في المسودة)"
                        >
                          {p.status === "draft" ? "حذف" : ""}
                        </button>
                      </div>
                      <div className="text-[11px] opacity-70 mb-2">
                        {s?.verification_status === "approved" ? "موثوق · " : ""}
                        ثقة {s?.trust_level ?? 0}
                        {s?.active_listings_count ? ` · ${s.active_listings_count} إعلان` : ""}
                      </div>
                      {p.status !== "draft" && (
                        <>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <b>{o.votes.toLocaleString("ar-SA")} صوت</b>
                            <span>{o.percent.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-black/[.06] overflow-hidden">
                            <div
                              className={[
                                "h-full rounded-full",
                                winning
                                  ? "bg-gradient-to-r from-amber-400 to-amber-600"
                                  : "bg-gradient-to-r from-sky-500 to-indigo-500",
                              ].join(" ")}
                              style={{ width: `${Math.min(100, o.percent)}%` }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
            </div>

            {p.status === "draft" && (
              <div className="rounded-xl border border-dashed border-black/[.15] dark:border-white/[.25] p-3">
                <div className="text-xs font-semibold mb-2 inline-flex items-center gap-2">
                  ➕ إضافة بائع إضافي لهذا الاستفتاء
                </div>
                <AddSellerDropdown
                  allSellers={allSellers}
                  existingSellerIds={new Set(p.options.map((o) => o.seller_id))}
                  onAdd={(sid) => addOption(p.id, sid)}
                />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-xs opacity-70 flex-wrap gap-2">
              <span>
                إجمالي الأصوات: <b>{p.total_votes.toLocaleString("ar-SA")}</b>
              </span>
              <span>
                آخر تعديل: {new Date(p.updated_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function AddSellerDropdown({
  allSellers,
  existingSellerIds,
  onAdd,
}: {
  allSellers: Seller[];
  existingSellerIds: Set<string>;
  onAdd: (sid: string) => void;
}) {
  const [q, setQ] = useState("");
  const list = allSellers.filter(
    (s) =>
      s.display &&
      !existingSellerIds.has(s.id) &&
      s.display.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 ابحث ثم اضغط إضافة على الاسم..."
        className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent mb-2"
      />
      {q && list.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
          {list.slice(0, 40).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setQ("");
                onAdd(s.id);
              }}
              className="w-full text-right rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between"
            >
              <div className="text-sm">
                <div className="font-semibold">{s.display}</div>
                <div className="text-[11px] opacity-60">ثقة {s.trust_level ?? 0}</div>
              </div>
              <span className="text-xs rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2.5 py-0.5 font-bold">
                + إضافة
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
