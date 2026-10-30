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
  photo?: { url: string; credit: string; author?: string; license?: string; page?: string; hotlinked?: boolean } | null;
  finance?: Source | null;         // FEC (federal) or TEC (Texas state) link
  positions?: { issue: string; text: string; source: Source; form?: "vote" | "summary" | "quote"; year?: string | number }[]; // stated positions only
  causes?: Cause[];                // issues the candidate talks about most, from their own campaign themes
  // Plug-in fields (optional):
  money?: Money;                   // from lib/money.ts (FEC, federal only)
};

// A cause pill: keyword match in the candidate's verbatim campaign themes, with the sentence that matched.
export type Cause = { id: string; label: string; mentions: number; quote: string; match?: string; source: Source };

export type Race = {
  id: string;                       // e.g. "tx-35", "tx-governor", "ca-prop-40"
  title: string;
  /** Ballot order line (lib/towny/ballotOrder.ts withOrderLines), added server-side; absent for one-choice contests. */
  order?: OrderLine | null;
  level: "federal" | "state" | "county" | "local" | "measure";
  office: string;                   // plain words: what the office controls
  candidates: Politician[];         // empty for ballot measures
  source: string;
  market?: { platform: "polymarket"; odds: Record<string, number>; url: string; fetchedAt: string } | null;
  // Plug-in field (optional):
  turnout?: TurnoutStats;
  judicial?: "tx" | "ca" | "ny" | boolean;
  judicialNoteSource?: { url: string; label: string }; // official conduct rule behind judicialNote (lib/judicial.ts)
  judicialNote?: string;            // set on every judicial race (lib/judicial.ts)           // from lib/turnout.ts
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
  spent?: number;                 // optional: Civic finance_fixes18 rows carry only receipts, cash on hand and coverage
  cashOnHand: number;
  individual?: number;
  smallDonorPct?: number | null;  // unitemized (under $200) share of individual contributions
  inStatePct?: number | null;     // share of itemized individual dollars from the candidate's state
  topEmployers?: { name: string; total: number }[];
  topCommittees?: { name: string; kind: string; total: number }[];
  coverageThrough: string | null;
  lastReport: string | null;
  committee?: { id: string; name: string } | null;
  note?: string;                  // short sourced caveat, e.g. Civic's Ortiz note; shown in small muted text
  verified?: string;              // set on rows Civic checked (finance_fixes18)
  source: Source;
  donorsSource?: Source;
  fetchedAt: string;
};

/** "Listed in the order on the official sample ballot." or the unsure line, with the source it points at. */
export type OrderLine = { text: string; confirmed: boolean; url: string | null; label: string | null };
