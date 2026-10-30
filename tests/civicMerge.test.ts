import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { ballotFor } from "../lib/tools";
import { JUDICIAL_NOTE } from "../lib/judicial";
import { ISSUES } from "../lib/issues";
import RaceTiers from "../app/RaceTiers";
import IssueMatch from "../app/IssueMatch";
import EndScreen from "../app/EndScreen";
import { ES_FOR_TEST, LangToggle, SPANISH_ENABLED } from "../lib/i18n";

const ZIPS = ["78701", "94103", "10001"] as const;
type R = { id: string; title: string; judicial?: unknown; judicialNote?: string; candidates: unknown[] };
const races = (z: string) => ballotFor(z)!.races as unknown as R[];
// Court seats by title; "County Judge" in Texas is the head of the commissioners court, not a judicial seat.
const COURT = /court|justice|judicial|surrogate|appeals?\b/i;

describe("Civic merge checks", () => {
  it("every judicial race in all 3 ZIPs carries the judicial note", () => {
    const seen: string[] = [];
    for (const z of ZIPS) for (const r of races(z)) {
      if (r.judicial || COURT.test(r.title)) {
        expect(r.judicial, `${z} ${r.title} flagged judicial`).toBeTruthy();
        expect(r.judicialNote, `${z} ${r.title}`).toBe(JUDICIAL_NOTE);
        seen.push(`${z} ${r.title}`);
      } else expect(r.judicialNote).toBeUndefined();
    }
    expect(JUDICIAL_NOTE).toBe("Judicial candidates\u2019 positions on these issues aren\u2019t public.");
    for (const must of [/78701 .*Texas Supreme Court, Place 2/, /78701 Chief Justice, Texas Supreme Court/, /78701 .*Place 7/, /78701 .*Place 8/, /78701 .*Court of Criminal Appeals/, /78701 .*15th Court of Appeals/, /78701 District Judge/, /78701 Judge, County Court at Law/, /78701 Justice of the Peace/, /94103 .*Supreme Court.*retention/, /94103 .*Court of Appeal.*retention/, /10001 Justice of the Supreme Court/, /10001 Surrogate/, /10001 Judge of the Civil Court/])
      expect(seen.some((s) => must.test(s)), String(must)).toBe(true);
  });

  it("the race list renders the note once per judicial race", () => {
    for (const z of ZIPS) {
      const rs = races(z);
      const html = renderToStaticMarkup(h(RaceTiers, { races: rs as never, market: () => null as never }));
      const n = (html.match(/data-judicial-note/g) || []).length;
      expect(n, z).toBe(rs.filter((r) => r.judicialNote).length);
      expect(html).toContain("Judicial candidates\u2019 positions on these issues aren\u2019t public.");
    }
  });

  // Adam (Oct 29 2026) overrides the earlier no-letter / no-odds rules: issue-overlap grades sit only in data-grade
  // rows after an answer, and the only market text is the live-Polymarket leader line (none without a live quote).
  it("letters appear only as labelled issue-overlap grades; no market text without a live quote", () => {
    const allYes = Object.fromEntries(ISSUES.map((i) => [i.id, 5]));
    for (const z of ZIPS) {
      const b = ballotFor(z)!;
      const tiers = renderToStaticMarkup(h(RaceTiers, { races: b.races as never, market: () => null as never }));
      const end = renderToStaticMarkup(h(EndScreen, { zip: z, races: b.races as never, answers: allYes, ids: ISSUES.map((i) => i.id), answered: ISSUES.length }));
      const html = [tiers, renderToStaticMarkup(h(IssueMatch, { zip: z, state: b.state, races: b.races as never })), end].join("\n");
      // Strip the grade rows; nothing else may show a bare letter or a "Tier/Grade X".
      const rest = html.replace(/<p[^>]*data-grade="[SABC]"[^>]*>.*?<\/p>/g, "").replace(/<span[^>]*data-grade-slot[^>]*>[SABC]?<\/span>/g, "");
      expect(rest, z).not.toMatch(/>\s*[SABC]\s*</);
      expect(rest, z).not.toMatch(/\b(Tier|Grade)\s+[SABC]\b/);
      for (const m of html.matchAll(/data-grade="([SABC])"[^>]*>(.*?)<\/p>/g)) expect(m[2]).toMatch(/^Grade shows how many of your issue picks match this candidate&#x27;s sourced stances \(\d+ of \d+ issues?\)\. It is not an endorsement or a rating of the candidate\.$/);
      // Candidates' own sourced words (quotes, Ballotpedia survey summaries) may say "best"; our copy never does.
      expect(html.replace(/“[^”]*”/g, "").replace(/data-bp-summary="true">Ballotpedia summary:<\/span>[^<]*/g, ""), z).not.toMatch(/\b(best|vote for)\b/i);
      expect(html, z).not.toMatch(/market odds|No market odds yet|\d+% chance|Kalshi|Leader on Polymarket|data-market-line/i);
      expect(html, z).toMatch(/Most at stake|High/);
    }
    for (const f of ["app/IssueMatch.tsx", "app/RaceTiers.tsx", "app/EndScreen.tsx", "app/BallotAgent.tsx"])
      expect(readFileSync(f, "utf8"), f).not.toMatch(/tierOf|"S" : |"A" : |"B" : |"C"\)/);
  });

  it("TX Supreme Court office text matches its txcourts citation; Place 2 cites the SOS certification", () => {
    const rs = races("78701") as unknown as { id: string; office?: string; source?: string }[];
    for (const r of rs.filter((x) => /^tx-supreme-court/.test(x.id))) {
      expect(r.office).toMatch(/court of last resort for civil matters/);
      expect(r.office).not.toMatch(/juvenile/);
    }
    const p2 = rs.find((r) => r.id === "tx-supreme-court-place-2")!;
    expect(p2.source).toBe("https://www.sos.texas.gov/elections/forms/2026-ballot-cert.pdf");
    expect(p2.office).toMatch(/unexpired term of Jimmy Blacklock, through December 31, 2030/);
  });

  it("Spanish toggle is visible by default and uses usted, with no translated tiers", () => {
    expect(SPANISH_ENABLED).toBe(true);
    expect(renderToStaticMarkup(h(LangToggle))).toMatch(/Español/);
    const vals = Object.values(ES_FOR_TEST).join(" | ");
    expect(vals).not.toMatch(/\b(tu|tus|te|contigo|Escribe|Revisa|Encuentra|Inténtalo|confírmalo)\b/);
    expect(vals).not.toMatch(/\bNivel\b|Sin nivel|probabilidades de mercado/);
    expect(vals).toMatch(/Día de las Elecciones/);
    expect(vals).toMatch(/No partidista/);
    expect(vals).toMatch(/estado de inscripción/);
    expect(vals).toMatch(/buzones electorales/);
  });

  it("77002 stays gated", () => {
    expect(ballotFor("77002")).toBeNull();
  });
});
