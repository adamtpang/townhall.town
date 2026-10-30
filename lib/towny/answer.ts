// QA judge-path P1-1/P1-2 (Oct 30, 1:25 PM CT): Towny answers the common questions from the ZIP's curated data, in code,
// before (and instead of) any model. Server-side (uses ballotFor). Used by /api/interview, so the page's Towny chat and the
// floating Towny panel give the same answers. Unknown questions get a helpful reply with suggestion chips, never a dead end.
import { ballotFor } from "../tools";
import { townyFact, todayCT } from "../townyFacts";
import { faqFor, WHO_LINE, OFFICES, SF_DOE } from "./faq";
import { ASKS_WHO, WHO_CHIP, OUT_OF_SCOPE, OUT_OF_SCOPE_LINKS, outOfScope, dedupeByHost, sameCity, SAME_CITY, stripPlace } from "../townyChat";

export type Curated = { reply: string; links: { label: string; url: string }[]; chips?: string[]; intent: string };

export const HELP_REPLY = "I can help with what's on your ballot, who is running for an office, when and where to vote, and how Towny works. Try one of these.";
export const helpChips = (zip: string) => ["What's on my ballot?", `Who is running for ${zip === "94103" ? "Governor of California" : zip === "10001" ? "Governor" : "Governor of Texas"}?`, "Where do I vote?", "How are candidates matched?"];
export const NO_RECORD = "No record found.";

const ASKS_RUNNING = /\b(?:who(?:'?s| is| are)?\s+(?:running|on the ballot|the candidates|in the race)|candidates?)\s+(?:for|in)\s+(?:the\s+)?(.+?)\s*\??$/i;
const STOP = new Set(["the", "of", "a", "an", "for", "my", "race", "seat", "office", "position", "in", "on", "ballot", "this", "year", "2026", "election"]);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));

// QA pre-pass 1ee5f9c P1 (Oct 30, 1:39 PM CT): common office names map to the ballot's own race titles. A query can match
// several races (e.g. "senate" on 10001 = two State Senator districts); each one is listed.
const ALIASES: { q: RegExp; title: RegExp }[] = [
  { q: /\b(lieutenant|lt\.?)\s*gov/i, title: /lieutenant governor/i },
  { q: /\bgovernor\b/i, title: /^governor\b/i },
  { q: /\bsenat(e|or|ors)\b/i, title: /\bsenat(e|or)\b/i },
  { q: /\b(house|congress|congressional|congressman|congresswoman|representatives?|rep)\b/i, title: /\bU\.S\. (house|representative)|\bstate representative\b|\bassembly\b/i },
  { q: /\bassembly\b/i, title: /\bassembly\b/i },
  { q: /\bmayor\b/i, title: /\bmayor\b/i },
  // San Francisco's city council is its Board of Supervisors.
  { q: /\b(city )?council\b|\bsupervisors?\b/i, title: /\bcouncil\b|\bboard of supervisors\b/i },
  { q: /\battorney general\b|\b(ag)\b/i, title: /\battorney general\b/i },
  { q: /\bcomptroller\b|\bcontroller\b/i, title: /\bc(omp)?troller\b/i },
  { q: /\bschool board\b|\bboard of (education|trustees)\b/i, title: /\bboard of (education|trustees)\b/i },
];
const FEDERAL = /\bU\.S\.|\bUS\b/;
/** Narrow an alias hit by "state" / "U.S." words in the question: "state senate" = state races only, "U.S. house" or
 *  "congress" = federal only. Bare "house" or "representative" also means the U.S. House. */
function scope(q: string, titles: { title: string }[]) {
  if (/\bstate\b/i.test(q)) return titles.filter((r) => !FEDERAL.test(r.title));
  if (/\b(u\.?s\.?|federal|congress\w*|house)\b/i.test(q) || /^\s*(the\s+)?(representatives?|rep)\s*$/i.test(q)) return titles.filter((r) => FEDERAL.test(r.title) || !/representative|assembly/i.test(r.title));
  return titles;
}
// Adam, Oct 30 2:08 PM CT (Civic's choice): 94103's office link in the ballot-order and who's-running replies is the SF
// Department of Elections page on sf.gov. Checked with curl at 2:10 PM CT: it answers 200 after one sf.gov redirect.
// Other replies (when/where) keep OFFICES as they are.
export { SF_DOE };
const officeFor = (zip: string) => (zip === "94103" ? SF_DOE : OFFICES[zip]);
export const UNSURE_ORDER = "Unsure: we couldn't confirm the ballot order in a cited source.";
type Race = { title: string; level?: string; source?: string; candidates?: { name: string }[] };

/** "Who is running for <office>?": the ballot data's candidates for each matching race. Civic, Oct 30 1:37 PM CT: the order
 *  is not yet checked against each office's sample ballot, so the reply says so (UNSURE_ORDER) and links the official
 *  election office first; the race's own source (e.g. Ballotpedia) stays as the second link, for who is running. */
