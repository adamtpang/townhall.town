// QA fb66b9b P0: party photo parity. Race mode (A, the default) can never picture one party and not the other.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { parity } from "../lib/photoParity";
import { PHOTO_GATE } from "../lib/photos";
const ZIPS = ["78701", "94103", "10001"];
describe("photo parity", () => {
  it("race mode (flag; candidate is the default since Oct 30 9:58 AM): no race partly pictured, no D-vs-R race with one party pictured", () => {
    expect(PHOTO_GATE).toBe("candidate");
    const a = parity(ZIPS, "race");
    expect(a.partly).toEqual([]);
    expect(a.oneParty).toEqual([]);
  });
  it("candidate mode stats are computed (QA asks for them in every report)", () => {
    const b = parity(ZIPS, "candidate");
    expect(b.races).toBeGreaterThan(0);
    if (process.env.PARITY_OUT) fs.writeFileSync(process.env.PARITY_OUT, JSON.stringify({ race: parity(ZIPS, "race"), candidate: b, perZip: Object.fromEntries(ZIPS.map((z) => [z, { race: parity([z], "race"), candidate: parity([z], "candidate") }])) }, null, 1));
  });
});
