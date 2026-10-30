// Round 0334 (Design, Oct 30 3:34 AM CT): 44px credit targets through spacing, and tile names that never split mid-word.
// The rendered checks (0 wrong-link taps, every credit >= 44px, 0 mid-word breaks, level rows at 390/427/1440, open and
// closed, all 3 ZIPs) run in shottool/tap.mjs and shottool/labels.mjs; this file pins the class contract.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RaceCredits } from "../components/Portrait";
import { CandidatePortraitRow } from "../components/PortraitRow";

const src = (f: string) => readFileSync(f, "utf8");
const P = src("components/Portrait.tsx");
const tap = P.match(/const TAP = "([^"]+)"/)![1].split(" ");
const pic = (page: string, attribution: string) => ({ url: "/x.webp", credit: attribution, attribution, page });

describe("credit links: 44px tall through spacing, never a vertical tap area", () => {
  it("each link is a 44px flex box; under 768 there is no after: inset at all", () => {
    expect(tap).toEqual(expect.arrayContaining(["flex", "min-h-11", "items-center"]));
    expect(tap.filter((c) => c.includes("after:") && !c.startsWith("md:"))).toEqual([]);
  });
  it("from 768: horizontal-only tap area (-inset-x-2) and no vertical inset", () => {
    expect(tap).toEqual(expect.arrayContaining(["md:after:absolute", "md:after:-inset-x-2", "md:after:inset-y-0"]));
    expect(P).not.toMatch(/after:-inset-y|after:-inset-\d|after:-top|after:-bottom/);
  });
  it("stacks one per line under 768 (no gap, lines touch); inline with gap-x-6 in a 44px row from 768", () => {
    const html = renderToStaticMarkup(h(RaceCredits, { cands: [{ name: "Ann Lee", photo: pic("https://commons.wikimedia.org/wiki/File:A.jpg", "A B") }, { name: "Bo Day", photo: pic("https://commons.wikimedia.org/wiki/File:B.jpg", "C D") }], label: (n: string) => n.split(" ")[1] }));
    const row = html.match(/<p class="([^"]+)"[^>]*data-photo-credits/)![1].split(" ");
    expect(row).toEqual(expect.arrayContaining(["flex", "flex-col", "md:flex-row", "md:min-h-11", "md:items-center", "md:gap-x-6"]));
    expect(row.filter((c) => /^gap|^space-y|^gap-y|^md:gap-y/.test(c))).toEqual([]);
    expect(html.match(/data-photo-credit(?!s)/g)?.length).toBe(2);
    // 24px between credits beats the two 8px tap areas; inside a ticket the links sit 8px + dot + 8px apart.
    expect(P).toMatch(/flex flex-wrap items-center gap-x-1 md:gap-x-2 md:data-\[overflow=true\]:invisible" data-race-credit/);
  });
});

describe("tile names break only between words", () => {
  const S = src("components/PortraitRow.tsx");
  it("overflow-wrap normal, hyphens none, no break-all or break-words, every word nowrap", () => {
    expect(S).toContain('const NOBREAK = "[overflow-wrap:normal] [word-break:normal] hyphens-none"');
    expect(S).not.toMatch(/break-all|break-words|overflow-wrap:anywhere|hyphens-auto/);
    expect(S).toMatch(/\$\{NOBREAK\} line-clamp-2 text-sm font-\[530\] leading-5`\} title=\{c\.name\}/);
  });
  it("a hyphenated surname is one unbreakable word that truncates with the full name in title", () => {
    const html = renderToStaticMarkup(h(CandidatePortraitRow, { cands: [{ name: "V. Alonzo Echavarria-Garza" }, { name: "Lisa Gonzales-Dholakia" }, { name: "Jo Day" }] }));
    expect(html).toMatch(/title="V\. Alonzo Echavarria-Garza"[^>]*data-tile-label[^>]*><span><span class="[^"]*whitespace-nowrap[^"]*text-ellipsis|title="V\. Alonzo Echavarria-Garza"[^>]*data-tile-label[^>]*><span><span class="[^"]*text-ellipsis[^"]*whitespace-nowrap/);
    expect(html).toContain(">Echavarria-Garza</span>");
    expect(html).toContain(">Gonzales-Dholakia</span>");
  });
  it("tiles in a row stay level: items stretch, label block grows to the row's tallest label", () => {
    expect(S).toContain("<li className={`flex min-w-0 flex-col ${max}`}");
    expect(S).toMatch(/<p className=\{`mt-1 w-full flex-1 /);
  });
});
