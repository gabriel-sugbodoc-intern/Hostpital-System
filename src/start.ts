import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSqlAuth } from "@/lib/auth-attacher";
import { extractTokenFromRequest, verifySessionToken } from "@/lib/session-auth";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Verifies the HMAC-signed session token (if present) on every request and
// exposes it to server functions as ctx.context.authSession. Privileged
// endpoints (e.g. Infobip SMS) assert role against this — the raw localStorage
// token is never trusted.
const signedSessionMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => {
    const session = await verifySessionToken(extractTokenFromRequest(request));
    const result = await next({ context: { authSession: session ?? null } });
    return result;
  },
);

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSqlAuth],
  requestMiddleware: [errorMiddleware, signedSessionMiddleware, csrfMiddleware],
}));
