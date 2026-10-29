// Shared data contract for townhall.town. Plug-in modules (turnout)
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
  causes?: Cause[];                // issues the candidate talks about most, from their own campaign themes
  // Plug-in fields (optional):
  money?: Money;                   // from lib/money.ts (FEC, federal only)
};

// A cause pill: keyword match in the candidate's verbatim campaign themes, with the sentence that matched.
export type Cause = { id: string; label: string; mentions: number; quote: string; match?: string; source: Source };

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

// Campaign money from FEC filings. Donors are shown by employer or committee, never by individual name.
export type Money = {
  raised: number;
  spent: number;
  cashOnHand: number;
  individual: number;
  smallDonorPct: number | null;   // unitemized (under $200) share of individual contributions
  inStatePct: number | null;      // share of itemized individual dollars from the candidate's state
  topEmployers?: { name: string; total: number }[];
  topCommittees?: { name: string; kind: string; total: number }[];
  coverageThrough: string | null;
  lastReport: string | null;
  committee: { id: string; name: string } | null;
  source: Source;
  donorsSource?: Source;
  fetchedAt: string;
};
