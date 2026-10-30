// Design p11 #1/#2/#4/#5 and QA fb66b9b P1/P2 (Oct 30, 2026).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { cleanChecked, sourcesChecked } from "../components/CandidateRow";
import { stancesFor } from "../lib/issues";
import { liveUrl } from "../lib/links";
import { carryText } from "../app/TownyInterview";
import { correctedIssue } from "../lib/oneIssue";
import P from "../data/photos.json";
const src = (f: string) => fs.readFileSync(f, "utf8");
describe("p11 + QA fb66b9b", () => {
  it("#1 item and tile are separate: item max 56/64px, tile max 40px centred, label centred and truncated", () => {
    const s = src("components/PortraitRow.tsx");
    expect(s).toContain('"max-w-[56px] lg:max-w-[64px]"');
    expect(s).toContain('"max-w-[40px] md:max-w-[48px] lg:max-w-[56px]"');
    expect(s).toMatch(/relative mx-auto aspect-square w-full/);
    expect(s).not.toMatch(/md:text-left/);
  });
  it("#2 credit links get a larger hit area", () => {
    expect(src("components/Portrait.tsx")).toContain("after:absolute after:-inset-x-3 after:-inset-y-4 after:content-['']");
  });
  it("#4 Hinojosa and Hilton have head-and-shoulders focus crops", () => {
    const h = (P as unknown as { selfHosted: Record<string, { focus?: number[] }> }).selfHosted;
    expect(h["gina-hinojosa"].focus).toEqual([0.5, 0.18, 1.5]);
    expect(h["steve-hilton"].focus).toEqual([0.52, 0.15, 1.2]);
  });
  it("#5 checked sources: one League of Women Voters guide, Mission Local and SF Standard split, SF Assessor-Recorder", () => {
    const lab = (xs: { title?: string | null; url: string }[]) => xs.map((x) => x.title ?? x.url);
    const lwv = cleanChecked([{ url: "https://lwvsf.org/x", title: "League of Women Voters guide" }, { url: "https://www.vote411.org/", title: "VOTE411" }]);
    expect(lwv).toHaveLength(1);
    const ml = lab(cleanChecked(sourcesChecked("Manuel Noris-Barrera")));
    expect(ml).toContain("Mission Local"); expect(ml).toContain("SF Standard");
    expect(ml.join("|")).not.toMatch(/Mission Local\/SF Standard/);
    expect(lab(cleanChecked(sourcesChecked("Joaquin Torres")))).toContain("SF Assessor-Recorder");
    expect(src("components/RaceFold.tsx")).toMatch(/<h3[^]*ChevronDown[^]*h-4 w-4/);
    expect(src("components/RaceFold.tsx")).not.toContain(`"Hide" : "Details"`);
  });
  it("QA P2 dead links hidden", () => {
    expect(liveUrl("https://ballotpedia.org/Joaquin_Torres")).toBeNull();
    expect(liveUrl("https://www.votedyana.com/")).toBeNull();
    expect(sourcesChecked("Joaquin Torres").map((x) => x.url)).not.toContain("https://ballotpedia.org/Joaquin_Torres");
    expect(sourcesChecked("Dyana Limon-Mercado").map((x) => x.url)).not.toContain("https://www.votedyana.com/");
  });
  it("QA P2 Andy Brown's tax line reads as a recorded vote, not a quote", () => {
    const t = stancesFor("Andy Brown").taxes;
    expect(t.quote).toBeUndefined();
    expect(t.voteRecord).toBe("Voted for the proposed tax rate increase");
    expect(t.value).toBe(2);
  });
  it("QA P2 Hilton's yahoo homelessness quote is held out (not housing)", () => {
    expect(correctedIssue("Steve Hilton", "housing", "Into housing, back into their life. Now, some of the people on our streets actually should be reunited with their families in other states")).toBeNull();
  });
  it("QA P2 carry-over notice agrees with the counter", () => {
    expect(carryText(2, "94103", "10001", 3)).toMatch(/^2 of your 3 answers/);
    expect(carryText(2, "94103", "10001", 2)).toMatch(/^Your 2 saved answers came from another ZIP \(10001\)/);
  });
});
