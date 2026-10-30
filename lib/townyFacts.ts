// QA 94cf301 #4 (Oct 30, 6:53 AM CT): two everyday questions the Towny box answers from data we already ship, with no
// model call and no new claims. "What's on my ballot?" -> the race and measure counts from ballotFor (the same races the
// page lists). "When does early voting end?" -> data/election_dates.json (Civic, official source), with its link.
import { ballotFor } from "./tools";
import { getElectionDates, todayIn, fmtDate, fmtRange } from "./logistics";

export const ASKS_BALLOT = /\b(what'?s|what is|what are|who'?s|who is|who are|show)\b[^?]*\b(my|the|our)\s+ballot\b|\bon my ballot\b/i;
export const ASKS_EARLY = /\bearly[\s-]*vot/i;

/** A fixed reply for a factual question, or null so the issue interview handles the text. */
export function townyFact(zip: string, text: string, today?: string): { reply: string; sourceUrl?: string } | null {
  const t = String(text || "");
  if (ASKS_EARLY.test(t)) {
    const j = getElectionDates(zip);
    if (!j) return null;
    const ev = j.earlyVoting;
    const d = today ?? todayIn(j.timezone);
    const when = ev.end < d ? `Early voting in ${j.name} ended on ${fmtDate(ev.end)}.` : `Early voting in ${j.name} runs ${fmtRange(ev.start, ev.end)}. The last day is ${fmtDate(ev.end)}.`;
    // Same hours the plan card shows: remaining daily rows when the county lists them, else the summary line.
    const daily = (ev.dailyHours || []).filter((x) => x.date && x.date >= d).map((x) => `${x.day ? x.day + " " : ""}${fmtDate(x.date!)}: ${x.hours}`);
    const hours = ev.dailyHours?.some((x) => x.date) ? daily.join("; ") : ev.hours;
    return { reply: `${when}${hours && ev.end >= d ? ` Hours: ${hours}.` : ""} Source: ${ev.sourceUrl}`, sourceUrl: ev.sourceUrl };
  }
  if (ASKS_BALLOT.test(t)) {
    const b = ballotFor(zip);
    if (!b) return null;
    const measures = b.races.filter((r) => r.level === "measure").length;
    const races = b.races.length - measures;
    const n = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
    return { reply: `Your ${zip} ballot has ${n(races, "race")}${measures ? ` and ${n(measures, "ballot measure")}` : ""}. Each one is listed on this page in ballot order, with sources.` };
  }
  return null;
}
