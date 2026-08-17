export type EmailTemplateData = {
  siteName: string;
  siteUrl: string;
  userName?: string;
  userEmail: string;
  year: number;
};

export type InstantEmailData = EmailTemplateData & {
  notification: {
    id: number;
    type: string;
    title: string;
    body?: string | null;
    link?: string | null;
    created_at: string;
  };
};

export type DigestEmailData = EmailTemplateData & {
  notifications: Array<{
    id: number;
    type: string;
    title: string;
    body?: string | null;
    link?: string | null;
    created_at: string;
    is_read: boolean;
  }>;
  unreadCount: number;
};

const inlineStyles = `
  body { margin:0; padding:0; background:#f8fafc; font-family:'Segoe UI', Tahoma, sans-serif; direction:rtl; }
  .container { max-width:580px; margin:0 auto; padding:24px 16px; }
  .card { background:#fff; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,0.08); overflow:hidden; }
  .header { background: linear-gradient(135deg,#0ea5e9,#06b6d4); padding:28px 32px; color:#fff; text-align:center; }
  .header h1 { margin:0; font-size:22px; font-weight:700; }
  .header p { margin:6px 0 0; opacity:0.9; font-size:14px; }
  .content { padding:32px; }
  .badge { display:inline-block; padding:4px 12px; border-radius:999px; background:#e0f2fe; color:#0369a1; font-size:12px; font-weight:600; margin-bottom:16px; }
  .title { font-size:20px; font-weight:700; color:#0f172a; margin:0 0 12px; }
  .body-text { font-size:15px; line-height:1.7; color:#475569; margin:0 0 24px; }
  .body-text p { margin:0 0 8px; }
  .cta { display:inline-block; background:linear-gradient(135deg,#0ea5e9,#06b6d4); color:#fff !important; padding:13px 28px; border-radius:10px; font-weight:600; text-decoration:none; font-size:15px; }
  .meta-box { margin-top:20px; padding:16px; background:#f1f5f9; border-radius:10px; font-size:13px; color:#64748b; }
  .divider { height:1px; background:#e2e8f0; margin:24px 0; }
  .item { padding:16px; border-radius:10px; background:#f8fafc; margin-bottom:10px; border:1px solid #e2e8f0; }
  .item-title { font-size:15px; font-weight:600; color:#0f172a; margin:0 0 4px; }
  .item-body { font-size:13px; color:#64748b; margin:0 0 8px; line-height:1.6; }
  .item-link { font-size:13px; color:#0284c7; font-weight:500; text-decoration:none; }
  .footer { padding:24px 32px; background:#f8fafc; text-align:center; }
  .footer p { margin:0 0 6px; font-size:13px; color:#64748b; }
  .footer a { color:#0284c7; text-decoration:none; font-size:12px; margin:0 8px; }
  .unsubscribe { font-size:12px; color:#94a3b8; margin-top:8px; }
`;

const iconMap: Record<string, string> = {
  listing_published: "✅",
  listing_rejected: "⚠️",
  seller_approved: "🎉",
  seller_rejected: "❌",
  transaction_claimed: "🤝",
  review_received: "⭐",
  vouch_received: "💚",
  answer_received: "💬",
  offer_published: "🏷️",
  offer_rejected: "⚠️",
  need_response: "📩",
};

const badgeMap: Record<string, string> = {
  listing_published: "إعلان منشور",
  listing_rejected: "إعلان يحتاج تعديل",
  seller_approved: "حساب معتمد",
  seller_rejected: "حساب قيد المراجعة",
  transaction_claimed: "تعامل جديد",
  review_received: "تقييم جديد",
  vouch_received: "توصية جار",
  answer_received: "رد على سؤالك",
  offer_published: "عرض منشور",
  offer_rejected: "عرض يحتاج تعديل",
  need_response: "رد على طلبك",
};

