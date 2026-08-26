import { createServerFn } from "@tanstack/react-start";

// ─────────────────────────────────────────────────────────────────────────────
// Brevo credentials — loaded strictly from environment variables (.env).
// NEVER hardcoded: secrets must not ship to frontend code, logs, or Git.
//
// Two transports, chosen automatically:
//   1. REST API  (preferred): BREVO_API_KEY   = v3 key (xkeysib-…)  — no IP limits
//   2. SMTP relay (fallback): BREVO_SMTP_LOGIN + BREVO_SMTP_KEY (xsmtpsib-…)
//      NOTE: relay access may be IP-restricted (525) depending on account plan.
//
// BREVO_SENDER_EMAIL must be a sender verified in Brevo (Senders & IP page).
// ─────────────────────────────────────────────────────────────────────────────

const SMTP_HOST = process.env.BREVO_SMTP_HOST?.trim() || "smtp-relay.brevo.com";
const SMTP_PORT = Number(process.env.BREVO_SMTP_PORT?.trim() || 587);

export type BrevoCredentials = {
  apiKey: string;
  smtpKey: string;
  smtpLogin: string;
  senderEmail: string;
  senderName: string;
};

export function getBrevoCredentials(): BrevoCredentials {
  return {
    apiKey: (process.env.BREVO_API_KEY || "").trim(),
    smtpKey: (process.env.BREVO_SMTP_KEY || "").trim(),
    smtpLogin: (process.env.BREVO_SMTP_LOGIN || "").trim(),
    senderEmail: (process.env.BREVO_SENDER_EMAIL || "").trim(),
    senderName: process.env.BREVO_SENDER_NAME?.trim() || "SugboDoc",
  };
}

function restReady(c: BrevoCredentials) {
  return Boolean(c.apiKey && c.senderEmail);
}
function smtpReady(c: BrevoCredentials) {
  return Boolean(c.smtpKey && c.smtpLogin && c.senderEmail);
}

/** Maps Brevo v3 REST API errors to actionable, user-safe messages. */
function friendlyRestError(status: number, message?: string): string {
  if (status === 401) {
    return "Brevo rejected the API key. BREVO_API_KEY must be a v3 API key starting with xkeysib- (SMTP & API page), not the SMTP key (xsmtpsib-…).";
  }
  if (status === 429) {
    return "Brevo daily email quota reached (free plan: 300/day). Upgrade or retry tomorrow.";
  }
  if (status === 404) {
    return "Brevo endpoint unavailable. Your plan may lack transactional email.";
  }
  if (message && /sender/i.test(message)) {
    return `Unverified sender. Verify ${getBrevoCredentials().senderEmail} in Brevo (Senders & IP).`;
  }
  return message || `Email delivery failed via Brevo API (${status}).`;
}

/** Maps nodemailer/Brevo SMTP errors to actionable, user-safe messages. */
function friendlySmtpError(code?: string, message?: string): string {
  const msg = message || "";
  if (/525|unauthorized ip/i.test(msg)) {
    return "Brevo SMTP relay blocked your server's IP (525 Unauthorized IP). Add your IP in Brevo (paid) or set BREVO_API_KEY to use the unrestricted REST API.";
  }
  if (code === "EAUTH" || /535|authentication|auth fail/i.test(msg)) {
    return "Brevo authentication failed. Check that BREVO_SMTP_LOGIN is your …@smtp-brevo.com login and BREVO_SMTP_KEY is your SMTP key (xsmtpsib-…), not the v3 API key.";
  }
  if (code === "EENVELOPE" || /recipient|554|550/i.test(msg)) {
    return `Message rejected for recipient/sender issues. Verify ${getBrevoCredentials().senderEmail} is a verified sender in Brevo.`;
  }
  if (/relay.*denied|553/i.test(msg)) {
    return "Brevo relay denied. Confirm the SMTP login/key pair matches an active Brevo account.";
  }
  if (code === "ESOCKET" || code === "EDNS" || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
    return "Network error contacting the Brevo SMTP relay. Check connectivity/firewall and retry.";
  }
  return msg || "Email delivery failed via Brevo SMTP.";
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BrevoEmailPayload = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
};

export type EmailSendResult = { sent: boolean; messageId?: string; reason?: string };

