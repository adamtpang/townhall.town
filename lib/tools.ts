import ballots from "../data/ballots.json";
import marketMap from "../data/markets-map.json";
import marketCache from "../data/markets-cache.json";
// @ts-ignore plain ESM helper shared with scripts/
import { fetchPolymarket, fetchKalshi } from "./marketsCore.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Ballot = any;
const B = ballots as unknown as Record<string, Ballot>;
export const DEMO_ZIPS = Object.keys(B);

export function ballotFor(zip: string): Ballot | null {
  return B[zip] ?? null;
}

export function getDistricts(zip: string) {
  const b = ballotFor(zip);
  if (!b) return { zip, found: false, message: "We only have demo ZIPs cached right now: " + DEMO_ZIPS.join(", ") };
  return { zip, found: true, state: b.state, place: b.place, county: b.county, districts: b.districts, source: b.districtSource, splitWarning: b.splitWarning };
}

export function getRaces(zip: string) {
  const b = ballotFor(zip);
  if (!b) return { zip, races: [], measures: [] };
  return {
    zip,
    electionDate: b.electionDate,
    races: b.races.map((r: any) => ({ id: r.id, title: r.title, office: r.office, source: r.source })),
    measures: b.measures.map((m: any) => ({ id: m.id, title: m.title, source: m.source })),
    measuresNote: b.measuresNote,
  };
}

export function getCandidates(zip: string, raceIds?: string[]) {
  const b = ballotFor(zip);
  if (!b) return { zip, races: [] };
  const races = b.races.filter((r: any) => !raceIds?.length || raceIds.includes(r.id));
  return {
    zip,
    races: races.map((r: any) => ({ id: r.id, title: r.title, candidates: r.candidates.map((c: any) => ({ name: c.name, party: c.party, incumbent: c.incumbent })) })),
  };
}

type MarketQuote = { source: string; title: string; url: string; api: string; outcomes: { name: string; prob: number }[]; fetchedAt: string; cached?: boolean };

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
      quotes.sort((a, b) => a.source.localeCompare(b.source));
      out[id] = { quotes, status: quotes.length ? (live === quotes.length ? "live" : live ? "partly cached" : "cached") : "no market found" };
    })
  );
  return out;
}

export function getLocalProblems(zip: string) {
  const b = ballotFor(zip);
  if (!b) return { zip, problems: [] };
  return { zip, problems: b.problems, context: b.context };
}
