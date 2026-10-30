import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// Folds are framer m.div under LazyMotion strict: outside a MotionShell they never animate open (height stays 0).
// BallotAgent mounts RaceTiers and IssueMatch separately, so each needs its own shell.
describe("motion shell covers every Fold root", () => {
  for (const f of ["app/RaceTiers.tsx", "app/IssueMatch.tsx"]) it(f, () => {
    const s = readFileSync(f, "utf8");
    expect(s).toMatch(/import MotionShell from "\.\.\/components\/MotionShell"/);
    expect(s).toMatch(/<MotionShell>/);
  });
});
