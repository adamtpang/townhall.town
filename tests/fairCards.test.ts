import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { press5, bucketOf, normalizeAnswers, overlapFor, recordFor, BUCKETS } from "../lib/overlapCore.mjs";
const src = (p: string) => readFileSync(p, "utf8");
describe("fair cards (Adam 9:58 AM CT Oct 30)", () => {
  it("5 buckets -2..+2 with plain labels; pressing again clears; low pole flips", () => {
    expect(BUCKETS.map((b) => b.label)).toEqual(["Strong no", "No", "Neutral", "Yes", "Strong yes"]);
    expect(BUCKETS.map((b) => b.text)).toEqual(["\u22122", "\u22121", "0", "+1", "+2"]);
    expect(press5({}, "x", 2).x).toBe(5);
    expect(press5({}, "x", -1).x).toBe(-2.5);
    expect(press5({}, "x", 1, "low").x).toBe(-2.5);
    expect(press5({ x: 5 }, "x", 2).x).toBe(null);
    expect(bucketOf(-2.5, "low")).toBe(1);
    expect(bucketOf(5)).toBe(2);
    expect(bucketOf(0)).toBe(0);
    expect(bucketOf(null)).toBe(null);
  });
  it("old yes/neutral/no answers migrate to +2/0/-2", () => {
    const a = normalizeAnswers({ a: "yes", b: "neutral", c: "no", d: 5, e: -5 }) as Record<string, number | null>;
    expect([a.a, a.b, a.c, a.d, a.e].map((v) => bucketOf(v))).toEqual([2, 0, -2, 2, -2]);
  });
  it("overlap is weighted by answer strength; +-2 only = plain share", () => {
    const st = { a: { value: 3 }, b: { value: -3 } };
    expect(overlapFor({ a: 5, b: 5 }, st, ["a", "b"]).pct).toBe(50);
    expect(overlapFor({ a: 5, b: 2.5 }, st, ["a", "b"]).pct).toBe(67);
    expect(overlapFor({ a: 2.5, b: 5 }, st, ["a", "b"]).pct).toBe(33);
  });
  it("accountability is behind one flag, ON by default, and states its method inline", () => {
    expect(src("lib/flags.ts")).toMatch(/DEFAULT_SHOW_ACCOUNTABILITY = true/);
    const c = src("components/CandidateRow.tsx");
    expect(c).toMatch(/SHOW_ACCOUNTABILITY \?/);
    expect(c).toMatch(/Record: \{rec\.x\} of \{rec\.n\} issue/);
    expect(c).toMatch(/a sourced stance or vote/);
    expect(c).toMatch(/Matches you on \$\{o\.agree\} of \$\{o\.n\} issues/);
    expect(c).toMatch(/o\.n >= 2 \?/);
  });
  it("record counts only sourced, non-null stances", () => {
    const st = { a: { value: 3, sourceUrl: "u" }, b: { value: null, sourceUrl: "u" }, c: { value: 0, sourceUrl: "u" }, d: { value: 2 } };
    expect(recordFor(st, ["a", "b", "c", "d"])).toMatchObject({ x: 2, n: 4, score: 50 });
    expect(recordFor({}, ["a"]).x).toBe(0);
  });
  it("placeholder avatar: one neutral silhouette, labelled, no name-based choice", () => {
    const s = src("components/Avatar.tsx");
    expect(s).toMatch(/No photo found/);
    expect(s).toMatch(/aria-hidden="true"/);
    expect(s).toMatch(/sr-only/);
    expect(s).toMatch(/bg-\[#E5E5E5\]/);
    expect(s).toMatch(/text-black\/30/);
    expect(s).not.toMatch(/female|male|gender\s*=/i);
    expect(src("components/PortraitRow.tsx")).toMatch(/<AvatarPlaceholder \/>/);
    expect(src("components/Portrait.tsx")).toMatch(/<AvatarPlaceholder \/>/);
  });
  it("answer buttons: 5 radios, 44px+, labelled", () => {
    const s = src("app/IssueMatch.tsx");
    expect(s).toMatch(/<ToggleGroup /);
    expect(s).toMatch(/h-14 min-w-11 flex-\[1_1_0\]/);
    expect(s).toMatch(/md:h-12 md:w-24/);
    expect(s).toMatch(/divide-x divide-black\/15 border border-black\/15/);
    expect(s).toMatch(/ariaLabel: t\(c\.label\)/);
    const tg = s.slice(s.indexOf("<ToggleGroup "), s.indexOf("data-bucket-ends"));
    expect(tg).not.toMatch(/red|blue|#3760F2|#C|rose|sky|indigo/i);
    const g = src("components/ui/toggle-group.tsx");
    expect(g).toMatch(/role="radiogroup"/); expect(g).toMatch(/role="radio"/);
    expect(g).toMatch(/ArrowRight/); expect(g).toMatch(/tabIndex=\{i === focusIdx \? 0 : -1\}/);
  });
});
