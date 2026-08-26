import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleStripeWebhookRequest } from "./lib/stripe-api";
import {
  getInfobipConfig,
  testInfobipConnection,
  sendInfobipSmsDirect,
  normalizeToE164,
} from "./lib/infobip-api";
import { requireRoleFromRequest } from "./lib/session-auth";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (
        request.method === "POST" &&
        (url.pathname === "/api/stripe/webhook" ||
          url.pathname === "/api/webhook/stripe" ||
          url.pathname === "/api/webhooks/stripe")
      ) {
        return await handleStripeWebhookRequest(request);
      }

      // ── SMS (Infobip) routes: staff-only (admin/doctor), verified via the
      // HMAC-signed session token. Patients are receive-only.
      if (url.pathname === "/api/sms/status" && request.method === "GET") {
        const denied = await requireRoleFromRequest(request, ["admin", "doctor"]);
        if (!denied.ok) {
          return new Response(JSON.stringify({ success: false, error: denied.error }), {
            status: denied.status,
            headers: { "content-type": "application/json" },
          });
        }
        const config = getInfobipConfig();
        return new Response(JSON.stringify(config), {
          headers: { "content-type": "application/json" },
        });
      }

      if (
        url.pathname === "/api/sms/test" &&
        (request.method === "GET" || request.method === "POST")
      ) {
        const denied = await requireRoleFromRequest(request, ["admin"]);
        if (!denied.ok) {
          return new Response(JSON.stringify({ connected: false, error: denied.error }), {
            status: denied.status,
            headers: { "content-type": "application/json" },
          });
        }
        const testRes = await testInfobipConnection();
        return new Response(JSON.stringify(testRes), {
          headers: { "content-type": "application/json" },
        });
      }

      if (url.pathname === "/api/sms/send-sms" && request.method === "POST") {
        const denied = await requireRoleFromRequest(request, ["admin", "doctor"]);
        if (!denied.ok) {
          return new Response(JSON.stringify({ success: false, error: denied.error }), {
            status: denied.status,
            headers: { "content-type": "application/json" },
          });
        }
        try {
          const body = await request.json();
          if (!body || typeof body.to !== "string" || typeof body.body !== "string") {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Body must be JSON with string fields "to" and "body".',
              }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          }
          const normalizedTo = normalizeToE164(body.to);
          if (!normalizedTo) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `"${body.to}" is not a valid phone number (E.164 expected).`,
              }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          }
          const result = await sendInfobipSmsDirect({ to: normalizedTo, body: body.body });
          return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 400,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({
              success: false,
              error: e instanceof Error ? e.message : "Invalid JSON body",
            }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          );
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
