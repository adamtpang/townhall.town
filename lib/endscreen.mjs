// Who / Where / When end screen helpers. Pure JS (node --test friendly). Data only from Civic's sourced files.
import dates from "../data/civic/election_dates.json" with { type: "json" };
import polls from "../data/civic/polling_locations.json" with { type: "json" };

export const mapsUrl = (address) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

/** "7:00 AM-7:00 PM" -> [[7,0],[19,0]] or null when not parseable (never guessed). */
export function parseHours(s) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((s || "").trim());
  if (!m) return null;
  const h = (hh, ap) => (+hh % 12) + (/pm/i.test(ap) ? 12 : 0);
  return [[h(m[1], m[3]), +m[2]], [h(m[4], m[6]), +m[5]]];
}

/** Offset in minutes of tz at a given UTC instant. */
function tzOffset(tz, utcMs) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return (asUtc - utcMs) / 60000;
}
/** Local wall time in tz -> UTC Date. */
export function zonedToUtc(isoDate, hh, mm, tz) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, hh, mm);
  const off = tzOffset(tz, guess);
  let t = guess - off * 60000;
  const off2 = tzOffset(tz, t);
  if (off2 !== off) t = guess - off2 * 60000;
  return new Date(t);
}
const pad = (n) => String(n).padStart(2, "0");
const utcStamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const local = (iso, hm) => `${iso.replace(/-/g, "")}T${pad(hm[0])}${pad(hm[1])}00`;
const ymd = (iso) => iso.replace(/-/g, "");
const nextDay = (iso) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

/** Sourced events for a ZIP. Each event: {uid,title,allDay,start,end,hours,tz,details,location,sourceUrl} or {missing:label}. */
export function whenFor(zip, todayISO) {
  const j = dates.jurisdictions?.[zip];
  if (!j) return { events: [], missing: ["Election dates"], jurisdiction: null };
  const tz = j.timezone, out = [], missing = [];
  const ev = j.earlyVoting;
  if (ev?.start && ev?.end && ev.sourceUrl) {
    if (ev.end >= todayISO) {
      const from = ev.start > todayISO ? ev.start : todayISO;
      out.push({ uid: `th-ev-${zip}-2026@townhall.town`, kind: "early", title: "Early voting", allDay: true, start: from, end: ev.end, hours: ev.hours || null, tz,
        details: `Early voting in ${j.name}: ${ev.start} to ${ev.end}.${ev.hours ? ` Hours: ${ev.hours}.` : ""}${ev.anySiteNote ? ` ${ev.anySiteNote}` : ""} Source: ${ev.sourceUrl}`, sourceUrl: ev.sourceUrl });
    }
  } else missing.push("Early voting dates");
  const ed = j.electionDay;
  if (ed?.date && ed.sourceUrl) {
    const hrs = parseHours(ed.hours);
    out.push({ uid: `th-ed-${zip}-2026@townhall.town`, kind: "election", title: "Election Day", allDay: !hrs, start: ed.date, end: ed.date, hm: hrs, hours: ed.hours || null, tz,
      details: `Election Day in ${j.name}.${ed.hours ? ` Polls open ${ed.hours} local time.` : " Poll hours: not found in an official source."} Source: ${ed.sourceUrl}`, sourceUrl: ed.sourceUrl });
    if (!hrs) missing.push("Election Day poll hours");
  } else missing.push("Election Day date");
  const reg = j.registration || null;
  return { events: out, missing, jurisdiction: j.name, tz, registration: reg };
}

export function gcalUrl(e, location = "") {
  let datesParam;
  if (e.allDay) datesParam = `${ymd(e.start)}/${ymd(nextDay(e.end))}`;
  else datesParam = `${local(e.start, e.hm[0])}/${local(e.end, e.hm[1])}`;
  const q = new URLSearchParams({ action: "TEMPLATE", text: `${e.title} (Nov 3, 2026 general election)`, dates: datesParam, details: e.details, location });
  if (!e.allDay) q.set("ctz", e.tz);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line) => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); } out.push(s); return out.join("\r\n"); };

export function buildIcs(events, location = "", nowMs = Date.now()) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//townhall.town//ballot plan//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    L.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utcStamp(new Date(nowMs))}`);
    if (e.allDay) L.push(`DTSTART;VALUE=DATE:${ymd(e.start)}`, `DTEND;VALUE=DATE:${ymd(nextDay(e.end))}`);
    else L.push(`DTSTART:${utcStamp(zonedToUtc(e.start, e.hm[0][0], e.hm[0][1], e.tz))}`, `DTEND:${utcStamp(zonedToUtc(e.end, e.hm[1][0], e.hm[1][1], e.tz))}`);
    L.push(`SUMMARY:${esc(e.title + " (Nov 3, 2026 general election)")}`, `DESCRIPTION:${esc(e.details)}`, `URL:${e.sourceUrl}`);
    if (location) L.push(`LOCATION:${esc(location)}`);
    L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "TRIGGER:-PT12H", "END:VALARM", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

/** Sourced polling places for a ZIP. Never invents an address. */
export function whereFor(zip, todayISO) {
  const z = polls.zips?.[zip];
  if (!z) return { sites: [], lookupUrl: null, phase: null };
  const evEnd = dates.jurisdictions?.[zip]?.earlyVoting?.end;
  const phase = evEnd && todayISO <= evEnd && (z.earlyVoting || []).length ? "early" : "election";
  const list = (phase === "early" ? z.earlyVoting : z.electionDay) || [];
  // Sites inside the ZIP first, then the rest in the official list order. No distance is computed.
  const inZip = list.filter((s) => s.zip === zip), rest = list.filter((s) => s.zip !== zip);
  const sites = [...inZip, ...rest].filter((s) => s.address && s.sourceUrl);
  return { sites, lookupUrl: z.lookupUrl || null, dependsOnAddress: !!z.dependsOnAddress, phase, jurisdiction: z.jurisdiction, note: phase === "early" ? z.earlyVotingNote : z.electionDayNote };
}

/** Minimal RFC 5545 sanity parser used by tests and the headless check. */
export function parseIcs(text) {
  const lines = text.replace(/\r\n /g, "").split("\r\n").filter(Boolean);
  if (lines[0] !== "BEGIN:VCALENDAR" || lines.at(-1) !== "END:VCALENDAR") throw new Error("bad envelope");
  const events = []; let cur = null, depth = 0;
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") { cur = {}; continue; }
    if (l === "END:VEVENT") { for (const k of ["UID", "DTSTART", "DTEND", "SUMMARY"]) if (!Object.keys(cur).some((x) => x.startsWith(k))) throw new Error("missing " + k); events.push(cur); cur = null; continue; }
    if (l === "BEGIN:VALARM") { depth++; continue; } if (l === "END:VALARM") { depth--; continue; }
    if (cur && !depth) { const i = l.indexOf(":"); if (i < 1) throw new Error("bad line " + l); cur[l.slice(0, i)] = l.slice(i + 1); }
  }
  return events;
}
