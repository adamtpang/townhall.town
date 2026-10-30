// Builds lib/civicChecks.gen.json from two Civic files, if present (Oct 30, 1:54 PM CT):
//   --order <path>  ballot_order_check.json          (default data/civic/ballot_order_check.json)
//   --audit <path>  ballotpedia_stance_audit.json    (default data/civic/bp22/ballotpedia_stance_audit.json)
// A missing file is fine: its section is written empty and the app keeps its current behavior.
// Usage: node scripts/build-civic-checks.mjs [--order path] [--audit path]
import fs from "node:fs";
import { parseOrderCheck, parseStanceAudit } from "../lib/civicChecks.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const orderPath = arg("--order", "data/civic/ballot_order_check.json");
const auditPath = arg("--audit", "data/civic/bp22/ballotpedia_stance_audit.json");
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { if (e.code !== "ENOENT") console.warn(`${p}: ${e.message}`); return null; } };
const order = read(orderPath), audit = read(auditPath);
const out = {
  built: "scripts/build-civic-checks.mjs",
  orderFile: order ? orderPath : null,
  auditFile: audit ? auditPath : null,
  ballotOrder: parseOrderCheck(order),
  stanceAudit: parseStanceAudit(audit),
};
fs.writeFileSync("lib/civicChecks.gen.json", JSON.stringify(out, null, 1) + "\n");
console.log(`ballot order: ${order ? orderPath : "missing"} (${Object.keys(out.ballotOrder.byRace).length} races); audit: ${audit ? auditPath : "missing"} (${out.stanceAudit.records.length} records)`);
