// Design p15 (Oct 30, 5:34 AM CT): images that are not photos fall back to initials (McFadden illustration, Bastiany
// 'VOTE' poster) with a recorded reason; Papari re-cropped to his head; image sizes 40px under 1024px.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { NOT_A_PHOTO, EXCLUDE } from "../scripts/photo-rules.mjs";
import { withLicensedPhoto, INITIALS_ONLY } from "../lib/photos";

const ph = JSON.parse(fs.readFileSync("data/photos.json", "utf8"));
const man = JSON.parse(fs.readFileSync("data/portraits-manifest.json", "utf8"));
const batch = JSON.parse(fs.readFileSync("data/civic/photos_batch.json", "utf8"));
const P = fs.readFileSync("components/Portrait.tsx", "utf8");
const IDS = ["bunny-mcfadden", "pearci-pj-bastiany-iii"];

describe("p15 #1: non-photos are initials only, with a reason, across re-ingests", () => {
  it("the rule lives in photo-rules (not the Civic batch) and excludes both even though Civic still lists a URL", () => {
    for (const id of IDS) {
      expect(String(NOT_A_PHOTO[id as keyof typeof NOT_A_PHOTO])).toMatch(/not a photo/i);
      expect(batch[id].photoUrl).toMatch(/^https:/);
      expect(EXCLUDE(id, batch[id])).toBe(true);
    }
  });
  it("photos.json and the manifest record the reason; no files or records ship", () => {
    for (const id of IDS) {
      expect(ph.initialsOnly[id]).toBe(NOT_A_PHOTO[id as keyof typeof NOT_A_PHOTO]);
      expect(man.initialsOnly[id]).toBe(NOT_A_PHOTO[id as keyof typeof NOT_A_PHOTO]);
      expect(ph.selfHosted[id]).toBeUndefined();
      expect(man.portraits[id]).toBeUndefined();
      expect(ph.excluded).toContain(id);
      for (const n of [112, 160]) expect(fs.existsSync(`public/portraits/${id}-${n}.webp`)).toBe(false);
    }
  });
  it("the app gives both initials even if a record came back", () => {
    expect([...INITIALS_ONLY].sort()).toEqual(IDS);
    expect((withLicensedPhoto({ name: "Bunny McFadden" } as never) as { photo?: unknown }).photo).toBeNull();
    expect((withLicensedPhoto({ name: 'Pearci "PJ" Bastiany III' } as never) as { photo?: unknown }).photo).toBeNull();
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
    expect(P).toContain('sizes: "(max-width: 1023px) 40px, 56px"');
    expect(P).not.toContain('sizes: "56px"');
  });
});
