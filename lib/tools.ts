import ballots from "../data/ballots.json";
import ny from "../data/ny.json";
import tx from "../data/tx.json";
import marketMap from "../data/markets-map.json";
import marketCache from "../data/markets-cache.json";
import type { Jurisdiction, Race, Politician } from "./types";
import { COVERED_ZIPS, isCoveredZip, UNSUPPORTED_MESSAGE } from "./site";
// @ts-ignore plain ESM helper shared with scripts/
import { fetchPolymarket, fetchKalshi } from "./marketsCore.mjs";
import { getTurnout } from "./turnout";
import { withLicensedPhoto } from "./photos";
import { withMoney } from "./money";
import { raceMeta } from "./raceMeta";

/** Jurisdiction plus app-only extras (measures, verify links, context). Extra fields only; contract fields unchanged. */
export type Ballot = Jurisdiction & {
  measures: { id: string; title: string; summary?: string; type?: string; source: string }[];
  measuresNote?: string;
  verify?: { label: string; url: string };
  context?: { medianIncome?: number; medianRent?: number; population?: number; profile?: string };
  cached: boolean;
};

const B = { ...ballots, ...ny } as unknown as Record<string, Ballot>;
const TX = tx as unknown as { statewide: Race[]; house: Record<string, Race>; zipToCd: Record<string, number>; zipSource: { label: string; url: string } };
// Served ZIPs only (lib/site.ts). Other cached ballots (78130, 90012) and the statewide Texas ZIP path stay in data but are never served.
export const DEMO_ZIPS = COVERED_ZIPS.filter((z) => z in B);

/** Attach the money and turnout plug-ins (optional contract fields). */
function enrich(b: Ballot): Ballot {
  const turnout = getTurnout(b.zip) ?? undefined;
  const titleN = new Map<string, number>();
  for (const r of b.races) titleN.set(r.title, (titleN.get(r.title) ?? 0) + 1);
  return { ...b, turnout, races: b.races.map((r0) => {
    // Same-titled single-candidate seats (CA retention races) get the justice's name so each title is distinct.
    const dup = (titleN.get(r0.title) ?? 0) > 1 && r0.candidates.length === 1;
    const r = { ...r0, title: dup ? r0.title.replace(/( \(retention[^)]*\))?$/, (m) => `: ${r0.candidates[0].name}${m}`) : r0.title } as Race;
    if (/^\s*unsure/i.test(String((r as { office?: string }).office ?? ""))) (r as { office?: string }).office = undefined; // never show "unsure" as an office description
    // Judicial races: no issue tags and no "why it matters" issue stats (judges can't campaign on issues).
    const meta = raceMeta(b.zip, r.id);
    const jud = !!(r as { judicial?: unknown }).judicial;
    // Civic rule (a): no keyword-matched tags anywhere. `causes` are all keyword matches; `positions` keep only
    // entries that are not keyword matches, and judicial candidates keep none.
    const sourced = (ps: unknown) => (Array.isArray(ps) ? ps.filter((p: { match?: string }) => !/keyword/i.test(String(p?.match ?? ""))) : []);
    const cands = r.candidates.map((c) => {
      const ps = jud ? [] : sourced((c as { positions?: unknown }).positions);
      return withMoney(withLicensedPhoto({ ...c, causes: undefined, positions: ps.length ? ps : undefined } as typeof c));
    });
    return { ...r, meta: jud && meta ? { ...meta, why: null } : meta, candidates: cands /* Design 8:05: initials only where a photo is truly missing */ };
  }) };
}

export function ballotFor(zip: string): Ballot | null {
  if (!isCoveredZip(zip)) return null;
  const b = baseBallot(zip);
  return b ? enrich(b) : null;
}

/** Adam's scope for the Hack Fair build: only fully sourced ZIPs. Other ZIPs get "We only cover 78701 (Austin), 94103 (San Francisco) and 10001 (New York) for now." */
export const SCOPE = new Set(["78701", "94103", "10001"]);

