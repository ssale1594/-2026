export type EmailSendResult = {
  success: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
};

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
};

const DEFAULT_FROM_EMAIL = process.env.EMAIL_FROM || "notifications@zulfi-local.example";
const DEFAULT_FROM_NAME = process.env.EMAIL_FROM_NAME || "منصة سوق الزلفي";

function fallbackError(method: string): EmailSendResult {
  return {
    success: false,
    error: `No email provider configured (tried: ${method}). Set RESEND_API_KEY or BREVO_API_KEY or SMTP_* env vars.`,
  };
}

async function sendWithResend(payload: EmailPayload, apiKey: string): Promise<EmailSendResult> {
  const from = payload.fromEmail || DEFAULT_FROM_EMAIL;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${payload.fromName || DEFAULT_FROM_NAME} <${from}>`,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        reply_to: payload.replyTo || "support@zulfi-local.example",
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, provider: "resend", error: JSON.stringify(json) };
    }
    return { success: true, provider: "resend", messageId: json.id };
  } catch (err: any) {
    return { success: false, provider: "resend", error: err?.message || String(err) };
  }
}

async function sendWithBrevo(payload: EmailPayload, apiKey: string): Promise<EmailSendResult> {
  const from = payload.fromEmail || DEFAULT_FROM_EMAIL;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: payload.fromName || DEFAULT_FROM_NAME, email: from },
        to: [{ email: payload.to }],
        subject: payload.subject,
        htmlContent: payload.html,
        replyTo: { email: payload.replyTo || from },
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, provider: "brevo", error: JSON.stringify(json) };
    }
    return { success: true, provider: "brevo", messageId: json.messageId };
  } catch (err: any) {
    return { success: false, provider: "brevo", error: err?.message || String(err) };
  }
}

async function sendWithSmtp(
  payload: EmailPayload,
  opts: { host: string; port: string; user: string; pass: string }
): Promise<EmailSendResult> {
  // Note: SMTP needs nodemailer or similar; we use fetch to an SMTP relay is not practical.
  // Implement using an HTTP-to-SMTP bridge (e.g. MailChannels for free on Cloudflare) if available.
  // Here we gracefully skip as optional.
  void opts;
  return {
    success: false,
    provider: "smtp",
    error: "Direct SMTP transport not implemented in the HTTP-only layer; configure RESEND or BREVO instead.",
  };
}

export async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  if (!payload.to || !payload.subject || !payload.html) {
    return { success: false, error: "Missing required fields: to, subject, html" };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey.length > 10) {
    const r = await sendWithResend(payload, resendKey);
    if (r.success) return r;
  }

  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey && brevoKey.length > 10) {
    const r = await sendWithBrevo(payload, brevoKey);
    if (r.success) return r;
  }

  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    const r = await sendWithSmtp(payload, {
      host: smtpHost,
      port: process.env.SMTP_PORT || "587",
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    });
    if (r.success) return r;
  }

  // Fallback: log the email to console during development so nothing is lost
  if (process.env.NODE_ENV !== "production") {
    console.log(
      "\n====== EMAIL DROP (no provider configured) ======\n" +
      `To: ${payload.to}\n` +
      `Subject: ${payload.subject}\n` +
      // First 300 chars of body (plaintext approximation)
      `Body preview: ${payload.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300)}...\n` +
      "================================================\n"
    );
    return {
      success: true,
      provider: "console_dev",
      messageId: "dev-" + Date.now(),
    };
  }

  return fallbackError("resend, brevo, smtp");
}
