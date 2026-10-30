import stancesData from "../data/stances.json";
import quoteYears from "../data/quote_years.json";

export type Issue = { id: string; label: string; low: string; high: string; lowShort: string; highShort: string; caOnly?: boolean; question?: string; yesMeansPole?: "high" | "low"; reason?: string; reasonUrl?: string; poles?: Record<string, string> };

/** Each issue is a policy direction from -5 (left end) to +5 (right end), integer steps. Neither end is a party. */
import { duplicateSentenceIds, isExcluded } from "./oneIssue";
import { stanceEligibility } from "./stanceEligibility";
export const ISSUES: Issue[] = [
  { id: "housing", question: "Should government act to lower housing costs?", label: "Housing costs", low: "Government should stay out of housing costs", high: "Government should act to lower housing costs", lowShort: "Hands off", highShort: "Act on costs" },
  { id: "healthcare", question: "Should government expand healthcare access?", label: "Healthcare access", low: "Smaller government role in healthcare", high: "Government should expand healthcare access", lowShort: "Smaller role", highShort: "Expand access" },
  { id: "wages", question: "Should government act to raise wages?", label: "Jobs and wages", low: "Leave wages to the market", high: "Government should act to raise wages", lowShort: "Market", highShort: "Government" },
  { id: "taxes", question: "Would you pay higher taxes for more public services?", label: "Taxes", low: "Lower taxes, fewer public services", high: "Higher taxes, more public services", lowShort: "Lower taxes", highShort: "More services" },
  { id: "safety", question: "Should public safety put more emphasis on detention and enforcement?", label: "Public safety", low: "More emphasis on diversion and prevention", high: "More emphasis on detention and enforcement", lowShort: "Prevention", highShort: "Enforcement" },
  { id: "education", question: "Should public school money follow students to private schools?", label: "Education", low: "Keep public school money in public schools", high: "Let public school money follow students to private schools", lowShort: "Public schools only", highShort: "Money follows students" },
  { id: "energy", question: "Should energy policy put environmental protection and renewables first?", label: "Energy and grid", low: "Prioritize oil and gas", high: "Prioritize environmental protection and renewables", lowShort: "Oil & gas", highShort: "Renewables" },
  { id: "immigration", question: "Should there be more border enforcement?", label: "Immigration and border", low: "Less border enforcement", high: "More border enforcement", lowShort: "Less enforcement", highShort: "More enforcement" },
  { id: "wealthtax", question: "Should California add a new tax on very large fortunes?", label: "Wealth tax (Prop 40)", low: "No new tax on very large fortunes", high: "A new tax on very large fortunes", lowShort: "No new tax", highShort: "New tax", caOnly: true },
  { id: "infrastructure", question: "Should there be more public spending on water and infrastructure?", label: "Water and infrastructure", low: "Less public spending on water and infrastructure", high: "More public spending on water and infrastructure", lowShort: "Spend less", highShort: "Spend more" },
];

/** value null = no usable position (status says why, shown verbatim); never counted. */
export type Stance = { value: number | null; quote?: string; summary?: string; sourceUrl?: string | null; status?: string; voteRecord?: string; bill?: string; year?: number; /** Why the shared eligibility rule made this unsure (lib/stanceEligibility.ts). */ unsureReason?: string; /** Chip label and citation from the shared rule (Civic's audit for Ballotpedia records). */ chip?: string; chipUrl?: string; /** Our own label for the source, when the URL alone would mislabel it. */ sourceTitle?: string };
// Year of each quote, from the source's own date (scripts/quote_years.py). Missing = 'date unsure'.
const YEARS = (quoteYears as unknown as { years: Record<string, { year: number }> }).years;
/** Questionnaires are labeled as such, never as endorsements. */
export function sourceLabel(url?: string | null): string {
  if (!url) return "source";
  if (/growsf\.org\/voter-guide\/questionnaires\//i.test(url)) return "Candidate questionnaire (GrowSF)";
  if (/sfgreens\.org\/questionnaires\//i.test(url)) return "Candidate questionnaire (SF Greens)";
  return "source";
}
type StanceFile = { stances: Record<string, { name: string } & Record<string, Stance | string>> };
const STANCES = (stancesData as unknown as StanceFile).stances;

export const candidateId = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function stancesFor(name: string): Record<string, Stance> {
  const rec = STANCES[candidateId(name)];
  if (!rec) return {};
  const out: Record<string, Stance> = {};
  for (const [k, v] of Object.entries(rec)) if (k !== "name" && typeof v === "object") { const y = (v as Stance).year ?? YEARS[`${candidateId(name)}.${k}`]?.year; out[k] = y ? { ...(v as Stance), year: y } : (v as Stance); }
  // One sentence, one issue (Oct 30 12:10 AM CT): a sentence tagged to several issues keeps only its best-fitting one.
  // Dropped duplicates (and quotes held for a Civic retag) become value null, so they are neither shown nor counted.
  for (const [id] of duplicateSentenceIds(out, ISSUES.map((i) => i.id))) out[id] = { value: null, status: "same sentence as another issue" };
  for (const id of Object.keys(out)) if (out[id].value !== null && isExcluded(name, id, out[id].quote ?? out[id].summary)) out[id] = { value: null, status: "held for a Civic retag" }; // retagged quotes already sit under their new issue in stances.json
  // One eligibility rule for the site and Towny (lib/stanceEligibility.ts, Civic Oct 30 1:54 PM CT): slogans and
  // Ballotpedia records the audit drops (stale) or doesn't list become unsure (display only, value null, never counted). The quote stays for display.
  const label = (id: string) => ISSUES.find((i) => i.id === id)?.label;
  for (const [id, s] of Object.entries(out)) {
    if (s.value === null || !s.sourceUrl) continue;
    const g = stanceEligibility(s, null, { candidate: name, issueId: id, issueLabel: label(id) });
    out[id] = g.ok ? { ...s, chip: g.label, chipUrl: g.url } : { ...s, value: null, status: "unsure", unsureReason: g.reason };
  }
  return out;
}

export type Answers = Record<string, number | null>; // null = skipped

/** Cosine similarity over issues the user answered (not skipped) AND the candidate has a sourced stance on. */
export function overlap(answers: Answers, stances: Record<string, Stance>, issueIds: string[]) {
  const answered = issueIds.filter((id) => typeof answers[id] === "number");
  const shared = answered.filter((id) => stances[id] && stances[id].value !== null);
  let dot = 0, a2 = 0, b2 = 0;
  for (const id of shared) {
    const a = answers[id] as number, b = stances[id].value ?? 0;
    dot += a * b; a2 += a * a; b2 += b * b;
  }
  const cos = a2 && b2 ? dot / Math.sqrt(a2 * b2) : null;
  return { n: shared.length, m: answered.length, shared, pct: cos === null ? null : Math.round(((cos + 1) / 2) * 100) };
}
