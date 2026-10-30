// QA P1 (Oct 30): no vague intro order sentence; each race carries its own confirmed/unsure line instead.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
describe("order intro sentence", () => {
  it("is gone from the end screen and the card", () => {
    for (const p of ["app/EndScreen.tsx", "app/card/BallotCard.tsx", "lib/i18n.tsx"]) {
      expect(read(p)).not.toContain("Candidates keep the ballot order in our data");
      expect(read(p)).not.toContain("in ballot order");
    }
  });
});
