// Which curated stances Towny may state and count (Civic review of the follow-up samples, Oct 30, 1:37 PM CT).
// 1) Ballotpedia: kept only for (a) Candidate Connection survey answers, chip "Ballotpedia Candidate Connection", and
//    (b) campaign-site text Ballotpedia says it copied, cited to the campaign site when the curated data has its URL.
//    Civic marks (a) and (b) in data/civic/positions_*.json (scripts/build-ballotpedia-kinds.mjs). Any other
//    ballotpedia.org text (for example "Connie Chan supports Medicare for All...", Ballotpedia's own third-person voice)
//    is unsure: shown with the unsure note, never a chip, never counted in overlap.
// 2) Slogans: a line that only ranks how urgent or important an issue is ("few priorities are as urgent as the battle
//    against climate change") says nothing about what the candidate would do. Unsure, not counted. Same rule for everyone.
// Pure; reads only shipped data. Changes nothing in lib/issues.ts.
import kinds from "./ballotpediaKinds.gen.json";
import type { Stance } from "../issues";

export const qkey = (s: string) => String(s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const BY_QUOTE = (kinds as { byQuote: Record<string, { kind: "survey" | "campaign" }> }).byQuote;

export const CANDIDATE_CONNECTION = "Ballotpedia Candidate Connection";

/** Urgency or importance rankings with no stated action. Kept narrow on purpose: it must not catch real positions. */
export const SLOGAN: RegExp[] = [
  /\b(few|no)( other)? (priorities|issues|challenges|things)\b[^.]*\b(as|more) (urgent|important|pressing)\b/i,
  /^\s*[^.]{0,80}\b(is|are) (my|our) (top|number one|#1|first) priority\.?\s*$/i,
];
export const isSlogan = (quote: string) => SLOGAN.some((r) => r.test(String(quote ?? "")));

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
export const isBallotpedia = (u?: string | null) => !!u && /(^|\.)ballotpedia\.org$/.test(host(u));

export type StanceGate =
  | { ok: true; url: string; label: string; via: "own" | "survey" | "campaign" }
  | { ok: false; reason: "ballotpedia voice" | "slogan" };

/** Whether Towny may state (and count) this stance, and which source to cite. */
export function gateStance(s: Pick<Stance, "quote" | "sourceUrl" | "voteRecord">, campaignSite?: string | null): StanceGate {
  const url = String(s.sourceUrl ?? "");
  const q = String(s.quote ?? "");
  if (!s.voteRecord && isSlogan(q)) return { ok: false, reason: "slogan" };
  if (isBallotpedia(url)) {
    const k = BY_QUOTE[qkey(q)]?.kind;
    if (k === "survey") return { ok: true, url, label: CANDIDATE_CONNECTION, via: "survey" };
    if (k === "campaign") return campaignSite ? { ok: true, url: campaignSite, label: host(campaignSite), via: "campaign" } : { ok: true, url, label: "Campaign site text on Ballotpedia", via: "campaign" };
    return { ok: false, reason: "ballotpedia voice" };
  }
  return { ok: true, url, label: host(url) || "source", via: "own" };
}

/** Stances with unsure ones set to value null, so overlapFor never counts them. */
export function countableStances(st: Record<string, Stance>, campaignSite?: string | null): Record<string, Stance> {
  const out: Record<string, Stance> = {};
  for (const [id, s] of Object.entries(st)) out[id] = s && s.value !== null && s.sourceUrl && !gateStance(s, campaignSite).ok ? { ...s, value: null } : s;
  return out;
}
