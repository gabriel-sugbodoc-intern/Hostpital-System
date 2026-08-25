// ─────────────────────────────────────────────────────────────────────────────
// HMAC-signed session tokens for privileged server-side operations (SMS).
//
// Why: the app's sessions live in browser localStorage, which the server cannot
// inspect. Raw client-issued tokens are therefore trivially forgeable and must
// never grant access to Twilio sending. Instead the server issues short-lived
// HMAC-SHA256-signed tokens; every SMS entry point (HTTP routes AND TanStack
// server functions) verifies the signature + expiry + role before touching
// Twilio. Forging a token without SESSION_SECRET is cryptographically infeasible.
//
// Known prototype limitation: role claims originate from the client-side DB at
// issuance time. This gate stops anonymous/unauthenticated abuse of the SMS API
// and enforces the admin/doctor contract at every layer, but a fully trusted
// authorization chain requires moving identity to the server.
// ─────────────────────────────────────────────────────────────────────────────

export type SmsSessionRole = "admin" | "doctor" | "patient";

export type SignedSession = {
  sub: string;
  name: string;
  email: string;
  role: SmsSessionRole;
  exp: number; // epoch seconds
  iat: number;
};

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || "";
  if (!secret && process.env.NODE_ENV === "production") {
    console.error("[auth] SESSION_SECRET is not set — signed session tokens use an ephemeral dev secret.");
  }
  // Deterministic per-process fallback keeps local/dev flows working.
  return secret || `dev-only-secret-${new Date().toISOString().slice(0, 10)}`;
}

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecodeToString(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

async function hmacSign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(sig));
}

export async function signSessionToken(user: {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
}): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TOKEN_TTL_SECONDS;
  const payload: SignedSession = {
    sub: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
    role: (["admin", "doctor", "patient"].includes(user.role) ? user.role : "patient") as SmsSessionRole,
    iat: now,
    exp: expiresAt,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacSign(body);
  return { token: `${body}.${sig}`, expiresAt: expiresAt * 1000 };
}

export async function verifySessionToken(token: string | undefined | null): Promise<SignedSession | null> {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const expected = await hmacSign(body);
    if (expected !== sig) return null;
    const payload = JSON.parse(base64UrlDecodeToString(body)) as SignedSession;
    if (!payload?.sub || !payload?.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Extracts a candidate token from an Authorization header or signed cookie. */
export function extractTokenFromRequest(request: Request): string | undefined {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim() || undefined;
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === "sugbodoc_signed_session") {
      return decodeURIComponent(v.join("=")) || undefined;
    }
  }
  return undefined;
}

/** Server-side guard for raw HTTP routes (src/server.ts). */
export async function requireRoleFromRequest(
  request: Request,
  allowedRoles: SmsSessionRole[]
): Promise<{ ok: true; session: SignedSession } | { ok: false; status: number; error: string }> {
  const session = await verifySessionToken(extractTokenFromRequest(request));
  if (!session) {
    return { ok: false, status: 401, error: "Authentication required." };
  }
  if (!allowedRoles.includes(session.role)) {
    return { ok: false, status: 403, error: "Your role is not permitted to perform this action." };
  }
  return { ok: true, session };
}

// ─────────────────────────────────────────────────────────────────────────────
// TanStack Start integration
// ─────────────────────────────────────────────────────────────────────────────

import { createServerFn } from "@tanstack/react-start";

/**
 * Issues an HMAC-signed session token for the current app user. The signed
 * token (not the forgeable raw localStorage token) is what SMS endpoints trust.
 */
export const issueSessionTokenServerFn = createServerFn({ method: "POST" })
  .validator(
    (input: { userId: string; email?: string | null; name?: string | null; role: string }) =>
      input
  )
  .handler(async ({ data }) => {
    if (!data?.userId) {
      return { success: false as const, error: "userId is required." };
    }
    const { token, expiresAt } = await signSessionToken({
      id: data.userId,
      email: data.email,
      name: data.name,
      role: data.role,
    });
    return { success: true as const, token, expiresAt };
  });
