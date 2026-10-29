// Tools named in Civic's Towny prompt (towny_prompt.md "Proposed tool interface").
// Logistics come only from data/election_dates.json and data/polling_locations.json.
// Positions come only from data/stances.json, and anything pending, rejected or unverified is never returned.
import { tool } from "ai";
import { z } from "zod";
import stancesData from "../data/stances.json";
import { ISSUES, candidateId } from "./issues";
import { getElectionDates, getPollingLocations } from "./logistics";
import { ballotFor, DEMO_ZIPS } from "./tools";
import { deleteMyData, getPrivacySummary } from "./townyControls";
import type { Politician } from "./types";

const NOT_COVERED = { status: "not covered", message: "Towny covers only ZIPs 78701, 94103 and 10001 for the Nov 3, 2026 election.", officialSite: "https://vote.gov" };
const HIDDEN = new Set(["pending", "under review", "rejected", "unsure", "unverified"]);
type Rec = { name: string } & Record<string, unknown>;
const STANCES = (stancesData as unknown as { stances: Record<string, Rec> }).stances;

/** A candidate on a covered ballot, for their official site. */
function findCandidate(name: string): Politician | null {
  const id = candidateId(name);
  for (const z of DEMO_ZIPS) for (const r of ballotFor(z)?.races ?? []) for (const c of r.candidates) if (candidateId(c.name) === id) return c;
  return null;
}

/** Published stances only, with the quote and its source URL. */
export function getCandidatePositions(name: string, issue?: string) {
  const c = findCandidate(name);
  const rec = STANCES[candidateId(name)];
  const issueIds = issue ? ISSUES.filter((i) => i.id === issue.toLowerCase() || i.label.toLowerCase().includes(issue.toLowerCase())).map((i) => i.id) : null;
  const positions = Object.entries(rec ?? {})
    .filter(([k, v]) => k !== "name" && v && typeof v === "object")
    .filter(([, v]) => !HIDDEN.has(String((v as { status?: string }).status ?? "").toLowerCase()))
    .filter(([k]) => !issueIds || issueIds.includes(k))
    .map(([k, v]) => {
      const s = v as { quote: string; sourceUrl: string };
      return { issue: ISSUES.find((i) => i.id === k)?.label ?? k, quote: s.quote, sourceUrl: s.sourceUrl };
    });
  const base = { name: c?.name ?? name, onCoveredBallot: !!c, officialSite: c?.officialSite ?? null, ballotpedia: c?.ballotpedia ?? null };
  if (!positions.length) return { ...base, status: "no public statement found", issue: issue ?? null };
  return { ...base, status: "published", positions };
}

export const townyTools = {
  getElectionDates: tool({
    description: "Official election dates, hours, registration rules (deadline, openOnOct30, notes) and mail-ballot rules for a covered ZIP, with source URLs. The only source for any date, hour, deadline or eligibility rule.",
    inputSchema: z.object({ zip: z.string().describe("5-digit ZIP") }),
    execute: async ({ zip }) => getElectionDates(zip) ?? NOT_COVERED,
  }),
  getPollingLocations: tool({
    description: "Official early-voting and Election Day sites for a covered ZIP, with dependsOnAddress and the official lookupUrl. The only source for any voting place.",
    inputSchema: z.object({ zip: z.string().describe("5-digit ZIP") }),
    execute: async ({ zip }) => getPollingLocations(zip) ?? NOT_COVERED,
  }),
  getCandidatePositions: tool({
    description: "A candidate's published, sourced positions (exact quote plus sourceUrl), optionally for one issue. Returns status 'no public statement found' when there is none.",
    inputSchema: z.object({ name: z.string().describe("Candidate name as on the ballot"), issue: z.string().optional().describe("Issue, e.g. housing, healthcare, immigration") }),
    execute: async ({ name, issue }) => getCandidatePositions(name, issue),
  }),
  getPrivacySummary: tool({
    description: "Towny's short privacy summary, the privacy page link and the contact. Use for any question about what is stored, shared or trained on.",
    inputSchema: z.object({}),
    execute: async () => getPrivacySummary(),
  }),
  deleteMyData: tool({
    description: "Delete everything stored about this voter. Confirm only what this tool returns.",
    inputSchema: z.object({}),
    execute: async () => deleteMyData(),
  }),
};
