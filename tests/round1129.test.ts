// Oct 29 11:28-11:42 PM CT round: photos (licensed, race-level fairness), source links, no-position line,
// Civic grade gate (fail closed), gap-fill batch 2, judicial short link, Spanish, carry-over, market line.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ballotFor } from "../lib/tools";
import { allOrNone, gatePhotos, withLicensedPhoto } from "../lib/photos";
import { eligibleSet, raceGradesEligible, gradeFor, gradeLabel, letterFor, MIN_TOP_SAMPLE } from "../lib/grades.mjs";
import ELIG from "../lib/gradesEligibility.gen.mjs";
import { overlapStatus } from "../lib/overlapCore.mjs";
import { stancesFor, ISSUES } from "../lib/issues";
import RaceFooter from "../components/RaceFooter";
import CandidateRow, { NO_POSITION, sourcesChecked } from "../components/CandidateRow";
import EndScreen from "../app/EndScreen";
import BallotCard from "../app/card/BallotCard";
import { judicialShort, JUDICIAL_RULES } from "../lib/judicial";
import { leaderLine, isPlaceholder } from "../lib/marketLine";
import { MarketLine } from "../app/RaceTiers";

const src = (p: string) => fs.readFileSync(p, "utf8");
const ids = ISSUES.map((i) => i.id);
const ZIPS = ["78701", "94103", "10001"];
const PB = JSON.parse(src("data/civic/photos_batch.json"));
const yesAll = Object.fromEntries(ids.map((i) => [i, 5]));
const card = (z: string) => { const b = ballotFor(z)!; return renderToStaticMarkup(h(BallotCard, { zip: z, place: z, ids, races: b.races as never })); };
const rowOf = (html: string, n: string) => html.split(`data-overlap="${n.replace(/"/g, "&quot;")}"`)[1]?.split(/data-overlap="|data-card-race=/)[0] ?? "";
const end = (z: string, answers: Record<string, number> = yesAll) => renderToStaticMarkup(h(EndScreen, { zip: z, races: ballotFor(z)!.races as never, answers, ids, answered: Object.keys(answers).length }));

describe("photos: licensed or the candidate's own headshot; PHOTO_GATE race by default, candidate behind the flag", () => {
  it("race mode (behind the flag): no race mixes photos and initials, on every ZIP", () => {
    for (const z of ZIPS) for (const r of ballotFor(z)!.races) {
      const c = allOrNone(((r as { candidates?: { photo?: unknown }[] }).candidates ?? []));
      const n = c.filter((x) => x.photo).length;
      expect(n === 0 || n === c.length, `${z} ${r.id}`).toBe(true);
    }
  });
  it("candidate mode (flag): every candidate with a photo shows it", () => {
    for (const z of ZIPS) for (const r of ballotFor(z)!.races) {
      const raw = (r as unknown as { candidates: { name: string; aka?: string }[] }).candidates.map((c) => withLicensedPhoto({ ...c } as never) as { name: string; photo?: unknown });
      const g = gatePhotos(raw, "candidate");
      g.forEach((c, i) => expect(!!c.photo, `${z} ${c.name}`).toBe(!!raw[i].photo));
    }
  });
  it("allOrNone: one missing photo means initials for the whole race", () => {
    const p = { url: "/portraits/x.avif", credit: "Photo: X" };
    expect(allOrNone([{ photo: p }, { photo: null }]).every((c) => c.photo === null)).toBe(true);
    expect(allOrNone([{ photo: p }, { photo: p }]).every((c) => c.photo)).toBe(true);
  });
  it("race mode (Civic headshot pass, Oct 30 12:40 AM): incomplete races and the 4 'photo ages not comparable' races show initials", () => {
    const race = (z: string, id: string) => (ballotFor(z)!.races.find((r) => r.id === id) as unknown as { candidates: { photo?: unknown }[] }).candidates;
    // Adam 9:58 AM CT Oct 30: candidate mode is now the default, so race mode is checked through gatePhotos directly.
    for (const [z, id] of [["78701", "tx-ag"], ["94103", "ca-ltgov"], ["94103", "sf-supervisor-10"], ["10001", "ny-supreme-1jd"]]) {
      const raw = (ballotFor(z)!.races.find((r) => r.id === id) as unknown as { candidates: { name: string }[] }).candidates.map((c) => withLicensedPhoto({ ...c, photo: undefined } as never) as { photo?: unknown });
      expect(gatePhotos(raw, "race", id).every((c) => !c.photo), id).toBe(true);
    }
    // Civic qa13: tx-ltgov's "photo ages not comparable" note is gone (only McCormick's 2026 is known), so the race is complete.
    expect(race("78701", "tx-ltgov").every((c) => c.photo), "tx-ltgov").toBe(true);
    const raw = (ballotFor("78701")!.races.find((r) => r.id === "tx-ltgov") as unknown as { candidates: { name: string }[] }).candidates.map((c) => withLicensedPhoto({ ...c, photo: undefined } as never) as { photo?: unknown });
    expect(raw.every((c) => c.photo)).toBe(true);
    expect(gatePhotos(raw, "race", "tx-ltgov").every((c) => c.photo)).toBe(true);
    expect(gatePhotos(raw, "candidate", "tx-ltgov").every((c) => c.photo)).toBe(true);
    // Civic qa10: Fisher's campaign-site photo completes sf-board-of-education.
    for (const [z, id] of [["94103", "ca-ag"], ["78701", "austin-council-9"], ["10001", "ny-governor"], ["94103", "sf-board-of-education"]]) expect(race(z, id).every((c) => c.photo), id).toBe(true);
  });
  it("running mates are attached to their ticket; cropNote focus flows to the photo", () => {
    const gov = (ballotFor("10001")!.races.find((r) => r.id === "ny-governor") as unknown as { candidates: { name: string; photo?: { mate?: { name: string; url: string } } }[] }).candidates;
    expect(gov.find((c) => /Hochul/.test(c.name))?.photo?.mate?.name).toBe("Adrienne E. Adams");
    expect(gov.find((c) => /Blakeman/.test(c.name))?.photo?.mate?.name).toBe("Todd Hood");
    const sf = ballotFor("94103")!.races.find((r) => r.id === "sf-community-college-board") as unknown as { candidates: { name: string }[] };
    const ball = withLicensedPhoto({ ...sf.candidates.find((c) => /Ball/.test(c.name))!, photo: undefined } as never) as { photo?: { url: string; url112?: string; focus?: number[] } };
    // Design p14: the focus is cut into the self-hosted square, so the rendered photo carries no CSS focus.
    expect(JSON.parse(src("data/photos.json")).selfHosted["elijah-ball"].focus).toEqual([0.49, 0.21, 2]);
    expect(ball.photo?.focus).toBeUndefined();
    expect(ball.photo?.url).toBe("/portraits/elijah-ball-160.webp"); expect(ball.photo?.url112).toBe("/portraits/elijah-ball-112.webp");
    expect(JSON.parse(src("data/portraits-manifest.json")).portraits["elijah-ball"].focus).toEqual([0.49, 0.21, 2]);
  });
  it("every shown photo is in Civic's licensed file with attribution, self-hosted, never txcourts.gov or the Fisher video still", () => {
    const hosted = JSON.parse(src("data/photos.json")).selfHosted as Record<string, { file: string; credit: string; license: string; sourceUrl: string }>;
    for (const [id, x] of Object.entries(hosted)) {
      expect(PB[id]?.photoUrl ?? null, id).toBe(x.sourceUrl);
      const c = String(PB[id].attribution).replace(/^photo:\s*/i, "");
      expect(x.credit, id).toBe(c); // Civic qa13: the batch attribution renders as written
      expect(x.license, id).toBeTruthy();
      expect(fs.existsSync(`public${x.file}`), id).toBe(true);
      expect(String(x.sourceUrl)).not.toMatch(/txcourts\.gov/i);
    }
    // Civic qa10: Fisher's own campaign-site photo is allowed; the SFGovTV video still never is.
    expect(hosted["alida-fisher"].sourceUrl).not.toMatch(/webm|wikimedia|sfgovtv/i);
    // Civic localFile copies are self-hosted as resized webp; running mates' files are kept under runningMates.
    const mates = Object.values(JSON.parse(src("data/photos.json")).runningMates ?? {}) as { file?: string }[];
    for (const f of fs.readdirSync("public/portraits")) expect(hosted[f.replace(/-(112|160)\.webp$/, "")] || mates.some((m) => m.file === `/portraits/${f}` || (m as { file112?: string }).file112 === `/portraits/${f}`), f).toBeTruthy();
    // Design p14: nothing is hotlinked any more; every file is listed in the manifest with its source URL and sha256.
    const hot = (JSON.parse(src("data/photos.json")).hotlinked ?? {}) as Record<string, { url: string; page: string; via: string }>;
    expect(Object.keys(hot)).toEqual([]);
    expect(fs.readdirSync("public/portraits").every((f) => /-(112|160)\.webp$/.test(f))).toBe(true);
    for (const [id, x] of Object.entries(hot)) {
      expect(x.url, id).toBe(PB[id].photoUrl);
      expect(x.url).toMatch(/^https:\/\//);
      expect(x.page, id).toBeTruthy();
      expect(x.via, id).toMatch(/campaign|official|own social profile/i);
      expect(x.via, id).not.toMatch(/news/i);
      expect(fs.existsSync(`public/portraits/${id}.avif`), id).toBe(false);
    }
  });
  it("attribution is visible (not collapsed) wherever a photo appears: one credit line per race (design p12 #1, 12/16 weight 450 black/60)", () => {
    const photo = (withLicensedPhoto({ name: "Rob Bonta" } as never) as { photo: unknown }).photo as never;
    const row = renderToStaticMarkup(h(CandidateRow, { c: { name: "Rob Bonta", photo }, o: overlapStatus({}, stancesFor("Rob Bonta"), ids), grade: null, ids }));
    expect(row).not.toMatch(/data-credit-line|>Photo: /); // no per-candidate line in Who or the card
    const foot = renderToStaticMarkup(h(RaceFooter, { cands: [{ name: "Rob Bonta", photo }], gradesHidden: null }));
    expect(foot).toMatch(/data-photo-credits[^>]*>.*Photo:.*<a href="https:\/\/commons\.wikimedia\.org\/[^"]+"[^>]*data-photo-credit[^>]*>[^<]+<\/a>/i);
    expect(src("components/PortraitRow.tsx")).not.toMatch(/<details[^>]*data-photo-credits/);
    expect(src("components/Portrait.tsx")).toMatch(/\$\{CREDIT\}`\} aria-label="Photo credits" data-photo-credits/);
  });
  it("never a generated image: no image-generation code paths", () => {
    for (const f of ["scripts/ingest-photos.mjs", "lib/photos.ts", "components/PortraitRow.tsx", "components/CandidateRow.tsx"]) expect(src(f)).not.toMatch(/openai|dall-?e|stable-?diffusion|generateImage/i);
  });
});

describe("grades: Civic gate, fail closed", () => {
  const race = { id: "tx-10", candidates: [{ name: "A" }, { name: "B" }] };
  const ok3 = { status: "ok", agree: 3, n: 3 };
  it("no file means no grades anywhere", () => {
    const none = eligibleSet(null);
    expect(raceGradesEligible(race, "78701", none)).toBe(false);
    expect(gradeFor(ok3, false, 3, true, race, "78701", none)).toBeNull();
    expect(eligibleSet({}).size).toBe(0);
    expect(eligibleSet({ races: { "tx-10": { reason: "x" } } }).size).toBe(0); // missing flag = not eligible
  });
  it("fixture: an eligible race shows a letter; {races:[ids]} works too", () => {
    const f = { races: { "tx-10": { zip: "78701", raceId: "tx-10", gradesEligible: true, reason: "ok" }, "tx-37": { zip: "78701", raceId: "tx-37", gradesEligible: false } } };
    const s = eligibleSet(f);
    expect(gradeFor(ok3, false, 3, true, race, "78701", s)).toBe("S");
    expect(gradeFor(ok3, false, 3, true, { ...race, id: "tx-37" }, "78701", s)).toBeNull();
    expect(gradeFor(ok3, false, 3, true, race, null, eligibleSet({ races: ["tx-10"] }))).toBe("S");
  });
  it("judicial, measures and unopposed races never grade, even if listed", () => {
    const s = eligibleSet({ races: ["j", "m", "u"] });
    expect(raceGradesEligible({ id: "j", judicial: "tx", candidates: [{}, {}] }, null, s)).toBe(false);
    expect(raceGradesEligible({ id: "m", level: "measure", candidates: [{}, {}] }, null, s)).toBe(false);
    expect(raceGradesEligible({ id: "u", candidates: [{}] }, null, s)).toBe(false);
  });
  it("the shipped gate matches Civic's grades_eligibility.json and grade_races.json (22 races after batch 7; D9 not eligible)", () => {
    expect(ELIG.present).toBe(true);
    const full = JSON.parse(src("data/civic/grades_eligibility.json"));
    const list = JSON.parse(src("data/civic/grade_races.json")).races as string[];
    const gen = [...eligibleSet(ELIG.data)].map((x) => x.split(":")[1]).sort();
    expect(gen).toEqual([...list].sort());
    expect(gen).toEqual(Object.values(full.races as Record<string, { raceId: string; gradesEligible: boolean }>).filter((r) => r.gradesEligible).map((r) => r.raceId).sort());
    expect(gen).not.toContain("austin-council-9");
    expect(Object.keys(full.races).length).toBe(143);
  });
  it("label word for word with x of y; S and A need 3+", () => {
    expect(gradeLabel(2, 3)).toBe("Grade shows how many of your issue picks match this candidate's sourced stances (2 of 3 issues). It is not an endorsement or a rating of the candidate.");
    expect(MIN_TOP_SAMPLE).toBe(3);
    expect(letterFor(2, 2)).toBe("B");
    expect(letterFor(3, 3)).toBe("S");
  });
  it("rendered: grades only in eligible races; every letter carries the label; D9 has none", () => {
    for (const z of ZIPS) {
      const html = end(z);
      const b = ballotFor(z)!;
      for (const m of html.matchAll(/data-grade="([SABC])"[^>]*>(.*?)<\/p>/g)) expect(m[2]).toMatch(/^Grade shows how many .* \(\d+ of \d+ issues?\)\. It is not an endorsement/);
      for (const r of b.races) if (!raceGradesEligible(r, z)) for (const c of ((r as { candidates?: { name: string }[] }).candidates ?? [])) {
        const row = rowOf(html, c.name);
        expect(row, `${z} ${c.name}`).not.toMatch(/data-grade="/);
      }
    }
    // Adam 9:58 AM CT Oct 30: no letter grades on cards at all.
    for (const z of ZIPS) expect(end(z)).not.toMatch(/data-grade="[SABC]"/);
  });
});

describe("positions: sources, no-position line, gap-fill batch 2", () => {
  it("'Not enough sourced positions' is gone from code and every render", () => {
    for (const f of ["components/CandidateRow.tsx", "app/EndScreen.tsx", "app/card/BallotCard.tsx", "lib/i18n.tsx", "lib/overlapCore.mjs"]) expect(src(f)).not.toMatch(/not enough sourced/i);
    for (const z of ZIPS) { expect(card(z)).not.toMatch(/not enough sourced/i); expect(end(z)).not.toMatch(/not enough sourced/i); }
  });
  it("every shown position links to its source", () => {
    for (const z of ZIPS) {
      const html = card(z);
      const items = [...html.matchAll(/<li[^>]*data-position="[^"]+"[^>]*>(.*?)<\/li>/g)];
      expect(items.length).toBeGreaterThan(20);
      for (const m of items) expect(m[1]).toMatch(/<a href="https?:\/\//);
    }
  });
  it("candidates with fewer than 2 sourced issues show the no-position line with checked sources (linked) and never an empty state", () => {
    let shown = 0;
    for (const z of ["78701", "94103"]) {
      const html = card(z);
      for (const r of ballotFor(z)!.races) {
        if ((r as { judicial?: unknown }).judicial) continue;
        for (const c of ((r as { candidates?: { name: string }[] }).candidates ?? [])) {
          const o = overlapStatus({}, stancesFor(c.name), ids);
          if (o.sourced >= 2) continue;
          const row = rowOf(html, c.name);
          // Design hard cut C3 (Oct 30 ~3:10 PM CT, /card only): "No public position found yet on other issues." is
          // dropped where a sourced point already sits above it; the line stays where it is the only statement.
          if (o.sourced > 0 || /data-point-type="office"/.test(row)) { expect(row, c.name).not.toMatch(/No public position found yet on other issues/); if (sourcesChecked(c.name).length) expect(row).toMatch(/data-checked-source/); shown++; continue; }
          expect(row, c.name).toMatch(/data-no-position/);
          expect(row).toMatch(/No public position found yet/);
          if (sourcesChecked(c.name).length) expect(row).toMatch(/data-checked-source/);
          shown++;
        }
      }
    }
    expect(shown).toBeGreaterThanOrEqual(25);
  });
  it("Katie Kam, Dave Thadani and Kai Huang (D9) and HD 49/51 rows show sourced positions with links", () => {
    const html = card("78701");
    for (const n of ["Katie Kam", "Dave Thadani", "Kai Huang", "Montserrat Garibay", "Arshia Papari", "Jessica Martinez"]) {
      const row = rowOf(html, n);
      expect(row, n).toMatch(/data-position=/);
      expect(row, n).not.toMatch(/data-no-position/);
    }
  });
  it("NO_POSITION is Adam's wording", () => { expect(NO_POSITION).toBe("No public position found yet. Sources checked:"); });
  it("gap-fill batch 2 merged: Thadani has housing + energy; unsure items are null (never scored) and shown as unclear", () => {
    const t = stancesFor("Dave Thadani");
    expect(t.housing.value).toBe(4); expect(t.energy.value).toBe(2);
    expect(t.safety.value).toBeNull(); expect(t.safety.status).toBe("unsure");
    expect(overlapStatus({ safety: 5, taxes: 5 }, t, ids).sourcedIds).not.toContain("safety");
    const html = renderToStaticMarkup(h(CandidateRow, { c: { name: "Dave Thadani" }, o: overlapStatus({}, t, ids), grade: null, ids }));
    expect(html).toMatch(/data-unsure="safety"/);
    expect(src("scripts/merge_gapfill.py")).not.toMatch(/import merge_research|subprocess|os\.system/);
  });
});

describe("design p9 / QA 4e15da7 items", () => {
  it("P0: the judicial link reads 'Canon 5 ↗' with the full title in title, no nowrap", () => {
    expect(judicialShort(JUDICIAL_RULES.tx[2])).toBe("Canon 5");
    const s = src("app/RaceTiers.tsx");
    expect(s).toMatch(/title=\{r.judicialNoteSource.label\}/); expect(s).not.toMatch(/whitespace-nowrap[^"]*" data-judicial-source/);
    expect(s).toMatch(/\{judicialShort\(r.judicialNoteSource.label\)\} ↗/);
  });
  it("Spanish: Sí / Su código postal; ?lang= and localStorage remembered; toggle stays", () => {
    const s = src("lib/i18n.tsx");
    expect(s).toMatch(/"Sí"/); expect(s).toMatch(/Su código postal/);
    expect(s).toMatch(/LANG_KEY = "th-lang"/); expect(s).toMatch(/lang=/);
  });
  it("carry-over notice only for answers saved before page load", () => {
    expect(src("app/TownyInterview.tsx")).toMatch(/const carry = carried > 0/);
    expect(src("app/IssueMatch.tsx")).toMatch(/carried/);
  });
  it("Who: under 3 answers, the prompt plus the cards (Adam 9:58 AM CT Oct 30: every candidate shows a card)", () => {
    const h0 = end("78701", { housing: 5 });
    expect(h0).toMatch(/Answer the questions to see overlap\./);
    expect(h0).toMatch(/data-record=/);
  });
  it("market line lists the other prices from the same market and never placeholders", () => {
    const q = { source: "Polymarket" as const, title: "T", url: "https://polymarket.com/event/x", fetchedAt: "2026-10-30T03:58:00Z", outcomes: [{ name: "Ann Lee", prob: 0.6 }, { name: "Bo Diaz", prob: 0.3 }, { name: "Person C", prob: 0.1 }] };
    const html = renderToStaticMarkup(h(MarketLine, { line: leaderLine(q as never) }));
    expect(html).toMatch(/Same market: Bo Diaz at 30%/);
    expect(html).not.toMatch(/Person C/);
    expect(isPlaceholder("Option A")).toBe(true);
    expect(leaderLine({ ...q, outcomes: [{ name: "Person A", prob: 0.7 }] } as never)).toBeNull();
  });
  it("P1 tiles (superseded by design p10 P0): flex 1 1 0, min-w-0, max 40/48/56px, one row", () => {
    const s = src("components/PortraitRow.tsx");
    expect(s).toMatch(/flex: "1 1 0"/); expect(s).toMatch(/min-w-0/); expect(s).toMatch(/max-w-\[40px\] md:max-w-\[48px\] lg:max-w-\[56px\]/);
    expect(s).toMatch(/flex flex-nowrap gap-2 md:gap-3/);
    expect(s).toMatch(/line-clamp-3 text-sm font-\[530\] leading-5`\} title=\{c\.name\}/); // QA 94cf301: wrap, up to 3 lines; round 0222: two-line labels at 384
  });
});
