// Design p15 (Oct 30, 5:34 AM CT): images that are not photos fall back to initials (McFadden illustration, Bastiany
// 'VOTE' poster) with a recorded reason; Papari re-cropped to his head; image sizes 40px under 1024px.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { NOT_A_PHOTO, EXCLUDE } from "../scripts/photo-rules.mjs";
import { INITIALS_ONLY } from "../lib/photos";

const ph = JSON.parse(fs.readFileSync("data/photos.json", "utf8"));
const man = JSON.parse(fs.readFileSync("data/portraits-manifest.json", "utf8"));
const batch = JSON.parse(fs.readFileSync("data/civic/photos_batch.json", "utf8"));
const P = fs.readFileSync("components/Portrait.tsx", "utf8");
const IDS = ["bunny-mcfadden", "pearci-pj-bastiany-iii"];

describe("p15 #1: the initials-only mechanism (list emptied by Civic qa11; see tests/p16.test.ts)", () => {
  it("NOT_A_PHOTO is empty, EXCLUDE honours it, and the empty list still ships in both data files", () => {
    expect(NOT_A_PHOTO).toEqual({});
    for (const id of IDS) expect(EXCLUDE(id, batch[id])).toBe(false);
    expect(ph.initialsOnly).toEqual({});
    expect(man.initialsOnly).toEqual({});
    expect(INITIALS_ONLY.size).toBe(0);
  });
});

describe("p15 #2: Papari cropped to his head", () => {
  it("manifest crop is the 340px square at (715, 330) of the 1200x800 source; both files match their sha", () => {
    const m = man.portraits["arshia-papari"];
    expect(m.crop).toEqual({ left: 0, top: 0, width: 340, height: 340 });
    expect(m.sourceSize).toEqual([340, 340]);
    expect(m.precrop).toEqual({ left: 715, top: 330, width: 340, height: 340 });
    expect(fs.readFileSync("scripts/ingest-photos.mjs", "utf8")).toMatch(/"arshia-papari": \[715 \/ 1200, 330 \/ 800, 340 \/ 1200, 340 \/ 800\]/);
    for (const n of [112, 160]) expect(createHash("sha256").update(fs.readFileSync(`public${m.files[n].file}`)).digest("hex")).toBe(m.files[n].sha256);
  });
});

describe("p15 #3: sizes attribute", () => {
  it("40px under 1024px, 56px from 1024 up", () => {
    expect(P).toContain('sizes: "(max-width: 1023px) 120px, 160px"');
    expect(P).not.toContain('sizes: "56px"');
  });
});
