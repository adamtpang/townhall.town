import ballots from "../data/ballots.json";
import ny from "../data/ny.json";
import tx from "../data/tx.json";
import marketMap from "../data/markets-map.json";
import marketCache from "../data/markets-cache.json";
import type { Jurisdiction, Race, Politician } from "./types";
// @ts-ignore plain ESM helper shared with scripts/
import { fetchPolymarket, fetchKalshi } from "./marketsCore.mjs";
import { withAccountability } from "./accountability";
import { getTurnout } from "./turnout";
import { withLicensedPhoto } from "./photos";
import { withMoney } from "./money";

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
export const DEMO_ZIPS = Object.keys(B);

/** Attach the accountability, money and turnout plug-ins (optional contract fields). */
function enrich(b: Ballot): Ballot {
  const turnout = getTurnout(b.zip) ?? undefined;
  return { ...b, turnout, races: b.races.map((r) => ({ ...r, candidates: r.candidates.map((c) => withMoney(withAccountability(withLicensedPhoto(c)))) })) };
}

export function ballotFor(zip: string): Ballot | null {
  const b = baseBallot(zip);
  return b ? enrich(b) : null;
}

function baseBallot(zip: string): Ballot | null {
  if (B[zip]) return { ...B[zip], cached: true };
  const cd = TX.zipToCd[zip];
  if (!cd || !TX.house[String(cd)]) return null;
  return {
    zip,
    state: "TX",
    place: `Texas ZIP ${zip}`,
    county: "unsure",
    counties: [],
    districts: [{ id: `tx-${cd}`, label: `TX-${cd} (U.S. House)`, note: "From the ZIP's center point; verify by address" }],
    districtSource: TX.zipSource,
    splitWarning: "Districts come from the ZIP's center point. If your ZIP sits near a boundary, your House race may differ: verify by address.",
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
  if (!b) return { zip, found: false, message: "Only Texas ZIPs, the California demo ZIPs (94103, 90012) and New York 10001 are covered right now." };
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
