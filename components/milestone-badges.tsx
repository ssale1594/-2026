import type { SellerDetail as SellerRow } from "@/lib/data/sellers";

export type MilestoneBadge = {
  slug: string;
  title: string;
  description: string;
  icon: string; // emoji fallback
  unlocked: boolean;
  progress: number; // 0..1
  goalLabel: string; // e.g. "٥ من ١٠ صفقات"
  tier: "bronze" | "silver" | "gold" | "emerald" | "indigo" | "sky" | "rose";
  /** SVG path content (optional) */
  svg?: "badge-wreath" | "badge-star" | "badge-flash" | "badge-heart" | "badge-chat" | "badge-image";
};

export type MilestoneInput = {
  seller_id: string;
  created_at: string;
  // listings
  total_listings_published: number;
  avg_images_per_listing: number;
  // chat
  avg_first_reply_minutes_last10: number;
  read_rate_last10: number; // 0..1
  // vouches
  vouch_count: number;
  // deals
  completed_deals: number;
  completed_last30d: number;
  // premium
  tier: string | null;
};

const TIER_GRAD: Record<MilestoneBadge["tier"], { from: string; to: string; text: string; ring: string }> = {
  bronze:  { from: "#b45309", to: "#f59e0b", text: "#78350f", ring: "#d97706" },
  silver:  { from: "#6b7280", to: "#cbd5e1", text: "#111827", ring: "#9ca3af" },
  gold:    { from: "#ca8a04", to: "#fde68a", text: "#713f12", ring: "#eab308" },
  emerald: { from: "#059669", to: "#6ee7b7", text: "#064e3b", ring: "#10b981" },
  indigo:  { from: "#4f46e5", to: "#a5b4fc", text: "#312e81", ring: "#6366f1" },
  sky:     { from: "#0284c7", to: "#7dd3fc", text: "#0c4a6e", ring: "#0ea5e9" },
  rose:    { from: "#be123c", to: "#fda4af", text: "#881337", ring: "#f43f5e" },
};

export function BadgeSVG({ badge, size = 72 }: { badge: MilestoneBadge; size?: number }) {
  const g = TIER_GRAD[badge.tier];
  const id = `grad-${badge.slug}`;
  const opacity = badge.unlocked ? 1 : 0.35;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 ${badge.unlocked ? "drop-shadow" : ""}`}
      style={{ opacity }}
      aria-label={badge.title}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={g.from} />
          <stop offset="100%" stopColor={g.to} />
        </linearGradient>
      </defs>

      {/* الدائرة الخارجية */}
      <circle cx="50" cy="45" r="32" fill={`url(#${id})`} stroke={g.ring} strokeWidth="3" />

      {/* الشريط السفلي */}
      <path
        d="M 20 58 L 20 82 Q 20 88 26 88 L 74 88 Q 80 88 80 82 L 80 58 Z"
        fill={g.from}
        stroke={g.ring}
        strokeWidth="2"
        opacity={0.9}
      />
      <text
        x="50"
        y="79"
        fontSize="16"
        textAnchor="middle"
        fontFamily="serif"
        fontWeight="900"
        fill="white"
      >
        {badge.icon}
      </text>

      {/* الأيقونة الدائرية الوسطى حسب svg type */}
      <text
        x="50"
        y="52"
        fontSize="30"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {badge.icon}
      </text>
    </svg>
  );
}

