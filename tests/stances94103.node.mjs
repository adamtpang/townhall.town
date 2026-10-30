import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const S = JSON.parse(fs.readFileSync(new URL("../data/stances.json", import.meta.url))).stances;
const B = JSON.parse(fs.readFileSync(new URL("../data/ballots.json", import.meta.url)));
const B7 = JSON.parse(fs.readFileSync(new URL("../data/civic/positions_gapfill_batch7civic.json", import.meta.url)));

// Batch 7 (Civic, Oct 30) replaced the old free-text status with Civic's "unsure" status plus a plain summary.
test("Bonta safety is null with Civic's status verbatim", () => {
  const s = S["rob-bonta"].safety;
  const civic = B7["rob-bonta"].unsure.find((u) => u.issue === "safety");
  assert.equal(s.value, null);
  assert.equal(s.status, civic.status); assert.equal(s.status, "unsure");
  assert.equal(s.summary, civic.summary); assert.equal(s.sourceUrl, civic.sourceUrl);
});
test("batch4 vote records carry bill, year and a source link", () => {
  for (const id of ["rob-bonta", "donald-p-don-wagner"]) {
    const w = S[id].wages;
    assert.equal(w.bill, "SB 3"); assert.equal(w.year, 2016);
    // Batch 7 format: the record names the bill and chamber ("Voted Yes on SB 3 (Leno), Assembly floor, ..."); votes are never quotes.
    assert.match(w.voteRecord, /^Voted (Yes|No) on SB 3 \(/); assert.equal(w.quote ?? "", ""); assert.match(w.sourceUrl, /^https:\/\//);
  }
});
test("94103 Treasurer and Lt. Governor pairs", () => {
  const races = JSON.stringify(B);
  assert.ok(races.includes("Kounalakis") && races.includes("Hawks"));
  assert.ok(races.includes("Fiona Ma") && races.includes("Romero"));
});
test("no _notes keys in stances", () => assert.ok(!JSON.stringify(S).includes('"_notes"')));
