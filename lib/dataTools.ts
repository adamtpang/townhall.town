// AI SDK tools for live public data APIs. Spread into the agent's tools:
//   tools: { ...existingTools, ...civicTools, ...dataTools }
// Every result carries a source URL. A missing key or a failed call returns
// { status: "unavailable", reason } instead of throwing, so the agent loop never breaks.
import { tool } from "ai";
import { z } from "zod";
import { ballotFor } from "./tools";

const TIMEOUT_MS = 8000;
const FEC_KEY = () => process.env.FEC_API_KEY || "DEMO_KEY";
const CONGRESS_KEY = () => process.env.CONGRESS_API_KEY || "DEMO_KEY";

type Unavailable = { status: "unavailable"; reason: string; source?: string };
const unavailable = (reason: string, source?: string): Unavailable => ({ status: "unavailable", reason, source });

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers: { accept: "application/json", ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** OpenFEC: totals for one federal candidate (by FEC id, or by name + state). */
export async function getCampaignFinance(input: { candidateId?: string; name?: string; state?: string; cycle?: number }) {
  const cycle = input.cycle ?? 2026;
  try {
    let id = input.candidateId;
    if (!id) {
      if (!input.name) return unavailable("Pass candidateId or name.");
      const q = new URLSearchParams({ api_key: FEC_KEY(), q: input.name, election_year: String(cycle), per_page: "5" });
      if (input.state) q.set("state", input.state);
      const hits = (await getJson(`https://api.open.fec.gov/v1/candidates/search/?${q}`)).results ?? [];
      if (hits.length !== 1) return { status: hits.length ? "ambiguous" : "no record found", matches: hits.map((h: any) => ({ name: h.name, candidateId: h.candidate_id })) };
      id = hits[0].candidate_id as string;
    }
    const t = (await getJson(`https://api.open.fec.gov/v1/candidates/totals/?api_key=${FEC_KEY()}&candidate_id=${id}&cycle=${cycle}`)).results?.[0];
    const source = `https://www.fec.gov/data/candidate/${id}/`;
    if (!t) return { candidateId: id, status: "no record found", source };
    return { candidateId: id, name: t.name, party: t.party_full, cycle, receipts: t.receipts, disbursements: t.disbursements, cashOnHand: t.cash_on_hand_end_period, coverageEnd: t.coverage_end_date, source };
  } catch (e: any) {
    return unavailable(`OpenFEC: ${e?.message || e}`, "https://api.open.fec.gov/developers/");
  }
}

/** Congress.gov: the current House member for a state + district, with recent sponsored bills. */
export async function getSponsoredBills(input: { state: string; district: number; limit?: number }) {
  const st = input.state.toUpperCase();
  try {
    const members = (await getJson(`https://api.congress.gov/v3/member/${st}/${input.district}?currentMember=true&format=json&api_key=${CONGRESS_KEY()}`)).members ?? [];
    const m = members[0];
    if (!m) return { state: st, district: input.district, status: "no record found" };
    const bills = (await getJson(`https://api.congress.gov/v3/member/${m.bioguideId}/sponsored-legislation?limit=${input.limit ?? 5}&format=json&api_key=${CONGRESS_KEY()}`)).sponsoredLegislation ?? [];
    return {
      member: m.name,
      bioguideId: m.bioguideId,
      party: m.partyName,
      bills: bills.map((b: any) => ({ title: b.title, number: b.type && b.number ? `${b.type} ${b.number}` : null, introduced: b.introducedDate, latestAction: b.latestAction?.text ?? null, congress: b.congress })),
      source: `https://www.congress.gov/member/${m.bioguideId}`,
    };
  } catch (e: any) {
    return unavailable(`Congress.gov: ${e?.message || e}`, "https://api.congress.gov/");
  }
}

/** BLS LAUS: latest county unemployment rate. County comes from countyFips, or from the ZIP's cached ballot. */
export async function getCountyUnemployment(input: { zip?: string; countyFips?: string }) {
  let fips = input.countyFips?.replace(/\D/g, "");
  if (!fips && input.zip) fips = ballotFor(input.zip)?.counties?.[0]?.replace(/^05000US/, "");
  if (!fips || fips.length !== 5) return { status: "no record found", reason: "County unknown for this ZIP; pass a 5-digit countyFips." };
  const series = `LAUCN${fips}0000000003`;
  try {
    const s = (await getJson(`https://api.bls.gov/publicAPI/v2/timeseries/data/${series}`)).Results?.series?.[0];
    const latest = s?.data?.[0];
    if (!latest) return { countyFips: fips, status: "no record found" };
    return {
      countyFips: fips,
      rate: Number(latest.value),
      unit: "%",
      period: `${latest.periodName} ${latest.year}`,
      preliminary: (latest.footnotes ?? []).some((f: any) => f?.code === "P"),
      note: "County rate from BLS LAUS (monthly). The ZIP-level Census ACS figure is a 5-year average for a much smaller area, so the two differ.",
      source: `https://data.bls.gov/timeseries/${series}`,
    };
  } catch (e: any) {
    return unavailable(`BLS: ${e?.message || e}`, "https://www.bls.gov/lau/");
  }
}

/** Open States: state legislators for a point. Needs OPENSTATES_API_KEY. */
export async function getStateLegislators(input: { lat: number; lng: number }) {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) return unavailable("OPENSTATES_API_KEY is not set.", "https://open.pluralpolicy.com/");
  try {
    const r = await getJson(`https://v3.openstates.org/people.geo?lat=${input.lat}&lng=${input.lng}`, { "X-API-KEY": key });
    return {
      legislators: (r.results ?? []).map((p: any) => ({ name: p.name, party: p.party, chamber: p.current_role?.org_classification, district: p.current_role?.district, url: p.openstates_url })),
      source: "https://open.pluralpolicy.com/",
    };
  } catch (e: any) {
    return unavailable(`Open States: ${e?.message || e}`, "https://open.pluralpolicy.com/");
  }
}

