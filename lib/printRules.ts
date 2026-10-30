// Server-only data for the printed ballot. Voter rules come verbatim from Civic's data/civic/voter_rules.json (copied unchanged
// from civic/print24, Oct 30 2:41 PM CT); a rule prints only when its status is "confirmed" and its verbatim text is present.
// Candidate order comes from Civic's data/civic/ballot_order_check.json (bp22): a race counts as confirmed only when it has an
// official_order that names exactly the candidates in our data. Unconfirmed races keep the data order and get a † on print.
import RULES from "../data/civic/voter_rules.json";
import ORDER from "../data/civic/ballot_order_check.json";
import type { St } from "./plan";

export type VoterRule = { topic: string; text: string; sourceName: string; sourceUrls: string[] };
export type PrintRules = { booth: VoterRule | null; devices: VoterRule | null; id: VoterRule | null; hours: VoterRule | null };
type Raw = { state: string; topic: string; rule_text_verbatim?: string; source_name?: string; source_url?: string; status?: string };
type OrderRow = { zip: string; race_id: string; official_order: string[] | null; status: string; source_url?: string; source_kind?: string };
export type OrderCite = { label: string; url: string; also?: { label: string; url: string } | null };

// The cite for "Listed in the order on the official sample ballot." per ZIP (Civic, Oct 30 2:58 PM CT). 78701 uses the
// Travis County bedsheet row's source_kind verbatim; 10001 uses Civic's label for the NYC BOE New York County sample ballot.
// 94103 has no official sample ballot in bp22 (its order is unconfirmed), so no cite.
// Civic P1, Oct 30 3:26 PM CT: no BOE-hosted 10001 sample ballot exists; the img1.wsimg.com PDF is a third-party copy of an
// AD 71 ballot. Relabel it exactly, add the BOE lookup next to it, and cite it only for the 6 Manhattan-wide races.
export const NY_COPY_LABEL = "Copy of an official NYC Board of Elections ballot (New York County, Assembly District 71), posted on a third-party website, not the Board's";
export const NY_BOE_LOOKUP = { label: "Find My Poll Site / View Sample Ballot, NYC Board of Elections", url: "https://findmypollsite.vote.nyc/" };
/** 10001 races the AD 71 copy may confirm: Manhattan-wide only. Never NY-12, the State Senate, AD 75 or Council 3. */
export const NY_COPY_RACES = ["ny-governor", "ny-comptroller", "ny-attorney-general", "ny-supreme-1jd", "ny-surrogate-ny", "ny-civil-county-ny"];
const ORDER_LABEL: Record<string, string | null> = { "78701": null, "10001": NY_COPY_LABEL };
export function orderCite(zip: string): OrderCite | null {
  if (!(zip in ORDER_LABEL)) return null;
  const row = (ORDER as OrderRow[]).find((x) => x.zip === zip && x.official_order?.length && /^https?:\/\//.test(x.source_url || ""));
  if (!row) return null;
  return { label: ORDER_LABEL[zip] ?? row.source_kind ?? "", url: row.source_url!, also: zip === "10001" ? NY_BOE_LOOKUP : null };
}

const urlsOf = (s?: string) => (s || "").split(/\s*;\s*/).map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u));

/** The confirmed verbatim rule for a state and topic, or null if it's missing, empty or not confirmed (e.g. "unsure"). */
export function voterRule(state: St, topic: string): VoterRule | null {
  const r = (RULES as Raw[]).find((x) => x.state === state && x.topic === topic);
  if (!r || r.status !== "confirmed" || !r.rule_text_verbatim?.trim()) return null;
  return { topic, text: r.rule_text_verbatim, sourceName: r.source_name || "", sourceUrls: urlsOf(r.source_url) };
}

// Civic, Oct 30 2:58 PM CT: the NY hours entry splices in a bracketed § 8-100(2) quote. Print only the NYC BOE sentences
// before it (still verbatim, a prefix of Civic's text), cited to the NYC BOE page alone.
const PRINT_ONLY: Record<string, { before: string; sourceName: string; keepUrl: RegExp }> = {
  "NY:polling_hours": { before: " [NY Election Law", sourceName: "NYC Board of Elections – Election Dates and Deadlines", keepUrl: /vote\.nyc/ },
};

function printRule(state: St, topic: string): VoterRule | null {
  const r = voterRule(state, topic);
  const o = PRINT_ONLY[`${state}:${topic}`];
  if (!r || !o) return r;
  const i = r.text.indexOf(o.before);
  if (i < 0) return null; // Civic's text changed: print nothing rather than guess a cut
  return { topic, text: r.text.slice(0, i).trim(), sourceName: o.sourceName, sourceUrls: r.sourceUrls.filter((u) => o.keepUrl.test(u)) };
}

export function printRules(state: St): PrintRules {
  return {
    booth: printRule(state, "written_notes_in_booth"),
    devices: state === "TX" ? printRule(state, "wireless_devices_ban") : null,
    id: printRule(state, "voter_id"),
    hours: printRule(state, "polling_hours"),
  };
}

const bare = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "").trim();

/** Candidates in the official order when Civic confirmed it for this race; otherwise the data order, flagged unconfirmed. */
export function officialOrder<C extends { name: string }>(zip: string, raceId: string, cands: C[]): { candidates: C[]; confirmed: boolean } {
  const row = (ORDER as OrderRow[]).find((x) => x.zip === zip && x.race_id === raceId);
  if (zip === "10001" && !NY_COPY_RACES.includes(raceId)) return { candidates: cands, confirmed: false };
  const off = row?.official_order?.map(bare);
  if (!off || off.length !== cands.length || !cands.every((c) => off.includes(c.name))) return { candidates: cands, confirmed: false };
  return { candidates: [...cands].sort((a, b) => off.indexOf(a.name) - off.indexOf(b.name)), confirmed: true };
}
