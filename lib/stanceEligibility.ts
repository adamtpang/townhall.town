// One stance-eligibility rule for the whole site (Civic, Oct 30 1:54 PM CT): lib/issues.stancesFor applies it, so the
// main site's overlap (EndScreen, BallotCard, CandidateRow) and Towny count exactly the same stances.
// 1) Slogans: a line that only ranks how urgent or important an issue is ("few priorities are as urgent as the battle
//    against climate change") says nothing about what the candidate would do. Unsure, not counted. Same rule for everyone.
// 2) Ballotpedia: decided only by Civic's audit, data/civic/bp22/ballotpedia_stance_audit.json (Oct 30), built into
//    lib/civicChecks.gen.json by scripts/build-civic-checks.mjs. Per record: keep_final (not keep), final_reason,
//    recommended_chip_label, recommended_citation_url. keep_final true: counted, with that chip and citation.
//    keep_final false (the stale rule: quote predates the 2026 campaign): unsure, not counted. A ballotpedia.org stance the
//    audit doesn't list is unsure ("not audited"): conservative by default. This replaces the old regex classification
//    (scripts/build-ballotpedia-kinds.mjs), which counted 7 of the 91 records.
//    The audit never overrides the slogan rule.
// Pure; reads only shipped data.
import checks from "./civicChecks.gen.json";
import { qkey, slugOf } from "./civicChecks.mjs";

export { qkey };
type StanceLike = { quote?: string; summary?: string; sourceUrl?: string | null; voteRecord?: string };
export type AuditRecord = { candidate: string | null; issue: string | null; quote: string | null; keep: boolean; label: string | null; url: string | null; reason?: string | null; race?: string | null };

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
  | { ok: true; url: string; label: string; via: "own" | "audit" }
  | { ok: false; reason: "slogan" | "stale" | "audit drop" | "not audited"; detail?: string };

export type GateCtx = { candidate?: string; issueId?: string; issueLabel?: string };

/** Same person, written differently ("Gloria J. Romero" / "Gloria Romero", "Donald P. Wagner" / "Donald P. (Don) Wagner"):
 *  first and last name tokens agree. */
const sameName = (a: string, b: string) => {
  if (a === b) return true;
  const ta = a.split("-").filter(Boolean), tb = b.split("-").filter(Boolean);
  return ta.length > 0 && tb.length > 0 && ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1];
};

/** The audit record for this stance, if Civic's audit lists it: same candidate (name variants allowed) and same issue,
 *  and, when the record carries a quote, the same quote (a changed quote is a different record, not audited). Else by exact quote. */
export function auditFor(s: StanceLike, ctx: GateCtx = {}, audit: AuditRecord[] = AUDIT): AuditRecord | null {
  if (!audit.length) return null;
  const cand = ctx.candidate ? slugOf(ctx.candidate) : null;
  const issues = [ctx.issueId, ctx.issueLabel].filter(Boolean).map((x) => qkey(x!));
  const q = s.quote ? qkey(s.quote) : null;
  return (
    audit.find((a) => a.candidate && a.issue && cand && sameName(a.candidate, cand) && issues.includes(a.issue) && (!a.quote || a.quote === q)) ??
    audit.find((a) => a.quote && q && a.quote === q && (!a.candidate || !cand || sameName(a.candidate, cand)) && (!a.issue || !issues.length || issues.includes(a.issue))) ??
    null
  );
}

/** Whether a stance may be stated and counted, and which source to cite. One function for the site and Towny
 *  (lib/issues.stancesFor, lib/towny/stanceRules.gateStance, lib/townyTools.getCandidatePositions). `campaignSite` is
 *  accepted for older callers; the audit's own citation is used for Ballotpedia records. */
export function stanceEligibility(s: StanceLike, campaignSite?: string | null, ctx: GateCtx = {}, audit: AuditRecord[] = AUDIT): StanceGate {
  void campaignSite;
  const url = String(s.sourceUrl ?? "");
  const q = String(s.quote ?? "");
  if (!s.voteRecord && isSlogan(q)) return { ok: false, reason: "slogan" };
  if (isBallotpedia(url)) {
    const a = auditFor(s, ctx, audit);
    if (!a) return { ok: false, reason: "not audited" };
    if (!a.keep) return { ok: false, reason: /^stale\b/i.test(a.reason ?? "") ? "stale" : "audit drop", ...(a.reason ? { detail: a.reason } : {}) };
    const u = a.url ?? url;
    return { ok: true, url: u, label: a.label ?? (host(u) || "source"), via: "audit" };
  }
  return { ok: true, url, label: host(url) || "source", via: "own" };
}
