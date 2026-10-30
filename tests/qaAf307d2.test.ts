// QA on af307d2 (parent steering 2:53-2:54 PM CT Oct 30): home trust lines, photo-credit names, band credit, city cards at 320, ZIP form errors.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RaceCredits, PhoneCredits, PhotoCredit, creditLabel } from "../components/Portrait";
import { SiteFooter } from "../components/SiteChrome";
import { SectionBody } from "../components/Prose";
import { HOME_SECTIONS } from "../lib/content";
import CityCards from "../components/media/CityCards";

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
  it("Adam 2:56 PM + Design landing 3:03 PM: 3 cards across (gap-4 phones, col-span-4 at lg), 4:5 on phones, 16:9 at lg, 16px/24px names, min-h-11, no arrow", () => {
    const html = renderToStaticMarkup(h(CityCards));
    // v3.1 merge: motion-v2's gap-2 on phones (Design P1 GO, fe2ac42; card bottoms ~604 at 390).
    expect(html).toContain('<ul class="grid grid-cols-3 gap-2 lg:grid-cols-12 lg:gap-6" data-city-cards="true">');
    expect(html.match(/<li class="th-card relative min-w-0 lg:col-span-4">/g)).toHaveLength(3);
    expect(html.match(/media-frame aspect-\[4\/5\] bg-brand-50 lg:aspect-video/g)).toHaveLength(3);
    expect(html.match(/min-h-11 items-center gap-1 text-base leading-5[^"]*lg:text-2xl/g)).toHaveLength(3);
    expect(html).not.toContain("↗");
    expect(html).not.toMatch(/overflow-x-auto|mask-image/);
  });
  it("home order: hero, ZIP, city cards, band, How it works, Sources", () => {
    const p = src("app/page.tsx");
    const at = (k: string) => { const i = p.indexOf(k); expect(i, k).toBeGreaterThan(-1); return i; };
    const seq = ["data-hero", "<BallotAgent />", "<CityCards />", "<MediaBand />", 'label="How it works"', "HOME_SECTIONS.map"].map(at);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
  });
  it("credits wrap, never clip (Jim Henderson shown in full)", () => {
    const html = renderToStaticMarkup(h(CityCards));
    // v3.1 merge: motion-v2's "Photo credits (3)" fold under the row (Design P1 GO); each credit row wraps.
    const lis = [...html.matchAll(/<li class="([^"]+)"><span class="\[overflow-wrap:anywhere\]"/g)].map((m) => m[1]);
    expect(lis).toHaveLength(3);
    for (const l of lis) { expect(l).toContain("flex-wrap"); expect(l).not.toMatch(/truncate|overflow-hidden|text-ellipsis|whitespace-nowrap/); }
    const credits = [...html.matchAll(/<span class="(\[overflow-wrap:anywhere\])"/g)].map((m) => m[1]);
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

describe("Adam 2:57 PM: photos are colored, never grayed out", () => {
  const BAD = /grayscale|desaturate|saturate-0|saturate\(0|mix-blend|opacity-\d|filter:/;
  it("no CSS rule filters, blends or dims a photo (img, picture, video or their frame)", () => {
    const css = src("app/globals.css");
    expect(css).not.toMatch(/grayscale|desaturate|mix-blend|saturate\(/);
    expect(css).not.toMatch(/\.duo\b/);
    expect(css).not.toMatch(/img[^{]*\{[^}]*(filter|opacity)/);
  });
  it("no img/picture, and no ancestor of one, carries a grayscale, desaturate or mix-blend class or filter", () => {
    const pages = [renderToStaticMarkup(h(CityCards)), renderToStaticMarkup(h(PhotoCredit, { name: "x", photo: pic("https://a.example/", "a") })),
      ...["components/Portrait.tsx", "components/PortraitRow.tsx", "components/media/MediaBand.tsx", "components/media/CityCards.tsx", "app/card/BallotCard.tsx", "app/RaceTiers.tsx", "app/EndScreen.tsx"].map(src)];
    for (const t of pages) { expect(t).not.toMatch(/grayscale|desaturate|saturate-0|mix-blend/); expect(t).not.toMatch(/\bduo\b(?!tone)/); }
    void BAD;
  });
});

describe("Design 2:57 PM: 94103 end-screen links", () => {
  it("'Official site list' and 'Find your assigned polling place' are 44px rows in a flex-col gap-1 stack", () => {
    const e = src("app/EndScreen.tsx");
    expect(e).toContain('className="mt-2 flex flex-col items-start gap-1 text-sm leading-5" data-end-links>');
    expect(e).toMatch(/className="inline-flex min-h-11 items-center th-link" data-end-link="sites">Official site list ↗/);
    expect(e).toMatch(/className="inline-flex min-h-11 items-center th-link" data-end-link="lookup">\{where\.lookupLabel \?\? "Find your assigned polling place"\} ↗/); // Towny v3 label (SF lookup) merged in
    const stack = e.slice(e.indexOf("data-end-links>"), e.indexOf('data-end-link="lookup"'));
    expect(stack).not.toContain("</div>"); // both links live in the same stack
  });
});
