// QA judge-path P1-1/P1-2 (Oct 30, 1:25 PM CT): Towny answers the common questions from the ZIP's curated data, in code,
// before (and instead of) any model. Server-side (uses ballotFor). Used by /api/interview, so the page's Towny chat and the
// floating Towny panel give the same answers. Unknown questions get a helpful reply with suggestion chips, never a dead end.
import { ballotFor } from "../tools";
import { townyFact, todayCT, ASKS_EARLY, ASKS_HOURS } from "../townyFacts";
import { faqFor, WHO_LINE, OFFICES, SF_DOE, withPolling } from "./faq";
import { ASKS_WHO, WHO_CHIP, OUT_OF_SCOPE, OUT_OF_SCOPE_LINKS, outOfScope, dedupeByHost, sameCity, SAME_CITY, stripPlace, zipsIn, cityOfZip } from "../townyChat";
import { COVERED_ZIPS } from "../site";
import { ORDER_CONFIRMED, ORDER_CONFIRMED_HEAD, ORDER_UNSURE, inOfficialOrder, isRetention, officialOrder, orderSourceLinks, splitOf, SPLIT_LINE, type OrderSource, type SplitGroup } from "../ballotOrder";
import { hostLabel } from "../sourceName";

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
// Adam, Oct 30 2:08 PM CT (Civic's choice): 94103's office link is the SF Department of Elections page on sf.gov
// (OFFICES["94103"] = SF_DOE). Checked with curl at 2:10 PM CT: it answers 200 after one sf.gov redirect.
export { SF_DOE };
const officeFor = (zip: string) => OFFICES[zip];
// Adam, Oct 30 3:24 PM CT: every unconfirmed race gets Civic's one unsure line, on every path.
export const UNSURE_ORDER = ORDER_UNSURE;
type Race = { id?: string; title: string; level?: string; source?: string; candidates?: { name: string }[] };

/** "Who is running for <office>?": the ballot data's candidates for each matching race. Civic, Oct 30 1:37 PM CT: the order
 *  is not yet checked against each office's sample ballot, so the reply says so (UNSURE_ORDER) and links the official
 *  election office first; the race's own source (e.g. Ballotpedia) stays as the second link, for who is running. */
/** Races a question names: office aliases first, else every title word. null = the question names nothing usable. */
function pickRaces(races: Race[], qText: string): Race[] | null {
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
  return pick.slice(0, 6);
}

/** `ownBallot` = false for another part of a covered city (same-city replies): Civic's order check is for the covered
 *  ZIP's own sample ballot, so those answers keep data order and the unsure line. */
