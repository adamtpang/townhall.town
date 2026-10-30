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

const fmtDay = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
/** Civic's dailyHours rows from today on (past days hidden). Each: {label, hours, appliesTo, sourceUrl}. */
const ZONE = { "America/Los_Angeles": "PT", "America/Chicago": "CT", "America/New_York": "ET", "America/Denver": "MT" };
export const zoneLabel = (tz) => ZONE[tz] || "";
const withZone = (h, z) => (h && z && /\b(AM|PM)\b/.test(h) && !/\b[PCEM][SD]?T\b/.test(h) ? `${h} ${z}` : h);
export function dailyRows(rows, todayISO, fallbackUrl, tz) {
  const out = [];
  for (const r of rows || []) {
    const spec = r.dates || r.date || "";
    const isoAll = spec.match(/\d{4}-\d{2}-\d{2}/g) || [];
    if (!isoAll.length) continue;
    const tag = (/\(([^)]+)\)/.exec(spec) || [])[1];
    let label;
    if (/ to /.test(spec) && isoAll.length === 2) {
      if (isoAll[1] < todayISO) continue;
      const from = isoAll[0] > todayISO ? isoAll[0] : todayISO;
      label = from === isoAll[1] ? fmtDay(from) : `${fmtDay(from)} to ${fmtDay(isoAll[1])}`;
    } else {
      const fut = isoAll.filter((d) => d >= todayISO);
      if (!fut.length) continue;
      label = fut.map(fmtDay).join(" and ");
    }
    if (tag) label += ` (${tag})`;
    out.push({ label, hours: /^unsure/i.test(r.hours || "") ? "Hours not published" : withZone(r.hours, zoneLabel(tz)), appliesTo: (r.appliesTo || "").split(/;\s*/).filter((seg) => { const d = seg.match(/\d{4}-\d{2}-\d{2}/g); return seg && !(d && d.every((x) => x < todayISO)); }).join("; ") || null, sourceUrl: r.sourceUrl || fallbackUrl });
  }
  return out;
}
/** A summary hours string is shown only if it is a real sentence (never "see dailyHours"). */
const usableHours = (h) => (h && !/dailyHours/i.test(h) ? h : null);

/** Sourced events for a ZIP. Each event: {uid,title,allDay,start,end,hours,tz,details,location,sourceUrl} or {missing:label}. */
export function whenFor(zip, todayISO) {
  const j = dates.jurisdictions?.[zip];
  if (!j) return { events: [], missing: ["Election dates"], jurisdiction: null };
  const tz = j.timezone, out = [], missing = [];
  const ev = j.earlyVoting;
  if (ev?.start && ev?.end && ev.sourceUrl) {
    if (ev.end >= todayISO) {
      const from = ev.start > todayISO ? ev.start : todayISO;
      const daily = dailyRows(ev.dailyHours, todayISO, ev.sourceUrl, tz);
      const hours = usableHours(ev.hours);
      // Calendar text (QA phone pass, Oct 30): readable dates, span matches the event (QA P2). One short hours line only
      // when every remaining day has the same stated hours; otherwise point to the official hours page (the Source link).
      // Never an "unsure"/"Hours not published" line and never the full per-day list.
      const known = daily.filter((d) => d.hours && !/unsure|not published/i.test(d.hours));
      const same = known.length && known.length === daily.length && known.every((d) => d.hours === known[0].hours);
      const hoursText = same ? `${known[0].hours}${from === ev.end ? "" : " each day"}` : null;
      out.push({ uid: `th-ev-${zip}-2026@townhall.town`, kind: "early", title: "Early voting", allDay: true, start: from, end: ev.end, hours, daily, tz,
        details: `Early voting in ${j.name}: ${from === ev.end ? fmtDay(from) : `${fmtDay(from)} to ${fmtDay(ev.end)}`}.${hoursText ? ` Hours: ${hoursText}.` : " Hours: see the official hours page."}${ev.anySiteNote && !/unsure/i.test(ev.anySiteNote) ? ` ${ev.anySiteNote}` : ""} Source: ${ev.sourceUrl}`, sourceUrl: ev.sourceUrl });
    }
  } else missing.push("Early voting dates");
  const ed = j.electionDay;
  if (ed?.date && ed.sourceUrl) {
    const hrs = parseHours(ed.hours);
    out.push({ uid: `th-ed-${zip}-2026@townhall.town`, kind: "election", title: "Election Day", allDay: !hrs, start: ed.date, end: ed.date, hm: hrs, hours: withZone(ed.hours, zoneLabel(tz)) || null, tz,
      details: `Election Day in ${j.name}.${hrs ? ` Polls open ${ed.hours} local time.` : " Poll hours: see the official hours page."} Source: ${ed.sourceUrl}`, sourceUrl: ed.sourceUrl });
    if (!hrs) missing.push("Election Day poll hours");
  } else missing.push("Election Day date");
  const reg = j.registration || null;
  const m = j.mail;
  const at = (v) => { const [d, t] = String(v).split("T"); if (!t) return fmtDay(d); const [h, mi] = t.split(":").map(Number); return `${fmtDay(d)}, ${((h + 11) % 12) + 1}${mi ? `:${String(mi).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"} ${zoneLabel(tz)}`.trim(); };
  const mail = m?.postmarkedBy && m?.receivedBy && m.sourceUrl && String(m.receivedBy).slice(0, 10) >= todayISO
    ? { text: `Mailed ballots: postmarked by ${at(m.postmarkedBy)} and received by ${at(m.receivedBy)}.`, sourceUrl: m.sourceUrl } : null;
  return { events: out, missing, jurisdiction: j.name, tz, registration: reg, mail };
}

/** Google Calendar `dates`: all-day YYYYMMDD/YYYYMMDD (end exclusive, as in the .ics) or local wall-clock times (read with ctz). */
export function gcalDates(e) {
  return e.allDay ? `${ymd(e.start)}/${ymd(nextDay(e.end))}` : `${local(e.start, e.hm[0])}/${local(e.end, e.hm[1])}`;
}

export function gcalUrl(e, location = "") {
  const q = new URLSearchParams({ action: "TEMPLATE", text: `${e.title} (Nov 3, 2026 general election)`, dates: gcalDates(e), details: e.details, location });
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
    // QA P2: a 12-hours-before alarm only on single-day events; a multi-day window (early voting) gets none.
    // QA phone pass (Oct 30): never write an alarm that would fire in the past (e.g. early voting's last day, today).
    const startMs = e.allDay ? (e.tz ? zonedToUtc(e.start, 0, 0, e.tz) : new Date(e.start + "T00:00:00Z")).getTime() : zonedToUtc(e.start, e.hm[0][0], e.hm[0][1], e.tz).getTime();
    if (ymd(e.start) === ymd(e.end) && startMs - 12 * 3600e3 > nowMs) L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "TRIGGER:-PT12H", "END:VALARM");
    L.push("END:VEVENT");
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

/** QA df0cb76 #5: a one-day early-voting window. On that day (today's date in America/Chicago, passed in) it reads
 *  "Early voting ends today, Friday, October 30"; on any other day the plain date. null for a multi-day window.
 *  @param {{start:string,end:string}} ev @param {string} todayISO */
export function earlySingleDay(ev, todayISO) {
  if (!ev || ev.start !== ev.end) return null;
  const long = new Date(ev.end + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
  return ev.end === todayISO ? `Early voting ends today, ${long}` : `Early voting, ${long}`;
}
