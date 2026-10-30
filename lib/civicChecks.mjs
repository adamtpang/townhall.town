// Parsers for two Civic data files that are coming later (Oct 30, 1:54 PM CT). Plain JS so the build script and the app
// share one implementation. Both parsers are tolerant: a missing file, null, or an unknown shape gives an empty result,
// and an unknown or unclear decision is ignored (current behavior stays).
//
// 1) ballot_order_check.json (Civic will send the path): per race, whether its candidate order was confirmed against the
//    office's sample ballot. Accepted shapes: [{raceId, status}], {races: [...]}, or {"<raceId>": {status}}.
//    Race id keys: raceId | race_id | race | id. Status keys: status | result | check | verdict ("confirmed"), or confirmed: true.
//    Optional: zip, url (sampleBallot | url | source), order (array of names as printed).
// 2) civic/bp22/ballotpedia_stance_audit.json: per Ballotpedia record, keep or drop, chip label, citation.
//    Accepted shapes: [{...}], {records | stances | audit: [...]}, or {"<id>": {...}}.
//    Match keys: candidate (candidateId | candidate_id | candidate | name | slug) + issue (issueId | issue_id | issue), or quote.
//    Decision: decision | action | verdict | status ("keep" / "drop"), or keep: true/false.
//    Chip label: chipLabel | chip_label | chip | label. Citation: citation (string URL or {url, label}) | citationUrl | citation_url | url.

export const qkey = (s) => String(s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Same slug as lib/issues.candidateId. */
export const slugOf = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const pick = (o, ...ks) => { for (const k of ks) if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; return undefined; };
const isUrl = (u) => typeof u === "string" && /^https?:\/\/\S+$/i.test(u.trim());

function recordsOf(raw, listKeys) {
  if (Array.isArray(raw)) return raw.filter((x) => x && typeof x === "object");
  if (!raw || typeof raw !== "object") return [];
  for (const k of listKeys) if (Array.isArray(raw[k])) return raw[k].filter((x) => x && typeof x === "object");
  for (const k of listKeys) if (raw[k] && typeof raw[k] === "object") return recordsOf(raw[k], []);
  return Object.entries(raw).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v)).map(([k, v]) => ({ _key: k, ...v }));
}

/** @returns {{ byRace: Record<string, { status: "confirmed" | "unconfirmed", zip: string | null, url: string | null, order: string[] | null }> }} */
export function parseOrderCheck(raw) {
  const byRace = {};
  for (const o of recordsOf(raw, ["races", "checks", "records"])) {
    const raceId = pick(o, "raceId", "race_id", "race", "id", "_key");
    if (typeof raceId !== "string" || !raceId.trim()) continue;
    const s = pick(o, "status", "result", "check", "verdict");
    const confirmed = o.confirmed === true || (typeof s === "string" && /^(confirmed|match(es|ed)?|verified)$/i.test(s.trim()));
    const url = pick(o, "sampleBallot", "url", "source", "sourceUrl");
    const order = Array.isArray(o.order) && o.order.every((x) => typeof x === "string") ? o.order : null;
    byRace[raceId.trim()] = { status: confirmed ? "confirmed" : "unconfirmed", zip: typeof o.zip === "string" ? o.zip : null, url: isUrl(url) ? url.trim() : null, order };
  }
  return { byRace };
}

/** @returns {{ records: { candidate: string | null, issue: string | null, quote: string | null, keep: boolean, label: string | null, url: string | null }[] }} */
export function parseStanceAudit(raw) {
  const records = [];
  for (const o of recordsOf(raw, ["records", "stances", "audit"])) {
    const d = pick(o, "decision", "action", "verdict", "status");
    const keep = o.keep === true || (typeof d === "string" && /^keep\b/i.test(d.trim())) ? true : o.keep === false || (typeof d === "string" && /^drop\b/i.test(d.trim())) ? false : null;
    if (keep === null) continue; // unclear decision: ignored, current rule stays
    const cand = pick(o, "candidateId", "candidate_id", "candidate", "name", "slug");
    const issue = pick(o, "issueId", "issue_id", "issue");
    const quote = pick(o, "quote", "text");
    if (!(cand && issue) && !quote) continue; // can't be matched to a record
    const cit = pick(o, "citation", "citationUrl", "citation_url", "url");
    const url = isUrl(cit) ? cit.trim() : cit && typeof cit === "object" && isUrl(cit.url) ? cit.url.trim() : null;
    const lab = pick(o, "chipLabel", "chip_label", "chip", "label") ?? (cit && typeof cit === "object" ? cit.label : undefined);
    records.push({ candidate: cand ? slugOf(cand) : null, issue: issue ? qkey(issue) : null, quote: quote ? qkey(quote) : null, keep, label: typeof lab === "string" && lab.trim() ? lab.trim() : null, url });
  }
  return { records };
}
