import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const S = JSON.parse(readFileSync("data/stances.json", "utf8")).stances;
const B = JSON.parse(readFileSync("data/ballots.json", "utf8"))["78701"];
const N = JSON.parse(readFileSync("data/ny.json", "utf8"))["10001"];
test("78701: Buckingham: batch6 real quotes win over heading-only entries", () => {
  // batch6 replaced the heading-only entries with real quotes
  for (const iss of ["taxes", "immigration"]) { assert.notEqual(S["dawn-buckingham"][iss].value, null); assert.doesNotMatch(S["dawn-buckingham"][iss].quote, /^[A-Z ]+$/); }
});
test("78701: voteRecord kept with its source", () => {
  // Batch 7 (Civic, Oct 30): the bill moved out of the quote into voteRecord/bill ("recorded votes go in voteRecord, never quotes").
  for (const k of ["jon-rosenthal", "sarah-eckhardt"]) { const s = S[k].immigration; assert.match(s.voteRecord, /^Voted Nay on SB 8, /); assert.equal(s.bill, "SB 8"); assert.match(s.sourceUrl, /^https:\/\//); assert.equal(s.quote ?? "", ""); }
});
test("court races are judicial; county judge is not", () => {
  assert.ok(B.races.filter((r) => /court|appeals/i.test(r.title)).every((r) => r.judicial === "tx"));
  assert.ok(!B.races.find((r) => r.title === "County Judge").judicial);
  assert.ok(N.races.some((r) => r.judicial === "ny"));
});
test("name fixes applied", () => {
  const names = B.races.flatMap((r) => r.candidates.map((c) => c.name));
  assert.ok(names.includes("Neill Snider") && names.includes("Austin R. Kelly"));
});
