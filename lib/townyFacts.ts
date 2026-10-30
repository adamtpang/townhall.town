// QA 94cf301 #4 (Oct 30, 6:53 AM CT): two everyday questions the Towny box answers from data we already ship, with no
// model call and no new claims. "What's on my ballot?" -> the race and measure counts from ballotFor (the same races the
// page lists). "When does early voting end?" -> data/election_dates.json (Civic, official source), with its link.
import { ballotFor } from "./tools";
import { getElectionDates, fmtDate, fmtRange } from "./logistics";
import { whereFor, whenFor } from "./endscreen.mjs";

export const ASKS_BALLOT = /\b(what'?s|what is|what are|who'?s|who is|who are|show)\b[^?]*\b(my|the|our)\s+ballot\b|\bon my ballot\b/i;
export const ASKS_EARLY = /\bearly[\s-]*vot/i;

export type TownyLink = { label: string; url: string };
/** The page's own "today": the current date in America/Chicago (app/EndScreen.tsx todayCT). */
export const todayCT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
const longDay = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });

/** A fixed reply for a factual question, or null so the issue interview handles the text. Links are returned as
 *  data (rendered as real links by app/TownyInterview.tsx), never pasted into the reply text. */
export function townyFact(zip: string, text: string, today?: string): { reply: string; links: TownyLink[] } | null {
  const t = String(text || "");
  if (ASKS_EARLY.test(t)) {
    const j = getElectionDates(zip);
    if (!j) return null;
    const ev = j.earlyVoting;
    // Same "today" and the same end === today test the page uses (lib/endscreen.mjs earlySingleDay, todayCT).
    const d = today ?? todayCT();
    const links: TownyLink[] = [{ label: "Early voting source", url: ev.sourceUrl }];
    if (ev.end < d) return { reply: `Early voting in ${j.name} ended on ${fmtDate(ev.end)}.`, links };
    const when = ev.end === d
      ? `Early voting in ${j.name} ends today, ${longDay(ev.end)}.`
      : `Early voting in ${j.name} runs ${fmtRange(ev.start, ev.end)}. The last day is ${fmtDate(ev.end)}.`;
    // Hours (Civic qa14, Oct 30 7:22 AM CT, votetravis.gov): where Civic's county line is written for the final days
    // (it names the last day), Towny says it word for word, then the first listed site's own line, also as written.
    // Elsewhere Towny uses the page's "When to go" rows. Never a paraphrase.
    const w = whereFor(zip, d) as { phase: string | null; sites: { name: string; hours?: string; sourceUrl: string }[] };
    const site = w.phase === "early" ? w.sites[0] : undefined;
    let hours = "";
    if (ev.hours && /\(last day\)/.test(ev.hours)) {
      hours = ` Hours: ${ev.hours}`;
      if (site?.hours) {
        hours += ` ${site.name}: ${site.hours}`;
        if (site.sourceUrl !== ev.sourceUrl) links.push({ label: `${site.name} hours source`, url: site.sourceUrl });
      }
    } else {
      const e = (whenFor(zip, d) as { events: { kind: string; daily?: { label: string; hours: string; appliesTo: string | null }[] }[] }).events.find((x) => x.kind === "early");
      const rows = e?.daily ?? [];
      const many = new Set(rows.map((x) => x.appliesTo)).size > 1;
      if (rows.length) hours = ` Hours: ${rows.map((x) => `${x.label}: ${x.hours}${many && x.appliesTo ? ` (${x.appliesTo})` : ""}`).join("; ")}.`;
    }
    return { reply: `${when}${hours}`, links };
  }
  if (ASKS_BALLOT.test(t)) {
    const b = ballotFor(zip);
    if (!b) return null;
    const measures = b.races.filter((r) => r.level === "measure").length;
    const races = b.races.length - measures;
    const n = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
    return { reply: `Your ${zip} ballot has ${n(races, "race")}${measures ? ` and ${n(measures, "ballot measure")}` : ""}. Each one is listed on this page with sources, and each race says whether its candidate order is confirmed against the official sample ballot.`,
      // The ballot's existing official source (ballotFor().verify, the same link the NY header shows); none if absent.
      links: b.verify?.url ? [{ label: b.verify.label, url: b.verify.url }] : [] };
  }
  return null;
}
