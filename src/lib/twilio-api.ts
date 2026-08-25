import { createServerFn } from "@tanstack/react-start";

// ─────────────────────────────────────────────────────────────────────────────
// Twilio credentials — loaded strictly from environment variables (.env).
// NEVER hardcoded: secrets must not ship to frontend code, logs, or Git.
// These values are only read inside server-function handlers / server routes.
// ─────────────────────────────────────────────────────────────────────────────

export type TwilioCredentials = {
  accountSid: string;
  authToken: string;
  apiKeySid: string;
  apiSecret: string;
  fromNumber: string;
};

export function getTwilioCredentials(): TwilioCredentials {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    apiKeySid: process.env.TWILIO_API_KEY_SID || "",
    apiSecret: process.env.TWILIO_API_SECRET || "",
    fromNumber: (process.env.TWILIO_PHONE_NUMBER || "").trim(),
  };
}

function isTwilioConfigured(creds: TwilioCredentials): boolean {
  const hasAccount = Boolean(creds.accountSid && creds.authToken);
  const hasApiKey = Boolean(creds.apiKeySid && creds.apiSecret);
  return (hasAccount || hasApiKey) && Boolean(creds.fromNumber);
}

/** Builds HTTP Basic auth; uses the API-Key pair only when the SID is a true
 *  Twilio API key (SK… prefix) — Account-SID-shaped values (AC…) must NOT be
 *  used as the Basic username or Twilio returns 20003 authentication failure. */
function getTwilioAuthHeader(creds: TwilioCredentials): string {
  const hasRealApiKey =
    Boolean(creds.apiKeySid && creds.apiSecret) && creds.apiKeySid.startsWith("SK");
  const username = hasRealApiKey ? creds.apiKeySid : creds.accountSid;
  const password = hasRealApiKey ? creds.apiSecret : creds.authToken;
  if (typeof Buffer !== "undefined") {
    return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  }
  return `Basic ${btoa(`${username}:${password}`)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone number handling — Twilio requires strict E.164 (+<countrycode><number>).
// Stored patient numbers look like "+63 917 123 4567" or "09171234567".
// ─────────────────────────────────────────────────────────────────────────────

export { normalizeToE164, isE164 } from "./phone";

import { normalizeToE164 } from "./phone";

/** Maps Twilio REST error codes to actionable, user-safe messages. */
function friendlyTwilioError(code?: number, message?: string): string {
  switch (code) {
    case 20003:
      return "Twilio authentication failed. Check TWILIO_ACCOUNT_SID / auth credentials in the environment.";
    case 20429:
      return "Twilio rate limit reached. Please retry in a moment.";
    case 21211:
      return "Invalid recipient phone number. Verify the patient's number is correct.";
    case 21214:
      return "Recipient phone number could not be validated by Twilio.";
    case 21606:
      return "The recipient or sender number is invalid for SMS.";
    case 21608:
      return "Trial account: the recipient's number must first be verified in your Twilio console.";
    case 21612:
      return "The 'From' number is not valid for this destination. Check TWILIO_PHONE_NUMBER.";
    case 21614:
      return "The 'To' number is not mobile-capable or is malformed.";
    case 21617:
      return "Message body exceeds the 1,600 character SMS limit.";
    default:
      return message || "SMS delivery failed via Twilio.";
  }
}

export type TwilioSmsPayload = {
  to: string;
  body: string;
};

export type TwilioSmsResult = {
  success: boolean;
  sid?: string;
  status?: string;
  to?: string;
  from?: string;
  dateCreated?: string;
  error?: string;
  errorCode?: number;
  /** Set when the request was rejected before reaching Twilio (auth/validation). */
  unauthorized?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Server functions
// ─────────────────────────────────────────────────────────────────────────────

type AuthContextLike = { authSession?: { sub: string; role: string; name?: string } | null };

/**
 * Asserts a verified signed session with an allowed role (admin/doctor).
 * Primary source: request-middleware context. Fallback: reads the incoming
 * request headers directly via the server runtime (defense-in-depth).
 */
async function authorizeSms(
  ctx: unknown,
  allowedRoles: string[]
): Promise<{ session: { sub: string; role: string; name?: string } } | { error: string; status: number }> {
  const ctxAny = ctx as { context?: AuthContextLike } | undefined;
  let session = ctxAny?.context?.authSession ?? null;

  if (!session) {
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest();
      const { extractTokenFromRequest, verifySessionToken } = await import("./session-auth");
      session = await verifySessionToken(extractTokenFromRequest(request));
    } catch {
      // Not running under the server runtime — treat as unauthenticated.
    }
  }

  if (!session) {
    return { error: "You must be signed in to use SMS features.", status: 401 };
  }
  if (!allowedRoles.includes(session.role)) {
    return { error: "Only clinic staff (doctor/admin) can send SMS.", status: 403 };
  }
  return { session };
}

export const getTwilioConfigServerFn = createServerFn({ method: "GET" }).handler(async (ctx) => {
  const auth = await authorizeSms(ctx, ["admin", "doctor"]);
  if ("error" in auth) return { configured: false, error: auth.error, unauthorized: true };
  return getTwilioConfig();
});

/** Shared masked-config reader (used by the server fn and raw HTTP routes). */
export function getTwilioConfig() {
  const creds = getTwilioCredentials();
  const mask = (str: string, keep = 4) =>
    str ? `${str.slice(0, keep)}${"*".repeat(Math.max(0, str.length - keep * 2))}${str.slice(-keep)}` : "";

  return {
    configured: isTwilioConfigured(creds),
    accountSidMasked: mask(creds.accountSid, 6),
    apiKeySidMasked: creds.apiKeySid ? mask(creds.apiKeySid, 6) : undefined,
    fromNumber: creds.fromNumber,
    hasAuthToken: Boolean(creds.authToken),
    hasApiSecret: Boolean(creds.apiSecret),
    missing: [
      ...(creds.accountSid ? [] : ["TWILIO_ACCOUNT_SID"]),
      ...(creds.authToken || creds.apiSecret ? [] : ["TWILIO_AUTH_TOKEN / TWILIO_API_SECRET"]),
      ...(creds.fromNumber ? [] : ["TWILIO_PHONE_NUMBER"]),
    ],
  };
}

export const testTwilioConnectionServerFn = createServerFn({ method: "POST" }).handler(async (ctx) => {
  const auth = await authorizeSms(ctx, ["admin", "doctor"]);
  if ("error" in auth) return { connected: false, error: auth.error, unauthorized: true };
  return testTwilioConnection();
});

/** Shared live credential check against Twilio's API. */
export async function testTwilioConnection() {
  const creds = getTwilioCredentials();
  if (!isTwilioConfigured(creds)) {
    return {
      connected: false,
      error: "Twilio is not fully configured. Required env vars: account SID + auth token (or API key pair) and TWILIO_PHONE_NUMBER.",
    };
  }

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}.json`, {
      method: "GET",
      headers: { Authorization: getTwilioAuthHeader(creds), Accept: "application/json" },
    });
    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("[Twilio] connection test failed:", data.code ?? response.status);
      return {
        connected: false,
        error: friendlyTwilioError(data.code, data.message || `Twilio Error (${response.status})`),
        code: data.code,
      };
    }

    return {
      connected: true,
      accountSid: data.sid,
      friendlyName: data.friendly_name,
      status: data.status,
      type: data.type,
      dateCreated: data.date_created,
    };
  } catch (err: any) {
    return { connected: false, error: err?.message || "Failed to reach the Twilio API." };
  }
}