type BrevoApiResponse = { messageId?: string; message?: string; code?: string };

type NodemailerModule = typeof import("nodemailer");

let cachedTransporter: import("nodemailer").Transporter | null = null;

async function getTransporter(creds: BrevoCredentials) {
  const nodemailer: NodemailerModule = await import("nodemailer");
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      requireTLS: true,
      auth: { user: creds.smtpLogin, pass: creds.smtpKey },
    });
  }
  return cachedTransporter;
}

async function sendViaRest(
  creds: BrevoCredentials,
  payload: BrevoEmailPayload,
): Promise<EmailSendResult> {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": creds.apiKey,
      },
      body: JSON.stringify({
        sender: { name: creds.senderName, email: creds.senderEmail },
        to: [{ email: payload.to, ...(payload.toName ? { name: payload.toName } : {}) }],
        subject: payload.subject,
        htmlContent: payload.html,
        ...(payload.text ? { textContent: payload.text } : {}),
      }),
    });

    if (!response.ok) {
      const data: BrevoApiResponse = await response.json().catch(() => ({}));
      console.error("[Brevo] send failed:", { status: response.status, code: data.code });
      return { sent: false, reason: friendlyRestError(response.status, data.message) };
    }

    const data: BrevoApiResponse = await response.json().catch(() => ({}));
    return { sent: true, messageId: data.messageId };
  } catch (err) {
    console.error("[Brevo] network failure:", err instanceof Error ? err.message : err);
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Network error contacting Brevo.",
    };
  }
}

async function sendViaSmtp(
  creds: BrevoCredentials,
  payload: BrevoEmailPayload,
): Promise<EmailSendResult> {
  try {
    // Dynamic import keeps nodemailer out of any client bundle.
    const transporter = await getTransporter(creds);
    const info = await transporter.sendMail({
      from: `"${creds.senderName}" <${creds.senderEmail}>`,
      to: payload.toName ? `"${payload.toName}" <${payload.to}>` : payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.text ? { text: payload.text } : {}),
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const mailErr = err as { code?: string; message?: string };
    console.error("[Brevo] send failed:", { code: mailErr.code });
    return {
      sent: false,
      reason: friendlySmtpError(mailErr.code, err instanceof Error ? err.message : undefined),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core sender — SERVER-SIDE ONLY (inside createServerFn handlers / routes).
// ─────────────────────────────────────────────────────────────────────────────

export async function sendBrevoEmailDirect(payload: BrevoEmailPayload): Promise<EmailSendResult> {
  const creds = getBrevoCredentials();

  if (!restReady(creds) && !smtpReady(creds)) {
    const missing: string[] = [];
    if (!creds.senderEmail) {
      missing.push("BREVO_SENDER_EMAIL (verified in Brevo)");
    }
    if (!creds.apiKey && !(creds.smtpKey && creds.smtpLogin)) {
      missing.push(
        "either BREVO_API_KEY (xkeysib-…, recommended) or a complete SMTP pair (BREVO_SMTP_LOGIN + BREVO_SMTP_KEY)",
      );
    }
    const reason = `Brevo is not configured. Provide ${missing.join(" and ")}.`;
    console.warn("[Brevo] skipped:", reason);
    return { sent: false, reason };
  }

  const to = (payload.to || "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { sent: false, reason: `"${payload.to}" is not a valid recipient email.` };
  }
  if (!payload.subject?.trim() || !(payload.html?.trim() || payload.text?.trim())) {
    return { sent: false, reason: "Email subject and content are required." };
  }

  if (restReady(creds)) return sendViaRest(creds, payload);
  return sendViaSmtp(creds, payload);
}

export const sendEmailServerFn = createServerFn({ method: "POST" })
  .validator((input: BrevoEmailPayload) => input)
  .handler(async ({ data }): Promise<EmailSendResult> => {
    return sendBrevoEmailDirect(data);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Public helper — safe to call anywhere (client or server).
// Never throws; failures are logged and returned as { sent:false, reason }.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendEmailSafe(payload: BrevoEmailPayload): Promise<EmailSendResult> {
  try {
    return await sendEmailServerFn({ data: payload });
  } catch (err) {
    console.error("[Brevo] unexpected failure:", err instanceof Error ? err.message : err);
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Unexpected error while sending email.",
    };
  }
}
