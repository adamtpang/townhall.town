import { test } from "node:test";
import assert from "node:assert/strict";
import { overlapFor, overlapRows, overlapLabel, MIN_ISSUES } from "../lib/overlapCore.mjs";

const ids = ["a", "b", "c", "d"];
test("counts only issues with a sourced stance; unmapped issues are no data, not disagreement", () => {
  const o = overlapFor({ a: 3, b: -2, c: 4, d: 1 }, { a: { value: 4 }, b: { value: -3 } }, ids);
  assert.equal(o.n, 2);
  assert.equal(o.agree, 2);
  assert.equal(o.pct, 100); // c and d have no stance, so they do not pull the % down
});
test("skipped answers are not counted", () => {
  const o = overlapFor({ a: null, b: 2, c: 2 }, { a: { value: 5 }, b: { value: 2 }, c: { value: -4 } }, ids);
  assert.equal(o.n, 2);
  assert.equal(o.agree, 1);
  assert.equal(o.pct, 50);
});
test(`fewer than ${MIN_ISSUES} sourced issues gives no percentage`, () => {
  const o = overlapFor({ a: 3, b: 3 }, { a: { value: 3 } }, ids);
  assert.equal(o.n, 1);
  assert.equal(o.pct, null);
  assert.equal(o.enough, false);
  assert.equal(overlapFor({}, {}, ids).pct, null);
});
test("rows keep ballot order, never sorted by overlap", () => {
  const st = { Low: { a: { value: -5 }, b: { value: -5 } }, High: { a: { value: 5 }, b: { value: 5 } } };
  const rows = overlapRows([{ name: "Low" }, { name: "High" }], { a: 5, b: 5 }, (n) => st[n], ids);
  assert.deepEqual(rows.map((r) => r.c.name), ["Low", "High"]);
  assert.equal(rows[0].o.pct, 0);
  assert.equal(rows[1].o.pct, 100);
});
test("label says overlap with the count, never ranking words", () => {
  const l = overlapLabel("X", { agree: 4, n: 6 });
  assert.equal(l, "Your answers overlap with X on 4 of 6 issues they've stated");
  assert.doesNotMatch(l, /best|recommend|match|rank/i);
});
test("'No public statement found' entries (value null) are excluded from % and from the sourced count", () => {
  const nps = { value: null, status: "No public statement found", checkedDate: "2026-10-29", searched: ["https://example.gov"] };
  const o = overlapFor({ a: 3, b: 3, c: 3 }, { a: { value: 3 }, b: nps, c: { value: 4 } }, ids);
  assert.equal(o.n, 2);
  assert.deepEqual(o.counted, ["a", "c"]);
  assert.equal(overlapFor({ a: 3, b: 3 }, { a: { value: 3 }, b: nps }, ids).pct, null);
});
