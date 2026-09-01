// Generates test-data/jmeter-ids.csv with REAL varying values pulled from the
// local Docker Postgres (DATABASE_URL in .env). Falls back to the app's seed
// values if the DB is unreachable so the JMeter plan is runnable immediately.
//
// Columns: user_id,user_email,appt_date
//   - user_id / user_email come from the `profiles` table (used by the
//     id / email / user_id filters in the recorded dbQueryServerFn bodies).
//   - appt_date comes from the `appointments` table (used by the
//     appointment_date eq filter).
//
// Run:  bun scripts/gen-jmeter-csv.ts
// Re-run after `docker` (Postgres) is up to refresh with live data.

import postgres from "postgres";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "test-data");
const OUT_FILE = join(OUT_DIR, "jmeter-ids.csv");

// ---- Seed-derived fallback (real values copied from src/lib/db/seed-data.ts) ----
const SEED_PROFILES: Array<[string, string]> = [
  ["user-admin-main", "admin@sugbodoc.ph"],
  ["user-doctor-maria", "dr.santos@sugbodoc.ph"],
  ["user-doctor-john", "dr.cruz@sugbodoc.ph"],
  ["user-doctor-angela", "dr.angela@sugbodoc.ph"],
  ["user-doctor-roberto", "dr.roberto@sugbodoc.ph"],
  ["user-doctor-elena", "dr.elena@sugbodoc.ph"],
  ["user-juan", "juan@example.com"],
];
const SEED_DATES = ["2026-08-20", "2026-08-28", "2026-08-27", "2026-09-01", "2026-09-10"];

const TARGET_ROWS = Number(process.env.JMETER_CSV_ROWS ?? 1000);

async function loadFromDb(): Promise<{ profiles: Array<[string, string]>; dates: string[] } | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  let sql: ReturnType<typeof postgres> | null = null;
  try {
    sql = postgres(url, { max: 1, idle_timeout: 2, connect_timeout: 3 });
    const profiles = await sql<{ id: string; email: string }[]>`
      SELECT id, email FROM profiles WHERE email IS NOT NULL
    `;
    const appts = await sql<{ appointment_date: string }[]>`
      SELECT appointment_date FROM appointments WHERE appointment_date IS NOT NULL
    `;
    await sql.end({ timeout: 1 });
    const profRows = profiles.map((p) => [p.id, p.email] as [string, string]);
    const dates = [
      ...new Set(
        appts.map((a) => {
          const d = a.appointment_date as unknown;
          const dt = d instanceof Date ? d : new Date(String(d));
          return Number.isNaN(dt.getTime()) ? String(d).slice(0, 10) : dt.toISOString().slice(0, 10);
        }),
      ),
    ];
    if (profRows.length === 0) return null;
    return { profiles: profRows, dates: dates.length ? dates : SEED_DATES };
  } catch (e) {
    console.warn("[gen-jmeter-csv] DB unreachable, using seed fallback:", (e as Error).message);
    if (sql) await sql.end({ timeout: 1 }).catch(() => {});
    return null;
  }
}

function buildCsv(profiles: Array<[string, string]>, dates: string[]): string {
  const rows: string[] = ["user_id,user_email,appt_date"];
  const n = Math.max(TARGET_ROWS, profiles.length);
  for (let i = 0; i < n; i++) {
    const [uid, email] = profiles[i % profiles.length];
    const date = dates[i % dates.length];
    rows.push(`${uid},${email},${date}`);
  }
  return rows.join("\n") + "\n";
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const db = await loadFromDb();
  const profiles = db?.profiles ?? SEED_PROFILES;
  const dates = db?.dates ?? SEED_DATES;
  const source = db ? "Docker Postgres" : "seed-data fallback";
  const csv = buildCsv(profiles, dates);
  writeFileSync(OUT_FILE, csv);
  console.log(`[gen-jmeter-csv] wrote ${OUT_FILE}`);
  console.log(`[gen-jmeter-csv] source=${source} rows=${profiles.length * 1}+ dates=${dates.length} -> file rows=${csv.split("\n").length - 2}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
