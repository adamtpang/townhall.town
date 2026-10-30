// Towny button + panel (Oct 30, 1:13 PM CT). Copy from Civic (1:16 PM CT). Pure routing, shared by the panel and its tests.
// Everything a model is never asked: who to vote for, places outside the 3 ZIPs. Those get fixed words, in code.
import { COVERED_ZIPS, UNSUPPORTED_MESSAGE } from "./site";

export const TOWNY_LABEL = "Ask Towny";
export const TOWNY_OPENER = "Hi, I'm Towny. What do you want to know about your ballot in Austin, San Francisco or New York City?";
export const TOWNY_CAPTION = "Nonpartisan. Every fact links its source.";
export const TOWNY_SUGGESTIONS = ["What's on my ballot?", "Where do I vote?", "Help me think through an issue"] as const;
import { WHO_LINE } from "./towny/faq";
export const WHO_TO_VOTE_REPLY = WHO_LINE;
export const WHO_CHIP = "Show where they overlap with my answers";
export const OUT_OF_SCOPE = UNSUPPORTED_MESSAGE; // "Austin, SF and NYC for now."
export const ASK_ZIP = "Which ZIP? 78701, 94103 or 10001.";
export const THINKING = "Towny is thinking";
export const PLACEHOLDER = "Ask about your ballot";
export const NO_MATCH = "Unsure. I couldn't match that to a question I have sourced answers for. Try one of the suggestions.";
export const FAILED = "I couldn't reach Towny just now. Try again in a moment.";

export const ASKS_WHO = /\bwho\b[^?]*\b(should|do|would|to|you)\b[^?]*\b(vote|pick|choose|support|back|recommend)\b|\bwho\b[^?]*\bvote for\b|\bshould i vote for\b|\bwho('?s| is) (the )?best\b|\bwhich candidate\b[^?]*\b(should|best|pick|choose)\b|\btell me who\b/i;
export const ASKS_THINK = /^help me think through an issue\b/i;
// Other places we don't cover, named without a ZIP. Houston stays hidden: it only ever gets OUT_OF_SCOPE.
const OTHER_PLACE = /\b(houston|dallas|san antonio|fort worth|el paso|los angeles|oakland|san diego|brooklyn|queens|bronx|staten island|chicago|miami|seattle|boston|atlanta|denver|phoenix)\b/i;

export const zipsIn = (text: string) => (String(text).match(/\b\d{5}\b/g) || []);

export type Route =
  | { kind: "fixed"; reply: string; chips?: string[]; zip?: string }
  | { kind: "think"; zip: string | null }
  | { kind: "ask"; zip: string };

/** Decide a turn before any network call. `zip` is the ZIP already known on this device (or null). */
export function routeTurn(text: string, zip: string | null): Route {
  const t = String(text || "").trim();
  const zs = zipsIn(t);
  const bad = zs.find((z) => !COVERED_ZIPS.includes(z));
  if (bad) return { kind: "fixed", reply: OUT_OF_SCOPE };
  if (!zs.length && OTHER_PLACE.test(t)) return { kind: "fixed", reply: OUT_OF_SCOPE };
  const z = zs[0] ?? zip;
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