export function runningFor(zip: string, text: string, only?: (r: Race) => boolean, ownBallot = true): Curated | null {
  const m = ASKS_RUNNING.exec(String(text || "").trim());
  if (!m) return null;
  const b = ballotFor(zip);
  if (!b) return null;
  const office = officeFor(zip);
  const races = (b.races as Race[]).filter((r) => r.level !== "measure" && (!only || only(r)));
  const qText = m[1];
  let pick = pickRaces(races, qText);
  if (pick === null) return null;
  pick = pick.slice(0, 6);
  if (!pick.length) {
    // QA P2-1: every host named in "Searched:" is also a link.
    const urls = [...races.map((r) => r.source).filter(Boolean) as string[], ...(b.verify?.url ? [b.verify.url] : [])];
    const byHost = new Map<string, string>();
    for (const u of urls) if (!byHost.has(host(u))) byHost.set(host(u), u);
    return { intent: "running-none", reply: `${NO_RECORD} Searched: the ${zip} ballot from ${[...byHost.keys()].join(", ")}.`,
      links: [...byHost].map(([h, url]) => ({ label: h, url })), chips: ["What's on my ballot?"] };
  }
  // Civic P1 (Oct 30, 2:58 PM CT): races confirmed against the official sample ballot (data/ballot_order.json) are listed in
  // that order and say so, with the sample ballot linked; every other race keeps the unsure line. Mixed answers say it per race.
  // Civic towny_order_check P0 (3:25 PM CT): districts a ZIP spans are one "Depending on your address" item with the lookup linked.
  // Civic GO 73ddcbf P2 (Oct 30, 3:37 PM CT): retention races (one judge, Yes or No) get no order line.
  const ordered = pick.filter((r) => !isRetention(r));
  const conf = ordered.map((r) => (ownBallot ? officialOrder(zip, r.id ?? "") : null));
  const all = conf.every(Boolean), none = conf.every((c) => !c);
  const segs = segments(ownBallot ? zip : "", pick);
  const lines = segs.map((g) => {
    const tail = all || none || g.races.every(isRetention) ? "" : ` ${officialOrder(zip, g.races[0].id ?? "") && ownBallot ? ORDER_CONFIRMED : UNSURE_ORDER}`;
    return { text: `${segText(zip, g, ownBallot)}${tail}`, split: !!g.split };
  });
  const sample = orderSourceLinks(sourcesOf(conf));
  const lists = [...new Map(pick.map((r) => r.source).filter(Boolean).map((u) => [u as string, { label: hostLabel(u as string), url: u as string }])).values()];
  const body = joinLines(lines);
  const reply = !ordered.length ? body : all ? `${body} ${ORDER_CONFIRMED}` : none ? `${body} ${UNSURE_ORDER}` : body;
  return { intent: "running", reply, links: uniq([...sample, ...splitLinks(segs), office, ...lists.filter((l) => host(l.url) !== host(office.url))]) };
}

/** Races in the order given, with the districts of one split group (2+ present) pulled together at the first one's place. */
type Seg = { races: Race[]; split: SplitGroup | null };
function segments(zip: string, races: Race[]): Seg[] {
  const out: Seg[] = [];
  const byGroup = new Map<SplitGroup, Seg>();
  for (const r of races) {
    const g = zip ? splitOf(zip, r.id ?? "") : null;
    const n = g ? races.filter((x) => g.raceIds.includes(x.id ?? "")).length : 0;
    if (g && n > 1) {
      const seg = byGroup.get(g);
      if (seg) { seg.races.push(r); continue; }
      const fresh = { races: [r], split: g };
      byGroup.set(g, fresh); out.push(fresh);
    } else out.push({ races: [r], split: null });
  }
  return out;
}
const namesOf = (zip: string, r: Race, own = true) => {
  const c = own ? inOfficialOrder(zip, r.id ?? "", r.candidates || []) : r.candidates || [];
  if (c.length === 1 && r.title.includes(c[0].name)) return ""; // retention rows already name the justice
  return c.length ? c.map((x) => x.name).join(", ") : "no candidates listed";
};
const segText = (zip: string, g: Seg, own = true) =>
  g.split ? `${SPLIT_LINE}: ${g.races.map((r) => item(r.title, namesOf(zip, r, own))).join("; ")}.` : `${item(g.races[0].title, namesOf(zip, g.races[0], own))}.`;
const item = (title: string, names: string) => (names ? `${title}: ${names}` : title);
const splitLinks = (segs: Seg[]) => segs.flatMap((g) => (g.split ? [g.split.lookup] : []));
const uniq = <T extends { url: string }>(l: T[]) => [...new Map(l.map((x) => [x.url, x])).values()];
/** Civic GO 73ddcbf P2 (Oct 30, 3:37 PM CT): a "Depending on your address" group is its own line, never run on after other text. */
function joinLines(items: { text: string; split: boolean }[]): string {
  let out = "";
  items.forEach((x, i) => { out += i === 0 ? x.text : x.split || items[i - 1].split ? `\n${x.text}` : ` ${x.text}`; });
  return out;
}
const segLines = (zip: string, segs: Seg[]) => segs.map((g) => ({ text: segText(zip, g), split: !!g.split }));
/** "<lead> <segments>", with the lead on its own line when the first segment is a split group. */
const lead = (head: string, zip: string, segs: Seg[]) => { const j = joinLines(segLines(zip, segs)); return segs[0]?.split ? `${head}\n${j}` : `${head} ${j}`; };

