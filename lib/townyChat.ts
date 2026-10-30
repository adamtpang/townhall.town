// Towny button + panel (Oct 30, 1:13 PM CT). Copy from Civic (1:16 PM CT). Pure routing, shared by the panel and its tests.
// Everything a model is never asked: who to vote for, places outside the 3 ZIPs. Those get fixed words, in code.
import { COVERED_ZIPS, UNSUPPORTED_MESSAGE } from "./site";

export const TOWNY_LABEL = "Ask Towny";
export const TOWNY_OPENER = "Hi, I'm Towny. What do you want to know about your ballot in Austin, San Francisco or New York City?";
export const TOWNY_CAPTION = "Nonpartisan. Every fact links its source.";
export const TOWNY_SUGGESTIONS = ["What's on my ballot?", "Where do I vote?", "Help me think through an issue"] as const;
import { WHO_LINE, VOTE_GOV } from "./towny/faq";
export const WHO_TO_VOTE_REPLY = WHO_LINE;
export const WHO_CHIP = "Show where they overlap with my answers";
// Civic, Oct 30 1:37 PM CT: inside the Towny chat, places we don't cover get this line with vote.gov linked. The page's ZIP
// box keeps UNSUPPORTED_MESSAGE ("Austin, SF and NYC for now.") exactly, per Adam's rule and its tests.
export const OUT_OF_SCOPE = "Towny covers Austin (78701), San Francisco (94103) and New York City (10001) right now. For your ballot, check vote.gov.";
export const OUT_OF_SCOPE_LINKS = [VOTE_GOV];
export const ZIP_BOX_UNSUPPORTED = UNSUPPORTED_MESSAGE;
export const ASK_ZIP = "Which ZIP? 78701, 94103 or 10001.";
export const THINKING = "Towny is thinking";
export const PLACEHOLDER = "Ask about your ballot";
export const NO_MATCH = "Unsure. I couldn't match that to a question I have sourced answers for. Try one of the suggestions.";
export const FAILED = "I couldn't reach Towny just now. Try again in a moment.";

