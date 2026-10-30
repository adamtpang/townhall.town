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
type OrderRow = { zip: string; race_id: string; official_order: string[] | null; status: string };

const urlsOf = (s?: string) => (s || "").split(/\s*;\s*/).map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u));

/** The confirmed verbatim rule for a state and topic, or null if it's missing, empty or not confirmed (e.g. "unsure"). */
export function voterRule(state: St, topic: string): VoterRule | null {
  const r = (RULES as Raw[]).find((x) => x.state === state && x.topic === topic);
  if (!r || r.status !== "confirmed" || !r.rule_text_verbatim?.trim()) return null;
  return { topic, text: r.rule_text_verbatim, sourceName: r.source_name || "", sourceUrls: urlsOf(r.source_url) };
}

export function printRules(state: St): PrintRules {
  return {
    booth: voterRule(state, "written_notes_in_booth"),
    devices: state === "TX" ? voterRule(state, "wireless_devices_ban") : null,
    id: voterRule(state, "voter_id"),
    hours: voterRule(state, "polling_hours"),
  };
}

const bare = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "").trim();

/** Candidates in the official order when Civic confirmed it for this race; otherwise the data order, flagged unconfirmed. */
export function officialOrder<C extends { name: string }>(zip: string, raceId: string, cands: C[]): { candidates: C[]; confirmed: boolean } {
  const row = (ORDER as OrderRow[]).find((x) => x.zip === zip && x.race_id === raceId);
  const off = row?.official_order?.map(bare);
  if (!off || off.length !== cands.length || !cands.every((c) => off.includes(c.name))) return { candidates: cands, confirmed: false };
  return { candidates: [...cands].sort((a, b) => off.indexOf(a.name) - off.indexOf(b.name)), confirmed: true };
}