/** Google Civic voterinfo: polling place and early-vote sites for an address. Needs GOOGLE_CIVIC_API_KEY. */
export async function getVoterInfo(input: { address: string; electionId?: string }) {
  const key = process.env.GOOGLE_CIVIC_API_KEY;
  if (!key) return unavailable("GOOGLE_CIVIC_API_KEY is not set.", "https://developers.google.com/civic-information");
  const q = new URLSearchParams({ key, address: input.address });
  if (input.electionId) q.set("electionId", input.electionId);
  try {
    const r = await getJson(`https://www.googleapis.com/civicinfo/v2/voterinfo?${q}`);
    const site = (s: any) => ({ name: s.address?.locationName ?? null, address: [s.address?.line1, s.address?.city, s.address?.state, s.address?.zip].filter(Boolean).join(", "), hours: s.pollingHours ?? null });
    return {
      election: r.election?.name ?? null,
      pollingLocations: (r.pollingLocations ?? []).slice(0, 3).map(site),
      earlyVoteSites: (r.earlyVoteSites ?? []).slice(0, 3).map(site),
      officialInfo: r.state?.[0]?.electionAdministrationBody?.electionInfoUrl ?? null,
      source: "https://developers.google.com/civic-information/docs/v2/elections/voterInfoQuery",
    };
  } catch (e: any) {
    return unavailable(`Google Civic: ${e?.message || e}`, "https://developers.google.com/civic-information");
  }
}

/** Census ACS 5-year: median household income and median gross rent for a ZIP (ZCTA). Needs CENSUS_API_KEY. */
export async function getZipIncomeRent(input: { zip: string; year?: number }) {
  const key = process.env.CENSUS_API_KEY;
  const year = input.year ?? 2024;
  const zip = input.zip.replace(/\D/g, "").slice(0, 5);
  const source = `https://data.census.gov/table/ACSDT5Y${year}.B19013?g=860XX00US${zip}`;
  if (!key) return unavailable("CENSUS_API_KEY is not set.", "https://api.census.gov/data/key_signup.html");
  if (zip.length !== 5) return { status: "no record found", reason: "Pass a 5-digit ZIP." };
  const q = new URLSearchParams({ get: "NAME,B19013_001E,B25064_001E", for: `zip code tabulation area:${zip}`, key });
  try {
    const rows = await getJson(`https://api.census.gov/data/${year}/acs/acs5?${q}`);
    const row = rows?.[1];
    if (!row) return { zip, status: "no record found", source };
    // The Census API uses large negative sentinels (e.g. -666666666) for suppressed values.
    const num = (v: string) => (Number(v) >= 0 ? Number(v) : null);
    return { zip, year: `ACS ${year} 5-year`, medianHouseholdIncome: num(row[1]), medianGrossRent: num(row[2]), unit: "USD", source };
  } catch (e: any) {
    // Never echo the request URL: it carries the key.
    return unavailable(`Census API: ${e?.message || e}`, "https://www.census.gov/data/developers.html");
  }
}

export const dataTools = {
  getZipIncomeRent: tool({
    description: "Median household income and median gross rent for a ZIP from the Census ACS 5-year estimates, with a source URL. Returns unavailable if no key is configured.",
    inputSchema: z.object({ zip: z.string(), year: z.number().int().optional() }),
    execute: async (i) => getZipIncomeRent(i),
  }),
  getCampaignFinance: tool({
    description: "Federal campaign finance totals from OpenFEC (receipts, spending, cash on hand) for one candidate, by FEC candidate id or by name and state. Facts only, with a source URL.",
    inputSchema: z.object({ candidateId: z.string().optional(), name: z.string().optional(), state: z.string().length(2).optional(), cycle: z.number().optional() }),
    execute: async (i) => getCampaignFinance(i),
  }),
  getSponsoredBills: tool({
    description: "The current U.S. House member for a state and district, and the most recent bills they sponsored, from Congress.gov. Report the record; never judge it.",
    inputSchema: z.object({ state: z.string().length(2), district: z.number().int(), limit: z.number().int().max(10).optional() }),
    execute: async (i) => getSponsoredBills(i),
  }),
  getCountyUnemployment: tool({
    description: "Latest monthly county unemployment rate from BLS LAUS, for a ZIP we cover or a 5-digit county FIPS code.",
    inputSchema: z.object({ zip: z.string().optional(), countyFips: z.string().optional() }),
    execute: async (i) => getCountyUnemployment(i),
  }),
  getStateLegislators: tool({
    description: "State legislators (state senate and house/assembly) for a latitude and longitude, from Open States. Returns unavailable if no key is configured.",
    inputSchema: z.object({ lat: z.number(), lng: z.number() }),
    execute: async (i) => getStateLegislators(i),
  }),
  getVoterInfo: tool({
    description: "Polling place and early-vote sites for a street address, from the Google Civic Information voterinfo API. Returns unavailable if no key is configured.",
    inputSchema: z.object({ address: z.string(), electionId: z.string().optional() }),
    execute: async (i) => getVoterInfo(i),
  }),
};
