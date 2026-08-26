// ─────────────────────────────────────────────────────────────────────────────
// Transactional email templates for Brevo notifications.
// Pure functions — no network, no secrets. Each returns { subject, html, text }.
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_NAME = "SugboDoc";
const BRAND_COLOR = "#2563EB";
const BRAND_COLOR_DARK = "#1D4ED8";
const BRAND_ACCENT = "#EFF6FF";
const TEXT_PRIMARY = "#1F2937";
const TEXT_MUTED = "#6B7280";
const BORDER = "#E5E7EB";

export type EmailContent = { subject: string; html: string; text: string };

function formatPeso(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return String(amount);
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT_PRIMARY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
        <tr>
          <td style="background-color:${BRAND_COLOR};padding:20px 32px;">
            <span style="font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;">${BRAND_NAME}</span>
            <span style="font-size:13px;color:${BRAND_ACCENT};display:block;margin-top:2px;">Your health, one tap away.</span>
          </td>
        </tr>
        <tr><td style="padding:32px;">${content}</td></tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid ${BORDER};font-size:12px;color:${TEXT_MUTED};line-height:18px;">
            This is an automated message from ${BRAND_NAME}. Please do not reply directly to this email.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:${TEXT_PRIMARY};">${text}</h1>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${TEXT_PRIMARY};">${text}</p>`;
}

function infoTable(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
    ${rows
      .map(
        ([label, value]) => `<tr>
      <td style="padding:10px 14px;font-size:13px;color:${TEXT_MUTED};white-space:nowrap;border-bottom:1px solid ${BORDER};">${label}</td>
      <td style="padding:10px 14px;font-size:14px;font-weight:600;color:${TEXT_PRIMARY};border-bottom:1px solid ${BORDER};text-align:right;">${value}</td>
    </tr>`,
      )
      .join("")}
  </table>`;
}

function cta(text: string): string {
  return `<a href="#" onclick="return false;" style="display:inline-block;background-color:${BRAND_COLOR_DARK};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">${text}</a>`;
}

// ─── Appointment booked ──────────────────────────────────────────────────────

export type AppointmentEmailData = {
  patientName?: string;
  doctorName?: string;
  department?: string;
  clinic?: string;
  appointmentDate?: string;
  appointmentTime?: string;
};

export function appointmentBookedTemplate(data: AppointmentEmailData): EmailContent {
  const name = data.patientName?.split(" ")[0] || "there";
  const doctor = data.doctorName || "your assigned doctor";
  return {
    subject: `Appointment Request Received — ${BRAND_NAME}`,
    html: baseTemplate(`
      ${heading(`Hi ${name}, we've received your appointment request!`)}
      ${paragraph(`Your request has been logged and is now <strong>pending confirmation</strong> by our clinic staff. You'll receive another email as soon as your appointment status is updated.`)}
      ${infoTable([
        ["Doctor", doctor],
        ["Department", data.department || "—"],
        ["Clinic", data.clinic || "—"],
        ["Date", fmtDate(data.appointmentDate) || "—"],
        ["Time", data.appointmentTime || "—"],
      ])}
      ${cta("View my appointments")}
    `),
    text: [
      `Hi ${name}, we've received your appointment request.`,
      ``,
      `Doctor: ${doctor}`,
      `Department: ${data.department || "-"}`,
      `Clinic: ${data.clinic || "-"}`,
      `Date: ${fmtDate(data.appointmentDate) || "-"}`,
      `Time: ${data.appointmentTime || "-"}`,
      ``,
      `Status: Pending confirmation. We'll email you once confirmed.`,
    ].join("\n"),
  };
}

/** Short plain-text variant for the booking confirmation SMS (Infobip). */
export function appointmentBookedSmsText(data: AppointmentEmailData): string {
  const name = data.patientName?.split(" ")[0];
  const doctor = data.doctorName || "your assigned doctor";
  const when = [fmtDate(data.appointmentDate), data.appointmentTime].filter(Boolean).join(", ");
  return [
    name ? `SugboDoc: Hi ${name}!` : "SugboDoc:",
    "Your appointment request has been received.",
    `${doctor}${when ? ` · ${when}` : ""}.`,
    "Status: pending clinic confirmation.",
  ].join(" ");
}

