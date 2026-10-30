// Tier math, shared by the results page (app/RaceTiers.tsx) and the calendar copy (lib/gcal.ts). Kept out of the
// client component so pages that only need the math (e.g. /card) do not pull the results UI or its motion code.
import { polymarketCloseness } from "./marketsCore.mjs";
import type { PolyQuote } from "./marketLine";
type Mk = PolyQuote | null;
type RaceLite = { id: string; title: string; level: string; judicial?: "ny" | "tx" | "ca" | boolean; meta?: { closeness?: string } | null };

/**
 * Tier formula (races only, never candidates):
 *   score = impact x competitiveness
 *   impact: 3 = President, U.S. Senate, Governor; 2 = U.S. House, other statewide executive, ballot measures;
 *           1.5 = state legislature; 1 = judicial and local.
 *   competitiveness = 2.0 when the sourced race ratings (Cook, Sabato, Inside Elections only) say Competitive,
 *           OR the live Polymarket top contract is between 35% and 65%; otherwise 1.0. Polymarket can only raise a
 *           race, never lower a sourced rating. No market means no market line; nothing is estimated.
 *   Most at stake >= 4.5, High stakes >= 3, Moderate stakes >= 2, else Lower stakes.
 */
export function impactOf(r: RaceLite): { v: number; why: string } {
  const t = r.title.toLowerCase();
  // Rank by race id / level first so certified ballot names ("U.S. Senator", "U.S. Representative, District 10") can't drop a race (QA P1-1).
  const usSenate = /^us-senate\b/.test(r.id) || /u\.s\. senat(e|or)\b/.test(t);
  const usHouse = !usSenate && ((r.level === "federal" && /^[a-z]{2}-\d+$/.test(r.id)) || /u\.s\. (house|representative)\b/.test(t));
  if (usSenate || /president|^governor/.test(t)) return { v: 3, why: "top federal or statewide office" };
  if (usHouse) return { v: 2, why: "your U.S. House seat" };
  if (r.level === "measure") return { v: 2, why: "statewide ballot measure" };
  // Judicial races are judicial seats even when the court is named for a municipal or county district (QA P2, 4c21a5c).
  if (r.judicial) return { v: 1, why: "judicial seat" };
  // Statewide boards (SBOE, Railroad Commission, Board of Equalization) are state offices, not local (QA P2 / Civic rule c).
  if (/state board of education|railroad commission|board of equalization/.test(t)) return { v: 1, why: "state office" };
  // County / city / precinct offices are local even when titled Treasurer or Commissioner (QA P2).
  if (/\bcounty\b|\bcity\b|precinct|municipal|board of/.test(t) && !/court at law|district court|court of|justice/.test(t)) return { v: 1, why: "local office" };
  if (/lieutenant governor|attorney general|comptroller|secretary of state|treasurer|controller|insurance commissioner|superintendent|commissioner/.test(t))
    return { v: 2, why: "statewide executive office" };
  if (/court|judge|justice|appeals/.test(t)) return { v: 1, why: "judicial seat" };
  if (/state senate|state house|state representative|assembly|senate district|house district/.test(t)) return { v: 1.5, why: "state legislature" };
  return { v: 1, why: r.level === "local" || r.level === "county" ? "local office" : "lower-profile office" };
}
export type Group = "most" | "high" | "moderate" | "lower";
export const TIER_LABELS = ["Most at stake", "High stakes", "Moderate stakes", "Lower stakes"] as const;
export function tierFor(r: RaceLite, mk?: Mk, tr?: (s: string) => string) {
  const imp = impactOf(r);
  const comp = r.meta?.closeness === "Competitive" || polymarketCloseness(mk ?? null) === "Competitive" ? 2 : 1;
  const score = imp.v * comp;
  const tier: Group = score >= 4.5 ? "most" : score >= 3 ? "high" : score >= 2 ? "moderate" : "lower";
  const w = tr ? tr(imp.why) : imp.why;
  const why = `${w[0].toUpperCase()}${w.slice(1)}.`;
  return { tier, score, why };
}