export function MilestoneBadgeCard({ badge }: { badge: MilestoneBadge }) {
  return (
    <div
      className={`rounded-2xl p-3 border ${
        badge.unlocked
          ? "border-black/10 dark:border-white/15 bg-gradient-to-br from-white to-black/[.03] dark:from-neutral-900 dark:to-white/[.04] shadow"
          : "border-dashed border-black/10 dark:border-white/15 opacity-80"
      }`}
      title={badge.description}
    >
      <div className="flex items-center gap-3">
        <BadgeSVG badge={badge} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <b className="text-sm">{badge.title}</b>
            {badge.unlocked ? (
              <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 border border-emerald-500/30 font-bold">
                مكتمل ✓
              </span>
            ) : (
              <span className="text-[10px] rounded-full bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 px-2 py-0.5 border border-neutral-500/30 font-bold">
                قيد الإكمال
              </span>
            )}
          </div>
          <p className="text-[11px] opacity-70 mt-0.5 leading-snug">
            {badge.description}
          </p>
          <div className="mt-2">
            <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(Math.max(0, Math.min(1, badge.progress)) * 100)}%`,
                  background: `linear-gradient(90deg, ${TIER_GRAD[badge.tier].from}, ${TIER_GRAD[badge.tier].to})`,
                }}
              />
            </div>
            <div className="text-[10px] opacity-60 mt-1">{badge.goalLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function clampPct(got: number, goal: number) {
  if (goal <= 0) return 1;
  return Math.max(0, Math.min(1, got / goal));
}

export function computeMilestones(d: MilestoneInput): MilestoneBadge[] {
  const created = new Date(d.created_at).getTime();
  const ageDays = Math.max(1, Math.floor((Date.now() - created) / (24 * 3600 * 1000)));
  const isNewSeller = ageDays < 7;

  return [
    {
      slug: "newcomer",
      title: "🆕 بائع جديد",
      description: "انضم خلال الأسبوع الأخير — أهلاً بك في سوق الزلفي!",
      icon: "🆕",
      unlocked: isNewSeller,
      progress: isNewSeller ? 1 : 0,
      goalLabel: isNewSeller ? "أسبوع الإندماج: يوم " + ageDays + "/7" : "انتهت فترة البائع الجديد",
      tier: "sky",
    },
    {
      slug: "deals-10",
      title: "🏆 ١٠ صفقات مكتملة",
      description: "أكمل ١٠ صفقات ناجحة عبر المنصة ليتعرف الجيران عليك",
      icon: "🏆",
      unlocked: d.completed_deals >= 10,
      progress: clampPct(d.completed_deals, 10),
      goalLabel: `${d.completed_deals} من ١٠ صفقات`,
      tier: "bronze",
    },
    {
      slug: "deals-50",
      title: "💎 ٥٠ صفقة مكتملة",
      description: "علامة فارقة في الثقة والجدية — ٥٠ صفقة واعدة!",
      icon: "💎",
      unlocked: d.completed_deals >= 50,
      progress: clampPct(d.completed_deals, 50),
      goalLabel: `${d.completed_deals} من ٥٠ صفقة`,
      tier: "silver",
    },
    {
      slug: "deals-200",
      title: "👑 بائع أسطورى (٢٠٠+ صفقة)",
      description: "عمود من أعمدة السوق المحلي — ٢٠٠ صفقة وأكثر",
      icon: "👑",
      unlocked: d.completed_deals >= 200,
      progress: clampPct(d.completed_deals, 200),
      goalLabel: `${d.completed_deals} من ٢٠٠ صفقة`,
      tier: "gold",
    },
    {
      slug: "active-month",
      title: "⚡ نشط هذا الشهر",
      description: "أكملت ٥ صفقات أو أكثر خلال الأيام الثلاثين الماضية",
      icon: "⚡",
      unlocked: d.completed_last30d >= 5,
      progress: clampPct(d.completed_last30d, 5),
      goalLabel: `${d.completed_last30d} صفقات خلال ٣٠ يوم`,
      tier: "rose",
    },
    {
      slug: "quick-reply",
      title: "💬 سريع الرد",
      description: "متوسط زمن الرد الأول على أقل من ٢ ساعة في آخر ١٠ محادثات",
      icon: "💬",
      unlocked: d.avg_first_reply_minutes_last10 > 0 && d.avg_first_reply_minutes_last10 < 120,
      progress: clampPct(
        Math.max(0, 240 - (d.avg_first_reply_minutes_last10 || 240)),
        120
      ),
      goalLabel:
        d.avg_first_reply_minutes_last10 > 0
          ? `${Math.round(d.avg_first_reply_minutes_last10)} دقيقة (أقل من ١٢٠ دقيقة هو الهدف)`
          : "لم يتوفر بيانات كافية عن المحادثات",
      tier: "sky",
    },
    {
      slug: "responsive",
      title: "📨 مستجيب",
      description: "٩٠٪+ من الرسائل تُقرأ خلال يوم واحد في آخر ١٠ محادثات",
      icon: "📨",
      unlocked: d.read_rate_last10 >= 0.9,
      progress: clampPct(Math.max(0, d.read_rate_last10), 0.9),
      goalLabel: `${Math.round((d.read_rate_last10 || 0) * 100)}٪ معدل القراءة (الهدف ٩٠٪)`,
      tier: "indigo",
    },
    {
      slug: "neighbours-vouched",
      title: "👥 موثوق بالجيران",
      description: "٥ توصيات أو أكثر من الجيران وزبائنك السابقين",
      icon: "👥",
      unlocked: d.vouch_count >= 5,
      progress: clampPct(d.vouch_count, 5),
      goalLabel: `${d.vouch_count} توصيات (الهدف ٥)`,
      tier: "emerald",
    },
    {
      slug: "detail-rich",
      title: "📸 مفصّل بالصور",
      description: "متوسط ٤+ صور لكل إعلان منشور — أفضل تجربة للمشتري",
      icon: "📸",
      unlocked: d.avg_images_per_listing >= 4,
      progress: clampPct(d.avg_images_per_listing, 4),
      goalLabel: `${d.avg_images_per_listing.toFixed(1)} صور في المتوسط (الهدف ٤)`,
      tier: "gold",
    },
    {
      slug: "premium-member",
      title: "✨ عضو متميّز",
      description: "حسابك ضمن العضوية المميزة (فضي/ذهبي/ماسي).",
      icon: "✨",
      unlocked: ["silver", "gold", "diamond"].includes((d.tier ?? "").toLowerCase()),
      progress: ["silver", "gold", "diamond"].includes((d.tier ?? "").toLowerCase()) ? 1 : 0,
      goalLabel: d.tier ? `العضوية الحالية: ${(d.tier as string).toUpperCase()}` : "فرد مجاني — جرّب Silver/Go‌ld/Diamond",
      tier: (["silver", "gold", "diamond"].includes((d.tier ?? "").toLowerCase())
        ? ((d.tier ?? "gold").toLowerCase() === "diamond"
          ? "rose"
          : (d.tier ?? "").toLowerCase() === "gold"
            ? "gold"
            : "silver")
        : "bronze") as MilestoneBadge["tier"],
    },
  ];
}

export type _S = SellerRow;
