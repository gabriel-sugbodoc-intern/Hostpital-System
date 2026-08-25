// Seeds the local sugbodoc PostgreSQL database with the app's demo data.
// Run with: bun scripts/seed.ts

import postgres from "postgres";
import {
  DEFAULT_STORE_BRANCHES,
  DEFAULT_STORE_PRODUCTS,
  DEFAULT_DOCTORS,
  DEFAULT_INSURANCE_PLANS,
  DEFAULT_PROFILES,
  DEFAULT_USER_ROLES,
  DEFAULT_INSURANCE_POLICIES,
  DEFAULT_APPOINTMENTS,
  DEFAULT_ENCOUNTERS,
  DEFAULT_SOAP_NOTES,
  DEFAULT_VITAL_SIGNS,
  DEFAULT_ENCOUNTER_DIAGNOSES,
  DEFAULT_PRESCRIPTIONS,
  DEFAULT_LAB_RESULTS,
  DEFAULT_IMAGING_RECORDS,
  DEFAULT_BILLS,
  DEFAULT_PAYMENTS,
  DEFAULT_ORDERS,
  DEFAULT_ORDER_ITEMS,
  DEFAULT_MESSAGES,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_QUEUE_ENTRIES,
} from "../src/lib/db/seed-data";

const DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env first.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

type Table = string;
type Row = Record<string, any>;

const TABLES: Array<[Table, Row[]]> = [
  ["store_branches", DEFAULT_STORE_BRANCHES],
  ["products", DEFAULT_STORE_PRODUCTS],
  ["doctors", DEFAULT_DOCTORS],
  ["insurance_plans", DEFAULT_INSURANCE_PLANS],
  ["profiles", DEFAULT_PROFILES],
  ["user_roles", DEFAULT_USER_ROLES],
  ["insurance_policies", DEFAULT_INSURANCE_POLICIES],
  ["appointments", DEFAULT_APPOINTMENTS],
  ["encounters", DEFAULT_ENCOUNTERS],
  ["soap_notes", DEFAULT_SOAP_NOTES],
  ["vital_signs", DEFAULT_VITAL_SIGNS],
  ["encounter_diagnoses", DEFAULT_ENCOUNTER_DIAGNOSES],
  ["prescriptions", DEFAULT_PRESCRIPTIONS],
  ["lab_results", DEFAULT_LAB_RESULTS],
  ["imaging_records", DEFAULT_IMAGING_RECORDS],
  ["bills", DEFAULT_BILLS],
  ["payments", DEFAULT_PAYMENTS],
  ["orders", DEFAULT_ORDERS],
  ["order_items", DEFAULT_ORDER_ITEMS],
  ["messages", DEFAULT_MESSAGES],
  ["notifications", DEFAULT_NOTIFICATIONS],
  ["queue_entries", DEFAULT_QUEUE_ENTRIES],
];

async function tableColumns(table: Table): Promise<Set<string>> {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
  return new Set(cols.map((c: any) => c.column_name));
}

async function main() {
  console.log("Seeding sugbodoc database...");

  const RESET_TABLES = [
    "procedures",
    "order_items",
    "orders",
    "payments",
    "bills",
    "imaging_records",
    "lab_results",
    "prescriptions",
    "encounter_diagnoses",
    "vital_signs",
    "soap_notes",
    "encounters",
    "appointments",
    "insurance_policies",
    "user_roles",
    "profiles",
    "insurance_plans",
    "doctors",
    "products",
    "store_branches",
    "messages",
    "notifications",
    "queue_entries",
  ];
  // Table names are hardcoded constants above — no user input involved.
  await sql.unsafe(`TRUNCATE TABLE ${RESET_TABLES.map((t) => `public."${t}"`).join(", ")} CASCADE`);

  for (const [table, rows] of TABLES) {
    if (!rows.length) continue;
    const cols = await tableColumns(table);
    for (const row of rows) {
      // Column names are filtered against the live schema whitelist; values are bound as parameters.
      const entries = Object.entries(row).filter(([k]) => cols.has(k));
      const colList = entries.map(([k]) => `"${k}"`).join(", ");
      const params: any[] = [];
      const values = entries.map(([, v]) => `$${params.push(v)}`);
      await sql.unsafe(
        `INSERT INTO public."${table}" (${colList}) VALUES (${values.join(", ")})`,
        params,
      );
    }
    console.log(`  ${table}: ${rows.length} rows`);
  }

  await sql.end();
  console.log("Done.");
}

main().catch(async (err) => {
  console.error("Seed failed:", err?.message ?? err);
  await sql.end();
  process.exit(1);
});
