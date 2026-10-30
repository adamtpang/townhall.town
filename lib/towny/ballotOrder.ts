// Ballot order, checked against the office's sample ballot (Civic, Oct 30 1:54 PM CT).
// Civic's ballot_order_check.json (built into lib/civicChecks.gen.json by scripts/build-civic-checks.mjs) marks races
// whose order was confirmed. Until a race is marked confirmed, its order line stays unsure. The file may be missing.
import checks from "../civicChecks.gen.json";
import type { Ballot } from "../tools";
import { OFFICES } from "./offices";

export const ORDER_UNSURE_LINE = "Ballot order: Unsure, we haven't confirmed it against the official sample ballot yet.";
export const ORDER_CONFIRMED_LINE = "Listed in the order on the official sample ballot.";
export const ORDER_UNCHECKED = "ballot order not yet checked against the office's sample ballot";
export const ORDER_MISMATCH = "ballot order check lists a different order than ours";

type Check = { status: "confirmed" | "unconfirmed" | "single"; zip: string | null; url: string | null; order: string[] | null };
export const ORDER_CHECKS: Record<string, Check> = ((checks as { ballotOrder?: { byRace?: Record<string, Check> } }).ballotOrder?.byRace ?? {}) as Record<string, Check>;

/** Where the order line points. `text` is the "Source:" line, `chip` its link label (same when no short host fits). */
export type OrderSource = { text: string; chip: string; url: string };
/** Per-ZIP order source (Civic, Oct 30): Travis County's bedsheet sample ballot; for 10001, the NYC BOE New York County
 *  sample ballot PDF (only for the 6 contests Civic confirmed; the rest point at the BOE's own lookup); for 94103, the
 *  SF Department of Elections (Civic could not confirm SF order, so every SF race stays unsure). */
export function orderSourceFor(zip: string, c?: Check | null): OrderSource | null {
  const o = OFFICES[zip];
  if (!o) return null;
  if (zip === "78701") return { text: `${o.name} sample ballot`, chip: o.label, url: c?.url ?? o.sampleBallot };
  if (zip === "10001" && c?.status === "confirmed" && c.url) return { text: "NYC Board of Elections sample ballot (New York County)", chip: "NYC Board of Elections sample ballot (New York County)", url: c.url };
  if (zip === "94103") return { text: "SF Department of Elections", chip: "SF Department of Elections", url: c?.url ?? o.sampleBallot };
  return { text: `${o.name} sample ballot`, chip: o.label, url: o.sampleBallot };
}
export const orderSourceLine = (s: OrderSource) => (s.chip === s.text ? `Source: ${s.text}` : `Source: ${s.text} [${s.chip}]`);

const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
type Race = Pick<Ballot["races"][number], "id" | "candidates">;
export type OrderCheck = { confirmed: true; url: string; source: OrderSource } | { confirmed: false; reason: string; single?: true; source: OrderSource | null };

/** Confirmed only when Civic marked the race confirmed (for this ZIP, if it names one) and the order it lists is ours.
 *  `single`: a one-choice contest (SF retention questions, MATCH_SINGLE): no order line is shown at all. */
export function orderCheckFor(zip: string, r: Race, byRace: Record<string, Check> = ORDER_CHECKS): OrderCheck {
  const c = byRace[r.id];
  const office = OFFICES[zip];
  const mine = c && (!c.zip || c.zip === zip) ? c : null;
  const source = orderSourceFor(zip, mine);
  if (mine?.status === "single") return { confirmed: false, reason: ORDER_UNCHECKED, single: true, source };
  if (!mine || mine.status !== "confirmed" || !office || !r.candidates.length || !source) return { confirmed: false, reason: ORDER_UNCHECKED, source };
  if (mine.order && (mine.order.length !== r.candidates.length || mine.order.some((n, i) => norm(n) !== norm(r.candidates[i].name)))) return { confirmed: false, reason: ORDER_MISMATCH, source };
  return { confirmed: true, url: source.url, source };
}

/** The line every race shows (race list, card, Towny): confirmed, unsure, or none for a one-choice contest. */
export function orderLineFor(zip: string, r: Race, byRace: Record<string, Check> = ORDER_CHECKS): { text: string; confirmed: boolean; source: OrderSource | null } | null {
  if (!r.candidates.length) return null;
  const chk = orderCheckFor(zip, r, byRace);
  if (!chk.confirmed && chk.single) return null;
  return { text: chk.confirmed ? ORDER_CONFIRMED_LINE : ORDER_UNSURE_LINE, confirmed: chk.confirmed, source: chk.source };
}

/** Adds each race's order line to a ballot for the site (race list, card). Same rule as Towny's order replies. */
export function withOrderLines<B extends Pick<Ballot, "races"> | null | undefined>(zip: string, b: B): B {
  if (!b) return b;
  return { ...b, races: b.races.map((r) => { const l = orderLineFor(zip, r); return { ...r, order: l ? { text: l.text, confirmed: l.confirmed, url: l.source?.url ?? null, label: l.source?.chip ?? null } : null }; }) };
}
