// Towny FAQ (Adam 1:18 PM CT Oct 30; facts from Civic, each checked against the code at 4954f93).
// Every answer carries its source links as data. No grades, no picks, no dates promised for new cities.
import { getElectionDates, getPollingLocations } from "../logistics";
import { whereFor } from "../endscreen.mjs";

export type FaqLink = { label: string; url: string };
export type Faq = { id: string; q: string; match: RegExp; a: string; links: FaqLink[] };

export const UNSURE_DATE = "Unsure: we couldn't confirm this in a cited source.";
export const WHO_LINE = "I don't pick for you. I can show where each candidate's sourced positions overlap with your answers.";
export const OFFICE_NAMES: Record<string, string> = { "78701": "Travis County Elections", "94103": "SF Department of Elections", "10001": "NYC Board of Elections" };
// Adam, Oct 30 2:08 PM CT (Civic's choice), and 2:17 PM CT: SF uses this one source everywhere in Towny (when/where,
// ballot order, who's running, same-city).
export const SF_DOE: FaqLink = { label: "SF Department of Elections", url: "https://www.sf.gov/departments/department-elections" };
export const OFFICES: Record<string, FaqLink> = {
  "78701": { label: "Travis County Elections", url: "https://votetravis.gov" },
  "94103": SF_DOE,
  "10001": { label: "NYC Board of Elections", url: "https://vote.nyc" },
};
export const VOTE_GOV: FaqLink = { label: "vote.gov", url: "https://vote.gov" };
const ABOUT = { label: "About townhall.town", url: "https://townhall.town/about" };
const GITHUB = { label: "GitHub", url: "https://github.com/adamtpang/townhall.town" };

export const FAQS: Faq[] = [
  {
    id: "match", q: "How are candidates matched?",
    match: /\b(match|matched|matching|overlap|compare|lines? up)\b/i,
    // Civic, Oct 30 1:38 PM CT: exact wording.
    a: "It shows where each candidate's sourced positions overlap with your answers, which you give on a -2 to +2 scale.",
    links: [ABOUT],
  },
  {
    id: "sources", q: "Where does the data come from?",
    match: /\b(data|sources?|where does .* come from|ballotpedia)\b/i,
    a: "Official election offices and sample ballots, Ballotpedia, League of Women Voters guides, nonpartisan candidate questionnaires, candidates' own campaign sites, and Congress.gov for votes. Every fact links its source. When a fact can't be confirmed, it says unsure.",
    links: [ABOUT, GITHUB],
  },
  {
    id: "partisan", q: "Is it partisan?",
    match: /\b(partisan|biased?|bias|left|right|democrat|republican|lean)\b/i,
    a: "No. townhall.town doesn't endorse candidates, parties or ballot positions, and it doesn't rank or grade candidates. Every candidate in a race gets the same fields in the same layout.",
    links: [ABOUT],
  },
  {
    id: "zips", q: "Why only 3 ZIPs?",
    match: /\b(only (3|three)|why .*zips?|other zips?|more zips?|coverage)\b/i,
    a: "Each ballot is checked against official sources. We started with Austin 78701, San Francisco 94103 and New York City 10001. For other places, check vote.gov.",
    links: [VOTE_GOV, ABOUT],
  },
  {
    id: "city", q: "How do I add my city?",
    match: /\b(add|request|bring|support)\b[^?]*\b(my )?(city|town|zip|place)\b/i,
    a: "Open an issue on GitHub, or read the contributing guide for how a city's ballot is added. There's no timeline for new cities.",
    links: [{ label: "GitHub issues", url: "https://github.com/adamtpang/townhall.town/issues" }, { label: "Contributing guide", url: "https://github.com/adamtpang/townhall.town/blob/main/CONTRIBUTING.md" }],
  },
  {
    id: "who", q: "Who should I vote for?",
    match: /\bwho\b[^?]*\b(should|do|would|to)\b[^?]*\b(vote|pick|choose|support|back)\b|\bwho\b[^?]*\bvote for\b|\bshould i vote for\b|\bwho('?s| is) (the )?best\b|\bwhich candidate\b[^?]*\b(should|best|pick|choose)\b|\btell me who\b/i,
    a: WHO_LINE,
    links: [],
  },
  {
    id: "when", q: "When and where do I vote?",
    match: /\b(when|where)\b[^?]*\bvot|\bpolling (place|site|location)|\belection day\b|\bearly vot/i,
    a: "", // built per ZIP by whenWhere()
    links: [],
  },
];

/** QA P1 (Oct 30): SF early-voting/where replies also link the polling place lookup and the Voter Portal, both read from
 *  data/polling_locations.json (lookupUrl, portalUrl), with the lookup label the page already uses (lib/endscreen.mjs).
 *  Only a ZIP whose lookup has that label (94103); never a hardcoded URL. */
export function pollingLinks(zip: string | null): FaqLink[] {
  if (!zip) return [];
  const w = whereFor(zip, "") as { lookupUrl: string | null; lookupLabel: string | null };
  if (!w.lookupUrl || !w.lookupLabel) return [];
  const portal = getPollingLocations(zip)?.portalUrl;
  return [{ label: w.lookupLabel, url: w.lookupUrl }, ...(portal && portal !== w.lookupUrl ? [{ label: "Voter Portal", url: portal }] : [])];
}
/** One link per hostname for the office and source links, then the ZIP's polling links (two pages on one host, kept). */
export const withPolling = (zip: string | null, links: FaqLink[]): FaqLink[] => {
  const poll = pollingLinks(zip);
  return [...oneHost(links.filter((l) => !poll.some((p) => p.url === l.url))), ...poll];
};
const oneHost = (links: FaqLink[]) => { const seen = new Set<string>(); return links.filter((l) => { let h = l.url; try { h = new URL(l.url).hostname.replace(/^www\./, ""); } catch { /* keep */ } return seen.has(h) ? false : (seen.add(h), true); }); };
const longDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const todayCT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());

