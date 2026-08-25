import { createMiddleware } from "@tanstack/react-start";
import { sqlDb } from "./db/sql-db";
import { issueSessionTokenServerFn, verifySessionToken } from "./session-auth";

const TOKEN_CACHE_KEY = "sugbodoc_signed_session_token";

/**
 * Attaches the HMAC-signed session token (issued by the server) to every
 * server-function request. The raw localStorage token is NOT trusted by
 * privileged endpoints.
 */
export const attachSqlAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = await getSignedToken();
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});

// Re-entrancy guards: issueSessionTokenServerFn is itself a server function, so
// it passes through attachSqlAuth too. With an empty sessionStorage cache and a
// stale localStorage user, each issuance spawned another issuance — an infinite
// chain of pending requests that saturated the browser connection pool until
// the ORIGINAL server-fn promise never settled (form freezes, spinner spins,
// nothing thrown). Nested calls now bail out immediately; concurrent callers
// share one in-flight issuance instead of stampeding.
let issuingNow = false;
let inflightIssuance: Promise<string | undefined> | null = null;

async function getSignedToken(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;

  // 1. Cached & still valid?
  const cached = sessionStorage.getItem(TOKEN_CACHE_KEY);
  if (cached && (await verifySessionToken(cached))) {
    return cached;
  }

  // 2. Nested call (we are inside issueSessionTokenServerFn's own request):
  // proceed WITHOUT a Bearer header — token issuance is not privileged.
  if (issuingNow) {
    console.debug("[auth-debug] auth-attach: nested issuance detected — skipping (recursion guard)");
    return undefined;
  }

  // 3. Issue once; parallel callers await the same in-flight promise.
  if (!inflightIssuance) {
    issuingNow = true;
    inflightIssuance = (async () => {
      try {
        const user = sqlDb.getCurrentUser();
        if (!user) return undefined;
        const res = await issueSessionTokenServerFn({
          data: { userId: user.id, email: user.email, name: user.name, role: user.role },
        });
        if (res?.success && res.token) {
          sessionStorage.setItem(TOKEN_CACHE_KEY, res.token);
          try {
            document.cookie = `sugbodoc_signed_session=${encodeURIComponent(res.token)}; path=/; SameSite=Strict; Secure; max-age=86400`;
          } catch {}
          return res.token;
        }
        return undefined;
      } catch {
        // Not signed in or issuance failed — privileged calls will be rejected.
        return undefined;
      } finally {
        issuingNow = false;
        inflightIssuance = null;
      }
    })();
  }
  return inflightIssuance;
}