export function runningFor(zip: string, text: string, only?: (r: Race) => boolean): Curated | null {
  const m = ASKS_RUNNING.exec(String(text || "").trim());
  if (!m) return null;
  const b = ballotFor(zip);
  if (!b) return null;
  const office = officeFor(zip);
  const races = (b.races as Race[]).filter((r) => r.level !== "measure" && (!only || only(r)));
  const qText = m[1];
  const alias = ALIASES.filter((a) => a.q.test(qText));
  // "Lieutenant governor" must not also pull in the governor alias.
  const use = alias.some((a) => a.title.source.startsWith("lieutenant")) ? alias.filter((a) => !a.title.source.startsWith("^governor")) : alias;
  let pick: Race[];
  if (use.length) {
    pick = scope(qText, races.filter((r) => use.some((a) => a.title.test(r.title))));
  } else {
    const q = words(qText);
    if (!q.length) return null;
    const hits = races.filter((r) => { const t = words(r.title); return q.every((w) => t.includes(w) || t.some((x) => x.startsWith(w) && w.length >= 4)); });
    const extra = (r: { title: string }) => words(r.title).length - q.length;
    const best = hits.length ? Math.min(...hits.map(extra)) : 0;
    pick = hits.filter((r) => extra(r) === best || q.length >= 3);
  }
  pick = pick.slice(0, 6);
  if (!pick.length) {
    // QA P2-1: every host named in "Searched:" is also a link.
    const urls = [...races.map((r) => r.source).filter(Boolean) as string[], ...(b.verify?.url ? [b.verify.url] : [])];
    const byHost = new Map<string, string>();
    for (const u of urls) if (!byHost.has(host(u))) byHost.set(host(u), u);
    return { intent: "running-none", reply: `${NO_RECORD} Searched: the ${zip} ballot from ${[...byHost.keys()].join(", ")}.`,
      links: [...byHost].map(([h, url]) => ({ label: h, url })), chips: ["What's on my ballot?"] };
  }
  const lines = pick.map((r) => {
    const names = (r.candidates || []).map((c) => c.name);
    return `${r.title}: ${names.length ? names.join(", ") : "no candidates listed"}.`;
  });
  const lists = [...new Map(pick.map((r) => r.source).filter(Boolean).map((u) => [u as string, { label: host(u as string), url: u as string }])).values()];
  return { intent: "running", reply: `${lines.join(" ")} ${UNSURE_ORDER}`, links: [office, ...lists.filter((l) => host(l.url) !== host(office.url))] };
}

// QA pre-pass 6b2ae5c P1-1 (Oct 30, 2:00 PM CT): "What order are candidates on my ballot?" used to get the race count.
// The order is not yet checked against any official sample ballot, so Towny says exactly that and links the office.
// Never an order of names.
export const BALLOT_ORDER_LINE = "Ballot order: Unsure, we haven't confirmed it against the official sample ballot yet.";
export const ASKS_ORDER = /\bballot order\b|\border\b[^?]*\b(candidates?|names?|listed|appear\w*)\b|\b(candidates?|names?|listed|appear\w*)\b[^?]*\border\b|\b(what|which) order\b[^?]*\bballot\b|\border (on|of) (the|my|our) ballot\b|\blisted first\b|\b(first|top|last) on (the|my|our) ballot\b|\bposition (on|of) (the|my|our) ballot\b|\bballot position\b/i;
export const asksOrder = (text: string) => ASKS_ORDER.test(String(text || "").replace(/\bin order to\b/gi, " "));
export function ballotOrder(zip: string): Curated | null {
  const office = officeFor(zip);
  return office ? { intent: "ballot-order", reply: BALLOT_ORDER_LINE, links: [office] } : null;
}

// Civic, Oct 30 2:10 PM CT: a race that is the same on every ballot in the covered city. Statewide and U.S. Senate races are;
// anything drawn by district, division or county is not. San Francisco is one city and county, so its citywide offices are.
const CITYWIDE: Record<string, RegExp> = { "94103": /^(assessor-recorder|public defender|board of education|community college board)\b/i };
export const onEveryBallot = (zip: string) => (r: Race) =>
  ((r.level === "federal" || r.level === "state") && !/\bdistrict\b|\bdivision\b|\bU\.S\. House\b|\bassembly\b|\brepresentative\b|^3rd court/i.test(r.title))
  || !!CITYWIDE[zip]?.test(r.title);
/** Another part of a covered city: the same-city line. When the question names a race that is on every ballot there, the
 *  answer from the covered ZIP's data comes first and the same-city line follows as a note. */
export function sameCityReply(text: string): Curated | null {
  const city = sameCity(text);
  if (!city) return null;
  const line = SAME_CITY[city];
  const q = stripPlace(text, city);
  const all = runningFor(city, q);
  const every = runningFor(city, q, onEveryBallot(city));
  if (all?.intent === "running" && every?.intent === "running" && all.reply === every.reply)
    return { intent: "same-city-running", reply: `${every.reply} ${line.reply}`, links: dedupeByHost([...every.links, ...line.links]) };
  return { intent: "same-city", reply: line.reply, links: [...line.links] };
}

/** Everything Towny answers without a model, in this order. null = let the interview model read it for issue answers. */
export function curated(zip: string, text: string, today: string = todayCT()): Curated | null {
  const t = String(text || "");
  // QA pre-pass 6b2ae5c P1-2: another state, a city outside the 3, or registering elsewhere: Civic's exact line, vote.gov.
  if (outOfScope(t)) return { intent: "out-of-scope", reply: OUT_OF_SCOPE, links: [...OUT_OF_SCOPE_LINKS] };
  if (ASKS_WHO.test(t)) return { intent: "who", reply: WHO_LINE, links: [], chips: [WHO_CHIP] };
  const same = sameCityReply(t);
  if (same) return same;
  if (asksOrder(t)) { const o = ballotOrder(zip); if (o) return o; }
  const run = runningFor(zip, t);
  if (run) return { ...run, links: dedupeByHost(run.links) };
  const fact = townyFact(zip, t, today);
  if (fact) return { intent: "fact", ...fact, links: dedupeByHost(fact.links) };
  const faq = faqFor(t, zip, today);
  if (faq) return { intent: `faq-${faq.id}`, reply: faq.a, links: dedupeByHost(faq.links) };
  return null;
}

/** The reply when nothing matched or the model failed twice: helpful, with chips. */
export const helpful = (zip: string): Curated => ({ intent: "help", reply: HELP_REPLY, links: [], chips: helpChips(zip) });
