// Towny FAQ (Adam 1:18 PM CT Oct 30; facts from Civic, each checked against the code at 4954f93).
// Every answer carries its source links as data. No grades, no picks, no dates promised for new cities.
import { getElectionDates } from "../logistics";

export type FaqLink = { label: string; url: string };
export type Faq = { id: string; q: string; match: RegExp; a: string; links: FaqLink[] };

export const WHO_LINE = "I don't pick for you. I can show where each candidate's sourced positions overlap with your answers.";
export const OFFICES: Record<string, FaqLink> = {
  "78701": { label: "Travis County Elections", url: "https://votetravis.gov" },
  "94103": { label: "SF Department of Elections", url: "https://sfelections.org" },
  "10001": { label: "NYC Board of Elections", url: "https://vote.nyc" },
};
const ABOUT = { label: "About townhall.town", url: "https://townhall.town/about" };
const GITHUB = { label: "GitHub", url: "https://github.com/adamtpang/townhall.town" };

export const FAQS: Faq[] = [
  {
    id: "match", q: "How are candidates matched?",
    match: /\b(match|matched|matching|overlap|compare|lines? up)\b/i,
    a: "Towny doesn't rank, pick or grade candidates. It shows where each candidate's sourced positions overlap with your answers, on a -2 to +2 scale. That overlap is not a recommendation. Unsure never counts. \"No public position found yet\" means we searched and found nothing citable. It doesn't mean the candidate has no view.",
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
    a: "Each ballot is checked by hand against official sources. We started with Austin 78701, San Francisco 94103 and New York City 10001. Other ZIPs: Austin, SF and NYC for now.",
    links: [ABOUT],
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

const longDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const todayCT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());

/** "When and where": Election Day plus the ZIP's early-voting window from Civic's election_dates.json, date-aware.
 *  No hours or sites here; the official office link has them. Unknown ZIP: the three official offices. */
export function whenWhere(zip: string | null, today = todayCT()): { a: string; links: FaqLink[] } {
  const ed = "Election Day is Tuesday, November 3, 2026.";
  const office = zip ? OFFICES[zip] : undefined;
  if (!zip || !office) return { a: `${ed} For hours and polling places, check your official election office.`, links: ["78701", "94103", "10001"].map((z) => OFFICES[z]) };
  const j = getElectionDates(zip);
  const ev = j?.earlyVoting;
  let early = " Early voting: no record found.";
  if (ev?.end) early = ev.end < today ? ` Early voting ended ${longDate(ev.end)}.` : ev.end === today ? ` Early voting ends today, ${longDate(ev.end)}.` : ` Early voting runs through ${longDate(ev.end)}.`;
  const links = [office];
  if (ev?.sourceUrl && ev.sourceUrl !== office.url) links.push({ label: "Early voting source", url: ev.sourceUrl });
  return { a: `${ed}${early} For hours and polling places, check ${office.label}.`, links };
}

/** The FAQ entry for a question, or null. */
export function faqFor(text: string, zip: string | null, today?: string): { id: string; a: string; links: FaqLink[] } | null {
  const t = String(text || "");
  const exact = FAQS.find((f) => f.q.toLowerCase() === t.trim().toLowerCase());
  // "who" first: a who-to-vote-for question must never fall through to anything else.
  const order = ["who", "when", "city", "zips", "match", "partisan", "sources"];
  const f = exact ?? order.map((id) => FAQS.find((x) => x.id === id)!).find((x) => x.match.test(t));
  if (!f) return null;
  if (f.id === "when") return { id: f.id, ...whenWhere(zip, today) };
  return { id: f.id, a: f.a, links: f.links };
}
