// Parsers for two Civic data files that are coming later (Oct 30, 1:54 PM CT). Plain JS so the build script and the app
// share one implementation. Both parsers are tolerant: a missing file, null, or an unknown shape gives an empty result,
// and an unknown or unclear decision is ignored (current behavior stays).
//
// 1) ballot_order_check.json (Civic will send the path): per race, whether its candidate order was confirmed against the
//    office's sample ballot. Accepted shapes: [{raceId, status}], {races: [...]}, or {"<raceId>": {status}}.
//    Race id keys: raceId | race_id | race | id. Status keys: status | result | check | verdict ("confirmed"), or confirmed: true.
//    Optional: zip, url (source_url | sampleBallot | url | source), order (official_order | order, names as printed).
// 2) civic/bp22/ballotpedia_stance_audit.json: per Ballotpedia record, keep or drop, chip label, citation.
//    Accepted shapes: [{...}], {records | stances | audit: [...]}, or {"<id>": {...}}.
//    Match keys: candidate (candidateId | candidate_id | candidate | name | slug) + issue (issueId | issue_id | issue), or quote.
//    Decision: keep_final (Civic's real field; keep is the pre-stale pass and is ignored), else decision | action | verdict | status.
//    Chip label: recommended_chip_label | chipLabel | chip_label | chip | label. Citation: recommended_citation_url | citation | ... | url.

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

/** Strip a printed party suffix: "Chris Gober (REP)" -> "Chris Gober". */
export const bareName = (s) => String(s ?? "").replace(/\s*\([^()]*\)\s*$/, "").trim();

/**
 * Civic's real file (data/civic/ballot_order_check.json, Oct 30): [{zip, race_id, official_order: ["Name (REP)", ...],
 * data_order, source_url, status: MATCH | MISMATCH | MATCH_SINGLE | UNCONFIRMED}].
 *   MATCH / MISMATCH with an official_order: Civic read the order off the office's sample ballot -> "confirmed", with that
 *     order. A MISMATCH only confirms once our data has been reordered to it (lib/towny/ballotOrder.ts compares the two).
 *   MATCH_SINGLE: a one-choice contest (SF retention questions) -> "single": no order line at all.
 *   UNCONFIRMED (or anything else): "unconfirmed".
 * Older guessed shapes still parse (status confirmed | match | verified, confirmed: true, order, url).
 * @returns {{ byRace: Record<string, { status: "confirmed" | "unconfirmed" | "single", zip: string | null, url: string | null, order: string[] | null }> }}
 */
export function parseOrderCheck(raw) {
  const byRace = {};
  for (const o of recordsOf(raw, ["races", "checks", "records"])) {
    const raceId = pick(o, "raceId", "race_id", "race", "id", "_key");
    if (typeof raceId !== "string" || !raceId.trim()) continue;
    const s = String(pick(o, "status", "result", "check", "verdict") ?? "").trim();
    const listed = pick(o, "official_order", "order");
    const order = Array.isArray(listed) && listed.length && listed.every((x) => typeof x === "string") ? listed.map(bareName) : null;
    const single = /^match_single$/i.test(s);
    const confirmed = !single && (o.confirmed === true || /^(confirmed|match(es|ed)?|verified)$/i.test(s) || (/^mismatch$/i.test(s) && !!order));
    const url = pick(o, "source_url", "sampleBallot", "url", "source", "sourceUrl");
    byRace[raceId.trim()] = { status: single ? "single" : confirmed ? "confirmed" : "unconfirmed", zip: typeof o.zip === "string" ? o.zip : null, url: isUrl(url) ? url.trim() : null, order };
  }
  return { byRace };
}

/**
 * Civic's real file (data/civic/bp22/ballotpedia_stance_audit.json, Oct 30): one row per scored Ballotpedia stance:
 * {candidate (name), race_id, issue (id), quote, keep (always true: the pre-stale pass), keep_final, final_reason,
 *  recommended_chip_label, recommended_citation_url, bp_year}. The decision is keep_final, never keep.
 * Older guessed shapes still parse (decision | action | verdict | status "keep"/"drop"); a bare keep flag is ignored.
 * @returns {{ records: { candidate: string | null, issue: string | null, quote: string | null, keep: boolean, label: string | null, url: string | null, reason: string | null, race: string | null }[] }}
 */
export function parseStanceAudit(raw) {
  const records = [];
  for (const o of recordsOf(raw, ["records", "stances", "audit"])) {
    const d = pick(o, "decision", "action", "verdict", "status");
    const keep = typeof o.keep_final === "boolean" ? o.keep_final
      : typeof d === "string" && /^keep\b/i.test(d.trim()) ? true : typeof d === "string" && /^drop\b/i.test(d.trim()) ? false : null;
    if (keep === null) continue; // unclear decision: ignored
    const cand = pick(o, "candidateId", "candidate_id", "candidate", "name", "slug");
    const issue = pick(o, "issueId", "issue_id", "issue");
    const quote = pick(o, "quote", "text");
    if (!(cand && issue) && !quote) continue; // can't be matched to a record
    const cit = pick(o, "recommended_citation_url", "citation", "citationUrl", "citation_url", "url");
    const url = isUrl(cit) ? cit.trim() : cit && typeof cit === "object" && isUrl(cit.url) ? cit.url.trim() : null;
    const lab = pick(o, "recommended_chip_label", "chipLabel", "chip_label", "chip", "label") ?? (cit && typeof cit === "object" ? cit.label : undefined);
    const reason = pick(o, "final_reason", "reason");
    const race = pick(o, "race_id", "raceId");
    records.push({ candidate: cand ? slugOf(cand) : null, issue: issue ? qkey(issue) : null, quote: quote ? qkey(quote) : null, keep, label: typeof lab === "string" && lab.trim() ? lab.trim() : null, url, reason: typeof reason === "string" && reason.trim() ? reason.trim() : null, race: typeof race === "string" ? race : null });
  }
  return { records };
}
