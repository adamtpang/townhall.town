// QA judge-path P1-1/P1-2 (Oct 30, 1:25 PM CT): Towny answers the common questions from the ZIP's curated data, in code,
// before (and instead of) any model. Server-side (uses ballotFor). Used by /api/interview, so the page's Towny chat and the
// floating Towny panel give the same answers. Unknown questions get a helpful reply with suggestion chips, never a dead end.
import { ballotFor } from "../tools";
import { townyFact, todayCT } from "../townyFacts";
import { faqFor, WHO_LINE } from "./faq";
import { ASKS_WHO, WHO_CHIP } from "../townyChat";

export type Curated = { reply: string; links: { label: string; url: string }[]; chips?: string[]; intent: string };

export const HELP_REPLY = "I can help with what's on your ballot, who is running for an office, when and where to vote, and how Towny works. Try one of these.";
export const helpChips = (zip: string) => ["What's on my ballot?", `Who is running for ${zip === "94103" ? "Governor of California" : zip === "10001" ? "Governor" : "Governor of Texas"}?`, "Where do I vote?", "How are candidates matched?"];
export const NO_RECORD = "No record found.";

const ASKS_RUNNING = /\b(?:who(?:'?s| is| are)?\s+(?:running|on the ballot|the candidates|in the race)|candidates?)\s+(?:for|in)\s+(?:the\s+)?(.+?)\s*\??$/i;
const STOP = new Set(["the", "of", "a", "an", "for", "my", "race", "seat", "office", "position", "in", "on", "ballot", "this", "year", "2026", "election"]);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));

/** "Who is running for <office>?": candidates in ballot order from the ballot data, with the race's source. */
export function runningFor(zip: string, text: string): Curated | null {
  const m = ASKS_RUNNING.exec(String(text || "").trim());
  if (!m) return null;
  const b = ballotFor(zip);
  if (!b) return null;
  const q = words(m[1]);
  if (!q.length) return null;
  const races = b.races.filter((r) => r.level !== "measure");
  const hits = races.filter((r) => { const t = words(r.title); return q.every((w) => t.includes(w) || t.some((x) => x.startsWith(w) && w.length >= 4)); });
  // "Governor" should find "Governor of Texas", not "Lieutenant Governor of Texas": keep the closest titles.
  const extra = (r: { title: string }) => words(r.title).length - q.length;
  const best = hits.length ? Math.min(...hits.map(extra)) : 0;
  const pick = hits.filter((r) => extra(r) === best || q.length >= 3).slice(0, 3);
  if (!pick.length) {
    const searched = [...new Set([...races.map((r) => (r as { source?: string }).source).filter(Boolean) as string[], ...(b.verify?.url ? [b.verify.url] : [])].map(host))];
    return { intent: "running-none", reply: `${NO_RECORD} Searched: the ${zip} ballot from ${searched.join(", ")}.`, links: b.verify?.url ? [{ label: b.verify.label, url: b.verify.url }] : [], chips: ["What's on my ballot?"] };
  }
  const lines = pick.map((r) => {
    const names = (r.candidates || []).map((c) => c.name);
    return `${r.title}: ${names.length ? names.join(", ") : "no candidates listed"}.`;
  });
  const links = [...new Map(pick.map((r) => (r as { source?: string }).source).filter(Boolean).map((u) => [u as string, { label: "Candidate list source", url: u as string }])).values()];
  return { intent: "running", reply: `${lines.join(" ")} Listed in ballot order.`, links };
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
