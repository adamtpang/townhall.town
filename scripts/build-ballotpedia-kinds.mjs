// Builds lib/towny/ballotpediaKinds.gen.json from Civic's positions files (data/civic/positions_*.json).
// Civic review (Oct 30, 1:37 PM CT): a Ballotpedia stance is kept only when it is
//   (a) a Candidate Connection survey answer, or (b) campaign-site text Ballotpedia says it copied.
// Civic marks these in each record's note / sourceTitle / sourceType. Anything else from ballotpedia.org is unsure.
// Key: the quote, normalized with qkey() (same function as lib/towny/stanceRules.ts).
import fs from "node:fs";
import path from "node:path";

const qkey = (s) => String(s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const SURVEY = /candidate connection/i; // "candidate survey" alone does not say it is Candidate Connection
const COPIED = /campaign (web ?site|site) text (quoted|copied) verbatim by ballotpedia|copied from (the|his|her|their) campaign (web ?site|site)/i;

const dir = "data/civic";
const out = {};
for (const f of fs.readdirSync(dir).filter((x) => /^positions_.*\.json$/.test(x)).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    if (typeof o.sourceUrl === "string" && /ballotpedia\.org/i.test(o.sourceUrl) && typeof o.quote === "string" && o.quote.trim()) {
      const marks = [o.note, o.sourceTitle, o.sourceType].filter((x) => typeof x === "string").join(" | ");
      const kind = SURVEY.test(marks) ? "survey" : COPIED.test(marks) ? "campaign" : null;
      if (kind) out[qkey(o.quote)] = { kind, file: f, mark: marks };
    }
    Object.values(o).forEach(walk);
  };
  walk(d);
}
const file = "lib/towny/ballotpediaKinds.gen.json";
fs.writeFileSync(file, JSON.stringify({ built: "scripts/build-ballotpedia-kinds.mjs from data/civic/positions_*.json", byQuote: out }, null, 1) + "\n");
console.log(`${Object.keys(out).length} marked Ballotpedia quotes -> ${file}`);
