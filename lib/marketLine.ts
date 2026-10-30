// Polymarket-only market line (Adam, Oct 29 2026). Built only from a live Polymarket quote fetched for this request.
// No quote, no line: nothing is cached, estimated or filled in.
import { polymarketCloseness } from "./marketsCore.mjs";

export type PolyQuote = { source: "Polymarket"; title: string; url: string; outcomes: { name: string; prob: number }[]; fetchedAt: string };

/** Fetch time in the voter-facing zone used across the site: "Oct 29, 10:58 PM CT". */
export function fetchedCT(iso: string): string {
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  return d.toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " CT";
}

/** Whole percent; never shows 0% or 100% for a live contract. */
export function pctOf(p: number): string {
  const n = Math.round(p * 100);
  return n >= 100 ? ">99%" : n <= 0 ? "<1%" : `${n}%`;
}

export type LeaderLine = { name: string; pct: string; url: string; title: string; fetched: string; closeness: "Competitive" | "Not closely contested" };

/** "Leader on Polymarket: <name> at N%". Null unless there is a live Polymarket quote with a priced outcome. */
export function leaderLine(q: PolyQuote | null | undefined): LeaderLine | null {
  if (!q || q.source !== "Polymarket" || !q.url || !q.fetchedAt) return null;
  const top = q.outcomes?.[0];
  if (!top || typeof top.prob !== "number" || !isFinite(top.prob)) return null;
  const closeness = polymarketCloseness(q);
  if (closeness === "No market data") return null;
  return { name: top.name, pct: pctOf(top.prob), url: q.url, title: q.title, fetched: fetchedCT(q.fetchedAt), closeness };
}
