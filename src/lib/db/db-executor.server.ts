// SERVER-ONLY: compiles a serialized QuerySpec into parameterized PostgreSQL via postgres.js.
// Never import this module from client code — it is loaded exclusively inside server functions.
//
// Values are ALWAYS bound as numbered parameters; identifiers are only ever emitted
// after being validated against the live information_schema column whitelist.
// Rule of thumb: one SqlBuf instance per SQL statement (its text and params travel together).

import postgres from "postgres";
import type { QuerySpec, DbQueryResult } from "./query-spec";

const DATABASE_URL = process.env.DATABASE_URL || "";

let client: any = null;

function getClient(): any {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Set it in .env (server-side only).");
  }
  if (!client) {
    client = postgres(DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      // Forwarded to Postgres as server startup params: never let a wedged
      // Postgres hang a server function indefinitely — fail fast instead.
      ...({
        statement_timeout: 10_000,
        idle_in_transaction_session_timeout: 15_000,
      } as Record<string, number>),
      onnotice: () => {},
    });
  }
  return client;
}

type ColInfo = { name: string; dataType: string };

const columnsCache = new Map<string, ColInfo[]>();

async function getColumns(sql: any, table: string): Promise<ColInfo[]> {
  const cached = columnsCache.get(table);
  if (cached) return cached;
  const rows = await sql`
    SELECT column_name AS name, data_type AS "dataType"
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `;
  const cols = rows as unknown as ColInfo[];
  columnsCache.set(table, cols);
  return cols;
}

async function requireColumns(sql: any, table: string): Promise<ColInfo[]> {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  const cols = await getColumns(sql, table);
  if (!cols.length) throw new Error(`Unknown table: ${table}`);
  return cols;
}

// ---------- tiny SQL text builder ----------

class SqlBuf {
  text = "";
  params: any[] = [];

  param(value: any): string {
    this.params.push(value === undefined ? null : value);
    return `$${this.params.length}`;
  }

  id(name: string): string {
    return '"' + String(name).replace(/"/g, '""') + '"';
  }
}

function qualifiedTable(table: string): string {
  return `public."${table.replace(/"/g, '""')}"`;
}

type ExecFn = (text: string, params?: any[]) => Promise<any[]>;

// ---------- select list ----------

// The in-memory engine never projected plain fields (it returned whole rows),
// so we always select every column; date columns are cast to text so callers
// receive the same plain "YYYY-MM-DD" strings the emulator produced.
function selectList(cols: ColInfo[]): string {
  return cols
    .map((c) => {
      const id = `"${c.name}"`;
      return c.dataType === "date" ? `${id}::text AS ${id}` : id;
    })
    .join(", ");
}

// ---------- filters ----------

type SimpleFilter = { col: string; op: string; value: any };

function compileFilter(sb: SqlBuf, colInfo: ColInfo[], f: SimpleFilter): string | null {
  const col = colInfo.find((c) => c.name === f.col);
  if (!col) return null;
  const id = sb.id(f.col);

  switch (f.op) {
    case "eq":
    case "is":
      if (f.value === null) return `${id} IS NULL`;
      return `${id} = ${sb.param(f.value)}`;
    case "neq":
      return `${id} <> ${sb.param(f.value)}`;
    case "gt":
      return `${id} > ${sb.param(f.value)}`;
    case "gte":
      return `${id} >= ${sb.param(f.value)}`;
    case "lt":
      return `${id} < ${sb.param(f.value)}`;
    case "lte":
      return `${id} <= ${sb.param(f.value)}`;
    case "like":
      return `${id} LIKE ${sb.param(String(f.value))}`;
    case "ilike": {
      const clean = String(f.value).replace(/^%|%$/g, "");
      return `${id} ILIKE ('%' || ${sb.param(clean)} || '%')`;
    }
    case "in": {
      const values = Array.isArray(f.value) ? f.value : [f.value];
      return `${id} = ANY(${sb.param(values)})`;
    }
    case "contains": {
      if (col.dataType === "jsonb") {
        const json = JSON.stringify(Array.isArray(f.value) ? f.value : [f.value]);
        return `${id} @> ${sb.param(json)}::jsonb`;
      }
      const arr = Array.isArray(f.value) ? f.value : [f.value];
      return `${id} @> ${sb.param(arr)}::text[]`;
    }
    default:
      return null;
  }
}

// Parses "col.op.value" clauses (comma-separated) the way Supabase .or() does.
function compileOrGroup(sb: SqlBuf, colInfo: ColInfo[], condition: string): string | null {
  const clauses = condition
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (!clauses.length) return null;

  const parts: string[] = [];
  for (const clause of clauses) {
    const dot1 = clause.indexOf(".");
    const dot2 = dot1 >= 0 ? clause.indexOf(".", dot1 + 1) : -1;
    if (dot1 < 0 || dot2 < 0) continue;
    const col = clause.slice(0, dot1);
    const op = clause.slice(dot1 + 1, dot2);
    const value = clause.slice(dot2 + 1);
    if (!colInfo.some((c) => c.name === col)) continue;
    const id = sb.id(col);
    switch (op) {
      case "eq":
        parts.push(`${id} = ${sb.param(value)}`);
        break;
      case "neq":
        parts.push(`${id} <> ${sb.param(value)}`);
        break;
      case "gt":
        parts.push(`${id} > ${sb.param(value)}`);
        break;
      case "gte":
        parts.push(`${id} >= ${sb.param(value)}`);
        break;
      case "lt":
        parts.push(`${id} < ${sb.param(value)}`);
        break;
      case "lte":
        parts.push(`${id} <= ${sb.param(value)}`);
        break;
      case "ilike": {
        const clean = value.replace(/^%|%$/g, "");
        parts.push(`${id} ILIKE ('%' || ${sb.param(clean)} || '%')`);
        break;
      }
      default:
        break;
    }
  }
  return parts.length ? `(${parts.join(" OR ")})` : null;
}

function buildWhereSql(sb: SqlBuf, colInfo: ColInfo[], spec: QuerySpec): string {
  const parts: string[] = [];
  for (const f of spec.filters ?? []) {
    const compiled = compileFilter(sb, colInfo, f);
    if (compiled) parts.push(compiled);
  }
  for (const g of spec.orGroups ?? []) {
    const compiled = compileOrGroup(sb, colInfo, g);
    if (compiled) parts.push(compiled);
  }
  return parts.length ? ` WHERE ${parts.join(" AND ")}` : "";
}

// ---------- embeds (relation hydration) ----------

type EmbedField = { rel: "profiles" | "doctors" | "order_items"; fields: string[] | null };

function parseEmbeds(selectStr?: string): EmbedField[] {
  if (!selectStr) return [];
  const embeds: EmbedField[] = [];
  const re = /(profiles|doctors|order_items)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(selectStr))) {
    const inner = m[2].trim();
    embeds.push({
      rel: m[1] as EmbedField["rel"],
      fields:
        !inner || inner === "*"
          ? null
          : inner
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
    });
  }
  return embeds;
}

