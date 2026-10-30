// QA 10:48 + 10:50 AM CT Oct 30 (phones, wording) on feat/fair-cards-main.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { lineText } from "../components/WhoRaces";
import { UNSUPPORTED_MESSAGE } from "../lib/site";
const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("QA 10:48/10:50 AM CT Oct 30", () => {
  it("main points wrap to full text: no truncate/ellipsis/line-clamp on the point, source follows it", () => {
    const s = src("components/CandidateRow.tsx");
    const li = s.slice(s.indexOf("data-main-point={x.i}") - 200, s.indexOf("data-main-source"));
    expect(li).not.toMatch(/truncate|text-ellipsis|line-clamp/);
    expect(li).toMatch(/<span data-main-text>\{x\.t\}<\/span>\{" "\}/);
  });
  const phoneCss = () => { const css = src("app/globals.css"); const i = css.indexOf("@media (max-width: 767px) {\n  /* P1"); expect(i).toBeGreaterThan(-1); return css.slice(i); };
  // <vercel-live-feedback> is injected by Vercel on preview deployments only; it is never in our markup or on production,
  // so this can only check that our CSS hides it on phones, not that the element exists (a rendered check would find none).
  it("phones (preview deployments only): Vercel's preview toolbar is hidden under 768px", () => {
    expect(phoneCss()).toMatch(/vercel-live-feedback \{ display: none !important; \}/);
  });
  it("phones: links get a 44px hit area", () => {
    expect(phoneCss()).toMatch(/::after \{\s*content: ""; position: absolute;[^}]*height: 44px/);
  });
  it("no 'No stated position' or 'No record found' stance copy anywhere in UI code", () => {
    for (const f of ["components/WhoRaces.tsx", "components/CandidateRow.tsx", "app/RaceTiers.tsx", "app/TownyResearch.tsx"]) {
      expect(src(f)).not.toMatch(/No stated position/);
      expect(src(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")).not.toMatch(/No record found/);
    }
  });
  it("collapsed Who rows use the card's overlap wording and N >= 2", () => {
    expect(lineText({ name: "Sarah Eckhardt", sourced: 3, agree: 1, n: 1, grade: null })).toBe("Sarah Eckhardt");
    expect(lineText({ name: "Sarah Eckhardt", sourced: 3, agree: 1, n: 2, grade: null })).toBe("Sarah Eckhardt · Issue overlap: 1 of 2");
  });
  it("unsupported ZIP notice is exactly Adam's wording, with Spanish", () => {
    expect(UNSUPPORTED_MESSAGE).toBe("Austin, SF and NYC for now.");
    expect(src("lib/i18n.tsx")).toMatch(/"Austin, SF and NYC for now\.": "Por ahora: Austin, SF y NYC\."/);
    expect(src("lib/i18n.tsx")).toMatch(/"Issue overlap with your answers": "/);
  });
});
