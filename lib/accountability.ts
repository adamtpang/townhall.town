// Track record plug-in. Source of truth: Civic's data/accountability.json (replaced wholesale 2026-10-29).
// Labels are only consistent / inconsistent / mixed/unclear. A score shows only with 3+ checkable pairs
// (consistent + inconsistent); otherwise "Not enough records", or "No voting record" for people who never held office.
// Method: /methodology/accountability (data/civic/accountability_method.md). Records, never vote advice.
import data from "../data/accountability.json";
import type { AccountabilityRecord, Politician, TrackRecord } from "./types";

type RawPair = {
  issue: string;
  claim: { quote: string; sourceUrl: string; date: string | null };
  action: { description: string; bill?: string | null; vote?: string | null; date: string | null; sourceUrl: string };
  classification: AccountabilityRecord["classification"];
  reason: string;
};
type RawCand = { slug: string; name: string; aliases?: string[]; accountability: { officesHeld?: string[]; officesVerified?: string; consistent: number; inconsistent: number; mixedUnclear: number; display: string; status: string; pairs: RawPair[] } };
const D = data as unknown as { asOf: string; method: string; score_min_inputs: number; score_methodology_url: string; candidates: Record<string, RawCand> };

export const METHOD_TEXT = D.method;
export const METHOD_URL = "/methodology/accountability";
/** Scores stay hidden for every candidate until /methodology/accountability is live on the public site.
 *  Flip to true only when that page is live; the "Not enough records" / "No voting record" states are not scores. */
export const SHOW_SCORES = false;
export const MIN_PAIRS = D.score_min_inputs ?? 3;
const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const index = new Map<string, RawCand>();
for (const c of Object.values(D.candidates)) for (const k of [c.slug, c.name, ...(c.aliases ?? [])]) index.set(slug(k), c);

export function trackRecordFor(name: string, aka?: string | null): TrackRecord | null {
  const c = index.get(slug(name)) ?? (aka ? index.get(slug(aka)) : undefined);
  if (!c) return null;
  const a = c.accountability;
  const pairs: AccountabilityRecord[] = a.pairs.map((p) => ({
    issue: p.issue,
    said: { quote: p.claim.quote, url: p.claim.sourceUrl, date: p.claim.date },
    did: { text: p.action.description, bill: p.action.bill ?? null, vote: p.action.vote ?? null, url: p.action.sourceUrl, date: p.action.date },
    classification: p.classification,
    reason: p.reason,
  }));
  const checkable = a.consistent + a.inconsistent;
  const score = checkable >= MIN_PAIRS ? Math.round((a.consistent / checkable) * 100) : null;
  const display = score !== null
    ? (SHOW_SCORES ? `${a.consistent} of ${checkable} checked pairs consistent` : "Score not shown until the method page is published; checked pairs are listed below")
    : a.status === "No voting record" ? "No voting record" : "Not enough records";
  // Office line only when Civic verified the office history (never for "unsure").
  const offices = a.officesVerified === "verified" && a.officesHeld?.length ? a.officesHeld : null;
  return { display, score: SHOW_SCORES ? score : null, offices, consistent: a.consistent, inconsistent: a.inconsistent, mixedUnclear: a.mixedUnclear, pairs, asOf: D.asOf };
}

/** Attach the track record without changing anything else. */
export function withAccountability<T extends Politician & { aka?: string | null }>(p: T): T {
  const accountability = trackRecordFor(p.name, p.aka);
  return accountability ? { ...p, accountability } : p;
}