function pickFields(row: any, fields: string[] | null): any {
  if (!fields) return row;
  const out: any = {};
  for (const f of fields) out[f] = row?.[f] ?? null;
  return out;
}

async function fetchByIds(
  sql: any,
  table: "profiles" | "doctors" | "order_items",
  cols: ColInfo[],
  ids: string[],
  idColumn: string,
): Promise<any[]> {
  if (!ids.length) return [];
  return sql.unsafe(
    `SELECT ${selectList(cols)} FROM public."${table}" WHERE "${idColumn}" = ANY($1)`,
    [ids],
  );
}

async function hydrateEmbeds(sql: any, rows: any[], embeds: EmbedField[]): Promise<any[]> {
  if (!embeds.length || !rows.length) return rows;

  const wants = new Set(embeds.map((e) => e.rel));
  const result = rows.map((r) => ({ ...r }));

  if (wants.has("profiles")) {
    const cols = await requireColumns(sql, "profiles");
    const ids = [...new Set(result.map((r) => r.patient_id || r.user_id || r.id).filter(Boolean))];
    const found = await fetchByIds(sql, "profiles", cols, ids, "id");
    const byId = new Map(found.map((p: any) => [p.id, p]));
    for (const e of embeds.filter((e) => e.rel === "profiles")) {
      for (const r of result) {
        const key = r.patient_id || r.user_id || r.id;
        const profile = byId.get(key) ?? null;
        r.profiles = profile
          ? pickFields(profile, e.fields)
          : e.fields?.includes("name")
            ? { name: "Patient" }
            : null;
      }
    }
  }

  if (wants.has("doctors")) {
    const cols = await requireColumns(sql, "doctors");
    const ids = [...new Set(result.map((r) => r.doctor_id).filter(Boolean))];
    const found = await fetchByIds(sql, "doctors", cols, ids, "id");
    const byId = new Map(found.map((d: any) => [d.id, d]));
    for (const e of embeds.filter((e) => e.rel === "doctors")) {
      for (const r of result) {
        const doctor = byId.get(r.doctor_id) ?? null;
        r.doctors = doctor ? pickFields(doctor, e.fields) : null;
      }
    }
  }

  if (wants.has("order_items")) {
    const cols = await requireColumns(sql, "order_items");
    const ids = [...new Set(result.map((r) => r.id).filter(Boolean))];
    const items = await fetchByIds(sql, "order_items", cols, ids, "order_id");
    const grouped = new Map<string, any[]>();
    for (const item of items) {
      const list = grouped.get(item.order_id) ?? [];
      list.push(item);
      grouped.set(item.order_id, list);
    }
    for (const r of result) {
      r.order_items = grouped.get(r.id) ?? [];
    }
  }

  return result;
}

