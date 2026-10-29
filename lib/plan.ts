// Sourced voting dates and official lookups for "Your plan". Only dates with a source are offered as calendar files.
import keyDates from "../data/research/texas/key_dates.json";

export type PlanDate = { id: string; label: string; date: string; note?: string; source: { label: string; url: string } };
export type Lookup = { label: string; url: string };

const tx = keyDates as { dates: { label: string; date?: string; date_range?: string[]; source: string }[] };
const txEarly = tx.dates.find((d) => d.date_range && /early voting/i.test(d.label));

export type St = "TX" | "CA" | "NY";
const NYCV = { label: "NYC Votes", url: "https://www.nycvotes.org/whats-on-the-ballot" };

export function planDates(state: St, electionDate: string): PlanDate[] {
  if (state === "NY") {
    // NYC Votes key dates (re-read 2026-10-29): early voting Sat Oct 24 - Sun Nov 1; Election Day Tue Nov 3.
    return [
      { id: "early-voting-ends", label: "Last day of early voting", date: "2026-11-01", note: "Early voting runs Oct 24 to Nov 1.", source: NYCV },
      { id: "election-day", label: "Election Day", date: electionDate, source: NYCV },
    ];
  }
  if (state === "TX") {
    const out: PlanDate[] = [];
    // Early-voting range is Oct 19-30 per the Texas SOS election notice (re-read 2026-10-29).
    if (txEarly?.date_range?.[1]) out.push({ id: "early-voting-ends", label: "Last day of early voting", date: txEarly.date_range[1], source: { label: "Texas SOS", url: "https://www.sos.state.tx.us/" } });
    out.push({ id: "election-day", label: "Election Day", date: electionDate, source: { label: "Texas SOS", url: "https://www.sos.state.tx.us/" } });
    return out;
  }
  // California: sos.ca.gov and voterguide.sos.ca.gov: Nov 3, polls 7:00 a.m. - 8:00 p.m.; mailed ballots postmarked on or before Nov 3. No separate early-voting end date.
  return [{ id: "election-day", label: "Election Day", date: electionDate, note: "Polls open 7 a.m. to 8 p.m. Mailed ballots must be postmarked by today.", source: { label: "sos.ca.gov", url: "https://www.sos.ca.gov/elections" } }];
}

export function lookups(state: St): Lookup[] {
  // County lookup links are added only when one is in the repo data; none is listed for Travis or San Francisco yet.
  if (state === "NY") return [{ label: "NYC Board of Elections: find my poll site", url: "https://findmypollsite.vote.nyc/" }];
  return state === "TX"
    ? [{ label: "VoteTexas.gov: find your polling place", url: "https://www.votetexas.gov/voting/where.html" }]
    : [
        { label: "sos.ca.gov: find your polling place", url: "https://www.sos.ca.gov/elections/polling-place" },
        { label: "caearlyvoting.sos.ca.gov", url: "https://caearlyvoting.sos.ca.gov/" },
      ];
}

export const bring = (state: St) =>
  state === "NY"
    ? { text: "ID rules depend on how you registered", source: { label: "NY State Board of Elections", url: "https://elections.ny.gov/" } }
    : state === "TX"
    ? { text: "One approved photo ID", source: { label: "Accepted IDs", url: "https://www.votetexas.gov/voting/need-id.html" } }
    : { text: "Usually no ID needed", source: { label: "Check your voter status", url: "https://voterstatus.sos.ca.gov/" } };

/** An all-day calendar event. No times are added because polling hours are set by the county. */
export function ics(d: PlanDate, place: string) {
  const ymd = d.date.replace(/-/g, "");
  const next = new Date(d.date + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  const end = next.toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//townhall.town//ballot plan//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${d.id}-${ymd}@townhall.town`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(`${d.label} (${place})`)}`,
    `DESCRIPTION:${esc(`${d.note ? d.note + "\n" : ""}Source: ${d.source.url}\nYour plan: https://townhall.town`)}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

export const fmtDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
