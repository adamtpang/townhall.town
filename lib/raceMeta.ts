// Per-race extras from Civic files, attached server-side (lib/tools.ts enrich):
// - competitiveness.json: contest status, plus a closeness label from the sourced race ratings (Cook Political Report,
//   Sabato's Crystal Ball, Inside Elections) with their links. Kalshi is never used: a rating whose only basis was a
//   Kalshi market is dropped (KALSHI_ONLY_DROPPED). Live Polymarket can raise a race's tier on top (app/RaceTiers.tsx).
// - contestStatus in plain words; sf-supervisor-8 is ranked-choice.
// - news.json: headlines exactly as written, outlet, date, link. No summaries or commentary.
import comp from "../data/civic/competitiveness.json";
import news from "../data/civic/news.json";
import ties from "../data/civic/race_problem_ties.json";

type CompRace = { zip: string; raceId: string; rating: "competitive" | "leans" | "safe" | "unsure"; contestStatus?: string; raters?: { rater: string; rating: string; sourceUrl: string }[]; market?: { source?: string; publicUrl?: string; sourceUrl?: string } | null };
type NewsRace = { zip: string; raceId: string; contestStatus?: string; links: { title: string; outlet: string; date: string; url: string }[] };
const C = (comp as unknown as { races: CompRace[] }).races;
const N = (news as unknown as { races: NewsRace[] }).races;

export type RaceMeta = {
  closeness: "Competitive" | "Leans" | "Not closely contested" | "No rating";
  closenessBasis: { label: string; url: string }[];
  contest: string | null; // "Uncontested", "Retention", "Multi-seat (choose up to 3)"
  rankedChoice?: boolean;
  news: { title: string; outlet: string; date: string; url: string }[];
  /** Civic race_problem_ties.json: what the office can do, and local numbers tied to it. */
  why: { summary: string; problems: { label: string; value: number; unit: string; geography: string; year: string; sourceUrl: string }[]; authority: { issue: string; issues: string[]; role: string; cite: string; sourceUrl: string }[] } | null;
};
type Tie = { authorityIssues?: { issue: string; role: string; sourceUrl: string; sourceCite: string }[]; authoritySummary?: string; problems?: { id: string; label: string; value: number; unit: string; geography: string; year: string; sourceUrl: string }[] };
const T = (ties as unknown as { races: Record<string, Tie> }).races;
/** Civic's authority labels (roleKeys), used exactly as written. */
const ROLE = (ties as unknown as { roleKeys: Record<string, string> }).roleKeys;
function whyFor(raceId: string): RaceMeta["why"] {
  const t = T[raceId];
  if (!t?.authoritySummary) return null;
  const seen = new Set<string>();
  const problems = (t.problems ?? []).filter((p) => p.sourceUrl && !seen.has(p.id) && seen.add(p.id)).slice(0, 3)
    .map(({ label, value, unit, geography, year, sourceUrl }) => ({ label, value, unit, geography, year, sourceUrl }));
  // QA P2: one line per power and source, listing every issue it covers (not "signs or vetoes state bills" six times).
  const groups = new Map<string, { issue: string; issues: string[]; role: string; cite: string; sourceUrl: string }>();
  for (const a of (t.authorityIssues ?? []).filter((a) => a.sourceUrl && ROLE[a.role])) {
    const k = `${a.role}|${a.sourceUrl}|${a.sourceCite}`;
    const g = groups.get(k);
    if (g) { if (!g.issues.includes(a.issue)) g.issues.push(a.issue); }
    else groups.set(k, { issue: a.issue, issues: [a.issue], role: ROLE[a.role], cite: a.sourceCite, sourceUrl: a.sourceUrl });
  }
  const authority = [...groups.values()];
  return { summary: t.authoritySummary, problems, authority };
}

const RANKED_CHOICE = new Set(["sf-supervisor-8"]);

function plainContest(s?: string): string | null {
  if (!s || s === "contested") return null;
  if (s.startsWith("uncontested")) return "Uncontested: one candidate on the ballot";
  if (s.startsWith("retention")) return "Retention: a Yes or No vote on keeping one judge";
  const m = /multi-seat \(\w+ \w+ (\d+)\)/.exec(s);
  if (m) return `Multi-seat: you can choose up to ${m[1]}`;
  return null;
}

// Civic race ids that duplicate an existing repo race (same map as scripts/merge_civic.py DUP).
const DUP: Record<string, string> = { "tx-supreme-court-place-2-unexpired": "tx-supreme-court-place-2", "tx-house-49": "tx-hd-49", "tx-15coa-chief": "tx-15th-coa-chief-justice", "tx-15coa-place-2": "tx-15th-coa-place-2", "tx-15coa-place-3": "tx-15th-coa-place-3", "tx-3coa-chief": "tx-3rd-coa-chief-justice" };
const same = (civicId: string, raceId: string) => civicId === raceId || DUP[civicId] === raceId;

/** Never a Kalshi rater or a Kalshi market (Adam, Oct 29 2026). */
const isKalshi = (s?: string) => /kalshi/i.test(s ?? "");
/**
 * Civic's ratingRule applied to the published raters only (no market): any Toss-up or Tilt -> Competitive; otherwise
 * any Lean -> Leans; otherwise every rater Likely/Solid/Safe -> Not closely contested; otherwise no rating.
 */
export function raterCloseness(raters?: { rater: string; rating: string; sourceUrl: string }[] | null): Pick<RaceMeta, "closeness" | "closenessBasis"> {
  const rs = (raters ?? []).filter((r) => r.rater && r.sourceUrl && !isKalshi(r.rater) && !isKalshi(r.sourceUrl));
  if (!rs.length) return { closeness: "No rating", closenessBasis: [] };
  const closeness: RaceMeta["closeness"] = rs.some((r) => /toss|tilt/i.test(r.rating)) ? "Competitive"
    : rs.some((r) => /\blean/i.test(r.rating)) ? "Leans"
    : rs.every((r) => /likely|solid|safe/i.test(r.rating)) ? "Not closely contested" : "No rating";
  return { closeness, closenessBasis: closeness === "No rating" ? [] : rs.map((r) => ({ label: r.rater, url: r.sourceUrl })) };
}
/** Civic ratings whose only basis was a Kalshi market price (no Cook/Sabato/Inside Elections rating): dropped. */
export const KALSHI_ONLY_DROPPED: { zip: string; raceId: string; rating: string }[] = C
  .filter((c) => c.rating !== "unsure" && raterCloseness(c.raters).closeness === "No rating" && isKalshi(c.market?.source))
  .map((c) => ({ zip: c.zip, raceId: c.raceId, rating: c.rating }));

export function raceMeta(zip: string, raceId: string): RaceMeta | null {
  const c = C.find((r) => r.zip === zip && same(r.raceId, raceId));
  const n = N.find((r) => r.zip === zip && same(r.raceId, raceId));
  const why = whyFor(raceId);
  if (!c && !n && !why) return null;
  const { closeness, closenessBasis } = raterCloseness(c?.raters);
  return {
    closeness,
    closenessBasis,
    contest: plainContest(c?.contestStatus || n?.contestStatus),
    rankedChoice: RANKED_CHOICE.has(raceId) ? true : undefined,
    why,
    news: (n?.links ?? []).map((l) => ({ title: l.title, outlet: l.outlet, date: l.date, url: l.url })),
  };
}
