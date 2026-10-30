// Design 1:54 PM Oct 30 (crowded photo rows): over 8 candidates, phones use gap-1 (4px) and tiles flex down to fit on
// one row (no sideways scroll, no wrap). Names stay sr-only, each tile's control carries the name in aria-label and a
// tap opens the candidate in "Who lines up". Rows of 8 or fewer keep gap-2 and have no tile control.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { PortraitRow, OPEN_CANDIDATE } from "../components/PortraitRow";

const cands = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Person Number${i + 1}` }));
const row = (n: number) => renderToStaticMarkup(createElement(PortraitRow, { cands: cands(n), raceId: "race-x" } as never));
const ul = (h: string) => h.match(/<ul role="list"[^>]*>/)![0];

describe("crowded photo rows (Design 1:54 PM Oct 30)", () => {
  it("over 8: gap-1 under md, same md/lg gaps, one equal column per candidate, no scroll container", () => {
    for (const n of [9, 10, 11]) {
      const u = ul(row(n));
      expect(u).toContain("grid justify-start gap-1 [--tile-max:72px] md:gap-3");
      expect(u).toContain(`grid-template-columns:repeat(${n}, minmax(0, var(--tile-max)))`);
      expect(u).toContain('data-crowded="true"');
      expect(u).not.toMatch(/overflow-x|overflow-auto|overflow-scroll|snap-|flex-wrap(?!-)/);
    }
  });
  it("over 8: every tile has a button whose aria-label is the full name; labels stay sr-only", () => {
    const h = row(11);
    expect(h.match(/data-tile-open/g)?.length).toBe(11);
    for (const c of cands(11)) expect(h).toContain(`aria-label="${c.name}"`);
    expect(h).toContain("group-data-[dense=true]/row:max-md:sr-only");
  });
  it("a race Who doesn't list (court races): the tap shows the full name under the row in a polite live region", () => {
    const h = row(11);
    expect(h).toContain('aria-live="polite" data-tile-picked');
    expect(readFileSync("components/PortraitRow.tsx", "utf8")).toContain("cancelable: true");
    expect(row(8)).not.toContain("data-tile-picked");
  });
  it("below 360px: every row over 6 uses gap-1 (8 at 320 is ~30.5px tiles); 360px and up keep gap-2; still one equal row", () => {
    for (const n of [7, 8]) {
      const u = ul(row(n));
      expect(u).toContain("grid justify-start gap-2 max-[359px]:gap-1 [--tile-max:72px] md:gap-3");
      expect(u).toContain(`grid-template-columns:repeat(${n}, minmax(0, var(--tile-max)))`);
      expect(u).not.toMatch(/overflow-x|overflow-auto|overflow-scroll|snap-|flex-wrap(?!-)/);
    }
    for (const n of [2, 6]) expect(ul(row(n))).not.toContain("max-[359px]");
    // 320 viewport, 272px content: 8 x 30.5 + 7 x 4 = 272.
    expect(8 * 30.5 + 7 * 4).toBe(272);
  });
  it("8 or fewer: keep gap-2 (from 360px) and no tile control", () => {
    for (const n of [2, 6, 8]) {
      const h = row(n);
      expect(ul(h)).toMatch(/grid justify-start gap-2 (max-\[359px\]:gap-1 )?\[--tile-max:72px\]/);
      expect(ul(h)).toContain('data-crowded="false"');
      expect(h).not.toContain("data-tile-open");
    }
  });
  it("RaceTiers passes the race id and WhoRaces opens the race on the tile event", () => {
    expect(readFileSync("app/RaceTiers.tsx", "utf8")).toContain("<PortraitRow cands={r.candidates} eager={eager} raceId={r.id} splitCredits />");
    const w = readFileSync("components/WhoRaces.tsx", "utf8");
    expect(w).toContain("window.addEventListener(OPEN_CANDIDATE, on)");
    expect(w).toContain("e.preventDefault()");
    expect(OPEN_CANDIDATE).toBe("townhall:open-candidate");
  });
});
