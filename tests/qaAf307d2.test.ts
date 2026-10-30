// QA on af307d2 (parent steering 2:53-2:54 PM CT Oct 30): home trust lines, photo-credit names, band credit, city cards at 320, ZIP form errors.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RaceCredits, PhoneCredits, PhotoCredit, creditLabel } from "../components/Portrait";
import { SiteFooter } from "../components/SiteChrome";
import { SectionBody } from "../components/Prose";
import { HOME_SECTIONS } from "../lib/content";
import CityCards, { canScrollRight } from "../components/media/CityCards";

const src = (p: string) => fs.readFileSync(p, "utf8");
const pic = (page: string, attribution: string) => ({ url: "/portraits/x-256.webp", credit: "Photo: " + attribution, attribution, page });
const labelsOf = (html: string) => [...html.matchAll(/<a [^>]*aria-label="([^"]+)"[^>]*data-photo-credit/g)].map((m) => m[1].replace(/&#x27;/g, "'"));

describe("QA af307d2 P1: home trust lines", () => {
  it("footer keeps 'Every fact links its source; confirm with your state.' exactly", () => {
    expect(renderToStaticMarkup(h(SiteFooter))).toContain("Every fact links its source; confirm with your state.");
  });
  it("home keeps exactly one 'When a fact cannot be confirmed, it is marked unsure or not shown.'", () => {
    const html = HOME_SECTIONS.map((s) => renderToStaticMarkup(h(SectionBody, { s }))).join("");
    expect(html.split("When a fact cannot be confirmed, it is marked unsure or not shown.").length - 1).toBe(1);
  });
});

describe("QA af307d2 P2: photo-credit links name the candidate", () => {
  it("creditLabel: campaign/official links read 'Name campaign site'; Commons credits name the candidate too", () => {
    expect(creditLabel("Jane Doe", "Jane Doe's campaign site")).toBe("Jane Doe campaign site");
    expect(creditLabel("Jane Doe", "Gage Skidmore, via Wikimedia Commons")).toBe("Jane Doe photo: Gage Skidmore, via Wikimedia Commons");
  });
  it("RaceCredits, PhoneCredits and PhotoCredit: every credit link's aria-label includes the candidate name", () => {
    const cands = [{ name: "Ann Lee", photo: pic("https://ann.example/", "Ann Lee's campaign site") }, { name: "Bo Day", photo: pic("https://commons.wikimedia.org/wiki/File:B.jpg", "C D, via Wikimedia Commons") }];
    const race = labelsOf(renderToStaticMarkup(h(RaceCredits, { cands, label: (n: string) => n })));
    expect(race).toEqual(["Ann Lee campaign site", "Bo Day photo: C D, via Wikimedia Commons"]);
    const phone = labelsOf(renderToStaticMarkup(h(PhoneCredits, { cands, label: (n: string) => n })));
    expect(phone).toEqual(["Ann Lee campaign site (opens in a new tab)", "Bo Day photo: C D, via Wikimedia Commons (opens in a new tab)"]);
    const one = labelsOf(renderToStaticMarkup(h(PhotoCredit, { name: "Ann Lee", photo: cands[0].photo })));
    expect(one).toEqual(["Ann Lee campaign site"]);
  });
});

describe("QA af307d2 P2: band credit source", () => {
  it("the Berkeley County, S.C. 2016 credit has no invented source link (no source URL exists in the repo's credits yet)", () => {
    const band = src("components/media/MediaBand.tsx");
    expect(band).toContain("Berkeley County, S.C., Oct 2016");
    expect(band).toContain("Voice of America · Public domain");
    const cap = band.slice(band.indexOf("<figcaption"), band.indexOf("</figcaption>"));
    expect(cap).not.toMatch(/href=/); // add one only from a recorded source URL
  });
});

describe("QA af307d2 P1: city cards at 320px", () => {
  it("Design 2:56 PM: 72% snap cards with scroll-pl-5 (peek stays, never width-fit); right fade only while it can scroll right", () => {
    const html = renderToStaticMarkup(h(CityCards));
    const ul = html.match(/<ul [^>]*class="([^"]+)"[^>]*data-city-cards/)![1].split(" ");
    for (const c of ["flex", "snap-x", "snap-mandatory", "scroll-pl-5", "overflow-x-auto", "data-[more=true]:[mask-image:linear-gradient(to_right,black_85%,transparent)]"]) expect(ul).toContain(c);
    expect(html.match(/<li class="([^"]+)"/g)!.every((li) => li.includes("w-[72%]") && li.includes("shrink-0"))).toBe(true);
    expect(canScrollRight({ scrollLeft: 0, clientWidth: 296, scrollWidth: 700 })).toBe(true);
    expect(canScrollRight({ scrollLeft: 404, clientWidth: 296, scrollWidth: 700 })).toBe(false);
    expect(canScrollRight({ scrollLeft: 0, clientWidth: 1000, scrollWidth: 1000 })).toBe(false);
    expect(src("components/media/CityCards.tsx")).not.toMatch(/←|→|aria-label="(Next|Previous)/);
  });
  it("credits wrap, never clip (Jim Henderson shown in full)", () => {
    const html = renderToStaticMarkup(h(CityCards));
    const credits = [...html.matchAll(/<p class="([^"]+)" data-city-credit="true"/g)].map((m) => m[1]);
    expect(credits).toHaveLength(3);
    for (const c of credits) { expect(c).toContain("[overflow-wrap:anywhere]"); expect(c).not.toMatch(/truncate|overflow-hidden|text-ellipsis|whitespace-nowrap/); }
    expect(html).toContain("Jim Henderson");
  });
});

describe("QA af307d2 P1: ZIP form shows only the inline error", () => {
  it("form has noValidate; input keeps pattern and inputMode; invalid ZIPs set 'Enter a valid 5-digit ZIP'", () => {
    const s = src("app/BallotAgent.tsx");
    expect(s).toMatch(/<form\s+onSubmit=[\s\S]{0,120}noValidate/);
    expect(s).toContain('pattern="[0-9]*"');
    expect(s).toContain('inputMode="numeric"');
    expect(s).toContain('setNotice("Enter a valid 5-digit ZIP")');
    expect(s).toContain('aria-describedby="zip-notice"');
    expect(s).toMatch(/id="zip-notice"[^>]*data-zip-notice/);
    const form = s.slice(s.indexOf("<form"), s.indexOf("</form>"));
    expect(form).not.toMatch(/\stitle=/);
  });
});

describe("Design 2:56 PM: footer wordmark fits its margins", () => {
  it("is a fitted SVG at w-full (textLength = viewBox width), no clamp text, no clipping overflow", () => {
    const html = renderToStaticMarkup(h(SiteFooter));
    const wm = html.slice(html.indexOf("data-wordmark"), html.indexOf("</svg>"));
    expect(wm).toMatch(/<svg viewBox="0 0 1000 118" class="block h-auto w-full/);
    expect(wm).toContain('textLength="1000"');
    expect(wm).toContain('lengthAdjust="spacingAndGlyphs"');
    expect(wm).toContain(">townhall.town</text>");
    expect(src("components/SiteChrome.tsx")).not.toMatch(/text-\[clamp\(40px/);
  });
});
