import STJ from "../data/stances.json";
import GE from "../data/civic/grades_eligibility.json";
import { fetchPolymarket, isActiveMarket } from "../lib/marketsCore.mjs";
import SC from "../data/sources-checked.json";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { gatePhotos, withLicensedPhoto, TAKEDOWNS } from "../lib/photos";
import { stancesFor } from "../lib/issues";
import { duplicateSentenceIds, isExcluded, correctedIssue } from "../lib/oneIssue";
import NYN from "../data/ny-applies-notes.json";
import { isListedPlaceholder, ballotFor, getMarketOdds } from "../lib/tools";
import { liveUrl } from "../lib/links";
import { sourcesChecked } from "../components/CandidateRow";

const src = (f: string) => readFileSync(f, "utf8");
const p = { url: "https://upload.wikimedia.org/x.jpg", credit: "x" };

describe("design p10 + QA 7391b20 + Oct 30 steering", () => {
  it("PHOTO_GATE: race mode is all-or-none, candidate mode keeps each licensed photo", () => {
    const c = [{ name: "A", photo: p }, { name: "B", photo: null }];
    expect(gatePhotos(c, "race").every((x) => !x.photo)).toBe(true);
    expect(gatePhotos(c, "candidate").map((x) => !!x.photo)).toEqual([true, false]);
    expect(src("lib/photoGate.ts")).toMatch(/const DEFAULT: PhotoGate = "race";/); // default race (12:20 AM correction)
  });
  it("initials aria-label is the bare name; failure fallback is per-race or per-candidate", () => {
    expect(src("components/PortraitRow.tsx")).toMatch(/aria-label=\{c\.name\}/);
    expect(src("components/Portrait.tsx")).toMatch(/PHOTO_GATE === "race"/);
  });
  it("credits: 'Photo: author · license', never a raw URL or Unknown author", () => {
    let n = 0;
    for (const z of ["78701", "94103", "10001"]) for (const r of ballotFor(z)!.races) for (const c of r.candidates) {
      const ph = (withLicensedPhoto({ ...c } as never) as { photo?: { author?: string; attribution?: string; license?: string; credit: string; page?: string } }).photo;
      if (!ph) continue; n++;
      // QA fb66b9b P2: the visible credit is "Photo: {attribution}"; author is split from the license text.
      expect(ph.credit).toBe(`Photo: ${ph.attribution}`);
      expect(ph.author).not.toMatch(/,\s*(CC[\s0-9-]|public domain)/i);
      expect(ph.credit).not.toMatch(/https?:\/\/|Unknown author|undefined/i);
      expect(ph.page).toMatch(/^https:\/\//);
    }
    expect(n).toBeGreaterThan(25);
    expect(src("components/Portrait.tsx")).toMatch(/max-w-\[60ch\] text-\[12px\] leading-4 font-\[450\] text-black\/60/);
  });
  it("every portrait is a square tile with a center-20% crop", () => {
    // Both tiles render through TileImage (Portrait.tsx), which carries the crop and Civic's cropNote focus.
    expect(src("components/Portrait.tsx")).toMatch(/object-cover object-\[center_20%\]/);
    expect(src("components/PortraitRow.tsx")).toMatch(/<TileImage /);
    for (const f of ["components/Portrait.tsx", "components/PortraitRow.tsx"]) {
      expect(src(f)).toMatch(/aspect-square/);
      expect(src(f)).not.toMatch(/aspect-\[4\/5\]|object-top/);
    }
  });
  it("multi-seat rows never wrap: flex 1 1 0, min-w-0, max 40/56px, truncated label, sr-only when dense under 768", () => {
    const s = src("components/PortraitRow.tsx");
    expect(s).toMatch(/flex: ?"1 1 0"/);
    expect(s).toMatch(/max-w-\[40px\][^"]*lg:max-w-\[56px\]/);
    expect(s).toMatch(/flex flex-nowrap/);
    expect(s).toMatch(/group-data-\[dense=true\]\/row:max-md:sr-only/);
    expect(s).toMatch(/truncate/);
  });
  it("grade sits inline after its count, Civic's label directly below in caption style", () => {
    const s = src("components/CandidateRow.tsx");
    expect(s).toMatch(/\{overlapLabel\(c\.name, o\)\}\{grade \? <> · <span[^>]*data-grade-slot>\{grade\}/);
    // QA fb66b9b P1: the grade caption reads at 13/18 (black/60) beside the grade.
    expect(s).toMatch(/text-\[13px\] leading-\[18px\] font-\[450\] text-black\/60 \[word-break:break-word\]" data-grade=\{grade\}>\{gradeLabel\(/);
  });
  it("'Who lines up': only answered issues show, the rest sits behind 'Show all positions'; date unsure is a title", () => {
    const s = src("components/CandidateRow.tsx");
    expect(s).toMatch(/data-all-positions/);
    expect(s).toMatch(/Show all positions/);
    expect(s).not.toMatch(/>\s*\(date unsure\)/);
  });
  it("no-position rows: LWV renamed, deduped by domain, vertical list with 44px links, never empty", () => {
    const s = src("components/CandidateRow.tsx");
    expect(s).toMatch(/flex flex-col gap-y-2/);
    expect(s).toMatch(/min-h-11/);
    expect(s).toMatch(/data-lwv-link/);
    const all = JSON.parse(src("data/sources-checked.json")).bySlug as Record<string, { checked: { url: string; title?: string }[] }>;
    for (const v of Object.values(all)) {
      const hosts = v.checked.map((x) => new URL(x.url).hostname.replace(/^www\./, ""));
      expect(new Set(hosts).size).toBe(hosts.length);
      for (const x of v.checked) expect(String(x.title ?? "")).not.toMatch(/\((via|direct fetch|search snippet|403|404)/i);
    }
  });
  it("market 'listed' drops placeholder names", () => {
    for (const n of ["Option A", "Option J", "Person A", "Person B", "A", "E", "Other"]) expect(isListedPlaceholder(n)).toBe(true);
    for (const n of ["Greg Abbott", "Kathy Hochul"]) expect(isListedPlaceholder(n)).toBe(false);
  });
  it("NY rows keep the TENTATIVE label and use Civic's byRace text on screen and in the API (qa_fixes4)", () => {
    const by = (NYN as { byRace: Record<string, string> }).byRace;
    expect(Object.keys(by).sort()).toEqual(["ny-civil-3md-ny", "ny-civil-9md-ny", "ny-civil-county-ny", "ny-surrogate-ny", "nyc-council-3"]);
    const races = ballotFor("10001")!.races as unknown as { id: string; appliesNote?: string; splitNote?: string; sourceNote?: string }[];
    for (const [id, text] of Object.entries(by)) {
      const r = races.find((x) => x.id === id)!;
      expect(text).toMatch(/TENTATIVE/);
      expect(text).not.toMatch(/Keep the existing/);
      expect(r.sourceNote).toBe(text);
      expect(r.appliesNote).toContain(text);
    }
    expect(races.find((x) => x.id === "ny-civil-3md-ny")!.splitNote).toMatch(/^SPLIT: ~70\.6%/);
    expect(races.find((x) => x.id === "nyc-council-3")!.appliesNote).toMatch(/^SPLIT: ~95\.1%.*TENTATIVE/);
    expect(src("app/RaceTiers.tsx")).toMatch(/TENTATIVE: draft contest list[^]*r\.sourceNote\.split\(/);
  });
  it("one source sentence counts toward one issue only (best fit)", () => {
    const q = "I'll fight for funding for critical infrastructure like water, roads and clean energy.";
    const drop = duplicateSentenceIds({ infrastructure: { value: 3, quote: q }, energy: { value: 2, quote: q } }, ["energy", "infrastructure"]);
    expect([...drop.keys()]).toEqual(["energy"]);
    for (const name of ["Caitlin Rourk", "Shehla Faizi", "Rob Bonta", "Shirley N. Weber", "Jessica Pessecow"]) {
      const st = stancesFor(name);
      const keys = Object.values(st).filter((s) => s.value !== null && (s.quote || s.summary)).map((s) => String(s.quote || s.summary).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(stancesFor("Caitlin Rourk").infrastructure.value).not.toBeNull();
    expect(stancesFor("Caitlin Rourk").energy.value).toBeNull();
  });
  it("Becerra's clean-energy sentence tagged wages is retagged to energy (Civic qa_fixes4); the LAist wages quote stays", () => {
    const q = "I believe that by treating clean energy and grid resilience as public investments—and ensuring renters, low-income households, and workers share in the benefits—California can fight climate change";
    expect(isExcluded("Xavier Becerra", "wages", q)).toBe(true);
    expect(correctedIssue("Xavier Becerra", "wages", q)).toBe("energy");
    expect(correctedIssue("Xavier Becerra", "wages", "pay a living wage")).toBeUndefined();
    expect(stancesFor("Xavier Becerra").wages.value).toBe(3);
    expect(stancesFor("Xavier Becerra").energy.value).toBe(3);
    expect(src("app/api/research/route.ts")).toMatch(/correctedIssue\(/);
  });
  it("qa_fixes4 + qa_fixes5 loaded through merge_gapfill: Andy Brown 4 stances (County Judge is executive, not judicial); Rome Moses Jones 1 and Dana Walker 0 after the wages downgrade", () => {
    const n = (name: string) => Object.values(stancesFor(name)).filter((s) => typeof s.value === "number" && s.value !== 0).length;
    expect(n("Andy Brown")).toBe(4);
    expect(n("Rome Moses Jones")).toBe(1);
    expect(n("Dana Walker")).toBe(0);
    const r = ballotFor("78701")!.races.find((x) => x.id === "travis-county-judge") as unknown as { judicial?: unknown; candidates: { name: string; positions?: unknown[] }[] };
    expect(r.judicial).toBeFalsy();
    expect(r.candidates.length).toBe(1);
    expect(r.candidates[0].positions?.length).toBe(4);
  });
  it("dead links are hidden and the QA-named ones are caught", () => {
    for (const u of ["https://ballotpedia.org/Maria_Luisa_Flores", "http://www.carlwilsonnyc.com", "http://cams.ocgov.com/Web_Publisher_sam/sam10_08_2024.htm", "https://kirk4aisd.com/", "https://www.tonysimone.com/"]) {
      expect(liveUrl(u) === null || liveUrl(u) !== u).toBe(true);
    }
    expect(liveUrl("http://example.com/x")).toBeNull();
    for (const x of sourcesChecked("Maria Luisa Flores")) expect(x.url).not.toMatch(/Maria_Luisa_Flores/);
  });
  it("photo takedowns: data/photo_takedowns.json is a list of candidate ids, and any id there shows initials", () => {
    expect(Array.isArray(JSON.parse(src("data/photo_takedowns.json")))).toBe(true);
    expect((withLicensedPhoto({ name: "Rob Bonta" } as never) as { photo?: unknown }).photo).toBeTruthy();
    TAKEDOWNS.add("rob-bonta");
    try { expect((withLicensedPhoto({ name: "Rob Bonta" } as never) as { photo?: unknown }).photo).toBeNull(); } finally { TAKEDOWNS.delete("rob-bonta"); }
    expect(src("README.md")).toMatch(/photo_takedowns\.json/);
  });
  it("hotlinked campaign headshot is credited to its source page; footer carries the removal notice", () => {
    const b = (withLicensedPhoto({ name: "Richard Barrera" } as never) as { photo?: { url: string; credit: string; page: string; hotlinked?: boolean } }).photo;
    expect(b?.hotlinked).toBe(true);
    expect(b?.url).toMatch(/^https:\/\//);
    expect(b?.page).toBe("https://www.barreraforedu.com/mediaresources");
    expect(b?.credit).toBe("Photo: Richard Barrera campaign site"); // Civic qa_fixes6 #5
    expect(src("components/SiteChrome.tsx")).toMatch(/Candidate photos are from their public campaign or official pages\. <a href="\/contact"[^>]*>Contact us<\/a> to remove\./);
    expect(src("components/Portrait.tsx")).toMatch(/referrerPolicy="no-referrer"/);
  });
  it("77002 stays unsupported", () => {
    expect(src("lib/site.ts")).not.toMatch(/zip: "77002"/);
  });
});

describe("qa_fixes4: Polymarket active outcomes only; ca-gov ballot names only; down sites", () => {
  const sub = (name: string, price: number, active = true, closed = false) => ({ groupItemTitle: name, outcomePrices: JSON.stringify([String(price), String(1 - price)]), active, closed, volume: "100" });
  it("fetchPolymarket keeps only active, not-closed sub-markets, even when an inactive placeholder is priced 0.5", async () => {
    const ev = [{ title: "NY AG", closed: false, markets: [sub("Letitia James", 0.95), sub("Saritha Komatireddy", 0.04), sub("Person A", 0.5, false), sub("Other", 0.5, false), sub("Old", 0.3, true, true)] }];
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify(ev), { status: 200 })) as typeof fetch;
    try {
      const q = await fetchPolymarket(`test-active-${Date.now()}`);
      expect(q.outcomes.map((o: { name: string }) => o.name)).toEqual(["Letitia James", "Saritha Komatireddy"]);
      expect(q.listed).toEqual(["Letitia James", "Saritha Komatireddy"]);
    } finally { globalThis.fetch = orig; }
    expect(isActiveMarket({ active: true, closed: false })).toBe(true);
    expect(isActiveMarket({ active: false, closed: false })).toBe(false);
    expect(isActiveMarket({ active: true, closed: true })).toBe(false);
  });
  it("ca-gov shows only names on the ballot", async () => {
    const fake = async () => ({ source: "Polymarket", title: "CA Gov", url: "https://polymarket.com/event/x", fetchedAt: new Date().toISOString(), outcomes: [{ name: "Xavier Becerra", prob: 0.97 }, { name: "Steve Hilton", prob: 0.03 }, { name: "Rick Caruso", prob: 0.0005 }], listed: ["Xavier Becerra", "Steve Hilton", "Rick Caruso", "Alex Padilla"] });
    const r = await getMarketOdds(["ca-gov"], fake as never, () => ["Xavier Becerra", "Steve Hilton"]);
    expect(r["ca-gov"].status).toBe("live");
    expect(r["ca-gov"].quotes[0].outcomes.map((o) => o.name)).toEqual(["Xavier Becerra", "Steve Hilton"]);
    expect(r["ca-gov"].quotes[0].listed).toEqual(["Xavier Becerra", "Steve Hilton"]);
  });
  it("kirk4aisd.com and tonysimone.com read 'site down as of Oct 30, 2026' with Civic's alternatives; Granicus, https and Lulu_Flores fixes are in", () => {
    const k = sourcesChecked("Kirk Becker");
    expect(k.find((x) => /kirk4aisd/.test(x.url))?.down).toBe("site down as of Oct 30, 2026");
    expect(k.some((x) => /kut\.org/.test(x.url))).toBe(true);
    const t = sourcesChecked("Tony Simone");
    expect(t.find((x) => /tonysimone\.com/.test(x.url))?.down).toBe("site down as of Oct 30, 2026");
    expect(t.some((x) => /abundanceny/.test(x.url))).toBe(true);
    expect(src("components/CandidateRow.tsx")).toMatch(/data-site-down/);
    const all = JSON.stringify(SC);
    expect(all).not.toMatch(/cams\.ocgov|Maria_Luisa_Flores|http:\/\/www\.carlwilsonnyc/);
    expect(all).toMatch(/ocgov\.granicus\.com/);
  });
});

describe("Civic qa_fixes5 (via scripts/civic_changes_to_gapfill.py + merge_gapfill.py)", () => {
  const ST = (STJ as unknown as { stances: Record<string, Record<string, { value: number | null; status?: string }>> }).stances;
  it("downgraded stances are unsure: value null, status 'unsure', never scored", () => {
    const pairs: [string, string][] = [["ted-brown", "infrastructure"], ["ted-brown", "wages"], ["sarah-eckhardt", "taxes"], ["sonja-shaw", "safety"], ["leah-lacroix", "taxes"], ["bunny-mcfadden", "taxes"], ["rome-moses-jones", "wages"], ["dana-walker", "wages"], ["don-huffines", "wages"]];
    for (const [id, iss] of pairs) {
      expect(ST[id][iss].value, `${id} ${iss}`).toBeNull();
      expect(ST[id][iss].status, `${id} ${iss}`).toBe("unsure");
      expect(stancesFor(ST[id].name as unknown as string)[iss].value, `${id} ${iss}`).toBeNull();
    }
  });
  it("Gina Hinojosa energy is +2; Hilton's CBS quote is retagged housing -> taxes in the research layer", () => {
    expect(ST["gina-hinojosa"].energy.value).toBe(2);
    expect(stancesFor("Gina Hinojosa").energy.value).toBe(2);
    const q = "$3 gas, your first $150,000 tax-free, capping vehicle registration at $73 for your car or your truck, eliminating mass homelessness by the end of my first year";
    expect(correctedIssue("Steve Hilton", "housing", q)).toBe("taxes");
  });
  it("grades_eligibility.json is Civic's recompute: still 19 eligible races", () => {
    const r = (GE as { races: Record<string, { gradesEligible?: boolean }> }).races;
    expect(Object.values(r).filter((x) => x.gradesEligible).length).toBe(19);
    expect(r["travis-county-judge"]?.gradesEligible ?? false).toBe(false);
  });
});
