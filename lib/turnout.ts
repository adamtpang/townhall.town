// Turnout plug-in for the shared contract in lib/types.ts.
// Fills Jurisdiction.turnout with official county numbers. Every number is
// sourced; anything missing stays undefined and the UI says "no record found".
import data from "../data/turnout.json";
import type { Source, TurnoutStats } from "./types";

type RawElection = {
  election: string;
  date: string;
  registered: number | null;
  ballotsCast: number | null;
  turnoutPct: number | null;
  sources: string[];
};
type RawCounty = {
  zip: string;
  county: string;
  state: string;
  elections: RawElection[];
  eligiblePopulation: { value: number; year?: string; source: string } | null;
  registered2026: { value: number; asOf?: string; source: string } | null;
  notes?: string;
};
const counties = (data as { asOf: string; counties: RawCounty[] }).counties;

const src = (url: string, label = new URL(url).hostname.replace(/^www\./, "")): Source => ({ label, url });

/** Extra numbers the turnout panel shows beyond the shared TurnoutStats. */
export type TurnoutDetail = TurnoutStats & {
  county: string;
  turnoutPct?: number;
  previous?: { election: string; turnoutPct: number | null };
  registered2026?: { value: number; asOf?: string; source: Source };
  nonVoterBasis?: string;
  yourBallotOneIn?: number;
  ifEveryoneVoted?: { ballots: number; multiplier: number };
};

export function getTurnout(zip: string): TurnoutDetail | null {
  const c = counties.find((x) => x.zip === zip);
  if (!c) return null;
  const elections = [...c.elections].sort((a, b) => b.date.localeCompare(a.date));
  const latest = elections[0];
  if (!latest) return null;

  const urls = new Set(elections.flatMap((e) => e.sources));
  if (c.eligiblePopulation) urls.add(c.eligiblePopulation.source);
  if (c.registered2026) urls.add(c.registered2026.source);

  const cast = latest.ballotsCast ?? undefined;
  const registered = latest.registered ?? undefined;
  const eligible = c.eligiblePopulation?.value;

  let eligibleNonVoters: number | undefined;
  let nonVoterBasis: string | undefined;
  if (cast != null && eligible != null && eligible > cast) {
    eligibleNonVoters = eligible - cast;
    nonVoterBasis = `Eligible population (${c.eligiblePopulation?.year ?? "latest"}) minus ballots cast in ${latest.election}`;
  } else if (cast != null && registered != null && registered > cast) {
    eligibleNonVoters = registered - cast;
    nonVoterBasis = `Registered voters who did not vote in ${latest.election}`;
  }

  const turnoutPct =
    latest.turnoutPct ?? (cast != null && registered ? Number(((cast / registered) * 100).toFixed(1)) : undefined);

  return {
    pastElection: latest.election,
    voteShare: [],
    registered,
    ballotsCast: cast,
    eligibleNonVoters,
    sources: [...urls].map((u) => src(u)),
    county: c.county,
    turnoutPct,
    previous: elections[1] ? { election: elections[1].election, turnoutPct: elections[1].turnoutPct } : undefined,
    registered2026: c.registered2026
      ? { value: c.registered2026.value, asOf: c.registered2026.asOf, source: src(c.registered2026.source) }
      : undefined,
    nonVoterBasis,
    yourBallotOneIn: cast,
    ifEveryoneVoted:
      cast && eligibleNonVoters != null
        ? { ballots: cast + eligibleNonVoters, multiplier: Number(((cast + eligibleNonVoters) / cast).toFixed(2)) }
        : undefined,
  };
}

/** Attach turnout to a Jurisdiction-shaped object without changing anything else. */
export function withTurnout<T extends { zip: string }>(j: T): T & { turnout?: TurnoutDetail } {
  const turnout = getTurnout(j.zip);
  return turnout ? { ...j, turnout } : j;
}
