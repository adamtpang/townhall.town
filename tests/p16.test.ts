// Civic qa11 (Oct 30, 5:50 AM CT): McFadden and Bastiany get solo campaign photographs, so they leave the not-a-photo list
// and ship self-hosted 112/160px webp files cropped per Civic's cropNote (both 160px files viewed by eye).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { NOT_A_PHOTO, EXCLUDE } from "../scripts/photo-rules.mjs";
import { withLicensedPhoto } from "../lib/photos";

const ph = JSON.parse(fs.readFileSync("data/photos.json", "utf8"));
const man = JSON.parse(fs.readFileSync("data/portraits-manifest.json", "utf8"));
const batch = JSON.parse(fs.readFileSync("data/civic/photos_batch.json", "utf8"));
const src = fs.readFileSync("scripts/ingest-photos.mjs", "utf8");
const sha = (f: string) => createHash("sha256").update(fs.readFileSync(f)).digest("hex");

describe("qa11: McFadden and Bastiany photos", () => {
  it("neither is on the not-a-photo list or excluded", () => {
    for (const id of ["bunny-mcfadden", "pearci-pj-bastiany-iii"]) {
      expect(id in NOT_A_PHOTO).toBe(false);
      expect(EXCLUDE(id, batch[id])).toBe(false);
      expect(ph.excluded ?? []).not.toContain(id);
    }
  });
  it("McFadden: the ourcitycollege.com DSC09407 photo, head and shoulders from the top third", () => {
    const m = man.portraits["bunny-mcfadden"];
    expect(m.sourceUrl).toMatch(/squarespace-cdn\.com\/.*\/DSC09407\.jpg/);
    expect(m.page).toBe("https://www.ourcitycollege.com/bunny-mcfadden");
    expect(m.precrop).toEqual({ left: 47, top: 150, width: 562, height: 562 });
    expect(m.precrop.top + m.precrop.height / 2).toBeLessThan(1125 / 2);
    expect(src).toMatch(/"bunny-mcfadden": \[47 \/ 750, 150 \/ 1125, 562 \/ 750, 562 \/ 1125\]/);
  });
  it("Bastiany: Civic's localFile, cropped at x 390-590, y 400-600", () => {
    const m = man.portraits["pearci-pj-bastiany-iii"];
    expect(m.localFile).toMatch(/photos_local\/pearci-pj-bastiany-iii\.jpg$/);
    expect(m.sourceUrl).toMatch(/pj-sf-event/);
    expect(m.precrop).toEqual({ left: 390, top: 400, width: 200, height: 200 });
    expect(src).toMatch(/"pearci-pj-bastiany-iii": \[390 \/ 960, 400 \/ 1280, 200 \/ 960, 200 \/ 1280\]/);
  });
  it("both ship 112 and 160 files matching the manifest sha, and the app shows them", () => {
    for (const id of ["bunny-mcfadden", "pearci-pj-bastiany-iii"]) {
      const m = man.portraits[id];
      for (const n of [112, 160]) expect(sha(`public${m.files[n].file}`)).toBe(m.files[n].sha256);
      expect(ph.selfHosted[id]).toBeTruthy();
    }
    expect((withLicensedPhoto({ name: "Bunny McFadden" } as never) as { photo?: unknown }).photo).toBeTruthy();
    expect((withLicensedPhoto({ name: 'Pearci "PJ" Bastiany III' } as never) as { photo?: unknown }).photo).toBeTruthy();
  });
});
