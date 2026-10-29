// Shared data contract for townhall.town. Plug-in modules (accountability, turnout)
// should import these types and add optional fields rather than changing existing ones.

export type Source = { label: string; url: string; retrieved?: string };

export type Politician = {
  name: string;
  party: string | null;            // as listed on the ballot; never used for color coding
  incumbent: boolean | "unsure";
  ballotpedia?: string | null;
  officialSite?: string | null;
  x?: string | null;               // X profile URL
  photo?: { url: string; credit: string; license?: string; page?: string } | null;
  finance?: Source | null;         // FEC (federal) or TEC (Texas state) link
  positions?: { issue: string; text: string; source: Source }[]; // stated positions only
  // Plug-in fields (optional):
  accountability?: AccountabilityRecord[]; // from lib/accountability.ts
};

export type AccountabilityRecord = {
  promise: string;
  promiseSource: Source;
  record: string | "no record found";
  recordSource?: Source;
  status: "kept" | "broken" | "in progress" | "unclear" | "no record found";
};

export type Race = {
  id: string;                       // e.g. "tx-35", "tx-governor", "ca-prop-40"
  title: string;
  level: "federal" | "state" | "county" | "local" | "measure";
  office: string;                   // plain words: what the office controls
  candidates: Politician[];         // empty for ballot measures
  source: string;
  market?: { platform: "polymarket" | "kalshi"; odds: Record<string, number>; url: string; fetchedAt: string; matchedByTitle?: boolean } | null;
  // Plug-in field (optional):
  turnout?: TurnoutStats;           // from lib/turnout.ts
};

export type TurnoutStats = {
  pastElection: string;             // e.g. "2022 general"
  voteShare: { name: string; party?: string; pct: number }[];
  registered?: number;
  ballotsCast?: number;
  eligibleNonVoters?: number;
  sources: Source[];
};

export type Jurisdiction = {
  zip: string;
  state: "TX" | "CA" | "NY";
  place: string;
  county: string;
  counties: string[];
  districts: { id: string; label: string; note?: string }[];
  districtSource: Source;
  splitWarning?: string;
  electionDate: string;             // "2026-11-03"
  races: Race[];
  problems?: { id: string; label: string; value: string; year: string; source: Source }[];
  turnout?: TurnoutStats;           // jurisdiction-level, from lib/turnout.ts
};
