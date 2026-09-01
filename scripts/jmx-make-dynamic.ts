// Transforms the recorded Login-10.jmx into a data-driven plan:
//   1. Replaces hardcoded filter VALUES in the TanStack server-fn bodies with
//      ${user_id} / ${user_email} / ${appt_date} (fed by the CSV Data Set).
//   2. Replaces fixed `limit` numbers ("s":5 / "s":6) with ${__Random(5,40)}.
//   3. Injects a CSV Data Set Config as the first child of the Thread Group.
//
// The server-fn body uses TanStack's seroval encoding, where:
//   - string value  -> {"t":1,"s":"<value>"}   (XML-encoded as &quot;t&quot;:1,&quot;s&quot;:&quot;<value>&quot;)
//   - number value  -> {"t":0,"s":<n>}          (limit / offset)
//   - boolean true  -> {"t":2,"s":2}, false -> {"t":2,"s":3}
// So a string replacement of the encoded literal is safe; numbers are targeted
// with the "t":0 prefix to avoid clashing with booleans.
//
// Run:  bun scripts/jmx-make-dynamic.ts
// Output: Login-10-dynamic.jmx (original is left untouched).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(homedir(), "Documents", "Login-10.jmx");
const OUT = join(homedir(), "Documents", "Login-10-dynamic.jmx");
const CSV_PATH = join(__dirname, "..", "test-data", "jmeter-ids.csv");

function transform(xml: string): string {
  let out = xml;

  // 1) filter value literals -> CSV variables
  out = out.replaceAll('&quot;admin@sugbodoc.ph&quot;', '&quot;${user_email}&quot;');
  out = out.replaceAll('&quot;user-admin-main&quot;', '&quot;${user_id}&quot;');
  out = out.replaceAll('&quot;2026-08-27&quot;', '&quot;${appt_date}&quot;');

  // 2) fixed numeric limits ("t":0,"s":5} / "t":0,"s":6}) -> random
  out = out.replaceAll('&quot;t&quot;:0,&quot;s&quot;:5}', '&quot;t&quot;:0,&quot;s&quot;:${__Random(5,40)}}');
  out = out.replaceAll('&quot;t&quot;:0,&quot;s&quot;:6}', '&quot;t&quot;:0,&quot;s&quot;:${__Random(5,40)}}');

  // 3) inject CSV Data Set Config as first child of the Thread Group
  const csvBlock = `        <CSVDataSet guiclass="TestBeanGUI" testclass="CSVDataSet" testname="CSV Data Set Config">
          <stringProp name="delimiter">,</stringProp>
          <stringProp name="fileEncoding"></stringProp>
          <stringProp name="filename">${CSV_PATH}</stringProp>
          <boolProp name="ignoreFirstLine">true</boolProp>
          <boolProp name="quotedData">false</boolProp>
          <boolProp name="recycle">true</boolProp>
          <stringProp name="shareMode">shareMode.all</stringProp>
          <boolProp name="stopThread">false</boolProp>
          <stringProp name="variableNames">user_id,user_email,appt_date</stringProp>
        </CSVDataSet>
        <hashTree/>
`;
  const marker = '\n        <TransactionController guiclass="TransactionControllerGui"';
  if (!out.includes(marker)) throw new Error("TransactionController marker not found");
  out = out.replace(marker, "\n" + csvBlock + marker);

  return out;
}

const xml = readFileSync(SRC, "utf8");
const result = transform(xml);
writeFileSync(OUT, result);

// quick sanity report
const count = (s: string) => (result.match(new RegExp(s, "g")) ?? []).length;
console.log(`[jmx-make-dynamic] wrote ${OUT}`);
console.log(`  user_id refs     : ${count("\\\\$\\{user_id\\}")}`);
console.log(`  user_email refs  : ${count("\\\\$\\{user_email\\}")}`);
console.log(`  appt_date refs   : ${count("\\\\$\\{appt_date\\}")}`);
console.log(`  __Random(limits) : ${count("__Random\\\\(5,40\\\\)")}`);
console.log(`  CSVDataSet added : ${result.includes("CSV Data Set Config")}`);
console.log(`  leftover user-admin-main : ${count("user-admin-main")}`);
console.log(`  leftover admin@sugbodoc.ph: ${count("admin@sugbodoc.ph")}`);
console.log(`  leftover 2026-08-27      : ${count("2026-08-27")}`);
