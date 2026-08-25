// Serializable query specification shared between the client-side builder and the
// server-side SQL executor. Mirrors the Supabase-style builder API used across the app.

export type QueryFilterOp =
  "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in" | "is" | "contains";

export type QueryFilter = {
  col: string;
  op: QueryFilterOp;
  value: unknown;
};

export type QuerySpec = {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  select?: string;
  count?: boolean;
  head?: boolean;
  filters?: QueryFilter[];
  orGroups?: string[];
  order?: Array<{ col: string; asc: boolean }>;
  limit?: number;
  offset?: number;
  single?: boolean;
  maybeSingle?: boolean;
  values?: unknown;
  onConflict?: string;
  ignoreDuplicates?: boolean;
};

export type DbQueryResult = {
  data: any;
  error: { message: string; code?: string } | null;
  count?: number | null;
};
