// Round 2:22 AM CT (Oct 30): charter rule, grade explainer line, per-race credits with clean tap targets, TX court photos.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { stancesFor } from "../lib/issues";
import { gradesForRace, GRADES_ABSENT_LINE } from "../lib/grades.mjs";
import RaceFooter from "../components/RaceFooter";
import photos from "../data/photos.json";
const src = (f: string) => fs.readFileSync(f, "utf8");

describe("charter rule (Civic 2:23 AM): Texas charters are public schools, so charter positions are never scored on education", () => {
  it("Allison Bush education is unsure, keeps her quote and source, and is not scored", () => {
    const s = stancesFor("Allison Bush").education;
    expect(s.value).toBeNull();
    expect(s.status).toBe("unsure");
    expect(s.summary).toBe("Opposes unlimited charter-school expansion; charter schools are public schools, so this isn't scored on the private-school-funding question.");
    expect(s.quote).toBe("I oppose the unlimited expansion of charter schools that diverts resources from our neighborhood public schools.");
    expect(s.sourceUrl).toBe("https://www.allisonfortx.com/");
  });
  it("Kirk Becker matches: unsure, not scored, and the voter-facing summary carries no internal note", () => {
    const s = stancesFor("Kirk Becker").education;
    expect(s.value).toBeNull();
    expect(s.status).toBe("unsure");
    expect(s.summary).toMatch(/charter/i);
    expect(s.summary).not.toMatch(/NOTE|asymmetr|flagged|Batch\d/i);
  });
});

describe("grade explainer line (Adam's wording, verbatim)", () => {
  const race = { id: "x", candidates: [{ name: "A" }, { name: "B" }] };
  const o = (n: number) => ({ status: "ok", agree: 1, n, sourced: 4 });
  it("the eligibility gate and guard (c) report why letters are gone; measures and unopposed races don't", () => {
    expect(gradesForRace(race, [o(3), o(3)], 3, null, new Set()).hidden).toBe("eligibility");
    expect(gradesForRace(race, [o(3), o(1)], 3, null, new Set(["x"])).hidden).toBe("overlap");
    expect(gradesForRace(race, [o(3), o(3)], 3, null, new Set(["x"])).hidden).toBeNull();
    expect(gradesForRace({ id: "m", measure: true, candidates: [{ name: "Yes" }, { name: "No" }] }, [o(3), o(3)], 3, null, new Set()).hidden).toBeNull();
    expect(gradesForRace({ id: "u", candidates: [{ name: "A" }] }, [o(3)], 3, null, new Set()).hidden).toBeNull();
    expect(gradesForRace({ ...race, judicial: "tx" }, [o(3), o(3)], 3, null, new Set()).hidden).toBeNull();
  });
  it("renders exactly the agreed sentence, and never the old phrasing", () => {
    expect(GRADES_ABSENT_LINE).toBe("Letters need sourced records for every candidate.");
    const html = renderToStaticMarkup(h(RaceFooter, { cands: [{ name: "A" }, { name: "B" }], gradesHidden: "eligibility" }));
    expect(html).toContain(GRADES_ABSENT_LINE);
    expect(renderToStaticMarkup(h(RaceFooter, { cands: [{ name: "A" }], gradesHidden: null }))).not.toContain(GRADES_ABSENT_LINE);
    for (const f of ["components/RaceFooter.tsx", "components/WhoRaces.tsx", "app/EndScreen.tsx", "app/card/BallotCard.tsx", "lib/grades.mjs"]) expect(src(f)).not.toMatch(/not enough sourced positions/i);
  });
});

describe("design p12 #1: per-race credit line, no overlapping tap targets", () => {
  it("credit links are their own 44px boxes with no pseudo-element hit area", () => {
    const p = src("components/Portrait.tsx");
    const tap = p.match(/const TAP = "([^"]+)"/)![1];
    expect(tap).toMatch(/\bflex min-h-11 items-center/);
    expect(tap.split(" ").filter((c) => c.includes("after:")).every((c) => c.startsWith("md:"))).toBe(true); // none under 768 (superseded: round 0334)
    expect(src("components/CandidateRow.tsx")).not.toMatch(/<PhotoCredit /);
  });
});

describe("TX court photos (Civic 1:20 AM)", () => {
  const all = { ...(photos as any).selfHosted, ...(photos as any).hotlinked };
  it("no txcourts.gov image or page ships; the txcourtsPortrait field is never read by the app", () => {
    expect(JSON.stringify(photos)).not.toMatch(/txcourts\.gov/i);
    for (const f of ["lib/photos.ts", "components/Portrait.tsx", "components/PortraitRow.tsx", "components/CandidateRow.tsx"]) expect(src(f)).not.toMatch(/txcourtsPortrait/);
  });
  it("Sullivan, Yeary and Baker are self-hosted; Field is zoomed onto him (right, in the robe)", () => {
    for (const id of ["james-p-sullivan", "kevin-patrick-yeary", "tom-baker", "marc-m-meyer"]) expect((photos as any).selfHosted[id], id).toBeTruthy();
    expect(all["scott-k-field"].focus).toEqual([0.66, 0.081, 3.4]);
    for (const id of ["jimmy-blacklock", "kyle-hawkins", "brett-busby", "april-farris", "darlene-byrne"]) expect(all[id], id).toBeTruthy();
  });
});

