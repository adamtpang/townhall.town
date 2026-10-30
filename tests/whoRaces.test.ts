// Design sign-off (Oct 30, 12:39 AM CT): "Who lines up" accordion under 768px; desktop unchanged.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { lineText, NO_POSITION_LINE } from "../components/WhoRaces";
const src = (f: string) => fs.readFileSync(f, "utf8");
describe("Who lines up: mobile accordion", () => {
  it("candidate line reads 'Name · 4 of 7 issues · B'; grade only where given; never 'No record found'", () => {
    expect(lineText({ name: "Ana Ruiz", sourced: 5, agree: 4, n: 7, grade: "B" })).toBe("Ana Ruiz · 4 of 7 issues · B");
    expect(lineText({ name: "Ana Ruiz", sourced: 5, agree: 4, n: 7, grade: null })).toBe("Ana Ruiz · 4 of 7 issues");
    expect(lineText({ name: "Ana Ruiz", sourced: 5, agree: 1, n: 1, grade: null })).toBe("Ana Ruiz · 1 of 1 issue");
    expect(lineText({ name: "Bo Li", sourced: 0, agree: 0, n: 0, grade: "C" })).toBe(`Bo Li · ${NO_POSITION_LINE}`);
    expect(NO_POSITION_LINE).toBe("No public position found yet");
    expect(src("components/WhoRaces.tsx")).not.toMatch(/No record found/);
  });
  it("type multiple, closed by default, 56px full-width trigger, 16px chevron, 14/20 weight 450 lines, 1px black/15 divider, radius 0, no open shading", () => {
    const s = src("components/WhoRaces.tsx");
    expect(s).toMatch(/<Accordion type="multiple" value=\{open\}/);
    expect(s).toMatch(/useState<string\[\]>\(\[\]\)/);
    expect(s).toMatch(/AccordionTrigger className="min-h-14 w-full rounded-none/);
    expect(s).toMatch(/data-\[state=open\]:bg-transparent/);
    expect(s).toMatch(/text-sm font-\[450\] leading-5/);
    expect(s).toMatch(/border-b border-black\/15/);
    expect(s).toMatch(/rounded-none border-b/);
    expect(s).toMatch(/\(min-width: 768px\)/);
    expect(s).toMatch(/<RaceFold /);
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
