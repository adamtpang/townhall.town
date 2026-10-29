import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanNarration, UNSUPPORTED } from "../lib/narration.mjs";
test("narration: tool syntax replaced with deterministic text", () => {
  for (const bad of ["tool_code\nprint(default_api.getRaces())", "Here: `x`", "default_api.getDistricts", "print(1)"]) {
    const out = cleanNarration(bad, "78701", 3, 1);
    assert.equal(out, "ZIP 78701: 3 races and 1 measure on the Nov 3, 2026 ballot. Each item below links to its source.");
  }
  assert.equal(cleanNarration("Plain sentence.", "78701", 1, 0), "Plain sentence.");
  assert.match(cleanNarration("", "10001", 13, 5), /13 races and 5 measures/);
  assert.equal(UNSUPPORTED, "We only cover 78701 (Austin), 94103 (San Francisco) and 10001 (New York) for now.");
});
