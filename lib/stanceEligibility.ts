// One stance-eligibility rule for the whole site (Civic, Oct 30 1:54 PM CT): lib/issues.stancesFor applies it, so the
// main site's overlap (EndScreen, BallotCard, CandidateRow) and Towny count exactly the same stances.
// 1) Slogans: a line that only ranks how urgent or important an issue is ("few priorities are as urgent as the battle
//    against climate change") says nothing about what the candidate would do. Unsure, not counted. Same rule for everyone.
// 2) Ballotpedia, conservative by default: kept only for (a) Candidate Connection survey answers, chip
//    "Ballotpedia Candidate Connection", and (b) campaign-site text Ballotpedia says it copied, cited to the campaign site
//    when the curated data has its URL. Civic marks (a) and (b) in data/civic/positions_*.json
//    (scripts/build-ballotpedia-kinds.mjs). Any other ballotpedia.org text (Ballotpedia's own third-person voice) is unsure.
// 3) Audit override: Civic's civic/bp22/ballotpedia_stance_audit.json (per record: keep or drop, chip label, citation),
//    built into lib/civicChecks.gen.json by scripts/build-civic-checks.mjs, decides keep/drop for the Ballotpedia records
//    it lists. It never overrides the slogan rule. When the file is absent, (2) applies unchanged.
// Pure; reads only shipped data.
import kinds from "./towny/ballotpediaKinds.gen.json";
import checks from "./civicChecks.gen.json";
import { qkey, slugOf } from "./civicChecks.mjs";

export { qkey };
type StanceLike = { quote?: string; summary?: string; sourceUrl?: string | null; voteRecord?: string };
export type AuditRecord = { candidate: string | null; issue: string | null; quote: string | null; keep: boolean; label: string | null; url: string | null };

const BY_QUOTE = (kinds as { byQuote: Record<string, { kind: "survey" | "campaign" }> }).byQuote;
export const AUDIT: AuditRecord[] = ((checks as { stanceAudit?: { records?: AuditRecord[] } }).stanceAudit?.records ?? []) as AuditRecord[];

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
  | { ok: true; url: string; label: string; via: "own" | "survey" | "campaign" | "audit" }
  | { ok: false; reason: "ballotpedia voice" | "slogan" | "audit drop" };

export type GateCtx = { candidate?: string; issueId?: string; issueLabel?: string };

/** The audit record for this stance, if Civic's audit lists it (by candidate + issue, else by exact quote). */
export function auditFor(s: StanceLike, ctx: GateCtx = {}, audit: AuditRecord[] = AUDIT): AuditRecord | null {
  if (!audit.length) return null;
  const cand = ctx.candidate ? slugOf(ctx.candidate) : null;
  const issues = [ctx.issueId, ctx.issueLabel].filter(Boolean).map((x) => qkey(x!));
  const q = s.quote ? qkey(s.quote) : null;
  return (
    audit.find((a) => a.candidate && a.issue && a.candidate === cand && issues.includes(a.issue)) ??
    audit.find((a) => a.quote && q && a.quote === q && (!a.candidate || a.candidate === cand)) ??
    null
  );
}

/** Whether a stance may be stated and counted, and which source to cite. One function for the site and Towny. */
export function stanceEligibility(s: StanceLike, campaignSite?: string | null, ctx: GateCtx = {}, audit: AuditRecord[] = AUDIT): StanceGate {
  const url = String(s.sourceUrl ?? "");
  const q = String(s.quote ?? "");
  if (!s.voteRecord && isSlogan(q)) return { ok: false, reason: "slogan" };
  if (isBallotpedia(url)) {
    const k = BY_QUOTE[qkey(q)]?.kind;
    const a = auditFor(s, ctx, audit);
    if (a && !a.keep) return { ok: false, reason: "audit drop" };
    if (a && a.keep) {
      const fallbackUrl = k === "campaign" && campaignSite ? campaignSite : url;
      const u = a.url ?? fallbackUrl;
      const label = a.label ?? (k === "survey" ? CANDIDATE_CONNECTION : host(u) || "source");
      return { ok: true, url: u, label, via: "audit" };
    }
    if (k === "survey") return { ok: true, url, label: CANDIDATE_CONNECTION, via: "survey" };
    if (k === "campaign") return campaignSite ? { ok: true, url: campaignSite, label: host(campaignSite), via: "campaign" } : { ok: true, url, label: "Campaign site text on Ballotpedia", via: "campaign" };
    return { ok: false, reason: "ballotpedia voice" };
  }
  return { ok: true, url, label: host(url) || "source", via: "own" };
}
