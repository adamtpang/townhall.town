// Copies Civic's main_points16.json (the ONLY source for card main points and record lines) into the repo and emits a
// compact client map keyed by race id, then candidate id AND slug(name) (Civic matched some ids by race + name).
// Usage: node scripts/sync-main-points.mjs [/workspace/townhall/civic/main_points16/main_points16.json]
import fs from "node:fs";
const src = process.argv[2] || "/workspace/townhall/civic/main_points16/main_points16.json";
const d = JSON.parse(fs.readFileSync(src, "utf8"));
fs.writeFileSync("data/civic/main_points16.json", JSON.stringify(d, null, 1) + "\n");
const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const out = {};
let n = 0;
for (const [rid, r] of Object.entries(d.races)) {
  const m = (out[rid] = {});
  for (const [cid, c] of Object.entries(r.candidates)) {
    const e = {
      id: cid, name: c.name,
      p: (c.mainPoints || []).filter((x) => x.sourceUrl).map((x) => ({ i: x.issueId || x.issue, l: x.issue, t: x.text, u: x.sourceUrl, s: x.sourceLabel })),
      r: c.recordLine ? { t: c.recordLine.text, u: c.recordLine.sourceUrl || null } : null,
      none: c.noRecordText || null,
    };
    m[cid] = e; if (slug(c.name) !== cid) m[slug(c.name)] = e; n++;
  }
}
fs.writeFileSync("lib/mainPoints.gen.json", JSON.stringify({ built: d._meta?.built ?? null, races: out }) + "\n");
console.log(`main points: ${Object.keys(out).length} races, ${n} candidates`);
