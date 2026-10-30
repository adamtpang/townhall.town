import NY_NOTES from "../data/ny-applies-notes.json";
import ballots from "../data/ballots.json";
import { JUDICIAL_NOTE, judicialSource } from "./judicial";
import ny from "../data/ny.json";
import tx from "../data/tx.json";
import marketMap from "../data/markets-map.json";
import type { Jurisdiction, Race, Politician } from "./types";
import { COVERED_ZIPS, isCoveredZip, UNSUPPORTED_MESSAGE } from "./site";
// @ts-ignore plain ESM helper shared with scripts/
import { fetchPolymarket, marketCoversBallot } from "./marketsCore.mjs";
import { getTurnout } from "./turnout";
import { withLicensedPhoto, gatePhotos, slug as nameSlug } from "./photos";
import SITES from "../data/campaign-sites.json";
import { liveUrl } from "./links";
import { withMoney } from "./money";
import { raceMeta } from "./raceMeta";
import { stancesFor, sourceLabel, ISSUES } from "./issues";
import { stanceForm } from "./stanceForm";
import { draftWording } from "./plain";

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

/** QA P2 (60582ae): agents get the same published, sourced stances the site shows (data/stances.json),
 *  each with its exact text and source link. Nothing pending, unsourced or null is returned; judicial candidates get none. */
const apiSourceLabel = (u: string) => { const l = sourceLabel(u); if (l !== "source") return l; try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
function publishedPositions(name: string) {
  return Object.entries(stancesFor(name))
    .filter(([, st]) => st && st.value !== null && st.value !== undefined && st.sourceUrl && (st.quote || (st as { voteRecord?: string }).voteRecord))
    .map(([id, st]) => {
      const vr = (st as { voteRecord?: string }).voteRecord;
      return { issue: ISSUES.find((i) => i.id === id)?.label ?? id, text: vr ? `${vr}${st.quote ? `: ${st.quote}` : ""}` : String(st.quote), form: stanceForm(st as { voteRecord?: string; sourceUrl?: string }), ...(st.year ? { year: st.year } : {}), source: st.chipUrl && st.chip && st.chip !== "source" ? { label: st.chip, url: st.chipUrl } : { label: apiSourceLabel(String(st.sourceUrl)), url: String(st.sourceUrl) } };
    });
}

/** QA P2: one naming style for Texas seats ("Office, District N"), matching the county's own ballot style.
 *  Display only: ids, sources and market matching are unchanged. */
export function txTitle(t: string): string {
  return t
    .replace(/^Texas House District (\d+)$/, "State Representative, District $1")
    .replace(/^U\.S\. House Texas District (\d+)$/, "U.S. Representative, District $1")
    .replace(/^U\.S\. Senate Texas$/, "U.S. Senator")
    .replace(/^State Board of Education District (\d+)$/, "State Board of Education, District $1")
    .replace(/^Texas Supreme Court Chief Justice$/, "Chief Justice, Texas Supreme Court")
    .replace(/^Texas Supreme Court Place (\d+)( \(Unexpired Term\))?$/, "Justice, Texas Supreme Court, Place $1$2")
    .replace(/^Texas Court of Criminal Appeals Place (\d+)$/, "Judge, Court of Criminal Appeals, Place $1")
    .replace(/^(\d+(?:st|nd|rd|th)) Court of Appeals Chief Justice$/, "Chief Justice, $1 Court of Appeals")
    .replace(/^(\d+(?:st|nd|rd|th)) Court of Appeals Place (\d+)$/, "Justice, $1 Court of Appeals, Place $2")
    .replace(/^Travis County Commissioner, Precinct (\d+)$/, "County Commissioner, Precinct $1")
    .replace(/^County Constable, Precinct (\d+) - Unexpired Term$/, "Constable, Precinct $1 (Unexpired Term)");
}

/** Attach the money and turnout plug-ins (optional contract fields). */
function enrich(b: Ballot): Ballot {
  const turnout = getTurnout(b.zip) ?? undefined;
  const titleN = new Map<string, number>();
  for (const r of b.races) titleN.set(r.title, (titleN.get(r.title) ?? 0) + 1);
  return { ...b, turnout, races: b.races.map((r0) => {
    // Same-titled single-candidate seats (CA retention races) get the justice's name so each title is distinct.
    const dup = (titleN.get(r0.title) ?? 0) > 1 && r0.candidates.length === 1;
    const t0 = b.state === "TX" ? txTitle(r0.title) : r0.title;
    const r = { ...r0, title: dup ? t0.replace(/( \(retention[^)]*\))?$/, (m) => `: ${r0.candidates[0].name}${m}`) : t0 } as Race;
    // Civic qa_fixes4 (Oct 30): NYC rows keep the TENTATIVE label and use Civic's per-race source text (data/ny-applies-notes.json),
    // after the existing SPLIT text where there is one. Other notes keep the draft wording.
    { const a = r as { id: string; appliesNote?: string; splitNote?: string; sourceNote?: string };
      const civic = (NY_NOTES.byRace as Record<string, string>)[a.id];
      if (civic) { const split = /^SPLIT[^]*?(?=\s*Source:|$)/.exec(a.appliesNote ?? "")?.[0]?.trim(); a.splitNote = split || undefined; a.sourceNote = civic; a.appliesNote = split ? `${split} ${civic}` : civic; }
      else if (a.appliesNote) a.appliesNote = draftWording(a.appliesNote); }
    if (/^\s*unsure/i.test(String((r as { office?: string }).office ?? ""))) (r as { office?: string }).office = undefined; // never show "unsure" as an office description
    // Judicial races: no issue tags and no "why it matters" issue stats (judges can't campaign on issues).
    const meta = raceMeta(b.zip, r.id);
    const jud = !!(r as { judicial?: unknown }).judicial;
    // Civic rule (a): no keyword-matched tags anywhere. `causes` are all keyword matches; `positions` keep only
    // entries that are not keyword matches, and judicial candidates keep none.
    const sourced = (ps: unknown) => (Array.isArray(ps) ? ps.filter((p: { match?: string }) => !/keyword/i.test(String(p?.match ?? ""))) : []);
    const cands = r.candidates.map((c) => {
      const kept = jud ? [] : sourced((c as { positions?: unknown }).positions);
      const ps = jud ? [] : kept.length ? kept : publishedPositions(c.name);
      const site = (c as { campaignSite?: string | null }).campaignSite || (SITES.bySlug as Record<string, string>)[nameSlug(c.name)] || null;
      const live = { campaignSite: liveUrl(site), officialSite: liveUrl(c.officialSite), ballotpedia: liveUrl((c as { ballotpedia?: string | null }).ballotpedia) };
      return withMoney(withLicensedPhoto({ ...c, ...live, causes: undefined, positions: ps.length ? ps : undefined } as typeof c));
    });
    return { ...r, ...(jud ? { judicialNote: JUDICIAL_NOTE, judicialNoteSource: judicialSource((r as { judicial?: unknown }).judicial, b.state) } : {}), meta: jud && meta ? { ...meta, why: null } : meta, candidates: gatePhotos(cands, undefined, r.id) /* PHOTO_GATE (lib/photos.ts): race mode by default = if any candidate in a race lacks a real photo, the whole race shows initials (Oct 29 11:34 PM) */ };
  }) };
}

