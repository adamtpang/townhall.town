// Additive loader (does not touch ballots/stances): collects the sources Civic recorded as checked for each candidate
// ("searched" + "checkedUrl" on every issue entry in data/civic/positions_*.json) into data/sources-checked.json.
// Shown under "No public position found yet. Sources checked:". Only Civic's recorded URLs; nothing is invented.
import fs from "node:fs";
const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const out = {};
for (const f of fs.readdirSync("data/civic").filter((f) => /^positions_.*\.json$/.test(f)).sort()) {
  const d = JSON.parse(fs.readFileSync(`data/civic/${f}`, "utf8"));
  for (const [k, v] of Object.entries(d.stances ?? {})) {
    if (!v || typeof v !== "object") continue;
    const key = slug(v.name ?? k);
    const seen = (out[key] ??= { name: v.name ?? k, checked: [], checkedDate: null });
    for (const x of Object.values(v)) {
      if (!x || typeof x !== "object" || Array.isArray(x)) continue;
      for (const raw of [...(x.searched ?? []), x.checkedUrl].filter(Boolean)) {
        const m = /^(https?:\/\/\S+?)(?:\s+\((.*)\))?$/.exec(String(raw).trim());
        if (!m || seen.checked.some((c) => c.url === m[1])) continue;
        seen.checked.push({ url: m[1], note: m[2] ?? null });
      }
      if (x.checkedDate && (!seen.checkedDate || x.checkedDate > seen.checkedDate)) seen.checkedDate = x.checkedDate;
    }
  }
}
// Gap-fill files (positions_gapfill_batch2+): per-candidate "sourcesChecked" [{url, title, dateChecked, result}], listed first.
for (const f of fs.readdirSync("data/civic").filter((f) => /^positions_gapfill_batch([2-9]|\d\d)\.json$/.test(f)).sort()) {
  const d = JSON.parse(fs.readFileSync(`data/civic/${f}`, "utf8"));
  for (const [k, v] of Object.entries(d)) {
    if (k.startsWith("_") || !v || typeof v !== "object" || Array.isArray(v) || !v.name) continue;
    const cur = (out[k] ??= { name: v.name ?? k, checked: [], checkedDate: null });
    const fresh = (v.sourcesChecked ?? []).filter((x) => /^https?:\/\//.test(String(x?.url ?? ""))).map((x) => ({ url: x.url, title: x.title ?? null, note: x.result ?? null }));
    cur.checked = [...fresh, ...cur.checked.filter((c) => !fresh.some((x) => x.url === c.url))];
    for (const x of v.sourcesChecked ?? []) if (x.dateChecked && (!cur.checkedDate || x.dateChecked > cur.checkedDate)) cur.checkedDate = x.dateChecked;
  }
}
for (const k of Object.keys(out)) if (!out[k].checked.length) delete out[k];
// Ships in the client bundle: links and titles only (Civic's per-source notes stay in data/civic).
// Design p10 P2: no internal notes in titles ("(via search snippet; direct fetch 403)"), one link per domain, and
// League of Women Voters / VOTE411 links read "League of Women Voters guide".
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const cleanTitle = (t, u) => {
  if (/lwv|league of women voters|vote411/i.test(`${u} ${t ?? ""}`)) return "League of Women Voters guide";
  if (!t) return null;
  const c = t.replace(/\s*[\(\[][^\)\]]*\b(via|fetch|403|404|snippet|blocked|search result|cached|paywall)\b[^\)\]]*[\)\]]/gi, "").replace(/\s*[;—-]\s*(via|direct fetch)\b.*$/i, "").replace(/\s{2,}/g, " ").trim();
  return c || null;
};
for (const v of Object.values(out)) {
  const seenHost = new Set();
  v.checked = v.checked.filter((c) => { const h = host(c.url); if (seenHost.has(h)) return false; seenHost.add(h); return true; })
    .map((c) => { const t = cleanTitle(c.title, c.url); return t ? { url: c.url, title: t } : { url: c.url }; });
}
// Civic qa_fixes4: sites that are down stay listed as plain text with the note, and Civic's alternatives follow.
const NOTES = JSON.parse(fs.readFileSync("data/link-notes.json", "utf8")).down;
for (const v of Object.values(out)) {
  const extra = [];
  v.checked = v.checked.map((c) => { const d = NOTES[c.url]; if (!d) return c; extra.push(...d.alternatives); return { ...c, down: d.note }; });
  for (const a of extra) if (!v.checked.some((c) => host(c.url) === host(a.url))) v.checked.push({ url: a.url, title: a.title });
}
fs.writeFileSync("data/sources-checked.json", JSON.stringify({ note: "Built by scripts/build-sources-checked.mjs from Civic positions files (searched/checkedUrl).", bySlug: out }) + "\n");
console.log(`sources-checked: ${Object.keys(out).length} candidates`);
