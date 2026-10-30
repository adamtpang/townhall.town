// QA 94cf301 #4 (Oct 30, 6:53 AM CT): two everyday questions the Towny box answers from data we already ship, with no
// model call and no new claims. "What's on my ballot?" -> the race and measure counts from ballotFor (the same races the
// page lists). "When does early voting end?" -> data/election_dates.json (Civic, official source), with its link.
import { ballotFor } from "./tools";
import { getElectionDates, fmtDate, fmtRange } from "./logistics";
import { whereFor, dailyRows } from "./endscreen.mjs";

export const ASKS_BALLOT = /\b(what'?s|what is|what are|who'?s|who is|who are|show)\b[^?]*\b(my|the|our)\s+ballot\b|\bon my ballot\b/i;
export const ASKS_EARLY = /\bearly[\s-]*vot/i;
// QA (Adam, Oct 30 3:24 PM CT): "What are the hours?", "What time do polls open and close?", "Where can I vote early and what
// are the hours?" get the hours answer (early voting rows, then the Election Day row from the same data).
export const ASKS_HOURS = /\bhours?\b|\bwhat time\b|\b(polls?|polling (places?|sites?)|voting (centers?|sites?))\b[^?]*\b(open|close|closes|opens)\b|\b(open|close)s?\b[^?]*\bpolls?\b|\bvote early\b/i;

export type TownyLink = { label: string; url: string };
/** The page's own "today": the current date in America/Chicago (app/EndScreen.tsx todayCT). */
export const todayCT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
const longDay = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });

/** A fixed reply for a factual question, or null so the issue interview handles the text. Links are returned as
 *  data (rendered as real links by app/TownyInterview.tsx), never pasted into the reply text. */
export function townyFact(zip: string, text: string, today?: string): { reply: string; links: TownyLink[] } | null {
  const t = String(text || "");
  const hoursAsk = !ASKS_EARLY.test(t) && ASKS_HOURS.test(t);
  if (ASKS_EARLY.test(t) || hoursAsk) {
    const j = getElectionDates(zip);
    if (!j) return null;
    const ev = j.earlyVoting;
    // Same "today" and the same end === today test the page uses (lib/endscreen.mjs earlySingleDay, todayCT).
    const d = today ?? todayCT();
    // QA 297e948 P2 (Oct 30, 3:54 PM CT): SF's early-voting source is labeled by its office.
    const links: TownyLink[] = [{ label: zip === "94103" ? "SF Department of Elections" : "Early voting source", url: ev.sourceUrl }];
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
      // Rebase onto 7c281a6: its data keeps the Election Day row in earlyVoting.dailyHours; Towny's early-voting reply lists
      // only rows on or before the early-voting end date (the page's own rows, same formatting).
      const early = (ev.dailyHours ?? []).filter((r: { dates?: string; date?: string }) => (String(r.dates ?? r.date ?? "").match(/\d{4}-\d{2}-\d{2}/g) ?? []).every((x) => x <= ev.end));
      const rows = dailyRows(early, d, ev.sourceUrl, j.timezone) as { label: string; hours: string; appliesTo: string | null }[];
      const many = new Set(rows.map((x) => x.appliesTo)).size > 1;
      // Civic GO 73ddcbf P1 (Oct 30, 3:37 PM CT): one place for every row (SF: City Hall Voting Center) is named once.
      const one = !many && rows[0]?.appliesTo ? ` at ${rows[0].appliesTo}` : "";
      if (rows.length) hours = ` Hours${one}: ${rows.map((x) => `${x.label}: ${x.hours}${many && x.appliesTo ? ` (${x.appliesTo})` : ""}`).join("; ")}.`;
      // QA 8f78579 P2 (Oct 30, 3:05 PM CT): the Election Day row in the same data (SF: 2026-11-03, 7:00 AM-8:00 PM, City Hall
      // Voting Center and all 501 polling places) follows as its own sentence, formatted the same way, never as early voting.
      const after = (ev.dailyHours ?? []).filter((r: { dates?: string; date?: string }) => { const iso = String(r.dates ?? r.date ?? "").match(/\d{4}-\d{2}-\d{2}/g) ?? []; return iso.length > 0 && iso.every((x) => x > ev.end); });
      const ed = dailyRows(after, d, ev.sourceUrl, j.timezone) as { label: string; hours: string; appliesTo: string | null }[];
      if (rows.length && ed.length) hours += ` Election Day, ${ed.map((x) => `${x.label}: ${x.hours}${x.appliesTo ? ` (${x.appliesTo})` : ""}`).join("; ")}.`;
    }
    // An hours question also gets the Election Day hours from data/election_dates.json (electionDay.hours, word for word) when
    // the early-voting rows above did not already include them (78701, 10001).
    if (hoursAsk && j.electionDay?.hours && !/Election Day,/.test(hours)) {
      const ed = dailyRows([{ dates: j.electionDay.date, hours: j.electionDay.hours, appliesTo: null }], d, j.electionDay.sourceUrl, j.timezone) as { label: string; hours: string }[];
      if (ed.length) {
        hours += ` Election Day, ${ed.map((x) => `${x.label}: ${x.hours}`).join("; ")}.`;
        if (j.electionDay.sourceUrl && !links.some((l) => l.url === j.electionDay.sourceUrl)) links.push({ label: "Election Day hours source", url: j.electionDay.sourceUrl });
      }
    }
    return { reply: `${when}${hours}`, links };
  }
  if (ASKS_BALLOT.test(t)) {
    const b = ballotFor(zip);
    if (!b) return null;
    const measures = b.races.filter((r) => r.level === "measure").length;
    const races = b.races.length - measures;
    const n = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
    return { reply: `Your ${zip} ballot has ${n(races, "race")}${measures ? ` and ${n(measures, "ballot measure")}` : ""}. Each one is listed on this page, with sources.`,
      // The ballot's existing official source (ballotFor().verify, the same link the NY header shows); none if absent.
      links: b.verify?.url ? [{ label: b.verify.label, url: b.verify.url }] : [] };
  }
  return null;
}
