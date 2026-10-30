import { test } from "node:test";
import assert from "node:assert/strict";
import { whenFor, whereFor, gcalUrl, buildIcs, parseIcs, mapsUrl, zonedToUtc } from "../lib/endscreen.mjs";

const TODAY = "2026-10-29";
for (const zip of ["78701", "94103", "10001"]) {
  test(`${zip}: sourced events, valid Google URL and .ics`, () => {
    const w = whenFor(zip, TODAY);
    assert.ok(w.events.length >= 1);
    const ed = w.events.find((e) => e.kind === "election");
    assert.equal(ed.start, "2026-11-03");
    for (const e of w.events) {
      const u = new URL(gcalUrl(e));
      assert.equal(u.origin + u.pathname, "https://calendar.google.com/calendar/render");
      assert.equal(u.searchParams.get("action"), "TEMPLATE");
      assert.match(u.searchParams.get("dates"), /^\d{8}(T\d{6})?\/\d{8}(T\d{6})?$/);
      assert.match(u.searchParams.get("details"), /Source: https:\/\//);
    }
    const ev = parseIcs(buildIcs(w.events, "", Date.UTC(2026, 9, 29)));
    assert.equal(ev.length, w.events.length);
  });
}
test("Election Day TX 7-7 CT converts to 13:00Z-01:00Z", () => {
  const ed = whenFor("78701", TODAY).events.find((e) => e.kind === "election");
  const ics = buildIcs([ed]);
  assert.match(ics, /DTSTART:20261103T130000Z/);
  assert.match(ics, /DTEND:20261104T010000Z/);
  assert.match(gcalUrl(ed), /dates=20261103T070000%2F20261103T190000/);
  assert.match(gcalUrl(ed), /ctz=America%2FChicago/);
  assert.equal(zonedToUtc("2026-11-03", 6, 0, "America/New_York").toISOString(), "2026-11-03T11:00:00.000Z");
});
test("past early voting is hidden", () => {
  assert.equal(whenFor("78701", "2026-10-31").events.some((e) => e.kind === "early"), false);
});
test("where: 78701 has sourced sites, 94103 City Hall, 10001 lookup only", () => {
  const a = whereFor("78701", TODAY);
  assert.ok(a.sites.length >= 3);
  assert.equal(a.sites[0].zip, "78701");
  assert.match(mapsUrl(a.sites[0].address), /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=301%20W%202nd%20St/);
  const s = whereFor("94103", TODAY);
  assert.match(s.sites[0].name, /City Hall/);
  assert.ok(s.lookupUrl);
  const n = whereFor("10001", TODAY);
  assert.equal(n.sites.length, 0);
  assert.equal(n.lookupUrl, "https://findmypollsite.vote.nyc/");
});
