// Civic qa_fixes8 (applied 4 AM CT Oct 30): media-station credits, txcourts duplicates, James/Byrne photos, charter rule.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import sharp from "sharp";
import { EXCLUDE, isMediaCredit, sameFileAsCourtPortrait, dhash, hamming } from "../scripts/photo-rules.mjs";

const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
const photos = read("data/photos.json");
const stances = read("data/stances.json").stances;

describe("rule 3: radio and TV station credits are media photos", () => {
  it("excludes a bare call-sign credit even with an open Commons license (the old Letitia James WBLS photo)", () => {
    const p = { attribution: "Photo: WBLS", license: "CC BY 3.0", sourceType: "Wikimedia Commons", photoUrl: "https://upload.wikimedia.org/x.jpg" };
    expect(isMediaCredit(p)).toBe(true);
    expect(EXCLUDE("x", p)).toBe(true);
  });
  it("excludes call signs with a band suffix and station or broadcaster wording", () => {
    for (const a of ["Photo: KXAN-TV", "Photo: WNYC-FM", "Photo: KUT radio", "Photo: Spectrum News television", "Photo: ABC broadcast still"])
      expect(isMediaCredit({ attribution: a }), a).toBe(true);
    expect(isMediaCredit({ attribution: "Photo: x", sourceType: "TV station" })).toBe(true);
  });
  it("keeps ordinary credits", () => {
    for (const a of ["Photo: Wikimedia Commons user Bhkdynamo", "Photo: Letitia James campaign site", "Photo: US Senate", "Photo: Darlene Byrne own social profile", "Photo: Gage Skidmore"])
      expect(isMediaCredit({ attribution: a, sourceType: "campaign site" }), a).toBe(false);
  });
  it("no shipped credit is a station credit", () => {
    for (const [id, v] of Object.entries<any>({ ...photos.selfHosted, ...photos.hotlinked })) expect(isMediaCredit({ attribution: v.credit, sourceType: v.via }), id).toBe(false);
  });
});

