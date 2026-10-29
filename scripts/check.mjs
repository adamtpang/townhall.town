// Offline checks run before every preview: nonpartisan copy, sourced measure math, sourced plan dates.
import fs from "node:fs";
import path from "node:path";
let fail = 0;
const bad = (m) => { console.error("FAIL", m); fail++; };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of [...walk("app"), ...walk("lib"), ...walk("components")].filter((f) => /\.(tsx?|css)$/.test(f))) {
  const s = fs.readFileSync(f, "utf8");
  for (const re of [/\bvote for\b/i, /\bbest\b/i]) {
    // ignore code comments
    const lines = s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\bnever\b/i.test(l) && !/Don&rsquo;t know who to vote for\?/.test(l)); // instructions that forbid the phrase are fine
    // Only user-visible text: string literals and JSX text, not identifiers.
    const visible = (l) => [...l.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]).concat([...l.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])).join(" ");
    lines.forEach((l) => { if (re.test(visible(l))) bad(`${f}: banned phrase ${re} -> ${l.trim().slice(0, 120)}`); });
  }
}
const ms = JSON.parse(fs.readFileSync("data/measures.json", "utf8")).measures;
for (const m of ms) for (const k of ["cost", "whoPays", "whatChanges", "ifYes", "ifNo"]) {
  if (!m[k] && (k === "ifYes" || k === "ifNo")) continue;
  if (!/^https:\/\//.test(m[k]?.sourceUrl || "")) bad(`${m.id}.${k} has no https sourceUrl`);
  if (!(m[k]?.value || m[k]?.text)) bad(`${m.id}.${k} is empty`);
}
const b = JSON.parse(fs.readFileSync("data/ballots.json", "utf8"));
for (const [z, v] of Object.entries(b)) for (const r of v.races) {
  const o = r.office || "";
  if (/U\.S\. House/.test(r.title) && v.state === "CA" && !/California's 52 districts/.test(o)) bad(`${z} ${r.id}: CA House copy`);
  if (/U\.S\. House/.test(r.title) && v.state === "TX" && !/Texas'?s? 38 districts/.test(o)) bad(`${z} ${r.id}: TX House copy`);
}
console.log(fail ? `${fail} check(s) failed` : `checks ok: ${ms.length} measures sourced`);
process.exit(fail ? 1 : 0);