/**
 * Core sender — SERVER-SIDE ONLY (raw HTTP routes in src/server.ts and the
 * sendTwilioSmsServerFn handler). Never call from client components.
 */
export async function sendTwilioSmsDirect(payload: TwilioSmsPayload): Promise<TwilioSmsResult> {
  const creds = getTwilioCredentials();

  if (!isTwilioConfigured(creds)) {
    return {
      success: false,
      error: "Twilio is not fully configured. Missing TWILIO_* environment variables.",
    };
  }

  const to = normalizeToE164(payload.to);
  const body = (payload.body ?? "").trim();
  const from = creds.fromNumber;

  if (!to) {
    return {
      success: false,
      errorCode: 21211,
      error: `"${payload.to}" is not a valid phone number. Use E.164 format (e.g. +639171234567).`,
    };
  }
  if (!body) {
    return { success: false, error: "Message text cannot be empty." };
  }
  if (body.length > 1600) {
    return { success: false, errorCode: 21617, error: "Message exceeds the 1,600 character limit." };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: getTwilioAuthHeader(creds),
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      }
    );

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Log code only — never credentials or full payloads.
      console.error("[Twilio] send failed:", { status: response.status, code: data.code });
      return {
        success: false,
        error: friendlyTwilioError(data.code, data.message),
        errorCode: data.code,
      };
    }

    return {
      success: true,
      sid: data.sid,
      status: data.status,
      to: data.to,
      from: data.from,
      dateCreated: data.date_created,
    };
  } catch (err: any) {
    console.error("[Twilio] network failure:", err?.message);
    return { success: false, error: err?.message || "Network error contacting Twilio." };
  }
}

export const sendTwilioSmsServerFn = createServerFn({ method: "POST" })
  .validator((input: TwilioSmsPayload) => input)
  .handler(async (ctx) => {
    const auth = await authorizeSms(ctx, ["admin", "doctor"]);
    if ("error" in auth) {
      return { success: false, error: auth.error, unauthorized: true } satisfies TwilioSmsResult;
    }
    return await sendTwilioSmsDirect(ctx.data);
  });
