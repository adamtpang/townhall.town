// QA judge-path P1-1/P1-2 (Oct 30, 1:25 PM CT): Towny answers the common questions from the ZIP's curated data, in code,
// before (and instead of) any model. Server-side (uses ballotFor). Used by /api/interview, so the page's Towny chat and the
// floating Towny panel give the same answers. Unknown questions get a helpful reply with suggestion chips, never a dead end.
import { ballotFor } from "../tools";
import { townyFact, todayCT } from "../townyFacts";
import { faqFor, WHO_LINE, OFFICES } from "./faq";
import { ASKS_WHO, WHO_CHIP } from "../townyChat";

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
export const UNSURE_ORDER = "Unsure: we couldn't confirm the ballot order in a cited source.";
type Race = { title: string; level?: string; source?: string; candidates?: { name: string }[] };

/** "Who is running for <office>?": the ballot data's candidates for each matching race. Civic, Oct 30 1:37 PM CT: the order
 *  is not yet checked against each office's sample ballot, so the reply says so (UNSURE_ORDER) and links the official
 *  election office first; the race's own source (e.g. Ballotpedia) stays as the second link, for who is running. */
export function runningFor(zip: string, text: string): Curated | null {
  const m = ASKS_RUNNING.exec(String(text || "").trim());
  if (!m) return null;
  const b = ballotFor(zip);
  if (!b) return null;
  const office = OFFICES[zip];
  const races = (b.races as Race[]).filter((r) => r.level !== "measure");
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

/** Everything Towny answers without a model, in this order. null = let the interview model read it for issue answers. */
export function curated(zip: string, text: string, today: string = todayCT()): Curated | null {
  const t = String(text || "");
  if (ASKS_WHO.test(t)) return { intent: "who", reply: WHO_LINE, links: [], chips: [WHO_CHIP] };
  const run = runningFor(zip, t);
  if (run) return run;
  const fact = townyFact(zip, t, today);
  if (fact) return { intent: "fact", ...fact };
  const faq = faqFor(t, zip, today);
  if (faq) return { intent: `faq-${faq.id}`, reply: faq.a, links: faq.links };
  return null;
}

/** The reply when nothing matched or the model failed twice: helpful, with chips. */
export const helpful = (zip: string): Curated => ({ intent: "help", reply: HELP_REPLY, links: [], chips: helpChips(zip) });
