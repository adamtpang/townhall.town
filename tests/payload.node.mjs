import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// QA P0.1: Said vs. did is removed. No accountability data or internal notes may ship in the ballot data.
test("no said-vs-did text in shipped ballot data", () => {
  for (const f of ["data/ballots.json", "data/ny.json", "data/tx.json", "data/stances.json"]) {
    const s = readFileSync(f, "utf8");
    assert.ok(!/said-vs-did|said vs\. did/i.test(s), f);
    assert.ok(!/"accountability"/.test(s), f);
  }
});
test("accountability modules are gone", () => {
  for (const f of ["lib/accountability.ts", "components/TrackRecord.tsx"]) assert.throws(() => readFileSync(f));
});