describe("rule 2: the same image as a txcourts.gov portrait counts as the court portrait", () => {
  const byrneOld = { photoUrl: "https://images.squarespace-cdn.com/content/v1/abc/byrne1.jpg", sourceType: "campaign site", txcourtsPortrait: { image: "https://www.txcourts.gov/media/1460167/byrne1.jpg" } };
  it("excludes a campaign re-host with the court portrait's file name", () => {
    expect(sameFileAsCourtPortrait(byrneOld)).toBe(true);
    expect(EXCLUDE("darlene-byrne", byrneOld)).toBe(true);
  });
  it("does not exclude a different file", () => {
    expect(sameFileAsCourtPortrait({ ...byrneOld, photoUrl: "https://example.com/headshot.jpg" })).toBe(false);
  });
  it("the pixel check calls a re-encoded, resized copy the same image and a different photo not the same", async () => {
    const a = await sharp("public/portraits/darlene-byrne.webp").jpeg({ quality: 90 }).toBuffer();
    const reenc = await sharp(a).resize(300).jpeg({ quality: 60 }).toBuffer();
    const other = fs.readdirSync("public/portraits").find((f) => f !== "darlene-byrne.webp")!;
    const b = await sharp(`public/portraits/${other}`).toBuffer();
    expect(hamming(await dhash(a), await dhash(reenc))).toBeLessThanOrEqual(6);
    expect(hamming(await dhash(a), await dhash(b))).toBeGreaterThan(6);
  });
  it("ingest runs the pixel check for every candidate with a recorded court portrait", () => {
    const src = fs.readFileSync("scripts/ingest-photos.mjs", "utf8");
    expect(src).toMatch(/p\.txcourtsPortrait\?\.image && await sameImage\(p\)/);
    expect(src).toMatch(/hamming\(await dhash\(mine\), await dhash\(/);
  });
});

describe("qa_fixes8 photos", () => {
  it("Letitia James: campaign-site cutout hotlinked with a mic-free head-and-shoulders focus", () => {
    const j = photos.hotlinked["letitia-a-james"];
    expect(j.url).toBe("https://jamesforny.com/wp-content/uploads/2026/03/tish.png");
    expect(j.credit).toBe("Letitia James campaign site");
    expect(j.focus).toEqual([0.5, 0.15, 1.3]);
    expect(photos.selfHosted["letitia-a-james"]).toBeUndefined();
    expect(fs.existsSync("public/portraits/letitia-a-james.avif")).toBe(false);
  });
  it("Darlene Byrne: her own social-profile headshot, self-hosted; never the court portrait or its re-host", () => {
    const b = photos.selfHosted["darlene-byrne"];
    expect(b.file).toBe("/portraits/darlene-byrne.webp");
    expect(b.credit).toBe("Darlene Byrne own social profile");
    expect(fs.existsSync("public/portraits/darlene-byrne.webp")).toBe(true);
    expect(JSON.stringify(photos)).not.toMatch(/byrne1\.jpg|txcourts\.gov\/media/);
  });
  it("Civic gave her race no raceNote (year not stated), so it is not in incompleteRaces", () => {
    expect(photos.incompleteRaces).not.toContain("tx-3rd-coa-chief-justice");
  });
});

describe("charter rule: charter-school stances are not scored on education", () => {
  const unsure = ["bo-french", "karen-ortiz", "alina-bonsell", "virginia-cheung", "alida-fisher", "ryan-hazelton", "laurance-lee"];
  it("the seven are unsure and unscored", () => {
    for (const id of unsure) { const e = stances[id].education; expect(e.status, id).toBe("unsure"); expect(e.value ?? null, id).toBeNull(); }
  });
  it("Steve Hilton keeps +3", () => expect(stances["steve-hilton"].education.value).toBe(3));
  it("stances match Civic's expected qa8 file", () => {
    const q = "/workspace/townhall/civic/qa8/stances.qa8.json";
    if (fs.existsSync(q)) expect(read("data/stances.json")).toEqual(read(q));
  });
  it("grade eligibility stays at 19 races", async () => {
    const m: any = await import("../lib/gradesEligibility.gen.mjs");
    expect(m.default.data.races.length).toBe(19);
  });
});

// Civic QA9 (photo_gaps9.md, Oct 30 ~4:10 AM CT): Hochul's campaign-site photo replaces the MTA agency photo; Mark Ash
// (completes tx-court-of-criminal-appeals-place-3) and DJ Brookter self-hosted from Civic's saved localFiles.
describe("Civic QA9 photos", () => {
  const ph = JSON.parse(fs.readFileSync("data/photos.json", "utf8"));
  it("Hochul shows the kathyhochul.com photo with a head-and-shoulders focus; the MTA agency photo is gone", () => {
    const h = ph.hotlinked["kathy-c-hochul-adrienne-e-adams"];
    expect(h.url).toBe("https://kathyhochul.com/wp-content/uploads/2026/05/kha.jpg");
    expect(h.page).toBe("https://kathyhochul.com/");
    expect(h.focus).toEqual([0.62, 0.32, 2.2]);
    expect(ph.selfHosted["kathy-c-hochul-adrienne-e-adams"]).toBeUndefined();
    expect(fs.existsSync("public/portraits/kathy-c-hochul-adrienne-e-adams.avif")).toBe(false);
    expect(JSON.stringify(h)).not.toMatch(/MTA|wikimedia/i);
  });
  it.each(["mark-ash", "dionjay-dj-brookter"])("%s is self-hosted from Civic's localFile, credited to the own social profile", (id) => {
    const s = ph.selfHosted[id];
    expect(s.file).toBe(`/portraits/${id}.webp`);
    expect(fs.existsSync(`public${s.file}`)).toBe(true);
    expect(s.via).toBe("own social profile");
    expect(ph.hotlinked[id]).toBeUndefined();
  });
  it("tx-court-of-criminal-appeals-place-3 is complete", () => {
    expect(ph.incompleteRaces).not.toContain("tx-court-of-criminal-appeals-place-3");
  });
});