// ─── Appointment status update ───────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; intro: string }> = {
  Confirmed: {
    label: "CONFIRMED",
    color: "#059669",
    intro:
      "Great news — your appointment has been <strong>confirmed</strong>. Please arrive 15 minutes early.",
  },
  Rejected: {
    label: "DECLINED",
    color: "#DC2626",
    intro:
      "Unfortunately, your appointment request was <strong>declined</strong> by clinic staff. Please book another schedule or contact us for assistance.",
  },
  Cancelled: {
    label: "CANCELLED",
    color: "#D97706",
    intro:
      "Your appointment has been <strong>cancelled</strong>. If this wasn't expected, please contact the clinic.",
  },
  Completed: {
    label: "COMPLETED",
    color: BRAND_COLOR,
    intro:
      "Your appointment has been marked as <strong>completed</strong>. Thank you for visiting!",
  },
};

export function appointmentStatusTemplate(
  status: string,
  data: AppointmentEmailData,
): EmailContent {
  const meta = STATUS_META[status] ?? {
    label: status.toUpperCase(),
    color: TEXT_MUTED,
    intro: `The status of your appointment changed to <strong>${status}</strong>.`,
  };
  const name = data.patientName?.split(" ")[0] || "there";
  return {
    subject: `Appointment ${meta.label.charAt(0)}${meta.label.slice(1).toLowerCase()} — ${BRAND_NAME}`,
    html: baseTemplate(`
      ${heading(`Hi ${name}, your appointment is ${meta.label.toLowerCase()}.`)}
      ${paragraph(meta.intro)}
      ${infoTable([
        ["Doctor", data.doctorName || "—"],
        ["Department", data.department || "—"],
        ["Clinic", data.clinic || "—"],
        ["Date", fmtDate(data.appointmentDate) || "—"],
        ["Time", data.appointmentTime || "—"],
        ["Status", `<span style="color:${meta.color};font-weight:700;">${meta.label}</span>`],
      ])}
      ${status === "Confirmed" ? cta("View appointment details") : ""}
    `),
    text: [
      `Hi ${name},`,
      ``,
      meta.intro.replace(/<[^>]+>/g, ""),
      ``,
      `Doctor: ${data.doctorName || "-"}`,
      `Clinic: ${data.clinic || "-"}`,
      `Date: ${fmtDate(data.appointmentDate) || "-"}`,
      `Time: ${data.appointmentTime || "-"}`,
      `Status: ${meta.label}`,
    ].join("\n"),
  };
}

// ─── Payment receipt ─────────────────────────────────────────────────────────

export type PaymentReceiptData = {
  patientName?: string;
  kind: "bill" | "order" | "insurance";
  title: string;
  description?: string;
  amount: number | string;
  reference?: string;
};

export function paymentReceiptTemplate(data: PaymentReceiptData): EmailContent {
  const name = data.patientName?.split(" ")[0] || "there";
  const kindLabel =
    data.kind === "order"
      ? "Order Payment Confirmed"
      : data.kind === "insurance"
        ? "Insurance Payment Verified"
        : "Payment Received";
  const rows: [string, string][] = [
    ["Description", data.title],
    ...(data.description ? ([["Details", data.description]] as [string, string][]) : []),
    ["Amount Paid", formatPeso(data.amount)],
    ...(data.reference ? ([["Reference", data.reference]] as [string, string][]) : []),
  ];
  return {
    subject: `${kindLabel} — ${formatPeso(data.amount)} · ${BRAND_NAME}`,
    html: baseTemplate(`
      ${heading(`Thank you, ${name}! Your payment went through.`)}
      ${paragraph(`We've successfully processed your payment. A record of this transaction is available in your ${BRAND_NAME} dashboard.`)}
      ${infoTable(rows)}
      ${cta("View my billing")}
    `),
    text: [
      `Thank you, ${name}! Your payment went through.`,
      ``,
      ...rows.map(([k, v]) => `${k}: ${v}`),
      ``,
      `Manage your billing anytime in your ${BRAND_NAME} dashboard.`,
    ].join("\n"),
  };
}
