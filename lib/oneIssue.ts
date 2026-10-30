/** Rule (Adam, Oct 30 12:10 AM CT): one source sentence counts toward only one issue, in matching and in "x of y".
 *  When the same quote (or theme sentence) is tagged to several issues for one candidate, it stays on the best-fitting
 *  issue (most issue keywords in the sentence; ties go to the earlier issue in issue order) and is dropped from the rest. */
import EXC from "../data/civic-exclusions.json";

const KW: Record<string, RegExp> = {
  housing: /hous|rent|home|afford|zoning|homeless/gi,
  healthcare: /health|medic|hospital|insur|coverage|\bcare\b/gi,
  wages: /wage|worker|\bjobs?\b|labor|\bpay\b|union|employ/gi,
  taxes: /\btax|budget|surplus|revenue/gi,
  safety: /police|crime|safety|prison|jail|bail|enforce|prosecut/gi,
  education: /school|teacher|educat|student|voucher/gi,
  energy: /energy|\bgrid\b|\boil\b|\bgas\b|renewab|climate|solar|wind|clean/gi,
  immigration: /border|immigra|migrant|asylum|deport/gi,
  wealthtax: /wealth|billionaire|fortune/gi,
  infrastructure: /water|infrastructure|road|bridge|transit|flood|investment/gi,
};
export const sentenceKey = (s: { quote?: string | null; summary?: string | null }) => String(s.quote || s.summary || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const fitScore = (issue: string, text: string) => (text.match(KW[issue] ?? /$^/g) ?? []).length;

type St = { value: number | null; quote?: string; summary?: string; status?: string };
/** ids in issue order. Returns the issue ids to drop because their sentence already counts under another issue. */
export function duplicateSentenceIds(stances: Record<string, St>, order: string[]): Map<string, string> {
  const groups = new Map<string, string[]>();
  for (const id of order) { const s = stances[id]; if (!s || s.value === null || s.value === undefined) continue; const k = sentenceKey(s); if (!k) continue; groups.set(k, [...(groups.get(k) ?? []), id]); }
  const drop = new Map<string, string>(); // dropped id -> kept id
  for (const [k, ids] of groups) {
    if (ids.length < 2) continue;
    const best = ids.reduce((a, b) => (fitScore(b, k) > fitScore(a, k) ? b : a));
    for (const id of ids) if (id !== best) drop.set(id, best);
  }
  return drop;
}
type Ex = { name: string; issue: string; match: string; retag?: string };
const hit = (name: string, issue: string, quote?: string | null) => (EXC.exclude as Ex[]).find((x) => x.name.toLowerCase() === name.toLowerCase() && x.issue === issue && new RegExp(x.match, "i").test(String(quote ?? "")));
/** Civic correction for this (candidate, issue, quote): the issue it belongs to instead, or null to hold it out. undefined = no correction. */
export function correctedIssue(name: string, issue: string, quote?: string | null): string | null | undefined {
  const x = hit(name, issue, quote);
  return x ? x.retag ?? null : undefined;
}
/** True when the quote must not count under this issue (held out or retagged elsewhere). */
export const isExcluded = (name: string, issue: string, quote?: string | null) => !!hit(name, issue, quote);
