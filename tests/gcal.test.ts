// Google Calendar plan link (Adam via Maans, 12:51 PM CT Oct 30): encoding, dates per ZIP, no candidate names, sources.
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { whenFor, whereFor, buildIcs, parseIcs, zonedToUtc, mapsUrl } from "../lib/endscreen.mjs";
import { planEventUrl, topRaceTitles, CITY, CARD_BASE, type PlanEvent } from "../lib/gcal";
import { ballotFor } from "../lib/tools";
import { tierFor } from "../app/RaceTiers";

const TODAY = "2026-10-30";
const ZIPS = { "78701": ["America/Chicago", "T070000", "T190000"], "94103": ["America/Los_Angeles", "T070000", "T200000"], "10001": ["America/New_York", "T060000", "T210000"] } as const;
function build(zip: string, kind: "election" | "early") {
  const when = whenFor(zip, TODAY);
  const e = when.events.find((x: { kind: string }) => x.kind === kind) as PlanEvent | undefined;
  if (!e) return null;
  const wh = whereFor(zip, kind === "election" ? e.start : TODAY);
  const races = ballotFor(zip)!.races;
  const url = planEventUrl({ e, zip, site: wh.sites[0], lookupUrl: wh.lookupUrl, dependsOnAddress: wh.dependsOnAddress, topRaces: topRaceTitles(races as never) });
  return { e, wh, races, url, u: new URL(url) };
}
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

describe("planEventUrl: Google Calendar template link", () => {
  for (const [zip, [tz, s, en]] of Object.entries(ZIPS)) {
    it(`${zip}: Election Day is timed in ${tz} with the same hours as the .ics`, () => {
      const { e, u, url } = build(zip, "election")!;
      expect(u.origin + u.pathname).toBe("https://calendar.google.com/calendar/render");
      expect([...u.searchParams.keys()]).toEqual(["action", "text", "dates", "ctz", "location", "details"]);
      expect(u.searchParams.get("action")).toBe("TEMPLATE");
      expect(u.searchParams.get("text")).toBe(`Vote: Election Day, ${CITY[zip]}`);
      expect(u.searchParams.get("dates")).toBe(`20261103${s}/20261103${en}`);
      expect(u.searchParams.get("ctz")).toBe(tz);
      // Same instant as the .ics DTSTART (which is written in UTC).
      const ics = (parseIcs(buildIcs([e], "")) as any)[0];
      expect(ics.DTSTART).toBe(utc(zonedToUtc("2026-11-03", +s.slice(1, 3), 0, tz)));
      // Properly encoded: no raw spaces, no "+" for spaces, "/" and newlines escaped.
      const q = url.split("?")[1];
      expect(q).not.toMatch(/[ \n+]/);
      expect(q).toContain("dates=20261103" + s + "%2F");
      expect(q).toContain("%0A");
    });
  }
  it("an event with no published hours is all-day (end date exclusive, as in the .ics)", () => {
    const e: PlanEvent = { kind: "election", title: "Election Day", allDay: true, start: "2026-11-03", end: "2026-11-03", hm: null, tz: "America/Chicago", details: "Source: https://example.gov/", sourceUrl: "https://example.gov/" };
    const u = new URL(planEventUrl({ e, zip: "78701" }));
    expect(u.searchParams.get("dates")).toBe("20261103/20261104");
    expect((parseIcs(buildIcs([e], "")) as any)[0]["DTSTART;VALUE=DATE"]).toBe("20261103");
  });
  it("78701 early voting (today, Oct 30) is all-day and names the early site", () => {
    const { u, wh } = build("78701", "early")!;
    expect(u.searchParams.get("text")).toBe("Vote: Early voting, Austin");
    expect(u.searchParams.get("dates")).toBe("20261030/20261031");
    expect(u.searchParams.get("location")).toBe(`${wh.sites[0].name}, ${wh.sites[0].address}`);
  });
  it("round-trips characters that need encoding (&, #, ?, =, accents, newlines)", () => {
    const e: PlanEvent = { kind: "election", title: "x", allDay: true, start: "2026-11-03", end: "2026-11-03", tz: "America/New_York", details: "A & B #1? x=y Peña\nSource: https://e.gov/?a=1&b=2", sourceUrl: "https://e.gov/" };
    const site = { name: "P.S. 11 & Annex", address: "320 W 21st St, New York, NY 10011" };
    const u = new URL(planEventUrl({ e, zip: "10001", site, topRaces: ["Governor & Lt. Governor"] }));
    expect(u.searchParams.get("location")).toBe("P.S. 11 & Annex, 320 W 21st St, New York, NY 10011");
    const d = u.searchParams.get("details")!;
    expect(d).toContain("Top races on your ballot: Governor & Lt. Governor");
    expect(d).toContain("A & B #1? x=y Peña\nSource: https://e.gov/?a=1&b=2");
    expect(d).toContain(`Map: ${mapsUrl(site.address)}`);
  });
});

