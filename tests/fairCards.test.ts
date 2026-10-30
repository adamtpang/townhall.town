import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { press5, bucketOf, normalizeAnswers, overlapFor, recordFor, BUCKETS } from "../lib/overlapCore.mjs";
const src = (p: string) => readFileSync(p, "utf8");
describe("fair cards (Adam 9:58 AM CT Oct 30)", () => {
  it("5 buckets -2..+2 with plain labels; pressing again clears; low pole flips", () => {
    expect(BUCKETS.map((b) => b.label)).toEqual(["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]);
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
  it("record counts only sourced, non-null stances", () => {
    const st = { a: { value: 3, sourceUrl: "u" }, b: { value: null, sourceUrl: "u" }, c: { value: 0, sourceUrl: "u" }, d: { value: 2 } };
    expect(recordFor(st, ["a", "b", "c", "d"])).toMatchObject({ x: 2, n: 4, score: 50 });
    expect(recordFor({}, ["a"]).x).toBe(0);
  });
  it("placeholder avatar: one neutral silhouette, labelled, no name-based choice", () => {
    const s = src("components/Avatar.tsx");
    expect(s).toMatch(/No photo available/);
    expect(s).not.toMatch(/female|male|gender\s*=/i);
    expect(src("components/PortraitRow.tsx")).toMatch(/<AvatarPlaceholder \/>/);
    expect(src("components/Portrait.tsx")).toMatch(/<AvatarPlaceholder \/>/);
  });
  it("answer buttons: 5 radios, 44px+, labelled", () => {
    const s = src("app/IssueMatch.tsx");
    expect(s).toMatch(/grid grid-cols-5/);
    expect(s).toMatch(/h-14 min-w-11/);
    expect(s).toMatch(/aria-label=\{t\(c\.label\)\}/);
  });
});
