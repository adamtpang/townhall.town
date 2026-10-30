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
    expect(s).toContain('"max-w-[80px] lg:max-w-[96px]"'); // widened in round 0222 (QA #6, 384px)
    expect(s).toContain('"max-w-[40px] md:max-w-[48px] lg:max-w-[56px]"');
    expect(s).toMatch(/relative mx-auto aspect-square w-full/);
    expect(s).not.toMatch(/md:text-left/);
  });
  it("#2 credit links: 44px through spacing (Design 3:34 AM CT supersedes the pseudo hit area); horizontal-only tap area from 768", () => {
    expect(src("components/Portrait.tsx")).toContain("md:after:absolute md:after:inset-y-0 md:after:-inset-x-2 md:after:content-['']");
    expect(src("components/Portrait.tsx")).not.toMatch(/after:-inset-y/);
  });
  it("#4 Hinojosa and Hilton are head and shoulders (superseded by Civic qa_fixes7: their own campaign headshots, self-hosted, no zoom)", () => {
    const h = (P as unknown as { selfHosted: Record<string, { focus?: number[]; file?: string }> }).selfHosted;
    expect(h["gina-hinojosa"].focus).toBeUndefined(); expect(h["gina-hinojosa"].file).toBe("/portraits/gina-hinojosa-160.webp");
    expect(h["steve-hilton"].focus).toBeUndefined(); expect(h["steve-hilton"].file).toBe("/portraits/steve-hilton-160.webp");
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
  it("Civic qa_fixes6 #1: votedyana.com is down (plain text + note); Torres Ballotpedia uses the confirmed accented slug, plus joaquintorressf.com", () => {
    expect(liveUrl("https://www.votedyana.com/")).toBeNull();
    const dy = cleanChecked(sourcesChecked("Dyana Limon-Mercado"));
    expect(dy.find((x) => x.url === "https://www.votedyana.com/")?.down).toBe("site down as of Oct 30, 2026");
    expect(dy.map((x) => x.url)).toContain("https://countyclerk.traviscountytx.gov/");
    const jt = sourcesChecked("Joaquin Torres").map((x) => x.url);
    expect(jt).toContain("https://ballotpedia.org/Joaqu%C3%ADn_Torres");
    expect(jt).toContain("https://joaquintorressf.com/");
    expect(jt).not.toContain("https://ballotpedia.org/Joaquin_Torres");
    expect(liveUrl("https://ballotpedia.org/Joaqu%C3%ADn_Torres")).toBe("https://ballotpedia.org/Joaqu%C3%ADn_Torres");
  });
  it("Civic qa_fixes6 #3: Brown and Morales taxes, Weber (5) and Allen healthcare are recorded votes, not quotes", () => {
    const vr = "Voted for the proposed 2026 county tax rate of $0.386210 per $100, above the no-new-revenue rate of $0.378179 (Travis County Commissioners Court; Notice of Public Hearing on Tax Increase, Sept 4, 2026)";
    for (const n of ["Andy Brown", "George Morales III"]) {
      const t = stancesFor(n).taxes;
      expect(t.quote ?? "").toBe(""); expect(t.voteRecord).toBe(vr); expect(t.value).toBe(2);
    }
    const w = stancesFor("Shirley N. Weber");
    // Batch 7 (Civic, Oct 30): vote records now carry bill + chamber detail; still votes, still no quote.
    expect([w.housing, w.wages, w.taxes, w.immigration].map((x) => x.voteRecord)).toEqual(["Voted Yes on AB 1482 (Chiu), Assembly floor, Concurrence in Senate Amendments, Sep 11, 2019 (passed, 47 For)", "Voted Yes on SB 3 (Leno), Assembly floor, Senate Third Reading, Mar 31, 2016 (passed, 48 For)", "Voted Yes on SB 1 (Beall), Assembly floor, Third Reading Urgency, Apr 6, 2017 (passed, 54 For)", "Voted Yes on SB 54 (De León), Assembly floor, Senate Third Reading, Sep 15, 2017 (passed, 51 For)"]);
    for (const x of [w.housing, w.wages, w.taxes, w.immigration]) expect(x.quote ?? "").toBe("");
    // infrastructure cited the same SB 1 roll call as taxes; Civic qa_fixes7 #2 removed it from the data (one vote, one issue).
    expect(w.infrastructure.status).toBe("No public statement found");
    expect(stancesFor("Ben Allen").healthcare.voteRecord).toMatch(/^Voted Yes on SB 562 \(Lara\)/);
    expect(src("lib/issues.ts")).not.toMatch(/County Judge \[/);
  });
  it("Civic qa_fixes6 #5/#6: office-named credits name the candidate; Meyer self-hosted from Civic's local file, banner cut off", () => {
    const ph = P as unknown as { selfHosted: Record<string, { credit: string; file: string; height: number }>; hotlinked: Record<string, { credit: string }> };
    const all = { ...ph.selfHosted, ...ph.hotlinked };
    for (const v of Object.values(all)) expect(v.credit).not.toMatch(/^(Travis County|Supreme Court|First District|Fifteenth|Madison County)[^]* official page$/);
    expect(all["andy-brown"].credit).toBe("Andy Brown's official page"); // Civic qa13 wording
    expect(ph.selfHosted["marc-m-meyer"].file).toBe("/portraits/marc-m-meyer-160.webp");
    expect(fs.existsSync("public/portraits/marc-m-meyer-160.webp")).toBe(true);
    expect(src("scripts/ingest-photos.mjs")).toContain('"marc-m-meyer": [0.1, 0, 0.8, 0.75]');
    for (const id of ["manuel-noris-barrera", "mike-trouble-lin"]) expect(ph.selfHosted[id]?.file).toMatch(/^\/portraits\//);
  });
  it("QA P2 Hilton's yahoo homelessness quote is held out (not housing)", () => {
    expect(correctedIssue("Steve Hilton", "housing", "Into housing, back into their life. Now, some of the people on our streets actually should be reunited with their families in other states")).toBeNull();
  });
  it("QA P2 carry-over notice agrees with the counter", () => {
    expect(carryText(2, "94103", "10001", 3)).toMatch(/^2 of your 3 answers/);
    expect(carryText(2, "94103", "10001", 2)).toMatch(/^Your 2 saved answers came from another ZIP \(10001\)/);
  });
});