function wrapHtml(body: string, data: EmailTemplateData) {
  const footer = `
    <div class="footer">
      <p><strong>${data.siteName}</strong> — دليلك لكل ما تحتاجه بالزلفي</p>
      <p>
        <a href="${data.siteUrl}/">الصفحة الرئيسية</a> |
        <a href="${data.siteUrl}/notifications">الإشعارات</a> |
        <a href="${data.siteUrl}/dashboard/settings">إعدادات الإشعارات</a>
      </p>
      <p class="unsubscribe">
        لتعديل تفضيلات البريد الإلكتروني، زر صفحة الإعدادات:
        <a href="${data.siteUrl}/dashboard/settings">${data.siteUrl}/dashboard/settings</a>
      </p>
      <p class="unsubscribe">© ${data.year} ${data.siteName}. جميع الحقوق محفوظة.</p>
    </div>
  `;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.siteName}</title>
  <style>${inlineStyles}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>${data.siteName}</h1>
        <p>إشعار جديد من منصة الزلفي</p>
      </div>
      <div class="content">
        ${body}
      </div>
      ${footer}
    </div>
  </div>
</body>
</html>`;
}

export function renderInstantEmail(data: InstantEmailData): { html: string; subject: string } {
  const { notification } = data;
  const icon = iconMap[notification.type] || "🔔";
  const badge = badgeMap[notification.type] || "إشعار جديد";

  const greeting = data.userName
    ? `<p>مرحباً <strong>${data.userName}</strong>,</p>`
    : `<p>مرحباً,</p>`;

  const ctaLink = notification.link
    ? `${data.siteUrl}${notification.link.startsWith("/") ? notification.link : "/" + notification.link}`
    : `${data.siteUrl}/notifications`;

  const ctaLabel = notification.link
    ? "عرض التفاصيل ←"
    : "فتح لوحة الإشعارات ←";

  const body = `
    <span class="badge">${icon} ${badge}</span>
    <h2 class="title">${notification.title}</h2>
    <div class="body-text">
      ${greeting}
      <p>${notification.body || notification.title}</p>
    </div>
    <a href="${ctaLink}" class="cta" target="_blank">${ctaLabel}</a>
    <div class="meta-box">
      تم إرسال هذا الإشعار في: ${new Date(notification.created_at).toLocaleString("ar-SA")}
    </div>
  `;

  const subject = `${icon} ${notification.title} | ${data.siteName}`;
  return { html: wrapHtml(body, data), subject };
}

export function renderDigestEmail(data: DigestEmailData): { html: string; subject: string } {
  const greeting = data.userName
    ? `<p>مرحباً <strong>${data.userName}</strong>,</p>`
    : `<p>مرحباً,</p>`;

  const items = data.notifications
    .slice(0, 10)
    .map((n) => {
      const icon = iconMap[n.type] || "🔔";
      const link = n.link
        ? `${data.siteUrl}${n.link.startsWith("/") ? n.link : "/" + n.link}`
        : `${data.siteUrl}/notifications`;
      return `
        <div class="item">
          <p class="item-title">${icon} ${n.title}</p>
          ${n.body ? `<p class="item-body">${n.body}</p>` : ""}
          <a class="item-link" href="${link}" target="_blank">عرض التفاصيل →</a>
        </div>
      `;
    })
    .join("");

  const unreadNote =
    data.unreadCount > 0
      ? `<p>لديك <strong>${data.unreadCount}</strong> إشعار جديد لم تقرأه بعد.</p>`
      : `<p>إليك ملخص ما حدث خلال آخر 48 ساعة.</p>`;

  const body = `
    <span class="badge">📬 ملخص يومي للإشعارات</span>
    <h2 class="title">أحدث الإشعارات على منصتنا</h2>
    <div class="body-text">
      ${greeting}
      ${unreadNote}
    </div>
    ${items}
    <div class="divider"></div>
    <a href="${data.siteUrl}/notifications" class="cta" target="_blank">فتح كل الإشعارات ←</a>
    <div class="meta-box">
      عدد الإشعارات في هذا الملخص: <strong>${data.notifications.length}</strong>
    </div>
  `;

  const subject = `📬 ملخص الإشعارات اليومي (${data.unreadCount} جديد) | ${data.siteName}`;
  return { html: wrapHtml(body, data), subject };
}
