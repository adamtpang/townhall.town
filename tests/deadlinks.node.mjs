import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
// QA 5:56 PM: these URLs returned 404/500. Replacements were checked on Oct 29, 2026.
const DEAD = [/cde\.ca\.gov\/eo\/mn\/sp\//, /house\.texas\.gov\/members\/member-page\/\?district=/];
test("no known-dead official URLs in shipped data", () => {
  const files = ["data/ballots.json", "data/tx.json", "data/ny.json", ...readdirSync("data/civic").filter((f) => f.endsWith(".json")).map((f) => "data/civic/" + f)];
  for (const f of files) { const s = readFileSync(f, "utf8"); for (const re of DEAD) assert.ok(!re.test(s), `${f} has ${re}`); }
});
