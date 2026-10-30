// Election logistics (dates, hours, registration, mail ballots, polling places), read only from
// data/election_dates.json and data/polling_locations.json (Civic, official sources). No hand-written dates or places.
import datesFile from "../data/election_dates.json";
import pollingFile from "../data/polling_locations.json";
import { hostLabel } from "./sourceName";

type Daily = { date?: string; dates?: string; day?: string; hours: string; appliesTo?: string; sourceUrl?: string };
export type Jurisdiction = {
  name: string;
  timezone: string;
  earlyVoting: { start: string; end: string; hours: string; dailyHours?: Daily[]; anySite?: boolean; anySiteNote?: string; sourceUrl: string; locationsUrl?: string };
  registration: { deadline: string; deadlineMeaning?: string; openOnOct30: boolean; notes: string; sourceUrl: string };
  mail: { eligibility?: string; returnDeadline: string; returnRule: string; sourceUrl: string };
  electionDay: { date: string; hours: string; anySite?: boolean; anySiteNote?: string; sourceUrl: string; locationsUrl?: string };
};
export type Site = { name: string; room?: string; address: string; dates?: string; hours?: string; sourceUrl?: string };
export type Polling = { jurisdiction: string; lookupUrl: string; lookupUrlNote?: string; portalUrl?: string; dependsOnAddress: boolean; earlyVoting: Site[]; electionDay: Site[]; earlyVotingNote?: string; electionDayNote?: string };

const DATES = (datesFile as unknown as { jurisdictions: Record<string, Jurisdiction> }).jurisdictions;
const POLLING = (pollingFile as unknown as { zips: Record<string, Polling> }).zips;
export const LOGISTICS_ZIPS = Object.keys(DATES);

export const getElectionDates = (zip: string): Jurisdiction | null => DATES[zip] ?? null;
export const getPollingLocations = (zip: string): Polling | null => POLLING[zip] ?? null;

/** YYYY-MM-DD for "now" in a time zone. */
export const todayIn = (tz: string, now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
/** "Thursday, October 29, 2026" for "now" in a time zone. */
export const longDateIn = (tz: string, now = new Date()) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now);

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parts = (d: string) => d.split("-").map(Number);
export const fmtDate = (d: string) => {
  const [, m, day] = parts(d);
  return `${MON[m - 1]} ${day}`;
};
export const fmtRange = (a: string, b: string) => {
  const [, ma, da] = parts(a);
  const [, mb, db] = parts(b);
  return ma === mb ? `${MON[ma - 1]} ${da}–${db}` : `${fmtDate(a)}–${fmtDate(b)}`;
};
// Display label for a source link (Civic P2: the CA certified list is named, not shown as a bare hostname).
export const host = (u: string) => hostLabel(u);

export type PlanRow = { k: string; title: string; detail?: string[]; sites?: { label: string; list: Site[] }[]; src: string; s: string; past?: boolean };

export const NO_ONLINE_VOTING = "You can't vote by text, email or online. You can vote in person, or by mail if you're eligible.";

/** Plan rows for a ZIP, in date order, every fact from the two JSON files. `today` is YYYY-MM-DD in the jurisdiction. */
export function planRows(zip: string, today?: string): PlanRow[] {
  const j = getElectionDates(zip);
  const p = getPollingLocations(zip);
  if (!j) return [];
  const t = today ?? todayIn(j.timezone);
  const ev = j.earlyVoting;
  const reg = j.registration;
  const ed = j.electionDay;
  const rows: PlanRow[] = [];

  rows.push({
    k: "Register",
    title: reg.openOnOct30 ? "You can still register and vote" : reg.deadline < t ? `Registration deadline (${fmtDate(reg.deadline)}) has passed` : `Register by ${fmtDate(reg.deadline)}`,
    detail: [reg.notes],
    src: reg.sourceUrl,
    s: host(reg.sourceUrl),
  });

  const evPast = ev.end < t;
  const daily = (ev.dailyHours || []).filter((d) => d.date && d.date >= t).map((d) => `${d.day ? d.day + " " : ""}${fmtDate(d.date!)}: ${d.hours}`);
  rows.push({
    k: fmtRange(ev.start, ev.end),
    title: evPast ? "Early voting (ended)" : "Early voting",
    detail: [ev.dailyHours?.some((d) => d.date) ? daily.join(" · ") : ev.hours, ev.anySiteNote].filter(Boolean) as string[],
    src: ev.sourceUrl,
    s: host(ev.sourceUrl),
    past: evPast,
  });

  rows.push({
    k: fmtDate(j.mail.returnDeadline),
    title: "Mail ballots",
    detail: [j.mail.eligibility, j.mail.returnRule].filter(Boolean) as string[],
    src: j.mail.sourceUrl,
    s: host(j.mail.sourceUrl),
  });

  rows.push({
    k: fmtDate(ed.date),
    title: `Election Day, ${ed.hours}`,
    detail: ed.anySiteNote ? [ed.anySiteNote] : ed.anySite && ev.anySiteNote ? [ev.anySiteNote] : undefined,
    src: ed.sourceUrl,
    s: host(ed.sourceUrl),
  });

  if (p) {
    const sites: { label: string; list: Site[] }[] = [];
    if (p.earlyVoting.length && !evPast) sites.push({ label: `Early voting sites listed for ${zip}`, list: p.earlyVoting });
    if (p.electionDay.length) sites.push({ label: `Election Day sites listed for ${zip}`, list: p.electionDay });
    rows.push({
      k: "Where",
      title: p.dependsOnAddress ? "Your polling place depends on your address" : "Sites listed near this ZIP",
      detail: [p.earlyVotingNote, p.electionDayNote].filter(Boolean) as string[],
      sites,
      src: p.lookupUrl,
      s: `Official lookup (${host(p.lookupUrl)})`,
    });
  }

  rows.push({ k: "How", title: NO_ONLINE_VOTING, src: ed.sourceUrl, s: host(ed.sourceUrl) });
  return rows;
}
