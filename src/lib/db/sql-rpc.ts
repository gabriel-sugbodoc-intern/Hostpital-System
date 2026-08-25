// RPC bridge for database queries.
//
// This module is CLIENT-SAFE: it only exports a TanStack Start server function,
// whose handler is stripped from client bundles by the compiler. The client-side
// query builder (sql-db.ts) calls it like a normal async function and TanStack
// transparently turns the call into an HTTP RPC.
//
// The actual PostgreSQL driver lives in db-executor.server.ts — a `.server.ts`
// module that is never imported by client code (it is loaded lazily inside the
// handler below, which only exists on the server).

import { createServerFn } from "@tanstack/react-start";
import type { DbQueryResult, QuerySpec } from "./query-spec";

export const dbQueryServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as QuerySpec)
  .handler(async ({ data }): Promise<DbQueryResult> => {
    const { executeQuerySpec } = await import("./db-executor.server");
    return executeQuerySpec(data);
  });
