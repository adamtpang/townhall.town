// QA 7391b20 P2: reachability check for every candidate-facing link we ship (sources checked, campaign/official sites,
// Ballotpedia pages, stance sources). Writes data/link-status.json; lib/links.ts hides anything listed there.
// Dead = 404/410, any 5xx, a network error or timeout on two tries, or http-only (unless the https version answers,
// in which case the https URL replaces it). 401/402/403/429 are bot blocks and stay. Usage: node scripts/check-links.mjs
import fs from "node:fs";
const urls = new Set();
const walk = (o) => { if (typeof o === "string") { const m = o.match(/^https?:\/\/\S+$/); if (m) urls.add(o); } else if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (/^(url|sourceUrl|campaignSite|officialSite|ballotpedia|site|page)$/i.test(k) || typeof v === "object") walk(v); } };
for (const f of ["data/sources-checked.json", "data/campaign-sites.json", "data/stances.json", "data/ballots.json", "data/ny.json", "data/tx.json"]) walk(JSON.parse(fs.readFileSync(f, "utf8")));
const UA = "Mozilla/5.0 (compatible; townhall-linkcheck/1.0; +https://townhall.town)";
async function probe(u, ms = 15000) {
  for (let t = 0; t < 2; t++) {
    try {
      const r = await fetch(u, { redirect: "follow", headers: { "user-agent": UA, accept: "text/html,*/*" }, signal: AbortSignal.timeout(ms) });
      r.body?.cancel?.();
      return r.status;
    } catch (e) { if (t === 1) return `error: ${e?.name === "TimeoutError" ? "timeout" : e?.cause?.code || e?.message}`; }
  }
}
const deadStatus = (s) => typeof s === "string" || s === 404 || s === 410 || s >= 500;
const list = [...urls].sort(); const dead = {}; const replace = {}; let i = 0;
await Promise.all(Array.from({ length: 16 }, async () => {
  while (i < list.length) {
    const u = list[i++];
    const s = await probe(u);
    if (u.startsWith("http://")) {
      const https = "https://" + u.slice(7); const s2 = await probe(https);
      if (!deadStatus(s2)) replace[u] = https; else dead[u] = `http-only (${s}); https: ${s2}`;
    } else if (deadStatus(s)) dead[u] = String(s);
  }
}));
fs.writeFileSync("data/link-status.json", JSON.stringify({ note: "Built by scripts/check-links.mjs. Links listed under dead are hidden; replace maps http to a working https URL.", checkedAt: new Date().toISOString(), checked: list.length, dead, replace }, null, 1) + "\n");
console.log(`checked ${list.length}, dead ${Object.keys(dead).length}, replaced ${Object.keys(replace).length}`);
for (const [u, why] of Object.entries(dead)) console.log("DEAD", why, u);