describe("plan link content: sourced, nonpartisan, no personal data", () => {
  for (const zip of Object.keys(ZIPS)) {
    for (const kind of ["election", "early"] as const) {
      const b = build(zip, kind);
      if (!b) continue;
      it(`${zip} ${kind}: race names only, sources included, no candidate names or answers`, () => {
        const { e, wh, races, u, url } = b;
        const text = [u.searchParams.get("text"), u.searchParams.get("location"), u.searchParams.get("details")].join("\n");
        for (const r of races) for (const c of r.candidates ?? []) expect(text, c.name).not.toContain(c.name);
        const prose = text.replace(/https?:\/\/\S+/g, ""); // URL escapes like %20 are not scores
        expect(prose).not.toMatch(/\b(best|vote for|recommend|endorse|match|overlap|fit|grade)\b/i);
        expect(prose).not.toMatch(/\d+%/);
        const d = u.searchParams.get("details")!;
        expect(d).toContain(`Source: ${e.sourceUrl}`);
        expect(d).toContain(`Your ballot card: ${CARD_BASE}${zip}`);
        if (wh.sites[0]) { expect(d).toContain(`Polling place: ${wh.sites[0].name}, ${wh.sites[0].address}`); expect(d).toContain(`Map: ${mapsUrl(wh.sites[0].address)}`); }
        if (wh.lookupUrl && (wh.dependsOnAddress || !wh.sites[0])) expect(d).toContain(`Find your assigned polling place: ${wh.lookupUrl}`);
        // Top races are titles of non-judicial races in the "Most at stake"/"High stakes" tiers.
        const line = d.split("\n").find((l) => l.startsWith("Top races on your ballot: "))!;
        const names = line.replace("Top races on your ballot: ", "").split("; ");
        expect(names.length).toBeGreaterThan(0);
        expect(names.length).toBeLessThanOrEqual(5);
        for (const n of names) { const r = races.find((x) => x.title === n)!; expect(r, n).toBeTruthy(); expect((r as { judicial?: unknown }).judicial).toBeFalsy(); expect(["most", "high"]).toContain(tierFor(r as never).tier); }
        // No answers or personal data in the URL (no hash, no extra params).
        expect(url).not.toContain("#");
        expect([...u.searchParams.keys()]).toEqual(["action", "text", "dates", "ctz", "location", "details"]);
      });
    }
  }
});

describe("UI: Google Calendar is the primary action, .ics a muted secondary link", () => {
  const ids = ["abortion"];
  it("end screen: Button with the plan URL, then 'or download .ics' in muted text", async () => {
    const { default: EndScreen } = await import("../app/EndScreen");
    const html = renderToStaticMarkup(h(EndScreen, { zip: "78701", races: ballotFor("78701")!.races as never, answers: {}, ids, answered: 0 }));
    const g = /data-gcal-url="([^"]+)"/.exec(html)![1].replace(/&amp;/g, "&");
    expect(g).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&text=Vote%3A%20Election%20Day%2C%20Austin&/);
    expect(html).toMatch(/<a[^>]*class="[^"]*h-12[^"]*"[^>]*data-gcal-url=/); // QA a11y P2 (Oct 30): the calendar control is a real link
    expect(html).toMatch(/class="inline-flex min-h-11 items-center text-black\/60 [^"]*" data-ics="true">or download \.ics<\/button>/);
    expect(html).toMatch(/rel="noopener noreferrer"[^>]*data-gcal-early/);
    expect(html.indexOf("data-gcal-url")).toBeLessThan(html.indexOf("data-ics"));
  });
  it("ballot card: Add to Google Calendar button, .ics kept as a muted link", async () => {
    const { default: BallotCard } = await import("../app/card/BallotCard");
    const b = ballotFor("94103")!;
    const races = b.races.map((r) => ({ id: r.id, title: r.title, level: r.level, judicial: !!(r as { judicial?: unknown }).judicial, meta: (r as { meta?: unknown }).meta ?? null, candidates: [] }));
    const html = renderToStaticMarkup(h(BallotCard, { zip: "94103", place: b.place, ids, races }));
    const g = /data-card-gcal="([^"]+)"/.exec(html)![1].replace(/&amp;/g, "&");
    expect(new URL(g).searchParams.get("ctz")).toBe("America/Los_Angeles");
    expect(html).toMatch(/data-card-ics="true">or download \.ics</);
    expect(html).toContain(">Add to Google Calendar ↗");
  });
});

