// Design p13 (Oct 30, 3:52 AM CT): hkt.texasjudges.com portraits self-hosted, plain search labels, wrapping closed
// lines, credits capped at 1 line from 768 with "more", and the grades-absent line in the closed row.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { checkedLabel, cleanChecked } from "../components/CandidateRow";
import WhoRaces, { lineText } from "../components/WhoRaces";
import { GRADES_ABSENT_LINE } from "../lib/grades.mjs";
import SC from "../data/sources-checked.json";

const photos = JSON.parse(fs.readFileSync("data/photos.json", "utf8"));

describe("p13 #1: unreliable photo host self-hosted", () => {
  it("Chari Kelly and Kristen Hawkins are self-hosted webp under /portraits/, credited to the campaign site", () => {
    for (const id of ["chari-kelly", "kristen-hawkins"]) {
      const p = photos.selfHosted[id];
      expect(p?.file, id).toBe(`/portraits/${id}-160.webp`);
      expect(fs.existsSync(`public${p.file}`), id).toBe(true);
      expect(p.page).toBe("https://hkt.texasjudges.com/");
      expect(photos.hotlinked[id], id).toBeUndefined();
    }
  });
  it("nothing is hotlinked from hkt.texasjudges.com any more", () => {
    expect(JSON.stringify(photos.hotlinked)).not.toMatch(/hkt\.texasjudges\.com\/img/);
  });
});

describe("p13 #2: recorded searches read as plain labels", () => {
  const bySlug = (SC as any).bySlug;
  it.each([
    ["velva-l-price", "News search: Statesman, KUT, Austin Monitor"],
    ["dyana-limon-mercado", "Local news search"],
    ["dolores-ortega-carter", "Local news search"],
  ])("%s", (slug, label) => {
    const labels = cleanChecked(bySlug[slug].checked).map(checkedLabel);
    expect(labels).toContain(label);
    expect(labels.join("|")).not.toMatch(/Web search/);
  });
  it("no recorded search anywhere reads 'Web search:'", () => {
    for (const v of Object.values<any>(bySlug)) for (const x of cleanChecked(v.checked ?? [])) expect(checkedLabel(x)).not.toMatch(/^Web search/);
  });
});

describe("p13 #3 and #5: closed Who rows", () => {
  const race = (gradesHidden: string | null) => ({ id: "r", title: "Travis County Clerk", gradesHidden, content: null,
    lines: [{ name: "V. Alonzo Echavarria-Garza", sourced: 0, agree: 0, n: 0, grade: null }, { name: "Jane Doe", sourced: 3, agree: 0, n: 0, grade: null }] });
  it("keeps Adam's wording, and 'No stated position yet' only for the old 'no stated position on the issues you answered' case", () => {
    expect(lineText(race(null).lines[0])).toBe("V. Alonzo Echavarria-Garza · No public position found yet");
    expect(lineText(race(null).lines[1])).toBe("Jane Doe · No stated position yet");
  });
  it("lines wrap between words, never truncate", () => {
    const html = renderToStaticMarkup(h(WhoRaces, { races: [race(null)] }));
    expect(html).toMatch(/data-fold-line/);
    expect(html).not.toMatch(/truncate|text-ellipsis|break-all/);
    expect(html).toMatch(/whitespace-normal \[overflow-wrap:normal\] \[word-break:normal\] hyphens-none" data-fold-line/);
  });
  it("a race without letters shows the grades-absent line, 12/16 black/60, under the lines; a graded race does not", () => {
    const hid = renderToStaticMarkup(h(WhoRaces, { races: [race("eligibility")] }));
    expect(hid).toContain(GRADES_ABSENT_LINE);
    expect(hid).toMatch(/text-xs font-\[450\] leading-4 text-black\/60" data-fold-grades-absent="eligibility"/);
    expect(hid.indexOf("data-fold-grades-absent")).toBeGreaterThan(hid.lastIndexOf("data-fold-line"));
    expect(renderToStaticMarkup(h(WhoRaces, { races: [race(null)] }))).not.toContain(GRADES_ABSENT_LINE);
  });
});

describe("p13 #4: credits row", () => {
  const P = fs.readFileSync("components/Portrait.tsx", "utf8");
  it("no comma separators", () => {
    const rc = P.slice(P.indexOf("export function RaceCredits"), P.indexOf("export function PhotoCredit"));
    expect(rc).not.toMatch(/[",]\s*,\s*["<]|\{", "\}|>,</);
  });
  it("capped at one 44px line from 768 with a 'more' disclosure; overflowed entries invisible while capped", () => {
    expect(P).toMatch(/md:max-h-11 md:overflow-hidden/);
    expect(P).toMatch(/aria-expanded=\{open\} aria-controls=\{id\}[\s\S]{0,200}min-h-11 min-w-11[\s\S]{0,200}after:-inset-x-3[\s\S]{0,60}md:flex/);
    expect(P).toMatch(/\{open \? "less" : "more"\}/);
    expect(P).toMatch(/md:data-\[overflow=true\]:invisible/);
  });
});
