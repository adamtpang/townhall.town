// Design p14 + Civic qa10 (Oct 30, 4:38 AM CT): self-hosted 112/160px portraits with a manifest, agency photos excluded,
// a 44x44 credits more/less button with aria-controls, and the shorter grades note.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isAgencyPhoto, isFisherVideo, EXCLUDE } from "../scripts/photo-rules.mjs";
import { GRADES_ABSENT_LINE } from "../lib/grades.mjs";
import { TileImage } from "../components/Portrait";

const ph = JSON.parse(fs.readFileSync("data/photos.json", "utf8"));
const man = JSON.parse(fs.readFileSync("data/portraits-manifest.json", "utf8"));
const P = fs.readFileSync("components/Portrait.tsx", "utf8");

describe("p14 page weight: every portrait self-hosted at 112 and 160px", () => {
  it("nothing is hotlinked; each self-hosted portrait has both files and a manifest entry with source URL and sha256", () => {
    expect(ph.hotlinked).toEqual({});
    expect(man.sizes).toEqual([112, 160, 256]); // Adam 1:11 PM Oct 30: bigger (256 q75 where the crop is >= 256px)
    for (const [id, x] of Object.entries<any>(ph.selfHosted)) if (x.file256) { expect(x.file256, id).toBe(`/portraits/${id}-256.webp`); expect(fs.existsSync(`public${x.file256}`), id).toBe(true); expect(man.portraits[id].crop.width, id).toBeGreaterThanOrEqual(256); }
    for (const [id, x] of Object.entries<any>(ph.selfHosted)) {
      expect(x.file, id).toBe(`/portraits/${id}-160.webp`);
      expect(x.file112, id).toBe(`/portraits/${id}-112.webp`);
      const m = man.portraits[id];
      expect(m.sourceUrl ?? m.localFile, id).toBeTruthy();
      expect(m.sourceSha256, id).toMatch(/^[0-9a-f]{64}$/);
      for (const s of ["112", "160"]) {
        const buf = fs.readFileSync(`public${m.files[s].file}`);
        expect(createHash("sha256").update(buf).digest("hex"), `${id} ${s}`).toBe(m.files[s].sha256);
        expect(buf.length, `${id} ${s}`).toBeLessThan(20000);
      }
    }
    expect(Object.keys(ph.selfHosted).length).toBeGreaterThanOrEqual(180);
  });
  it("Kyle Hawkins is downloaded from justicekylehawkins.com and credited to it", () => {
    const k = Object.entries<any>(ph.selfHosted).find(([id]) => /kyle-hawkins/.test(id))![1];
    expect(k.sourceUrl).toMatch(/justicekylehawkins\.com/);
    expect(k.page).toMatch(/justicekylehawkins\.com/);
  });
  it("the square crop is object-cover at the focus (default center 20%), as the script records it", () => {
    const S = fs.readFileSync("scripts/ingest-photos.mjs", "utf8");
    expect(S).toContain("export function squareFor(w, h, [x, y, s] = [0.5, 0.2, 1])");
    expect(S).not.toMatch(/_next\/image|cloudinary/i); // no image service
    expect(fs.readFileSync("components/Portrait.tsx", "utf8")).not.toMatch(/next\/image/);
    expect(Object.values<any>(man.portraits).every((m) => m.crop && m.crop.width === m.crop.height)).toBe(true);
  });
  it("tiles render the self-hosted square with srcset, width/height, lazy and async", () => {
    const html = renderToStaticMarkup(h(TileImage as never, { alt: "Ann Lee", onFail: () => {}, photo: { url: "/portraits/a-160.webp", url112: "/portraits/a-112.webp", credit: "Photo: X" } } as never));
    expect(html).toMatch(/src="\/portraits\/a-160\.webp"/);
    expect(html).toMatch(/srcSet="\/portraits\/a-112\.webp 112w, \/portraits\/a-160\.webp 160w"/);
    expect(html).toMatch(/width="160"/); expect(html).toMatch(/height="160"/);
    expect(html).toMatch(/loading="lazy"/); expect(html).toMatch(/decoding="async"/);
  });
  it("the shipped data names no third-party image host", () => {
    for (const x of Object.values<any>(ph.selfHosted)) expect(x.file).toMatch(/^\/portraits\//);
    for (const x of Object.values<any>(ph.runningMates ?? {})) expect(x.file).toMatch(/^\/portraits\//);
  });
});

describe("Civic qa10: agency photos and the Fisher video stay out", () => {
  it("agency and video sources are excluded", () => {
    expect(isAgencyPhoto({ attribution: "Metropolitan Transportation Authority of the State of New York" })).toBe(true);
    expect(isAgencyPhoto({ photoUrl: "https://upload.wikimedia.org/x/USMC-12345.jpg" })).toBe(true);
    expect(isAgencyPhoto({ attribution: "NASA/Bill Ingalls" })).toBe(true);
    expect(isAgencyPhoto({ attribution: "GovPics" })).toBe(true);
    expect(isAgencyPhoto({ attribution: "LBJ Library photo" })).toBe(true);
    expect(isAgencyPhoto({ photoUrl: "https://example.com/campaign.jpg", attribution: "Campaign site" })).toBe(false);
    expect(isFisherVideo("alida-fisher", { photoUrl: "https://upload.wikimedia.org/x.webm" })).toBe(true);
    expect(EXCLUDE("alida-fisher", { photoUrl: "https://static.wixstatic.com/media/a.jpg", sourceType: "campaign site" })).toBe(false);
  });
  it("no shipped photo comes from an agency, the video, or txcourts.gov", () => {
    const s = JSON.stringify({ ph, man });
    expect(s).not.toMatch(/Metropolitan Transportation|_MTA_|\bUSMC\b|Marine Corps|\bNASA\b|GovPics|LBJ Library|lbjlibrary|SFGovTV|\.webm|txcourts\.gov/i);
    for (const id of ["dawn-buckingham", "alida-fisher"]) expect(ph.selfHosted[id].focus, id).toBeTruthy();
  });
});

describe("p14 #3 credits more/less and #4 grades note", () => {
  it("the more button has a 44x44 hit area, aria-controls and aria-expanded, 12/16 black/60 underlined", () => {
    expect(P).toMatch(/aria-expanded=\{open\} aria-controls=\{id\}/);
    expect(P).toMatch(/data-photo-credits id=\{id\}/);
    const cls = P.match(/className=\{`relative hidden min-h-11 min-w-11[^`]*`\} data-credits-more/)![0];
    for (const c of ["px-2", "underline", "after:absolute", "after:inset-y-0", "after:-inset-x-3", "${CREDIT}"]) expect(cls).toContain(c);
  });
  it("the grades note is exactly the short line", () => {
    expect(GRADES_ABSENT_LINE).toBe("Letters need sourced records for every candidate.");
  });
  it("the no-position text is unchanged", () => {
    const all = ["components", "lib"].flatMap((d) => fs.readdirSync(d).map((f) => `${d}/${f}`)).filter((f) => /\.(tsx?|mjs)$/.test(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
    expect(all).toContain("No public position found yet");
  });
});
