import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { createHash } from "crypto";
import { handleStripeWebhookRequest } from "./lib/stripe-api";

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

      // Decode server fn identifier for observability/logging
      let serverFnName: string | null = null
      const serverFnPathMatch = url.pathname.match(/_serverFn\/(.+)/)
      if (serverFnPathMatch) {
        try {
          const decoded = JSON.parse(atob(serverFnPathMatch[1]))
          const fileBase = decoded.file
            ? decoded.file.split("?").shift().replace("/src/lib/", "").replace(".ts", "")
            : "unknown"
          serverFnName = fileBase + "/" + (decoded.export || "unknown")
        } catch {
          serverFnName = "decode-error"
        }
      }
      if (serverFnName) {
        console.info("[ServerFn]", serverFnName, "method=", request.method, "path=", url.pathname)
      }

      // For dbQueryServerFn: clone request to extract identifying fields
      // without consuming the original stream before framework parsing.
      const isSqlRpc = serverFnName === "db/sql-rpc/dbQueryServerFn";
      let clonedRequest: Request | null = null;
      let detailHeader = "";
      if (isSqlRpc && request.method === "POST") {
        clonedRequest = request.clone();
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx)

      // Extract identifying query details from cloned request (original stream intact)
      if (clonedRequest && response) {
        try {
          const cloneBody = await clonedRequest.json();
          // Framework sends payload as { data: QuerySpec, ... }
          const querySpec = cloneBody?.data ?? cloneBody;
          const tableName = querySpec?.table || "unknown";
          const filters = Array.isArray(querySpec?.filters) ? querySpec.filters : [];
          const filterKeys = filters
            .map((f: unknown) => (f && typeof f === "object" && (f as any).col) ? (f as any).col : null)
            .filter((v: unknown) => typeof v === "string")
            .join(",");
          // Hash only filter VALUES (not keys) for uniqueness; never include raw PII in header
          let valueHash = "";
          if (filters.length > 0) {
            const valueStr = filters
              .map((f: unknown) => ((f && typeof f === "object" && (f as any).value !== undefined) ? String((f as any).value) : ""))
              .join("|");
            if (valueStr) {
              valueHash = createHash("sha256").update(valueStr).digest("hex").slice(0, 8);
            }
          }
          const parts: string[] = [`table=${tableName}`];
          if (filterKeys) parts.push(`filters=${filterKeys}`);
          if (valueHash) parts.push(`hash=${valueHash}`);
          detailHeader = parts.join(";");
        } catch {
          // Intentionally ignore parse failures — never break response for observability
        }
      }

      if (serverFnName && response) {
        response.headers.set("X-Server-Fn-Name", serverFnName)
      }
      if (detailHeader && response) {
        response.headers.set("X-Server-Fn-Detail", detailHeader)
      }
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