// QA pre-pass 6b2ae5c P1-1 (Oct 30, 2:00 PM CT): "What order are candidates on my ballot?" used to get the race count.
// Civic P1 (Oct 30, 2:58 PM CT): per race, from data/ballot_order.json. A race confirmed against the official sample ballot
// (all of 78701; 6 races in 10001) gets ORDER_CONFIRMED with that sample ballot linked; every other race (all of 94103, the
// 7 unconfirmed 10001 races) gets the unsure line. Never an order that isn't in that file.
export const BALLOT_ORDER_LINE = ORDER_UNSURE;
const sourcesOf = (c: ({ source: OrderSource } | null)[]) => [...new Map(c.filter(Boolean).map((x) => [x!.source.url, x!.source])).values()];
const ORDER_WORDS = /\b(ballot|order|orders|candidates?|names?|listed|list|appears?|appearing|first|top|last|position|what|which|who|whose|is|are|was|on|my|our|the|in|of|for|how|do|does|get|race|races|name)\b/gi;
export const ASKS_ORDER = /\bballot order\b|\border\b[^?]*\b(candidates?|names?|listed|appear\w*)\b|\b(candidates?|names?|listed|appear\w*)\b[^?]*\border\b|\b(what|which) order\b[^?]*\bballot\b|\border (on|of) (the|my|our) ballot\b|\blisted first\b|\b(first|top|last) on (the|my|our) ballot\b|\bposition (on|of) (the|my|our) ballot\b|\bballot position\b/i;
export const asksOrder = (text: string) => ASKS_ORDER.test(String(text || "").replace(/\bin order to\b/gi, " "));
export function ballotOrder(zip: string, text = ""): Curated | null {
  const office = officeFor(zip);
  if (!office) return null;
  const b = ballotFor(zip);
  const races = ((b?.races ?? []) as Race[]).filter((r) => r.level !== "measure" && (r.candidates?.length ?? 0) > 0);
  const named = pickRaces(races, String(text || "").replace(/\bin order to\b/gi, " ").replace(/['’]s\b/gi, " ").replace(ORDER_WORDS, " ")) ?? [];
  // Adam, Oct 30 3:24 PM CT (Civic towny_order_check): every answer names the candidates. Confirmed races say ORDER_CONFIRMED with
  // the official source (78701: candidate order within each race, 58/58, never the order of the races); every other race says
  // ORDER_UNSURE. Races are never presented in ballot order. Split districts are one "Depending on your address" item.
  // Civic GO 73ddcbf (Oct 30, 3:37 PM CT): retention races get no order line (P2 4); split groups are their own line (P2 5).
  const pick = named.length ? named : races;
  const ret = pick.filter(isRetention), ordered = pick.filter((r) => !isRetention(r));
  const conf = ordered.map((r) => officialOrder(zip, r.id ?? ""));
  const yes = ordered.filter((_, i) => conf[i]), no = ordered.filter((_, i) => !conf[i]);
  const segY = segments(zip, yes), segN = segments(zip, no), segR = segments(zip, ret);
  const parts: string[] = [];
  // QA 297e948 P1 (Oct 30, 3:54 PM CT): with confirmed races the opener and the confirmed header were one contradictory pair;
  // ORDER_CONFIRMED_HEAD replaces both. ZIPs with no confirmed races (94103) keep the old opener.
  const multi = !(segY.length + segN.length + segR.length === 1 || named.length === 1);
  if (!named.length) parts.push(multi && segY.length ? "Here are the candidates in each race." : "Here are the candidates in each race. The races are not listed in the order they appear on the ballot.");
  if (segY.length + segN.length + segR.length === 1 || (named.length === 1)) {
    const g = [...segY, ...segN, ...segR][0];
    parts.push(segR.length && !ordered.length ? segText(zip, g) : `${segText(zip, g)}${g.split ? "\n" : " "}${yes.length ? ORDER_CONFIRMED : ORDER_UNSURE}`);
  } else {
    if (segY.length) parts.push(lead(ORDER_CONFIRMED_HEAD, zip, segY));
    if (segN.length) parts.push(lead(`${ORDER_UNSURE} That applies to these races:`, zip, segN));
    if (segR.length) parts.push(lead("Retention races, a Yes or No vote on one judge each:", zip, segR));
  }
  return { intent: "ballot-order", reply: parts.join("\n"), links: uniq(dedupeByHost([...orderSourceLinks(sourcesOf(conf)), ...splitLinks([...segY, ...segN]), office])) };
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
  const all = runningFor(city, q, undefined, false);
  const every = runningFor(city, q, onEveryBallot(city), false);
  if (all?.intent === "running" && every?.intent === "running" && all.reply === every.reply)
    return { intent: "same-city-running", reply: `${every.reply} ${line.reply}`, links: dedupeByHost([...every.links, ...line.links]) };
  return { intent: "same-city", reply: line.reply, links: [...line.links] };
}

/** Everything Towny answers without a model, in this order. null = let the interview model read it for issue answers. */
export function curated(zip: string, text: string, today: string = todayCT()): Curated | null {
  const t = String(text || "");
  // QA pre-pass 6b2ae5c P1-2: another state, a city outside the 3, or registering elsewhere: Civic's exact line, vote.gov.
  // QA NO-GO a0bcef7 P0-2: a ZIP outside the 3 covered ZIPs and outside their cities (e.g. 78613) gets OUT_OF_SCOPE, never the
  // page ZIP's ballot. Same rule as the panel's routeTurn. Other parts of a covered city (78745) keep the same-city line below.
  if (outOfScope(t) || zipsIn(t).some((z) => !COVERED_ZIPS.includes(z) && !cityOfZip(z))) return { intent: "out-of-scope", reply: OUT_OF_SCOPE, links: [...OUT_OF_SCOPE_LINKS] };
  if (ASKS_WHO.test(t)) return { intent: "who", reply: WHO_LINE, links: [], chips: [WHO_CHIP] };
  const same = sameCityReply(t);
  if (same) return same;
  if (asksOrder(t)) { const o = ballotOrder(zip, t); if (o) return o; }
  const run = runningFor(zip, t);
  if (run) return { ...run, links: dedupeByHost(run.links) };
  // "Where can I vote early and what are the hours?": the where answer (office, lookup, portal), then the hours with Election Day.
  if (ASKS_HOURS.test(t) && /\bwhere\b/i.test(t)) {
    const w = faqFor(t, zip, today), h = townyFact(zip, t, today);
    // Civic GO 73ddcbf P2 (Oct 30, 3:37 PM CT): the hours follow, so "For hours and polling places, check X." goes; the where
    // part keeps naming the office ("For your polling place, check X.") with its lookup linked.
    const wa = w?.a.replace(/\s*For hours and polling places, check ([^.]*)\.\s*$/, " For your polling place, check $1.") ?? "";
    if (w?.id === "when" && h && !w.a.includes(h.reply)) return { intent: "faq-when", reply: `${wa} ${h.reply}`, links: withPolling(zip, [...w.links, ...h.links]) };
  }
  const fact = townyFact(zip, t, today);
  if (fact) return { intent: "fact", ...fact, links: ASKS_EARLY.test(t) || ASKS_HOURS.test(t) ? withPolling(zip, fact.links) : dedupeByHost(fact.links) };
  const faq = faqFor(t, zip, today);
  if (faq) return { intent: `faq-${faq.id}`, reply: faq.a, links: faq.id === "when" ? withPolling(zip, faq.links) : dedupeByHost(faq.links) };
  return null;
}

/** The reply when nothing matched or the model failed twice: helpful, with chips. */
export const helpful = (zip: string): Curated => ({ intent: "help", reply: HELP_REPLY, links: [], chips: helpChips(zip) });
