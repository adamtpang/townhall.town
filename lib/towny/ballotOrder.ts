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

type Check = { status: "confirmed" | "unconfirmed"; zip: string | null; url: string | null; order: string[] | null };
export const ORDER_CHECKS: Record<string, Check> = ((checks as { ballotOrder?: { byRace?: Record<string, Check> } }).ballotOrder?.byRace ?? {}) as Record<string, Check>;

const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
type Race = Pick<Ballot["races"][number], "id" | "candidates">;

/** Confirmed only when Civic marked the race confirmed (for this ZIP, if it names one) and any order it lists is ours. */
export function orderCheckFor(zip: string, r: Race, byRace: Record<string, Check> = ORDER_CHECKS): { confirmed: true; url: string } | { confirmed: false; reason: string } {
  const c = byRace[r.id];
  const office = OFFICES[zip];
  if (!c || c.status !== "confirmed" || (c.zip && c.zip !== zip) || !office || !r.candidates.length) return { confirmed: false, reason: ORDER_UNCHECKED };
  if (c.order && (c.order.length !== r.candidates.length || c.order.some((n, i) => norm(n) !== norm(r.candidates[i].name)))) return { confirmed: false, reason: ORDER_MISMATCH };
  return { confirmed: true, url: c.url ?? office.sampleBallot };
}
