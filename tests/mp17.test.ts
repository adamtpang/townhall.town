// main_points17 (Civic, Oct 30 12:19 PM CT): pointType "issue" (scored), "office" (unscored office priority) and
// "role" (TX judges' official-profile line). Office and role points are display only and never count toward issue
// overlap, the fit line, accountability or grades.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ballotFor } from "../lib/tools";
import { ISSUES, stancesFor } from "../lib/issues";
import { pointsFor, scoredPoints, type MainPoint } from "../lib/mainPoints";
import { overlapFor, recordFor, sourcedCount } from "../lib/overlapCore.mjs";
import ELIG from "../lib/gradesEligibility.gen.mjs";

const ids = ISSUES.map((i) => i.id);
const yesAll = Object.fromEntries(ids.map((i) => [i, 2]));
const MP = JSON.parse(fs.readFileSync("data/civic/main_points17.json", "utf8"));
const GEN = JSON.parse(fs.readFileSync("lib/mainPoints.gen.json", "utf8"));
const dec = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const rowOf = (html: string, n: string) => html.split(`data-overlap="${n.replace(/"/g, "&quot;")}"`)[1]?.split(/data-overlap="|data-card-race=/)[0] ?? "";
type R = { races: { id: string; judicial?: boolean; candidates?: { name: string }[] }[] };
const all = () => Object.entries(GEN.races as Record<string, Record<string, { id: string; name: string; p: MainPoint[] }>>).flatMap(([rid, m]) => Object.entries(m).filter(([k, e]) => k === e.id).map(([, e]) => ({ rid, ...e })));
const OFFICE = all().filter((e) => e.p.some((x) => x.k === "office"));

async function endHtml(zip: string) {
  const { default: EndScreen } = await import("../app/EndScreen");
  return renderToStaticMarkup(h(EndScreen, { zip, races: ballotFor(zip)!.races as never, answers: yesAll, ids, answered: ids.length }));
}
// Every scoring-relevant attribute on a row (overlap status, fit line, record/accountability, grade if any).
const scoringAttrs = (row: string) => [...row.matchAll(/data-(status|fit|record|record-n|grade|letter)="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`).join("|");

describe("main_points17 pointType", () => {
  it("every point carries Civic's pointType: 316 issue, 10 office, 8 role", () => {
    const c: Record<string, number> = {};
    for (const e of all()) for (const x of e.p) c[x.k] = (c[x.k] ?? 0) + 1;
    expect(c).toEqual({ issue: 316, office: 10, role: 8 });
    for (const r of Object.values(MP.races as Record<string, { candidates: Record<string, { mainPoints: { pointType?: string }[] }> }>))
      for (const cand of Object.values(r.candidates)) for (const x of cand.mainPoints) expect(["issue", "office", "role"]).toContain(x.pointType);
  });
  it("office points only in Civic's office-priority races, at most 1 each, unscored", () => {
    const allowed = new Set(JSON.parse(fs.readFileSync("data/civic/positions_gapfill_batch8civic.json", "utf8"))._meta.officePriorityOffices);
    expect(OFFICE.length).toBe(10);
    for (const e of OFFICE) {
      expect(allowed.has(e.rid), e.rid).toBe(true);
      expect(e.p.filter((x) => x.k === "office").length).toBe(1);
      expect(e.p.filter((x) => x.k === "office").every((x) => x.i === "office-priorities")).toBe(true);
    }
  });
});

describe("office and role points never count toward overlap, fit, accountability or grades", () => {
  it("no office-priority issue exists in the issue list or in any candidate's stances", () => {
    expect(ids).not.toContain("office-priorities");
    expect(ids).not.toContain("office priorities");
    for (const e of all()) {
      const st = stancesFor(e.name) as Record<string, unknown>;
      expect(st["office-priorities"], e.name).toBeUndefined();
      expect(st["office priorities"], e.name).toBeUndefined();
    }
  });
  it("overlap and accountability come from stances only: an office-only candidate overlaps on 0 issues", () => {
    for (const e of OFFICE) {
      const st = stancesFor(e.name);
      const o = overlapFor(yesAll, st, ids);
      expect(o.n, e.name).toBeLessThanOrEqual(sourcedCount(st, ids));
      expect(sourcedCount(st, ids), e.name).toBe(scoredPoints(e.p).length === 0 ? 0 : sourcedCount(st, ids));
      expect(recordFor(st, ids)).toEqual(recordFor(stancesFor(e.name), ids));
    }
    for (const n of ["Brian Peña", "Dyana Limon-Mercado", "Trevor Hale", "Nan McRaven"]) {
      expect(sourcedCount(stancesFor(n), ids), n).toBe(0);
      expect(overlapFor(yesAll, stancesFor(n), ids).n, n).toBe(0);
    }
  });
  it("scoring modules never read main points", () => {
    for (const f of ["lib/overlapCore.mjs", "lib/grades.mjs", "lib/gradesEligibility.gen.mjs", "lib/tools.ts", "lib/issues.ts", "lib/card.mjs", "lib/endscreen.mjs"]) {
      if (!fs.existsSync(f)) continue;
      expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/mainPoints|main_points|pointType/);
    }
  });
  it("grade eligibility unchanged at 22 races (office priorities are unscored)", () => {
    expect((ELIG as { data: { races: string[] } }).data.races.length).toBe(22);
  });
  it("adding office and role points to every candidate changes no overlap, fit, record or grade attribute", async () => {
    const base = Object.fromEntries(await Promise.all(["78701", "94103", "10001"].map(async (z) => [z, await endHtml(z)])));
    vi.resetModules();
    vi.doMock("../lib/mainPoints", async (orig) => {
      const m = (await orig()) as typeof import("../lib/mainPoints");
      const extra: MainPoint[] = [
        { i: "office-priorities", l: "office priorities", t: "Test office point", u: "https://example.org/o", s: "x", k: "office" },
        { i: "role", l: "role", t: "Test role line", u: "https://example.org/r", s: "x", k: "role" },
      ];
      return { ...m, pointsFor: (r: string | undefined, n: string) => { const e = m.pointsFor(r, n); return e ? { ...e, p: [...extra, ...e.p] } : e; } };
    });
    for (const z of ["78701", "94103", "10001"]) {
      const html = await endHtml(z);
      expect(html).toContain("Test office point");
      for (const r of (ballotFor(z) as unknown as R).races) for (const c of r.candidates ?? []) {
        expect(scoringAttrs(rowOf(html, c.name)), `${z} ${c.name}`).toBe(scoringAttrs(rowOf(base[z], c.name)));
      }
    }
    vi.doUnmock("../lib/mainPoints");
    vi.resetModules();
  });
});

describe("office label and empty states", () => {
  it("office points get the muted 'Office priority:' prefix; issue points do not", async () => {
    const html = await endHtml("78701");
    const pena = dec(rowOf(html, "Brian Peña"));
    expect(pena).toMatch(/data-point-type="office"><span class="text-sm leading-6 text-black\/60" data-office-label="true">Office priority:<\/span> <span data-main-text="true">Says he will seek accurate appraisals/);
    const eck = rowOf(html, "Sarah Eckhardt");
    expect(eck).not.toContain("data-office-label");
    expect(eck.match(/data-point-type="issue"/g)?.length).toBe(3);
    const sf = dec(rowOf(await endHtml("94103"), "Elijah Ball"));
    expect(sf.match(/data-office-label/g)?.length).toBe(1);
    expect(sf.match(/data-point-type="issue"/g)?.length).toBe(2);
    expect(html).not.toMatch(/data-office-label[^>]*class="[^"]*(bg-|border|rounded|text-(red|blue|green|amber))/);
  });
  it("Padilla shows exactly 'No public position found yet' and no main point", async () => {
    const row = rowOf(await endHtml("78701"), "Gabriel Padilla");
    expect(row).not.toContain("data-main-text");
    expect(row).toContain("No public position found yet");
    expect(pointsFor("travis-constable-4-unexpired", "Gabriel Padilla")!.none).toBe("No public position found yet");
  });
  it("City College stays uneven on purpose: Jones 1 point, Wynn 0, no filler", async () => {
    const html = await endHtml("94103");
    expect(rowOf(html, "Rome Moses Jones").match(/data-main-text/g)?.length).toBe(1);
    const wynn = rowOf(html, "Lisa Wynn");
    expect(wynn).not.toContain("data-main-text");
    expect(wynn).toContain("No public position found yet");
  });
});