function baseBallot(zip: string): Ballot | null {
  if (!SCOPE.has(zip)) return null;
  if (B[zip]) return { ...B[zip], cached: true };
  const cd = TX.zipToCd[zip];
  if (!cd || !TX.house[String(cd)]) return null;
  return {
    zip,
    state: "TX",
    place: `Texas ZIP ${zip}`,
    county: "unsure",
    counties: [],
    districts: [{ id: `tx-${cd}`, label: `TX-${cd} (U.S. House)`, note: "Your ZIP may cross district lines; check by address" }],
    districtSource: TX.zipSource,
    splitWarning: "Your ZIP may cross district lines. Check your exact district by address.",
    electionDate: "2026-11-03",
    races: [TX.house[String(cd)], ...TX.statewide],
    measures: [],
    measuresNote: "No statewide Texas measures are on the Nov 3, 2026 ballot (Ballotpedia). Local measures are not covered yet.",
    verify: { label: "VoteTexas.gov (official)", url: "https://www.votetexas.gov/" },
    cached: false,
  };
}

export function getDistricts(zip: string) {
  const b = ballotFor(zip);
  if (!b) return { zip, found: false, message: UNSUPPORTED_MESSAGE };
  return { zip, found: true, state: b.state, place: b.place, county: b.county, districts: b.districts, source: b.districtSource, splitWarning: b.splitWarning };
}

export function getRaces(zip: string) {
  const b = ballotFor(zip);
  if (!b) return { zip, races: [], measures: [] };
  return {
    zip,
    electionDate: b.electionDate,
    races: b.races.map((r) => ({ id: r.id, title: r.title, office: r.office, source: r.source })),
    measures: b.measures.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    measuresNote: b.measuresNote,
  };
}

export function getCandidates(zip: string, raceIds?: string[]) {
  const b = ballotFor(zip);
  if (!b) return { zip, races: [] };
  const races = b.races.filter((r) => !raceIds?.length || raceIds.includes(r.id));
  return {
    zip,
    races: races.map((r) => ({ id: r.id, title: r.title, candidates: r.candidates.map((c: Politician) => ({ name: c.name, party: c.party, incumbent: c.incumbent })) })),
  };
}

export type MarketQuote = { source: string; title: string; url: string; api: string; outcomes: { name: string; prob: number }[]; fetchedAt: string; cached?: boolean; matchedByTitle?: boolean };

export async function getMarketOdds(raceIds: string[]) {
  const map = marketMap as Record<string, { polymarket?: string; kalshi?: string }>;
  const cache = marketCache as unknown as Record<string, MarketQuote[]>;
  const out: Record<string, { quotes: MarketQuote[]; status: string }> = {};
  await Promise.all(
    raceIds.map(async (id) => {
      const m = map[id];
      if (!m) {
        out[id] = { quotes: [], status: "no market found" };
        return;
      }
      const quotes: MarketQuote[] = [];
      const jobs: [string, () => Promise<MarketQuote>][] = [];
      if (m.polymarket) jobs.push(["Polymarket", () => fetchPolymarket(m.polymarket, 3000)]);
      if (m.kalshi) jobs.push(["Kalshi", () => fetchKalshi(m.kalshi, 3000)]);
      let live = 0;
      await Promise.all(
        jobs.map(async ([src, fn]) => {
          try {
            quotes.push(await fn());
            live++;
          } catch {
            const c = (cache[id] || []).find((q) => q.source === src);
            if (c) quotes.push({ ...c, cached: true });
          }
        })
      );
      // Ballot-measure markets are matched to the measure by market title, not by an official ID.
      if (id.startsWith("Proposition")) quotes.forEach((q) => (q.matchedByTitle = true));
      quotes.sort((a, b) => a.source.localeCompare(b.source));
      out[id] = { quotes, status: quotes.length ? (live === quotes.length ? "live" : live ? "partly cached" : "cached") : "no market found" };
    })
  );
  return out;
}

export function getLocalProblems(zip: string) {
  const b = ballotFor(zip);
  if (!b) return { zip, problems: [] };
  return { zip, problems: b.problems || [], context: b.context, note: b.problems?.length ? undefined : "Census metrics are cached for the demo ZIPs only." };
}