export function ballotFor(zip: string): Ballot | null {
  if (!isCoveredZip(zip)) return null;
  const b = baseBallot(zip);
  return b ? enrich(b) : null;
}

/** Adam's scope for the Hack Fair build: only fully sourced ZIPs. Other ZIPs get "Austin, SF and NYC for now." */
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

export type MarketQuote = { source: "Polymarket"; title: string; url: string; api: string; outcomes: { name: string; prob: number }[]; listed?: string[]; fetchedAt: string };

/** Polymarket slug per race or measure id (data/markets-map.json). No entry: no matching Polymarket market. */
export const MARKET_SLUGS: Record<string, string> = Object.fromEntries(
  Object.entries(marketMap as Record<string, unknown>).flatMap(([id, v]) => (v && typeof v === "object" && typeof (v as { polymarket?: unknown }).polymarket === "string" ? [[id, (v as { polymarket: string }).polymarket]] : []))
);

/** Ballot candidate names per race id, across the covered ZIPs (the market coverage rule checks these). */
function ballotNamesFor(id: string): string[] {
  for (const z of COVERED_ZIPS) {
    const r = ballotFor(z)?.races.find((x) => x.id === id) as { candidates?: { name: string }[] } | undefined;
    if (r) return (r.candidates ?? []).map((c) => c.name);
  }
  return [];
}

/**
 * Live Polymarket prices only. No cache, no other market, no estimate: a failed fetch is "unavailable"
 * with no quote, and a race with no matching market is "no market found". A candidate-race market that leaves out
 * anyone on the ballot is hidden ("market does not list every ballot candidate"), e.g. a primary-field market.
 */
/** Polymarket placeholder outcome names: "Option A", "Person B", a bare letter, or "Other". */
export const isListedPlaceholder = (n: string) => /^(?:(?:person|option)\s+)?[a-z0-9]$|^other$/i.test(String(n).trim());
export const BALLOT_NAMES_ONLY = new Set(["ca-gov"]);
export type MarketStatus = "live" | "unavailable" | "no market found" | "market does not list every ballot candidate";
export async function getMarketOdds(raceIds: string[], fetcher: (slug: string, timeoutMs?: number) => Promise<MarketQuote> = fetchPolymarket as never, namesFor: (id: string) => string[] = ballotNamesFor) {
  const out: Record<string, { quotes: MarketQuote[]; status: MarketStatus }> = {};
  await Promise.all(
    raceIds.map(async (id) => {
      const slug = MARKET_SLUGS[id];
      if (!slug) return void (out[id] = { quotes: [], status: "no market found" });
      try {
        let q = await fetcher(slug, 3000);
        // Civic qa_fixes4: ca-gov's market lists 20+ active people who are not on the ballot; show ballot names only.
        if (q && BALLOT_NAMES_ONLY.has(id)) { const ok = (n: string) => namesFor(id).some((b) => marketCoversBallot([n], [b])); q = { ...q, outcomes: (q.outcomes ?? []).filter((o) => ok(o.name)), listed: (q.listed ?? []).filter(ok) }; }
        if (!q || !q.outcomes?.length) return void (out[id] = { quotes: [], status: "unavailable" });
        const listed = q.listed?.length ? q.listed : q.outcomes.map((o) => o.name);
        if (!marketCoversBallot(listed, namesFor(id))) return void (out[id] = { quotes: [], status: "market does not list every ballot candidate" });
        // QA 7391b20 P1: Polymarket's unnamed slots ("Option A", "Person B", "A", "Other") never reach the API.
        const named = listed.filter((n) => !isListedPlaceholder(n));
        out[id] = { quotes: [{ ...q, listed: named }], status: "live" };
      } catch {
        out[id] = { quotes: [], status: "unavailable" };
      }
    })
  );
  return out;
}

export function getLocalProblems(zip: string) {
  const b = ballotFor(zip);
  if (!b) return { zip, problems: [] };
  return { zip, problems: b.problems || [], context: b.context, note: b.problems?.length ? undefined : "Census metrics are cached for the demo ZIPs only." };
}
