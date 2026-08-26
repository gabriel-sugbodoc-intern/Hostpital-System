import { createServerFn } from "@tanstack/react-start";
import { normalizeToE164 } from "./phone";

export { normalizeToE164, isE164 } from "./phone";

// ─────────────────────────────────────────────────────────────────────────────
// Infobip credentials — loaded strictly from environment variables (.env).
// NEVER hardcoded: secrets must not ship to frontend code, logs, or Git.
// These values are only read inside server-function handlers / server routes.
//
//   INFOBIP_API_KEY   — portal API key (sent as `Authorization: App <key>`)
//   INFOBIP_BASE_URL  — account-specific host, e.g. 3d4191.api.infobip.com
//   INFOBIP_SENDER    — default numeric/alphanumeric sender ID
// ─────────────────────────────────────────────────────────────────────────────

export type InfobipCredentials = {
  apiKey: string;
  baseUrl: string;
  sender: string;
};

export function getInfobipCredentials(): InfobipCredentials {
  return {
    apiKey: (process.env.INFOBIP_API_KEY || "").trim(),
    baseUrl: (process.env.INFOBIP_BASE_URL || "").trim().replace(/^https?:\/\//, ""),
    sender: (process.env.INFOBIP_SENDER || "").trim(),
  };
}

function isInfobipConfigured(creds: InfobipCredentials): boolean {
  return Boolean(creds.apiKey && creds.baseUrl);
}

/** Maps Infobip REST errors to actionable, user-safe messages. */
function friendlyInfobipError(status: number, messageId?: string, text?: string): string {
  if (status === 401 || messageId === "UNAUTHORIZED") {
    return "Infobip authentication failed. Check INFOBIP_API_KEY and INFOBIP_BASE_URL in the environment.";
  }
  if (status === 403) {
    return "Infobip rejected the request for this account/key. Verify API-key scopes in the Infobip portal.";
  }
  if (status === 429) {
    return "Infobip rate limit reached. Please retry in a moment.";
  }
  if (/not\s*allowed|whitelist|previously registered|trial/i.test(text || "")) {
    return "Infobip trial accounts can only deliver to the phone number registered at signup. Top up your account or verify the recipient.";
  }
  return text || `SMS delivery failed via Infobip (${status}).`;
}

export type InfobipSmsPayload = {
  to: string;
  body: string;
};

export type InfobipSmsResult = {
  success: boolean;
  messageId?: string;
  status?: string;
  to?: string;
  from?: string;
  error?: string;
  /** Set when the request was rejected before reaching Infobip (auth/validation). */
  unauthorized?: boolean;
};

type InfobipMessageStatus = {
  groupId?: number;
  groupName?: string;
  name?: string;
  description?: string;
};

type InfobipSendResponse = {
  messages?: Array<{
    messageId?: string;
    to?: string;
    from?: string;
    smsCount?: number;
    status?: InfobipMessageStatus;
  }>;
  requestError?: { serviceException?: { messageId?: string; text?: string } };
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
  allowedRoles: string[],
): Promise<
  { session: { sub: string; role: string; name?: string } } | { error: string; status: number }
> {
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

export const getInfobipConfigServerFn = createServerFn({ method: "GET" }).handler(async (ctx) => {
  const auth = await authorizeSms(ctx, ["admin", "doctor"]);
  if ("error" in auth) return { configured: false, error: auth.error, unauthorized: true };
  return getInfobipConfig();
});

/** Shared masked-config reader (used by the server fn and raw HTTP routes). */
export function getInfobipConfig() {
  const creds = getInfobipCredentials();
  const mask = (str: string, keep = 4) =>
    str
      ? `${str.slice(0, keep)}${"*".repeat(Math.max(0, str.length - keep * 2))}${str.slice(-keep)}`
      : "";

  return {
    configured: isInfobipConfigured(creds),
    apiKeyMasked: mask(creds.apiKey, 6),
    baseUrl: creds.baseUrl,
    sender: creds.sender,
    missing: [
      ...(creds.apiKey ? [] : ["INFOBIP_API_KEY"]),
      ...(creds.baseUrl ? [] : ["INFOBIP_BASE_URL"]),
      ...(creds.sender ? [] : ["INFOBIP_SENDER"]),
    ],
  };
}

export const testInfobipConnectionServerFn = createServerFn({ method: "POST" }).handler(
  async (ctx) => {
    const auth = await authorizeSms(ctx, ["admin", "doctor"]);
    if ("error" in auth) return { connected: false, error: auth.error, unauthorized: true };
    return testInfobipConnection();
  },
);

/** Shared live credential check against Infobip's account-balance endpoint. */
export async function testInfobipConnection() {
  const creds = getInfobipCredentials();
  if (!isInfobipConfigured(creds)) {
    return {
      connected: false,
      error:
        "Infobip is not fully configured. Required env vars: INFOBIP_API_KEY and INFOBIP_BASE_URL.",
    };
  }

  try {
    const response = await fetch(`https://${creds.baseUrl}/account/1/balance`, {
      method: "GET",
      headers: {
        Authorization: `App ${creds.apiKey}`,
        Accept: "application/json",
      },
    });
    const data = (await response.json().catch(() => ({}))) as InfobipSendResponse & {
      balance?: number;
      currency?: string;
    };

    if (!response.ok) {
      console.error("[Infobip] connection test failed:", response.status);
      return {
        connected: false,
        error: friendlyInfobipError(
          response.status,
          data?.requestError?.serviceException?.messageId,
          data?.requestError?.serviceException?.text,
        ),
      };
    }

    return {
      connected: true,
      balance: typeof data?.balance === "number" ? data.balance : undefined,
      currency: data?.currency,
    };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : "Failed to reach the Infobip API.",
    };
  }
}

/**
 * Core sender — SERVER-SIDE ONLY (raw HTTP routes in src/server.ts and the
 * Infobip server-fn handlers). Never call from client components.
 */
export async function sendInfobipSmsDirect(payload: InfobipSmsPayload): Promise<InfobipSmsResult> {
  const creds = getInfobipCredentials();

  if (!isInfobipConfigured(creds)) {
    return {
      success: false,
      error: "Infobip is not fully configured. Missing INFOBIP_* environment variables.",
    };
  }

  const to = normalizeToE164(payload.to);
  const text = (payload.body ?? "").trim();

  if (!to) {
    return {
      success: false,
      error: `"${payload.to}" is not a valid phone number. Use E.164 format (e.g. +639171234567).`,
    };
  }
  if (!text) {
    return { success: false, error: "Message text cannot be empty." };
  }
  if (text.length > 1600) {
    return { success: false, error: "Message exceeds the 1,600 character limit." };
  }

  try {
    const response = await fetch(`https://${creds.baseUrl}/sms/3/messages`, {
      method: "POST",
      headers: {
        Authorization: `App ${creds.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            destinations: [{ to }],
            ...(creds.sender ? { sender: creds.sender } : {}),
            content: { text },
          },
        ],
      }),
    });

    const data: InfobipSendResponse = await response.json().catch(() => ({}));

    if (!response.ok) {
      const svc = data.requestError?.serviceException;
      console.error("[Infobip] send failed:", { status: response.status, id: svc?.messageId });
      return {
        success: false,
        error: friendlyInfobipError(response.status, svc?.messageId, svc?.text),
      };
    }

    const msg = data.messages?.[0];
    const group = msg?.status?.groupId ?? 0;
    // Submit-time rejection arrives as HTTP 200 with status group REJECTED (4+).
    if (group >= 4) {
      console.error(
        "[Infobip] message rejected:",
        msg?.status?.groupName,
        msg?.status?.description,
      );
      return {
        success: false,
        to: msg?.to,
        error: friendlyInfobipError(400, msg?.status?.name, msg?.status?.description),
      };
    }

    return {
      success: true,
      messageId: msg?.messageId,
      status: msg?.status?.name,
      to: msg?.to ?? to,
      from: msg?.from ?? creds.sender,
    };
  } catch (err) {
    console.error("[Infobip] network failure:", err instanceof Error ? err.message : err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error contacting Infobip.",
    };
  }
}

/** Staff-gated sender (admin/doctor) — used by messaging UI and raw routes. */
export const sendInfobipSmsServerFn = createServerFn({ method: "POST" })
  .validator((input: InfobipSmsPayload) => input)
  .handler(async (ctx) => {
    const auth = await authorizeSms(ctx, ["admin", "doctor"]);
    if ("error" in auth) {
      return { success: false, error: auth.error, unauthorized: true } satisfies InfobipSmsResult;
    }
    return await sendInfobipSmsDirect(ctx.data);
  });

/**
 * Ungated internal sender for trusted server flows (e.g. patient booking
 * confirmations triggered by the patient's own request). Mirrors the Brevo
 * email pattern: never throws; failures are returned as { success:false }.
 */
const sendSmsInternalServerFn = createServerFn({ method: "POST" })
  .validator((input: InfobipSmsPayload) => input)
  .handler(async ({ data }) => sendInfobipSmsDirect(data));

export async function sendInfobipSmsSafe(payload: InfobipSmsPayload): Promise<InfobipSmsResult> {
  try {
    return await sendSmsInternalServerFn({ data: payload });
  } catch (err) {
    console.error("[Infobip] unexpected failure:", err instanceof Error ? err.message : err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error while sending SMS.",
    };
  }
}