// ---------- writes ----------

function payloadEntries(cols: ColInfo[], payload: Record<string, any>): [string, any][] {
  return Object.entries(payload ?? {}).filter(
    ([k, v]) => cols.some((c) => c.name === k) && v !== undefined,
  );
}

async function insertRow(
  exec: ExecFn,
  table: string,
  cols: ColInfo[],
  row: Record<string, any>,
): Promise<any | null> {
  const entries = payloadEntries(cols, row);
  if (!entries.length) return null;

  const sb = new SqlBuf();
  const colList = entries.map(([k]) => sb.id(k)).join(", ");
  const values = entries.map(([, v]) => sb.param(v));
  const inserted = await exec(
    `INSERT INTO ${qualifiedTable(table)} (${colList}) VALUES (${values.join(", ")}) RETURNING ${selectList(cols)}`,
    sb.params,
  );
  return inserted[0] ?? null;
}

function setClause(sb: SqlBuf, cols: ColInfo[], payload: Record<string, any>): string | null {
  const entries = payloadEntries(cols, payload);
  const sets: string[] = entries.map(([k, v]) => `${sb.id(k)} = ${sb.param(v)}`);
  const hasUpdatedAt = cols.some((c) => c.name === "updated_at");
  if (hasUpdatedAt && !entries.some(([k]) => k === "updated_at")) {
    sets.push("updated_at = now()");
  }
  return sets.length ? ` SET ${sets.join(", ")}` : null;
}

// Mirrors the emulated upsert: match on an explicit onConflict target, then id,
// then (user_id, role), then order_no, then invoice_no — updating existing rows
// and inserting the rest, without requiring unique indexes. Each statement gets
// its own SqlBuf so parameter numbering always starts at $1.
async function executeUpsert(
  sql: any,
  spec: QuerySpec,
  cols: ColInfo[],
  embeds: EmbedField[],
): Promise<DbQueryResult> {
  const rowsToUpsert = (Array.isArray(spec.values) ? spec.values : [spec.values]) as Record<
    string,
    any
  >[];
  const out: any[] = [];

  await sql.begin(async (tx: any) => {
    const exec: ExecFn = (text, params) => tx.unsafe(text, params);

    for (const row of rowsToUpsert) {
      const match = buildUpsertMatch(spec, cols, row);
      const existingRow = match
        ? await exec(
            `SELECT ${selectList(cols)} FROM ${qualifiedTable(spec.table)} WHERE ${match.whereSql} LIMIT 1`,
            match.sb.params,
          )
        : [];
      const existing = existingRow[0] ?? null;

      if (existing) {
        const sb = new SqlBuf();
        const sets = setClause(sb, cols, row);
        if (sets) {
          const updated = await exec(
            `UPDATE ${qualifiedTable(spec.table)}${sets} WHERE id = ${sb.param(existing.id)} RETURNING ${selectList(cols)}`,
            sb.params,
          );
          if (updated[0]) out.push(updated[0]);
        }
      } else {
        const inserted = await insertRow(exec, spec.table, cols, row);
        if (inserted) out.push(inserted);
      }
    }
  });

  const hydrated = await hydrateEmbeds(sql, out, embeds);
  return { data: Array.isArray(spec.values) ? hydrated : (hydrated[0] ?? null), error: null };
}

function buildUpsertMatch(
  spec: QuerySpec,
  cols: ColInfo[],
  row: Record<string, any>,
): { whereSql: string; sb: SqlBuf } | null {
  if (spec.onConflict) {
    const target = spec.onConflict
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (target.length && target.every((c) => cols.some((x) => x.name === c))) {
      const sb = new SqlBuf();
      return {
        whereSql: target
          .map((c) =>
            row[c] === undefined ? `${sb.id(c)} IS NULL` : `${sb.id(c)} = ${sb.param(row[c])}`,
          )
          .join(" AND "),
        sb,
      };
    }
  }
  if (row.id != null) {
    const sb = new SqlBuf();
    return { whereSql: `id = ${sb.param(row.id)}`, sb };
  }
  if (row.user_id != null && row.role != null) {
    const sb = new SqlBuf();
    return { whereSql: `user_id = ${sb.param(row.user_id)} AND role = ${sb.param(row.role)}`, sb };
  }
  if (row.order_no != null) {
    const sb = new SqlBuf();
    return { whereSql: `order_no = ${sb.param(row.order_no)}`, sb };
  }
  if (row.invoice_no != null) {
    const sb = new SqlBuf();
    return { whereSql: `invoice_no = ${sb.param(row.invoice_no)}`, sb };
  }
  return null;
}