/** "When and where": Election Day plus the ZIP's early-voting window from Civic's election_dates.json, date-aware.
 *  No hours or sites here; the official office link has them. Unknown ZIP: the three official offices.
 *  Civic, Oct 30 1:37-1:38 PM CT: 78701 (ends Oct 30, votetravis.gov) and 10001 (through Sun Nov 1, vote.nyc) are verified in
 *  their cited sources. 94103 in-person early voting ends Mon Nov 2 (Nov 3 is Election Day), so its data end is 2026-11-02.
 *  A ZIP with no cited end date says UNSURE_DATE plus the official office link; never an invented date. */
export function whenWhere(zip: string | null, today = todayCT()): { a: string; links: FaqLink[] } {
  const ed = "Election Day is Tuesday, November 3, 2026.";
  const office = zip ? OFFICES[zip] : undefined;
  if (!zip || !office) return { a: `${ed} For hours and polling places, check your official election office.`, links: ["78701", "94103", "10001"].map((z) => OFFICES[z]) };
  const j = getElectionDates(zip);
  const ev = j?.earlyVoting;
  let early = ` ${UNSURE_DATE}`;
  if (ev?.end) early = ev.end < today ? ` Early voting ended ${longDate(ev.end)}.` : ev.end === today ? ` Early voting ends today, ${longDate(ev.end)}.` : ` Early voting runs through ${longDate(ev.end)}.`;
  const links = [office];
  if (ev?.sourceUrl && ev.sourceUrl !== office.url) links.push({ label: "Early voting source", url: ev.sourceUrl });
  return { a: `${ed}${early} For hours and polling places, check ${zip === "94103" ? "the " : ""}${OFFICE_NAMES[zip]}.`, links };
}

/** The FAQ entry for a question, or null. */
export function faqFor(text: string, zip: string | null, today?: string): { id: string; a: string; links: FaqLink[] } | null {
  const t = String(text || "");
  const exact = FAQS.find((f) => f.q.toLowerCase() === t.trim().toLowerCase());
  // "who" first: a who-to-vote-for question must never fall through to anything else.
  const order = ["who", "when", "city", "zips", "match", "partisan", "sources"];
  const f = exact ?? order.map((id) => FAQS.find((x) => x.id === id)!).find((x) => x.match.test(t));
  if (!f) return null;
  // QA pre-pass 6b2ae5c P2: one link per hostname (votetravis.gov and vote.nyc were each listed twice).
  if (f.id === "when") { const w = whenWhere(zip, today); return { id: f.id, a: w.a, links: withPolling(zip, w.links) }; }
  return { id: f.id, a: f.a, links: f.links };
}
