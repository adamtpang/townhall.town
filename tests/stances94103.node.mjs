import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const S = JSON.parse(fs.readFileSync(new URL("../data/stances.json", import.meta.url))).stances;
const B = JSON.parse(fs.readFileSync(new URL("../data/ballots.json", import.meta.url)));

test("Bonta safety is null with Civic's status verbatim", () => {
  const s = S["rob-bonta"].safety;
  assert.equal(s.value, null);
  assert.equal(s.status, "Mixed statements; no clear position from a valid source");
});
test("batch4 vote records carry bill, year and a source link", () => {
  for (const id of ["rob-bonta", "donald-p-don-wagner"]) {
    const w = S[id].wages;
    assert.equal(w.bill, "SB 3"); assert.equal(w.year, 2016);
    assert.match(w.voteRecord, /^Voted (Yes|No) \(/); assert.match(w.sourceUrl, /^https:\/\//);
  }
});
test("94103 Treasurer and Lt. Governor pairs", () => {
  const races = JSON.stringify(B);
  assert.ok(races.includes("Kounalakis") && races.includes("Hawks"));
  assert.ok(races.includes("Fiona Ma") && races.includes("Romero"));
});
test("no _notes keys in stances", () => assert.ok(!JSON.stringify(S).includes('"_notes"')));
