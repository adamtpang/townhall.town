import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buttonValue, poleName, press, choiceOf, overlapFor } from "../lib/overlapCore.mjs";

const order = JSON.parse(fs.readFileSync(new URL("../data/issue_order.json", import.meta.url)));

test("issue_order has intro, one statement per issue, numeric poles, and ranked ZIP rows with sources", () => {
  assert.equal(order.intro, "Your answers stay private on your device and are never shared or sold.");
  for (const [k, s] of Object.entries(order.statements)) {
    assert.ok(s.statement && typeof s.statement === "string", k);
    assert.ok(s.yesMeansPole === 1 || s.yesMeansPole === -1, k);
  }
  for (const zip of ["78701", "94103", "10001"]) {
    const rows = order.zips[zip].issues;
    assert.ok(rows.length > 0, zip);
    for (const r of rows) { assert.ok(order.statements[r.issue], `${zip} ${r.issue}`); assert.match(r.sourceUrl, /^https:\/\//); }
  }
});

test("+1 issue (housing): buttonValue = stance.value * 1, Yes overlaps a +5 stance", () => {
  const pole = order.statements.housing.yesMeansPole;
  assert.equal(pole, 1);
  assert.equal(buttonValue(4, pole), 4);
  assert.equal(buttonValue(-3, pole), -3);
  const a = press({}, "housing", "yes", poleName(pole));
  assert.equal(choiceOf(a.housing, poleName(pole)), "yes");
  assert.equal(overlapFor(a, { housing: { value: 4 } }, ["housing"]).agree, 1);
  assert.equal(overlapFor(a, { housing: { value: -4 } }, ["housing"]).agree, 0);
});

test("-1 issue (healthcare): buttonValue = stance.value * -1, Yes overlaps a -5 stance", () => {
  const pole = order.statements.healthcare.yesMeansPole;
  assert.equal(pole, -1);
  assert.equal(buttonValue(4, pole), -4);
  assert.equal(buttonValue(-5, pole), 5);
  assert.equal(buttonValue(0, pole), 0);
  assert.equal(buttonValue(null, pole), null);
  const a = press({}, "healthcare", "yes", poleName(pole));
  assert.equal(choiceOf(a.healthcare, poleName(pole)), "yes");
  // Yes on "smaller government role" lines up with a -5 (smaller role) stance, not with +5.
  assert.equal(overlapFor(a, { healthcare: { value: -5 } }, ["healthcare"]).agree, 1);
  assert.equal(overlapFor(a, { healthcare: { value: 5 } }, ["healthcare"]).agree, 0);
  // Same thing on the button scale: both Yes (+5).
  assert.equal(Math.sign(buttonValue(-5, pole)), Math.sign(5));
});