// ---------- executor ----------

export async function executeQuerySpec(spec: QuerySpec): Promise<DbQueryResult> {
  const t0 = Date.now();
  console.debug(`[auth-debug] server: executeQuerySpec start ${spec.op} ${spec.table}`);
  try {
    const sql = getClient();
    const cols = await requireColumns(sql, spec.table);
    const embeds = parseEmbeds(spec.select);

    if (spec.op === "select") {
      let count: number | null = null;
      if (spec.count || spec.head) {
        const sb = new SqlBuf();
        const whereSql = buildWhereSql(sb, cols, spec);
        const counted = await sql.unsafe(
          `SELECT count(*)::int AS total FROM ${qualifiedTable(spec.table)}${whereSql}`,
          sb.params,
        );
        count = Number(counted[0]?.total ?? 0);
      }

      if (spec.head) {
        return { data: null, error: null, count };
      }

      const sb = new SqlBuf();
      const whereSql = buildWhereSql(sb, cols, spec);

      let orderSql = "";
      if (spec.order?.length) {
        const valid = spec.order.filter((o) => cols.some((c) => c.name === o.col));
        if (valid.length) {
          orderSql =
            " ORDER BY " +
            valid.map((o) => `${sb.id(o.col)} ${o.asc ? "ASC" : "DESC"} NULLS LAST`).join(", ");
        }
      }

      let limitSql = "";
      if (spec.limit !== undefined) limitSql += ` LIMIT ${Number(spec.limit)}`;
      if (spec.offset !== undefined) limitSql += ` OFFSET ${Number(spec.offset)}`;

      const rows = (await sql.unsafe(
        `SELECT ${selectList(cols)} FROM ${qualifiedTable(spec.table)}${whereSql}${orderSql}${limitSql}`,
        sb.params,
      )) as any[];

      const hydrated = await hydrateEmbeds(sql, rows, embeds);

      if (spec.single) {
        if (!hydrated.length) {
          return { data: null, error: { message: "Row not found", code: "PGRST116" }, count };
        }
        return { data: hydrated[0], error: null, count };
      }
      if (spec.maybeSingle) {
        return { data: hydrated[0] ?? null, error: null, count };
      }
      return { data: hydrated, error: null, count };
    }

    if (spec.op === "insert") {
      const payload = (Array.isArray(spec.values) ? spec.values : [spec.values]) as Record<
        string,
        any
      >[];
      const inserted: any[] = [];
      await sql.begin(async (tx: any) => {
        const exec: ExecFn = (text, params) => tx.unsafe(text, params);
        for (const row of payload) {
          const one = await insertRow(exec, spec.table, cols, row);
          if (one) inserted.push(one);
        }
      });
      const hydrated = await hydrateEmbeds(sql, inserted, embeds);
      return { data: Array.isArray(spec.values) ? hydrated : (hydrated[0] ?? null), error: null };
    }

    if (spec.op === "update") {
      const sb = new SqlBuf();
      const sets = setClause(sb, cols, (spec.values ?? {}) as Record<string, any>);
      const whereSql = buildWhereSql(sb, cols, spec);
      if (!sets) {
        const unchanged = (await sql.unsafe(
          `SELECT ${selectList(cols)} FROM ${qualifiedTable(spec.table)}${whereSql}`,
          sb.params,
        )) as any[];
        const hydratedUnchanged = await hydrateEmbeds(sql, unchanged, embeds);
        if (spec.single || spec.maybeSingle) {
          return { data: hydratedUnchanged[0] ?? null, error: null };
        }
        return { data: hydratedUnchanged, error: null };
      }
      const updated = (await sql.unsafe(
        `UPDATE ${qualifiedTable(spec.table)}${sets}${whereSql} RETURNING ${selectList(cols)}`,
        sb.params,
      )) as any[];
      const hydrated = await hydrateEmbeds(sql, updated, embeds);
      if (spec.single || spec.maybeSingle) {
        return { data: hydrated[0] ?? null, error: null };
      }
      return { data: hydrated, error: null };
    }

    if (spec.op === "delete") {
      const sb = new SqlBuf();
      const whereSql = buildWhereSql(sb, cols, spec);
      await sql.unsafe(`DELETE FROM ${qualifiedTable(spec.table)}${whereSql}`, sb.params);
      return { data: null, error: null };
    }

    if (spec.op === "upsert") {
      return await executeUpsert(sql, spec, cols, embeds);
    }

    return { data: null, error: { message: `Unsupported operation: ${spec.op}` } };
  } catch (err: any) {
    return {
      data: null,
      error: { message: err?.message || "SQL operation failed" },
    };
  } finally {
    console.debug(
      `[auth-debug] server: executeQuerySpec end ${spec.op} ${spec.table} in ${Date.now() - t0}ms`,
    );
  }
}
