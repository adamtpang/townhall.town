// Design sign-off (Oct 30, 12:39 AM CT): "Who lines up" accordion under 768px; desktop unchanged.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { lineText, NO_POSITION_LINE, OPEN_BY_DEFAULT } from "../components/WhoRaces";
const src = (f: string) => fs.readFileSync(f, "utf8");
describe("Who lines up: mobile accordion", () => {
  it("candidate line reads 'Name · 4 of 7 issues · B'; grade only where given; never 'No record found'", () => {
    expect(lineText({ name: "Ana Ruiz", sourced: 5, agree: 4, n: 7, grade: "B" })).toBe("Ana Ruiz · Issue overlap with your answers: 4 of 7 issues · B");
    expect(lineText({ name: "Ana Ruiz", sourced: 5, agree: 4, n: 7, grade: null })).toBe("Ana Ruiz · Issue overlap with your answers: 4 of 7 issues");
    expect(lineText({ name: "Ana Ruiz", sourced: 5, agree: 1, n: 1, grade: null })).toBe("Ana Ruiz"); // QA 10:50 AM CT: N >= 2 rule, never "1 of 1"
    expect(lineText({ name: "Bo Li", sourced: 0, agree: 0, n: 0, grade: "C" })).toBe(`Bo Li · ${NO_POSITION_LINE}`);
    expect(NO_POSITION_LINE).toBe("No public position found yet");
    expect(lineText({ name: "Bo Li", sourced: 3, agree: 0, n: 0, grade: null })).toBe(`Bo Li · ${NO_POSITION_LINE}`); // QA 10:50 AM CT: one empty-state wording
    expect(OPEN_BY_DEFAULT).toBe(3);
    expect(src("components/WhoRaces.tsx")).not.toMatch(/No record found|No stated position/);
  });
  it("type multiple, closed by default, 56px full-width trigger, 16px chevron, 14/20 weight 450 lines, 1px black/15 divider, radius 0, no open shading", () => {
    const s = src("components/WhoRaces.tsx");
    expect(s).toMatch(/<Accordion type="multiple" value=\{open\}/);
    expect(s).toMatch(/races\.slice\(0, OPEN_BY_DEFAULT\)/); // design p12 #3: first 3 open at 768px and up, the rest closed
    expect(s).toMatch(/AccordionTrigger className="min-h-14 w-full items-start rounded-none/);
    expect(s).toMatch(/data-\[state=open\]:bg-transparent/);
    expect(s).toMatch(/text-sm font-\[450\] leading-5/);
    expect(s).toMatch(/border-b border-black\/15/);
    expect(s).toMatch(/rounded-none border-b/);
    expect(s).not.toMatch(/RaceFold/); // same Accordion at 768px and up
    expect(s).toMatch(/useState<string\[\]>\(\[\]\)/); expect(s).toContain('matchMedia("(min-width: 768px)")'); // phones all closed, desktop first 3 open
    expect(s.indexOf("data-fold-lines")).toBeGreaterThan(s.indexOf("<AccordionTrigger")); // p12 #4: summary lines inside the trigger
    expect(s.indexOf("data-fold-lines")).toBeLessThan(s.indexOf("</AccordionTrigger>"));
    const ui = src("components/ui/accordion.tsx");
    expect(ui).toMatch(/A\.Header/); // renders an h3
    expect(ui).toMatch(/ChevronDown className="h-4 w-4/);
  });
  it("grades come from gradeFor (the eligibility gate) in EndScreen; same colour as the line", () => {
    const e = src("app/EndScreen.tsx");
    expect(e).toMatch(/<WhoRaces /);
    expect(e).toMatch(/gradesForRace\(race, rows0/);
    expect(src("components/WhoRaces.tsx")).not.toMatch(/data-fold-line[^>]*text-(?!black\/80)/);
  });
});
