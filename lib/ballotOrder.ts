// Civic P1 (Oct 30, 2026, 2:58 PM CT): candidate order per race, from Civic's check against the official sample ballots
// (civic/bp22/ballot_order_check.json -> data/ballot_order.json). Only 78701 and the 6 confirmed 10001 races are listed there.
// Every other race (all of 94103, the 7 unconfirmed 10001 races) stays "unsure"; nothing here guesses an order.
import data from "../data/ballot_order.json";

export const ORDER_CONFIRMED = "Listed in the order on the official sample ballot.";
export const ORDER_UNSURE = "Ballot order: Unsure, we haven't confirmed it against the official sample ballot yet.";

type Row = { zip: string; raceId: string; title: string; officialOrder: string[]; sourceUrl: string; page: number | null; sourceKind: string };
const ROWS = (data as { races: Row[] }).races;
const BY = new Map(ROWS.map((r) => [`${r.zip}|${r.raceId}`, r]));

// Link label per source. 10001's PDF is the NYC Board of Elections ballot for New York County (AD71), hosted on a
// third-party site; Civic used it only for contests that are the same on every New York County ballot.
// Adam, Oct 30 3:24 PM CT (Civic sourcing NO-GO): 10001's PDF gets Civic's exact label and always travels with the Board's own
// Find My Poll Site / sample-ballot lookup.
export const NY_PDF_LABEL = "Copy of an official NYC Board of Elections ballot (New York County, Assembly District 71), posted on a third-party website, not the Board's";
export const NY_FMPS = { label: "Find My Poll Site / View Sample Ballot, NYC Board of Elections", url: "https://findmypollsite.vote.nyc/" };
const LABELS: Record<string, string> = { "78701": "Travis County sample ballot", "10001": NY_PDF_LABEL };
export type OrderSource = { label: string; url: string };
const sourceOf = (r: Row): OrderSource => ({ label: LABELS[r.zip] ?? "Official sample ballot", url: r.sourceUrl });

/** The confirmed official order for one race, or null (unsure). */
export function officialOrder(zip: string, raceId: string): { names: string[]; source: OrderSource } | null {
  const r = BY.get(`${zip}|${raceId}`);
  return r ? { names: [...r.officialOrder], source: sourceOf(r) } : null;
}
export const isOrderConfirmed = (zip: string, raceId: string) => BY.has(`${zip}|${raceId}`);

/** Candidates in the official sample-ballot order when that race is confirmed and the names are the same set; otherwise
 *  unchanged (data order, which is never claimed as ballot order). */
export function inOfficialOrder<T extends { name: string }>(zip: string, raceId: string, cands: T[]): T[] {
  const o = officialOrder(zip, raceId);
  if (!o || o.names.length !== cands.length) return cands;
  const pos = new Map(o.names.map((n, i) => [n, i]));
  if (!cands.every((c) => pos.has(c.name))) return cands;
  return [...cands].sort((a, b) => pos.get(a.name)! - pos.get(b.name)!);
}

/** Links for the order sources cited, one per URL; the 10001 PDF is followed by the Board's own lookup. */
export function orderSourceLinks(sources: OrderSource[]): OrderSource[] {
  const out = new Map<string, OrderSource>();
  for (const s of sources) {
    out.set(s.url, s);
    if (s.label === NY_PDF_LABEL) out.set(NY_FMPS.url, NY_FMPS);
  }
  return [...out.values()];
}

/** Per-race order status for the model's tools (getRaces/getCandidates). "confirmed" covers the order of candidates within
 *  that race only (78701: 58/58 races checked against the bedsheet), never the order of the races. */
export type OrderStatus = { status: "confirmed" | "unsure"; sourceUrl: string | null; sourceLabel: string | null; say: string };
export function orderStatus(zip: string, raceId: string): OrderStatus {
  const o = officialOrder(zip, raceId);
  return o ? { status: "confirmed", sourceUrl: o.source.url, sourceLabel: o.source.label, say: ORDER_CONFIRMED } : { status: "unsure", sourceUrl: null, sourceLabel: null, say: ORDER_UNSURE };
}

// Civic towny_order_check P0 (Oct 30, 3:25 PM CT): a ZIP that spans districts. A voter has only one race of each group.
export const SPLIT_LINE = "Depending on your address, you'll have one of these";
export type SplitGroup = { raceIds: string[]; lookup: OrderSource };
const TX_LOOKUP = { label: "Texas Secretary of State, My Voter Portal (look up your districts by address)", url: "https://teamrv-mvp.sos.texas.gov/MVP/mvp.do" };
const CA_LOOKUP = { label: "California Secretary of State, voter status lookup", url: "https://voterstatus.sos.ca.gov/" };
const SPLITS: Record<string, SplitGroup[]> = {
  "78701": [{ raceIds: ["tx-10", "tx-37"], lookup: TX_LOOKUP }, { raceIds: ["tx-hd-49", "tx-house-51"], lookup: TX_LOOKUP }],
  "94103": [{ raceIds: ["sf-supervisor-6", "sf-supervisor-8", "sf-supervisor-10"], lookup: CA_LOOKUP }],
  "10001": [{ raceIds: ["ny-sd-47", "ny-sd-28"], lookup: NY_FMPS }],
};
export const splitGroups = (zip: string): SplitGroup[] => SPLITS[zip] ?? [];
export const splitOf = (zip: string, raceId: string): SplitGroup | null => splitGroups(zip).find((g) => g.raceIds.includes(raceId)) ?? null;

/** The order line for one race: the confirmed line plus its source, or the unsure line. */
export function orderLine(zip: string, raceId: string): { confirmed: boolean; line: string; source: OrderSource | null } {
  const o = officialOrder(zip, raceId);
  return o ? { confirmed: true, line: ORDER_CONFIRMED, source: o.source } : { confirmed: false, line: ORDER_UNSURE, source: null };
}
