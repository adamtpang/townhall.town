import { test } from "node:test";
import assert from "node:assert/strict";
import { overlapFor, overlapRows, overlapLabel, MIN_ISSUES, migrateAnswers, press, choiceOf } from "../lib/overlapCore.mjs";

const ids = ["a", "b", "c", "d"];
test("counts only issues with a sourced stance; unmapped issues are no data, not disagreement", () => {
  const o = overlapFor({ a: 5, b: -5, c: 5, d: 5 }, { a: { value: 4 }, b: { value: -3 } }, ids);
  assert.equal(o.n, 2);
  assert.equal(o.agree, 2);
  assert.equal(o.pct, 100); // c and d have no stance, so they do not pull the % down
});
test("skipped answers are not counted", () => {
  const o = overlapFor({ a: null, b: 5, c: 5 }, { a: { value: 5 }, b: { value: 2 }, c: { value: -4 } }, ids);
  assert.equal(o.n, 2);
  assert.equal(o.agree, 1);
  assert.equal(o.pct, 50);
});
test(`fewer than ${MIN_ISSUES} sourced issues gives no percentage`, () => {
  const o = overlapFor({ a: 5, b: 5 }, { a: { value: 3 } }, ids);
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
  const o = overlapFor({ a: 5, b: 5, c: 5 }, { a: { value: 3 }, b: nps, c: { value: 4 } }, ids);
  assert.equal(o.n, 2);
  assert.deepEqual(o.counted, ["a", "c"]);
  assert.equal(overlapFor({ a: 5, b: 5 }, { a: { value: 3 }, b: nps }, ids).pct, null);
});

test("Neutral answers are excluded, overlap means same sign only", () => {
  const o = overlapFor({ a: 0, b: 5, c: -5, d: 5 }, { a: { value: 5 }, b: { value: 1 }, c: { value: 2 }, d: { value: 0 } }, ids);
  assert.deepEqual(o.counted, ["b", "c"]); // a is Neutral, d has a zero stance
  assert.equal(o.agree, 1);
  assert.equal(o.pct, 50);
});
test("label with percent", () => {
});
test("old slider values migrate: >0 Yes, <0 No, 0 Neutral, null stays null", () => {
  assert.deepEqual(migrateAnswers({ a: 3, b: -1, c: 0, d: null }), { a: 5, b: -5, c: 0, d: null });
});
test("press stores ±5 by yesMeansPole, Neutral 0, re-tap clears", () => {
  let a = press({}, "x", "yes");
  assert.equal(a.x, 5);
  assert.equal(press(a, "x", "yes").x, null);
  assert.equal(press({}, "x", "yes", "low").x, -5);
  assert.equal(choiceOf(-5, "low"), "yes");
  assert.equal(press({}, "x", "neutral").x, 0);
  assert.equal(choiceOf(0), "neutral");
  assert.equal(press({}, "x", "no").x, -5);
});

import { overlapStatus } from "../lib/overlapCore.mjs";
test("overlapStatus: one threshold, few / answer / ok", () => {
  const st = { a: { value: 5 }, b: { value: -5 }, c: { value: null } };
  assert.equal(overlapStatus({ a: 5 }, { a: { value: 5 } }, ["a", "b"]).status, "few");
  assert.equal(overlapStatus({ a: 5, b: 0 }, st, ["a", "b", "c"]).status, "answer");
  const ok = overlapStatus({ a: 5, b: 5 }, st, ["a", "b", "c"]);
  assert.equal(ok.status, "ok"); assert.equal(ok.agree, 1); assert.equal(ok.pct, 50);
});

test("Sourced positions count does not depend on the voter's answers", () => {
  const st = { a: { value: 3 }, b: { value: -2 }, c: { value: 4 }, d: { value: null } };
  const ids = ["a", "b", "c", "d"];
  const one = overlapStatus({ a: 5 }, st, ids), all = overlapStatus({ a: 5, b: 5, c: -5, d: 5 }, st, ids);
  assert.deepEqual(one.sourcedIds, ["a", "b", "c"]); assert.deepEqual(all.sourcedIds, ["a", "b", "c"]);
});