describe("QA phone pass (Oct 30): Election Day leads, no past alarms, short hours text, ZIP input", () => {
  it("calendar text: one short hours line only when real and uniform; never a per-day blob or 'Hours not published'", () => {
    for (const zip of Object.keys(ZIPS)) for (const e of whenFor(zip, TODAY).events as PlanEvent[]) {
      expect(e.details).not.toMatch(/not published|unsure|not found/i);
      expect((e.details.match(/AM-/g) || []).length).toBeLessThanOrEqual(1);
      expect(e.details).toMatch(/(Hours: .+ (each day)?\.|Hours: see the official hours page\.|Polls open .+ local time\.) .*Source: https:\/\//);
      expect(e.details.length).toBeLessThan(340);
    }
    const ny = whenFor("10001", TODAY).events.find((e: { kind: string }) => e.kind === "early");
    expect(ny!.details).toContain("Hours: 9:00 AM-5:00 PM ET each day.");
    const tx = whenFor("78701", TODAY).events.find((e: { kind: string }) => e.kind === "early");
    expect(tx!.details).toContain("Hours: see the official hours page.");
  });
  it(".ics: Election Day first; no alarm that would fire in the past (early voting's last day is today)", async () => {
    const { electionFirst } = await import("../lib/gcal");
    const now = Date.parse("2026-10-30T17:59:00Z"); // 12:59 PM CT
    for (const zip of Object.keys(ZIPS)) {
      const ev = electionFirst(whenFor(zip, TODAY).events);
      expect(ev[0].kind).toBe("election");
      const parts = buildIcs(ev, "", now).split("BEGIN:VEVENT").slice(1);
      expect(parts[0]).toMatch(/SUMMARY:Election Day/);
      expect(parts[0]).toMatch(/TRIGGER:-PT12H/); // Nov 2 evening: still ahead
      for (const p of parts.slice(1)) expect(p).not.toMatch(/VALARM/);
    }
    // A single-day event whose 12-hours-before alarm is still ahead keeps it.
    const one = { uid: "x", kind: "early", title: "Early voting", allDay: true, start: "2026-11-01", end: "2026-11-01", tz: "America/Chicago", details: "d", sourceUrl: "https://e.gov/" };
    expect(buildIcs([one], "", now)).toMatch(/TRIGGER:-PT12H/);
    expect(buildIcs([{ ...one, start: "2026-10-30", end: "2026-10-30" }], "", now)).not.toMatch(/VALARM/);
  });
  it("ZIP input brings up the number pad, and the unsupported notice sits right under it (before the city chips)", async () => {
    const src = (await import("node:fs")).readFileSync(new URL("../app/BallotAgent.tsx", import.meta.url), "utf8");
    const input = src.slice(src.indexOf("<Input"), src.indexOf("/>", src.indexOf("<Input")));
    for (const a of ['inputMode="numeric"', 'pattern="[0-9]*"', "maxLength={5}", 'autoComplete="postal-code"']) expect(input).toContain(a);
    const form = src.indexOf("</form>"), notice = src.indexOf("data-zip-notice"), chips = src.indexOf("{DEMO.map(");
    expect(form).toBeLessThan(notice);
    expect(notice).toBeLessThan(chips);
    const { UNSUPPORTED_MESSAGE } = await import("../lib/site");
    expect(UNSUPPORTED_MESSAGE).toBe("Austin, SF and NYC for now.");
  });
});
