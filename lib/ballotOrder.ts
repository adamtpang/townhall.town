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
const LABELS: Record<string, string> = { "78701": "Travis County sample ballot", "10001": "NYC Board of Elections sample ballot, New York County" };
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

/** The order line for one race: the confirmed line plus its source, or the unsure line. */
export function orderLine(zip: string, raceId: string): { confirmed: boolean; line: string; source: OrderSource | null } {
  const o = officialOrder(zip, raceId);
  return o ? { confirmed: true, line: ORDER_CONFIRMED, source: o.source } : { confirmed: false, line: ORDER_UNSURE, source: null };
}