export const ASKS_WHO = /\bwho\b[^?]*\b(should|do|would|to|you)\b[^?]*\b(vote|pick|choose|support|back|recommend)\b|\bwho\b[^?]*\bvote for\b|\bshould i vote for\b|\bwho('?s| is) (the )?best\b|\bwhich candidate\b[^?]*\b(should|best|pick|choose)\b|\btell me who\b/i;
export const ASKS_THINK = /^help me think through an issue\b/i;
// Other places we don't cover, named without a ZIP (outOfScope below). Houston stays hidden: it only ever gets OUT_OF_SCOPE.

// QA pre-pass 6b2ae5c P1-2 (Oct 30, 2:00 PM CT): any question that names another US state, a city outside Austin, SF and
// NYC, or registering somewhere else gets OUT_OF_SCOPE. Texas, California and New York are in scope and never listed.
// A state or city name used as a street or landmark (SF's Florida St, Vermont St, Utah St; NYC's Pennsylvania Station,
// Washington Square; Austin's Colorado River) is not a place, so those words are skipped.
const OTHER_STATES = ["alabama", "alaska", "arizona", "arkansas", "colorado", "connecticut", "delaware", "florida", "georgia", "hawaii",
  "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan",
  "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
  "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota",
  "tennessee", "utah", "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming", "puerto rico", "guam",
  "district of columbia"];
// Brooklyn, Queens, the Bronx and Staten Island moved to SAME_CITY_PLACES below (Civic, Oct 30 2:10 PM CT). Round Rock
// is its own city, so it stays here like Pflugerville and Cedar Park (Adam, 2:17 PM CT).
const OTHER_CITIES = ["houston", "dallas", "san antonio", "fort worth", "el paso", "corpus christi", "lubbock", "plano", "round rock",
  "pflugerville", "cedar park", "san marcos", "los angeles", "oakland", "berkeley", "san jose", "sacramento", "san diego", "fresno",
  "long beach", "palo alto", "buffalo", "rochester", "albany", "yonkers", "syracuse",
  "chicago", "miami", "seattle", "boston", "atlanta", "denver", "phoenix", "philadelphia", "pittsburgh", "detroit", "las vegas",
  "nashville", "memphis", "baltimore", "milwaukee", "minneapolis", "new orleans", "salt lake city", "portland", "cincinnati",
  "cleveland", "indianapolis", "kansas city", "st\\.? louis", "saint louis", "tampa", "orlando", "jacksonville", "raleigh",
  "albuquerque", "tucson", "omaha", "tulsa", "honolulu", "anchorage", "newark", "jersey city", "hoboken"];
const NOT_A_PLACE = "(?![ ,]+(?:street|st\\b|st\\.|avenue|ave\\b|ave\\.|blvd|boulevard|road|rd\\b|drive|dr\\b|place|pl\\b|square|sq\\b|heights|station|plaza|river|bridge|park|hall|irving))";
const PLACE_RE = new RegExp(`\\b(?:${[...OTHER_STATES, ...OTHER_CITIES].join("|")})\\b${NOT_A_PLACE}`, "i");
const ELSE = "(?:elsewhere|out[- ]of[- ]state|(?:in|to|from) (?:another|a different|other|a new) (?:state|city|county))";
const ELSEWHERE_RE = new RegExp(`\\bregist\\w*\\b[^?]*\\b${ELSE}|\\b${ELSE}[^?]*\\bregist|\\bmov(?:e|ed|ing) (?:to )?(?:another|a different|a new) (?:state|city)\\b`, "i");
/** True when the question is about a place Towny doesn't cover (state, city, or registering elsewhere). */
export const outOfScope = (text: string) => { const t = String(text || ""); return PLACE_RE.test(t) || ELSEWHERE_RE.test(t); };

export const zipsIn = (text: string) => (String(text).match(/\b\d{5}\b/g) || []);

// Civic, Oct 30 2:10 PM CT: another part of a covered city is not out of scope. It gets that city's same-city line, which
// says which ZIP Towny shows and where to look up the voter's own ballot. Same pattern for all 3 cities.
// Civic review a853221: the Austin line names ZIPs, not the city, since some 787xx ZIPs (Lakeway, Bee Cave, West Lake Hills) are outside Austin.
import { OFFICES, SF_DOE, pollingLinks, type FaqLink } from "./towny/faq";
import { hostLabel } from "./sourceName";
export const SAME_CITY: Record<"78701" | "94103" | "10001", { reply: string; links: FaqLink[] }> = {
  "10001": { reply: "Towny shows the ballot for ZIP 10001 in Manhattan. Other parts of New York City have different races on their ballots. For yours, check vote.nyc.", links: [{ label: "vote.nyc", url: OFFICES["10001"].url }] },
  "78701": { reply: "Towny shows the ballot for ZIP 78701 in downtown Austin. Ballots in other ZIPs have different races. For yours, check your county election office or vote.gov.", links: [VOTE_GOV] },
  "94103": { reply: "Towny shows the ballot for ZIP 94103 in San Francisco. Other parts of the city have different district races on their ballots. For yours, check the SF Department of Elections.", links: [SF_DOE] },
};
// Named parts of each city. Kept to names that aren't also a street, a US state or another city's place (no "Mission",
// "Richmond" or "Chinatown" alone).
const SAME_CITY_PLACES: Record<keyof typeof SAME_CITY, string[]> = {
  "10001": ["brooklyn", "queens", "the bronx", "bronx", "staten island", "harlem", "east harlem", "upper east side", "upper west side",
    "lower east side", "east village", "west village", "greenwich village", "tribeca", "soho", "financial district", "battery park city",
    "washington heights", "inwood", "williamsburg", "bushwick", "park slope", "bed[- ]stuy", "bedford[- ]stuyvesant", "astoria",
    "flushing", "long island city", "jackson heights", "other boroughs?", "another borough", "outer boroughs?"],
  "78701": ["east austin", "south austin", "north austin", "west austin", "northwest austin", "hyde park", "zilker",
    "mueller", "barton hills", "bouldin creek", "travis heights", "tarrytown", "allandale", "crestview", "cherrywood", "windsor park",
    "circle c", "other parts? of austin", "another part of austin"],
  "94103": ["mission district", "the mission", "sunset district", "inner sunset", "outer sunset", "the sunset", "richmond district",
    "inner richmond", "outer richmond", "noe valley", "the castro", "castro district", "haight[- ]ashbury", "the haight", "the marina",
    "marina district", "pacific heights", "nob hill", "russian hill", "north beach", "tenderloin", "bayview", "hunters point",
    "excelsior", "potrero hill", "dogpatch", "glen park", "bernal heights", "twin peaks", "visitacion valley", "presidio",
    "other parts? of (?:sf|san francisco)", "another part of (?:sf|san francisco)"],
};
const SAME_CITY_RE = Object.fromEntries(Object.entries(SAME_CITY_PLACES).map(([z, names]) =>
  [z, new RegExp(`\\b(?:${[...names].sort((a, b) => b.length - a.length).join("|")})\\b(?![ ,]+(?:street|st\\b|st\\.|avenue|ave\\b|ave\\.|blvd|boulevard|road|rd\\b|bridge|expressway|zoo))`, "i")])) as Record<keyof typeof SAME_CITY, RegExp>;
/** Which covered city a ZIP belongs to, when it's not the covered ZIP itself: NYC (Manhattan, Staten Island, Bronx, Brooklyn,
 *  Queens ranges), Austin 787xx only, San Francisco 941xx. */
export function cityOfZip(z: string): keyof typeof SAME_CITY | null {
  if (COVERED_ZIPS.includes(z)) return null;
  if (/^(?:10[0-4]\d\d|11[1-46]\d\d|1100[45])$/.test(z)) return "10001";
  if (/^787\d\d$/.test(z)) return "78701";
  if (/^941\d\d$/.test(z)) return "94103";
  return null;
}
/** The covered city a question points at (another ZIP or a named part of that city), or null. */
export function sameCity(text: string): keyof typeof SAME_CITY | null {
  const t = String(text || "");
  for (const z of zipsIn(t)) { const c = cityOfZip(z); if (c) return c; }
  for (const z of Object.keys(SAME_CITY_RE) as (keyof typeof SAME_CITY)[]) if (SAME_CITY_RE[z].test(t)) return z;
  return null;
}
/** The question with the place taken out, so "Who's running for governor in Brooklyn?" asks about the governor's race. */
export function stripPlace(text: string, city: keyof typeof SAME_CITY): string {
  const re = new RegExp(`\\s*(?:\\b(?:in|for|from|at|around|near)\\s+)?(?:zip\\s*(?:code\\s*)?)?(?:the\\s+)?(?:${SAME_CITY_RE[city].source.replace(/\(\?!.*$/, "")}|\\b\\d{5}\\b)`, "gi");
  return String(text || "").replace(re, "").replace(/\s+([?.!,])/g, "$1").trim();
}

export type Route =
  | { kind: "fixed"; reply: string; chips?: string[]; zip?: string; links?: { label: string; url: string }[] }
  | { kind: "think"; zip: string | null }
  | { kind: "ask"; zip: string };

/** Decide a turn before any network call. `zip` is the ZIP already known on this device (or null). */
export function routeTurn(text: string, zip: string | null): Route {
  const t = String(text || "").trim();
  const zs = zipsIn(t);
  const bad = zs.find((z) => !COVERED_ZIPS.includes(z) && !cityOfZip(z));
  if (bad) return { kind: "fixed", reply: OUT_OF_SCOPE, links: OUT_OF_SCOPE_LINKS };
  if (!zs.length && outOfScope(t)) return { kind: "fixed", reply: OUT_OF_SCOPE, links: OUT_OF_SCOPE_LINKS };
  // Civic, Oct 30 2:10 PM CT: another part of a covered city goes to the server, which answers with the same-city line
  // (and, for a race on every ballot in that city, the answer first). The page's own ZIP is kept.
  const city = sameCity(t);
  if (city && !ASKS_WHO.test(t)) return { kind: "ask", zip: zip && COVERED_ZIPS.includes(zip) ? zip : city };
  const z = zs.find((x) => COVERED_ZIPS.includes(x)) ?? zip;
  const known = z && COVERED_ZIPS.includes(z) ? z : null;
  if (ASKS_WHO.test(t)) return { kind: "fixed", reply: WHO_TO_VOTE_REPLY, chips: [WHO_CHIP], zip: known ?? undefined };
  if (ASKS_THINK.test(t)) return { kind: "think", zip: known };
  if (!known) return { kind: "fixed", reply: ASK_ZIP };
  // A bare ZIP just sets the place.
  if (/^\d{5}$/.test(t)) return { kind: "fixed", reply: `Got it, ${t}. What do you want to know?`, zip: known };
  return { kind: "ask", zip: known };
}

export const STATE_OF: Record<string, "TX" | "CA" | "NY"> = { "78701": "TX", "94103": "CA", "10001": "NY" };
export const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
/** QA 8f78579 P1 (Oct 30, 3:05 PM CT): a source link shows its hostname, unless another link in the same reply has that
 *  host (SF's polling place lookup and Voter Portal share one host). Then each shows its own label from the data. */
export function linkText(l: { url: string; label: string }, all: { url: string }[]): string {
  return all.filter((x) => host(x.url) === host(l.url)).length > 1 ? l.label : hostLabel(l.url);
}

/** QA pre-pass 6b2ae5c P2: one link per hostname (the first one wins, so the official office link stays first).
 *  QA P1 (Oct 30): a ZIP's polling lookup and Voter Portal (pollingLinks) are two pages on one host; each is kept once. */
export function dedupeByHost<T extends { url: string }>(links: T[] | undefined): T[] {
  const seen = new Set<string>();
  const poll = new Set(COVERED_ZIPS.flatMap((z) => pollingLinks(z).map((l) => l.url)));
  return (links ?? []).filter((l) => { const h = poll.has(l.url) ? l.url : host(l.url); if (seen.has(h)) return false; seen.add(h); return true; });
}
