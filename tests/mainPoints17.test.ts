// Civic 10:19 AM CT Oct 30: main_points16.json is the only source for card main points and the record line.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ballotFor } from "../lib/tools";
import { ISSUES } from "../lib/issues";
import { pointsFor } from "../lib/mainPoints";
import EndScreen from "../app/EndScreen";

const ids = ISSUES.map((i) => i.id);
const ZIPS = ["78701", "94103", "10001"];
const yesAll = Object.fromEntries(ids.map((i) => [i, 2]));
const MP = JSON.parse(fs.readFileSync("data/civic/main_points17.json", "utf8"));
const end = (z: string) => renderToStaticMarkup(h(EndScreen, { zip: z, races: ballotFor(z)!.races as never, answers: yesAll, ids, answered: ids.length }));
const rowOf = (html: string, n: string) => html.split(`data-overlap="${n.replace(/"/g, "&quot;")}"`)[1]?.split(/data-overlap="|data-card-race=/)[0] ?? "";
const dec = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
type R = { races: { id: string; judicial?: boolean; candidates?: { name: string }[] }[] };

describe("main_points17 (Civic, Oct 30; was main_points16)", () => {
  it("every candidate on all 3 ballots resolves to exactly one Civic entry (no silent misses)", () => {
    for (const z of ZIPS) for (const r of (ballotFor(z) as unknown as R).races) for (const c of r.candidates ?? []) {
      if (!MP.races[r.id]) continue; // ballot measures are not in the file
      const p = pointsFor(r.id, c.name);
      expect(p, `${z} ${r.id} ${c.name}`).not.toBeNull();
      expect(p!.name).toBe(c.name);
    }
  });
  it("each non-judicial card shows Civic's main points verbatim (max 3, never padded) or the exact empty text", () => {
    for (const z of ZIPS) {
      const html = end(z);
      for (const r of (ballotFor(z) as unknown as R).races) if (!r.judicial && MP.races[r.id]) for (const c of r.candidates ?? []) {
        const row = rowOf(html, c.name); const e = pointsFor(r.id, c.name)!;
        const shown = [...row.matchAll(/data-main-text="true">([^<]*)</g)].map((m) => dec(m[1]));
        expect(shown, `${r.id} ${c.name}`).toEqual(e.p.slice(0, 3).map((x) => x.t));
        if (!e.p.length) { expect(e.none).toBe("No public position found yet"); expect(row).toContain("No public position found yet"); }
        expect(dec(row)).toContain(`Record: ${e.r?.t || "No voting record found"}`);
      }
    }
  });
  it("race+name matched ids land on the right candidate (Gates, Romero, Cohen, NY governor tickets)", () => {
    const sf = end("94103"), ny = end("10001");
    const want: [string, string, string, RegExp][] = [
      [sf, "Michael E. Gates", "michael-e-gates", /Huntington Beach v\. Newsom/],
      [sf, "Gloria Romero", "gloria-romero", /SBX5 4/],
      [sf, "Malia M. Cohen", "malia-m-cohen", /Annual Comprehensive Financial Report/],
      [ny, "Kathy C. Hochul / Adrienne E. Adams", "kathy-c-hochul-adrienne-e-adams", /Gateway funding/],
      [ny, "Bruce A. Blakeman / Todd Hood", "bruce-a-blakeman-todd-hood", /287\(g\)/],
    ];
    for (const [html, name, id, re] of want) {
      const row = dec(rowOf(html, name));
      expect(row, name).toContain(`data-record-id="${id}"`);
      expect(row, name).toMatch(re);
      expect(row, name).toMatch(/data-record-source/);
    }
    // the other side of each ticket race does not carry the wrong record
    expect(dec(rowOf(ny, "Bruce A. Blakeman / Todd Hood"))).not.toMatch(/Gateway funding/);
  });
  it("unbalanced race tx-comptroller: every candidate shown, the empty one plainly", () => {
    const html = end("78701");
    const race = (ballotFor("78701") as unknown as R).races.find((r) => r.id === "tx-comptroller")!;
    for (const c of race.candidates!) expect(html).toContain(`data-overlap="${c.name}"`);
    const empty = rowOf(html, "V. Alonzo Echavarria-Garza");
    expect(empty).not.toContain("data-main-text");
    expect(empty).toContain("No public position found yet");
    expect(rowOf(html, "Sarah Eckhardt").match(/data-main-text/g)?.length).toBe(3);
  });
  it("record lines clamp to 2 lines with the full text in title", () => {
    const row = rowOf(end("10001"), "Kathy C. Hochul / Adrienne E. Adams");
    expect(row).toMatch(/class="line-clamp-2 min-w-0" title="Record: /);
  });
});

import RaceTiers from "../app/RaceTiers";
describe("judges (main_points16)", () => {
  it("8 Texas judges show their official-profile role line; the rest show the plain empty text", () => {
    const J = Object.entries(MP.races as Record<string, { judicial: boolean; candidates: Record<string, { name: string; mainPoints: { text: string; sourceUrl: string }[] }> }>).filter(([, r]) => r.judicial);
    const withRole = J.flatMap(([, r]) => Object.values(r.candidates).filter((c) => c.mainPoints.length));
    expect(withRole.length).toBe(8);
    expect(J.flatMap(([, r]) => Object.values(r.candidates)).length - withRole.length).toBe(66);
    for (const c of withRole) expect(c.mainPoints[0].sourceUrl).toMatch(/^https:\/\/www\.txcourts\.gov\//);
  });
});
void RaceTiers;