import { earlySingleDay, whenFor } from "../lib/endscreen.mjs";
describe("early voting, one day left (QA df0cb76 #5)", () => {
  it("reads 'ends today' only on that day in CT, else the plain date; multi-day windows unchanged", () => {
    expect(earlySingleDay({ start: "2026-10-30", end: "2026-10-30" }, "2026-10-30")).toBe("Early voting ends today, Friday, October 30");
    expect(earlySingleDay({ start: "2026-10-30", end: "2026-10-30" }, "2026-10-29")).toBe("Early voting, Friday, October 30");
    expect(earlySingleDay({ start: "2026-10-19", end: "2026-10-30" }, "2026-10-19")).toBeNull();
    const ev = whenFor("78701", "2026-10-30").events.find((e: { kind: string }) => e.kind === "early");
    expect(earlySingleDay(ev as { start: string; end: string }, "2026-10-30")).toBe("Early voting ends today, Friday, October 30");
  });
});

import { checkedLabel } from "../components/CandidateRow";
describe("design p12 #4: recorded web searches read as their query", () => {
  it("'Web search … (query URL)' becomes a plain label (Design p13 #2)", () => {
    expect(checkedLabel({ url: "https://www.google.com/search?q=Velva+Price+district+clerk+2026", title: "Web search: Statesman/KUT/Austin Monitor (query URL)" } as never)).toBe("News search: Statesman, KUT, Austin Monitor");
    expect(checkedLabel({ url: "https://www.google.com/search?q=x", title: "Mission Local" } as never)).toBe("Mission Local");
  });
});

import STANCES from "../data/stances.json";
import QY from "../data/quote_years.json";
import NYN from "../data/ny-applies-notes.json";
import { ballotFor } from "../lib/tools";
import Q7 from "../data/civic/qa_fixes7.json";
const ALL = JSON.stringify(STANCES);
describe("Civic qa_fixes7", () => {
  it("#1 editorNote is internal: never in stances.json (shipped to the client) and never read by the app", () => {
    expect(ALL).not.toMatch(/editorNote/);
    for (const f of ["components/CandidateRow.tsx", "components/WhoRaces.tsx", "app/EndScreen.tsx", "app/card/BallotCard.tsx", "lib/issues.ts", "lib/tools.ts", "scripts/merge_gapfill.py"]) expect(src(f)).not.toMatch(/editorNote/);
    expect(src("scripts/merge_gapfill.py")).not.toMatch(/\*\*it|dict\(it\)|it\.copy\(\)/); // copies named fields only
  });
  it("#1 the 36 rendered notes read in plain voter wording", () => {
    const rows = (Q7 as any).items[0].rows.filter((r: any) => r.stancesPath);
    expect(rows.length).toBe(36);
    for (const r of rows) expect((STANCES as any).stances[r.id][r.issue].summary, `${r.id}.${r.issue}`).toBe(r.new);
    const unsure = Object.values((STANCES as any).stances).flatMap((c: any) => Object.values(c)).filter((e: any) => e && e.status === "unsure");
    for (const e of unsure as any[]) expect(e.summary || "").not.toMatch(/NOTE:|Not scored|batch\d|retag|standing rule|flagged/i);
  });
  it("#1 Dana Walker wages uses her campaign-site words", () => {
    const w = (STANCES as any).stances["dana-walker"].wages;
    expect(w.sourceUrl).toMatch(/danawalkerforacc\.com/);
    expect(w.quote).toMatch(/local jobs that pay living wages/);
  });
  it("#2 Weber's SB 1 vote counts once (taxes), not again as infrastructure", () => {
    expect((STANCES as any).stances["shirley-n-weber"].infrastructure).toEqual({ value: null, status: "No public statement found" });
    expect((QY as any).years["shirley-n-weber.infrastructure"]).toBeUndefined();
  });
  it("#3 NY notes stay short (<=200, Civic qa13 restores \"printed 9/11/2026\") and keep TENTATIVE", () => {
    for (const [id, n] of Object.entries((NYN as any).byRace)) { expect((n as string).length, id).toBeLessThanOrEqual(200); expect(n as string).toMatch(/TENTATIVE/); }
    const b = ballotFor("10001")!;
    for (const r of b.races.filter((r: any) => r.appliesNote)) { expect((r as any).appliesNote.length, r.id).toBeLessThanOrEqual(200); }
  });
  it("#4 Commons credits without a named photographer say so", () => {
    for (const id of ["james-talarico", "trevor-hale", "jon-rosenthal"]) /* qa13: Goodwin now has her campaign headshot */ expect(((photos as any).hotlinked[id] ?? (photos as any).selfHosted[id])?.credit, id).toMatch(/^Wikimedia Commons user /);
  });
});
