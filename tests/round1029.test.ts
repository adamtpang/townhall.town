// Oct 29 2026 round: Polymarket only, Spanish visible, no serif, CANDIDATE_GRADES, QA 9dfe90d P2s, design p8.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getMarketOdds, MARKET_SLUGS, ballotFor } from "../lib/tools";
import { raceMeta, KALSHI_ONLY_DROPPED } from "../lib/raceMeta";
import { leaderLine, pctOf, fetchedCT } from "../lib/marketLine";
import { polymarketCloseness, marketCoversBallot } from "../lib/marketsCore.mjs";
import { CANDIDATE_GRADES, gradeFor, letterFor, GRADE_NOTE } from "../lib/grades.mjs";
import { overlapStatus } from "../lib/overlapCore.mjs";
import { stancesFor, ISSUES } from "../lib/issues";
import RaceTiers, { tierFor, MarketLine } from "../app/RaceTiers";
import EndScreen from "../app/EndScreen";
import { carryText } from "../app/TownyInterview";
import { sourceLabel } from "../app/TownyResearch";
import { JUDICIAL_RULES } from "../lib/judicial";
import { measuresFor } from "../lib/measures";
import { openApiSpec } from "../lib/openapi";

const src = (p: string) => fs.readFileSync(p, "utf8");
const Q = (prob: number, extra: Partial<{ url: string; fetchedAt: string }> = {}) => ({
  source: "Polymarket" as const, title: "Texas Senate Election Winner", url: "https://polymarket.com/event/texas-senate-election-winner",
  api: "https://gamma-api.polymarket.com/events?slug=texas-senate-election-winner",
  outcomes: [{ name: "Candidate A", prob }, { name: "Candidate B", prob: 1 - prob }], fetchedAt: "2026-10-30T03:58:00Z", ...extra,
});

describe("Polymarket only (Kalshi dropped)", () => {
  it("live quote, failed fetch and no market are three distinct statuses; no numbers without a live market", async () => {
    const ok = await getMarketOdds(["us-senate-tx", "tx-comptroller"], async () => ({ ...Q(0.6), listed: ["James Talarico", "Ken Paxton", "Ted Brown", "Other"] }));
    expect(ok["us-senate-tx"].status).toBe("live");
    expect(ok["us-senate-tx"].quotes).toHaveLength(1);
    expect(ok["tx-comptroller"]).toEqual({ quotes: [], status: "no market found" });
    const down = await getMarketOdds(["us-senate-tx"], async () => { throw new Error("timeout"); });
    expect(down["us-senate-tx"]).toEqual({ quotes: [], status: "unavailable" });
  });
  it("every mapped id is a real race or measure id in a covered ZIP; Kalshi appears nowhere served", () => {
    const ids = new Set<string>();
    for (const z of ["78701", "94103", "10001"]) { const b = ballotFor(z)!; b.races.forEach((r: { id: string }) => ids.add(r.id)); (b.measures ?? []).forEach((m: { id: string }) => ids.add(m.id)); measuresFor(z).forEach((m) => ids.add(m.id)); }
    for (const id of Object.keys(MARKET_SLUGS)) expect(ids.has(id), id).toBe(true);
    expect(Object.keys(MARKET_SLUGS)).not.toContain("ca-11");
    for (const f of ["lib/tools.ts", "lib/marketsCore.mjs", "lib/api/agent.ts", "lib/openapi.ts", "lib/content.ts", "lib/llms.ts", "app/RaceTiers.tsx", "app/BallotAgent.tsx", "README.md"]) expect(src(f), f).not.toMatch(/kalshi/i);
    expect(JSON.stringify(openApiSpec())).not.toMatch(/kalshi/i);
    expect(fs.existsSync("data/markets-cache.json")).toBe(false);
  });
  it("a candidate-race market is shown only if every ballot candidate appears in it", async () => {
    // Real Polymarket lists (Oct 29 2026). ca-ltgov: has Kellman and Fryday, leaves out Romero -> hidden.
    const ltgov = ["Rakesh Christian", "Josh Fryday", "Janelle Kellman", "Fiona Ma", "Michael Tubbs", "Option B", "Other"];
    expect(marketCoversBallot(ltgov, ["Fiona Ma", "Gloria Romero"])).toBe(false);
    expect(marketCoversBallot(["Lauren Peña", "Greg Casar", "Other"], ["Greg Casar", "Lauren B. Peña"])).toBe(true);
    expect(marketCoversBallot(["Kathy Hochul", "Bruce Blakeman"], ["Kathy C. Hochul / Adrienne E. Adams", "Bruce A. Blakeman / Todd Hood"])).toBe(true);
    expect(marketCoversBallot(["Manny Yekutiel", "Gary McCoy"], ['Emanuel "Manny" Yekutiel', "Gary McCoy"])).toBe(true);
    expect(marketCoversBallot(["James Talarico", "Ken Paxton", "Person A", "Other"], ["James Talarico", "Ken Paxton", "Ted Brown"])).toBe(false);
    expect(marketCoversBallot(["Yes (passes)", "No (fails)"], [])).toBe(true); // measures: no candidates to check
    // Through getMarketOdds: a market missing a ballot candidate returns no quote and no numbers.
    const q = { ...Q(0.6), listed: ["James Talarico", "Ken Paxton", "Other"] };
    const r = await getMarketOdds(["us-senate-tx"], async () => q);
    expect(r["us-senate-tx"]).toEqual({ quotes: [], status: "market does not list every ballot candidate" });
    const full = await getMarketOdds(["us-senate-tx"], async () => ({ ...q, listed: ["James Talarico", "Ken Paxton", "Ted Brown"] }));
    expect(full["us-senate-tx"].status).toBe("live");
    // ca-ltgov's market is not mapped at all, so it can never show a line.
    expect(MARKET_SLUGS["ca-ltgov"]).toBeUndefined();
    expect((await getMarketOdds(["ca-ltgov"], async () => { throw new Error("should not fetch"); }))["ca-ltgov"].status).toBe("no market found");
  });
  it("sourced race ratings are back (Cook, Sabato, Inside Elections), never Kalshi; Kalshi-only ratings are dropped", () => {
    const sen = raceMeta("78701", "us-senate-tx")!;
    expect(sen.closeness).toBe("Competitive");
    expect(sen.closenessBasis.map((b) => b.label)).toEqual(["Cook Political Report", "Sabato's Crystal Ball", "Inside Elections"]);
    expect(raceMeta("78701", "tx-gov")!.closeness).toBe("Competitive");
    expect(raceMeta("94103", "ca-gov")!.closeness).toBe("Not closely contested");
    for (const z of ["78701", "94103", "10001"]) for (const r of ballotFor(z)!.races as unknown as { id: string; meta?: { closenessBasis: { label: string; url: string }[] } }[]) {
      for (const b of r.meta?.closenessBasis ?? []) { expect(JSON.stringify(b), r.id).not.toMatch(/kalshi/i); expect(b.url).toMatch(/^https:\/\/(www\.cookpolitical\.com|centerforpolitics\.org|insideelections\.com)\//); }
    }
    expect(KALSHI_ONLY_DROPPED.map((d) => d.raceId).sort()).toEqual(["ca-ag", "ca-insurance", "ca-ltgov", "ca-sos", "ny-attorney-general", "sf-supervisor-8", "tx-agcomm", "tx-rrc"]);
    for (const d of KALSHI_ONLY_DROPPED) expect(raceMeta(d.zip, d.raceId)?.closeness ?? "No rating", d.raceId).toBe("No rating");
  });
  it("closeness: Competitive only when the top contract is 35%-65%", () => {
    expect(polymarketCloseness(Q(0.65))).toBe("Competitive");
    expect(polymarketCloseness(Q(0.35 + 0.3))).toBe("Competitive");
    expect(polymarketCloseness(Q(0.8))).toBe("Not closely contested");
    expect(polymarketCloseness(null)).toBe("No market data");
  });
  it("tier: sourced rating ranks the race; Polymarket can raise it but never lower it", () => {
    const bare = { id: "us-senate-tx", title: "U.S. Senator", level: "federal" };
    expect(tierFor(bare as never, Q(0.55) as never).tier).toBe("most"); // Polymarket adds
    expect(tierFor(bare as never, Q(0.9) as never).tier).toBe("high");
    expect(tierFor(bare as never, null).tier).toBe("high");
    const rated = { ...bare, meta: raceMeta("78701", "us-senate-tx") };
    expect(tierFor(rated as never, null).tier).toBe("most");
    expect(tierFor(rated as never, Q(0.9) as never).tier).toBe("most"); // a lopsided market does not replace the rating
  });
  it("leader line: name, percent, market link and fetch time in CT; null without a live quote", () => {
    const l = leaderLine(Q(0.62))!;
    expect(l).toMatchObject({ name: "Candidate A", pct: "62%", url: "https://polymarket.com/event/texas-senate-election-winner" });
    expect(l.fetched).toBe("Oct 29, 10:58 PM CT");
    expect(leaderLine(null)).toBeNull();
    expect(leaderLine({ ...Q(0.6), outcomes: [] } as never)).toBeNull();
    expect(leaderLine({ ...Q(0.6), source: "Kalshi" } as never)).toBeNull();
    expect(pctOf(0.999)).toBe(">99%"); expect(pctOf(0.001)).toBe("<1%");
    expect(fetchedCT("nope")).toBe("");
    const html = renderToStaticMarkup(h(MarketLine, { line: l }));
    expect(html).toContain("Leader on Polymarket:");
    expect(html).toContain('href="https://polymarket.com/event/texas-senate-election-winner"');
    expect(html).toMatch(/Fetched Oct 29, 10:58 PM CT/);
    expect(html).toMatch(/not a forecast or a recommendation/);
    expect(renderToStaticMarkup(h(MarketLine, { line: null }))).toBe("");
  });
  it("RaceTiers shows a leader line only for races with a live quote, and links each sourced rating", () => {
    const b = ballotFor("78701")!;
    const html = renderToStaticMarkup(h(RaceTiers, { races: b.races as never, market: (id: string) => (id === "us-senate-tx" ? Q(0.55) : null) as never }));
    expect(html.match(/data-market-line/g)?.length).toBe(1);
    expect(html).toContain('href="https://www.cookpolitical.com/ratings/senate-race-ratings"');
    expect(html).toMatch(/Cook Political Report rating ↗/);
    expect(html).toMatch(/Sabato&#x27;s Crystal Ball rating ↗/);
    expect(html).not.toMatch(/kalshi/i);
    expect(html).toMatch(/Polymarket can move a race up, never down/);
  });
  it("measures get a Yes/No leader line from the market", () => {
    const m = measuresFor("94103")[0];
    const q = { ...Q(0.7), outcomes: [{ name: "Yes (passes)", prob: 0.7 }, { name: "No (fails)", prob: 0.3 }] };
    const html = renderToStaticMarkup(h(RaceTiers, { races: [], measures: [m], market: (id: string) => (id === m.id ? q : null) as never }));
    expect(html).toMatch(/Leader on Polymarket: <span[^>]*>Yes \(passes\)<\/span> at 70%/);
  });
});

describe("CANDIDATE_GRADES (issue overlap, preview only)", () => {
  const ok = (agree: number, n: number) => ({ status: "ok", agree, n });
  it("is a single constant, on for this preview", () => {
    expect(CANDIDATE_GRADES).toBe(true);
    expect(src("lib/grades.mjs").match(/export const CANDIDATE_GRADES = (true|false);/g)).toHaveLength(1);
  });
  it("S/A/B/C from agreement share", () => {
    expect(letterFor(4, 4)).toBe("S"); expect(letterFor(3, 4)).toBe("A"); expect(letterFor(2, 4)).toBe("B"); expect(letterFor(1, 4)).toBe("C");
    expect(letterFor(0, 0)).toBeNull();
  });
  it("no grade without sourced positions, before any answer, for judicial races, or when the flag is off", () => {
    expect(gradeFor({ status: "few", agree: 0, n: 0 }, false)).toBeNull();
    expect(gradeFor({ status: "answer", agree: 1, n: 1 }, false)).toBeNull();
    expect(gradeFor(ok(2, 2), true)).toBeNull();
    expect(gradeFor(ok(2, 2), false, 0)).toBeNull();
    expect(gradeFor(ok(2, 2), false, 1, false)).toBeNull();
    expect(gradeFor(ok(2, 2), false, 1)).toBe("S");
  });
  it("EndScreen: grades labelled as issue overlap, ballot order kept, 'Not enough sourced positions' otherwise, no 'best'/'vote for'", () => {
    const allYes = Object.fromEntries(ISSUES.map((i) => [i.id, 5]));
    const ids = ISSUES.map((i) => i.id);
    let graded = 0;
    for (const z of ["78701", "94103", "10001"]) {
      const b = ballotFor(z)!;
      const html = renderToStaticMarkup(h(EndScreen, { zip: z, races: b.races as never, answers: allYes, ids, answered: ids.length }));
      // Our own words only: candidates' sourced quotes and Ballotpedia survey summaries may say "best".
      expect(html.replace(/“[^”]*”/g, "").replace(/data-bp-summary="true">Ballotpedia summary:<\/span>[^<]*/g, "")).not.toMatch(/\b(best|vote for)\b/i);
      for (const r of b.races as unknown as { id: string; judicial?: unknown; candidates: { name: string }[] }[]) {
        const block = html.split(`data-race="${r.id}"`)[1]?.split(/data-race="|data-race-none-list/)[0];
        if (!block) continue;
        if (r.judicial) expect(block).not.toMatch(/data-grade/);
        // Ballot order: candidates appear in the order given.
        const shown = [...block.matchAll(/data-overlap="([^"]+)"/g)].map((m) => m[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
        expect(shown).toEqual(r.candidates.map((c) => c.name).filter((n) => shown.includes(n)));
        for (const c of r.candidates) {
          const o = overlapStatus(allYes, stancesFor(c.name), ids);
          const g = gradeFor(o, !!r.judicial, ids.length);
          if (g) { graded++; expect(html).toContain(`data-grade="${g}"`); }
          if (o.status === "few" && shown.includes(c.name)) {
            const li = block.split(/data-overlap="/).find((x) => x.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").startsWith(c.name + '"'))!;
            expect(li).toMatch(/Not enough sourced positions/);
            expect(li).not.toMatch(/data-grade/);
          }
        }
      }
      for (const m of html.matchAll(/data-grade="[SABC]"[^>]*>(.*?)<\/p>/g)) expect(m[1]).toContain(GRADE_NOTE);
    }
    expect(graded).toBeGreaterThan(0);
  });
  it("no grade before any Yes/No answer, and the API never carries letters", () => {
    const b = ballotFor("94103")!;
    const html = renderToStaticMarkup(h(EndScreen, { zip: "94103", races: b.races as never, answers: {}, ids: ISSUES.map((i) => i.id), answered: 0 }));
    expect(html).not.toMatch(/data-grade/);
    for (const f of ["lib/tools.ts", "lib/api/agent.ts", "lib/openapi.ts", "app/api/research/route.ts", "lib/v1.ts"].filter((f) => fs.existsSync(f))) expect(src(f), f).not.toMatch(/grades\.mjs|gradeFor|CANDIDATE_GRADES/);
  });
});

describe("Spanish visible, no serif", () => {
  it("toggle defaults on; NEXT_PUBLIC_SPANISH=0 is the only way off; key chrome goes through t()", () => {
    expect(src("lib/i18n.tsx")).toContain('process.env.NEXT_PUBLIC_SPANISH !== "0"');
    expect(src("app/BallotAgent.tsx")).toMatch(/placeholder=\{t\("Enter your ZIP"\)\}/);
    expect(src("app/page.tsx")).toContain("<T>Know your ballot in 2 minutes.</T>");
  });
  it("no serif font anywhere; Inter Tight 450/530 files only", () => {
    for (const f of fs.readdirSync("app", { recursive: true }) as string[]) if (/\.(tsx|ts|css)$/.test(f)) expect(src(`app/${f}`), f).not.toMatch(/font-serif|Instrument|Georgia|Times New Roman/);
    expect(fs.readdirSync("assets/fonts").filter((f) => f.endsWith(".ttf")).sort()).toEqual(["InterTight-450.ttf", "InterTight-530.ttf"]);
    expect(src("app/opengraph-image.tsx")).toMatch(/fontFamily: "Inter Tight"/);
  });
});

describe("QA 9dfe90d P2 + design p8", () => {
  it("carry-over notice is body text and names the other ZIP", () => {
    expect(carryText(3, "94103", "78701")).toBe("Your 3 saved answers came from another ZIP (78701) and are filled in below. Change any of them, or use Reset my answers.");
    expect(carryText(1, "94103", "94103")).toMatch(/^Your 1 saved answer from your last visit for 94103 is filled in below/);
    expect(carryText(2, "94103", null)).toMatch(/earlier visit in this browser, possibly for another ZIP/);
    expect(src("app/TownyInterview.tsx")).toMatch(/className="mb-3 text-base leading-6 text-black" data-carryover/);
  });
  it("every research quote has a source label (own site or the outlet that quoted them)", () => {
    expect(sourceLabel({ url: "https://www.cbsnews.com/sanfrancisco/news/x", ownSite: false })).toBe("(quoted on cbsnews.com)");
    expect(sourceLabel({ url: "https://www.xavierbecerra2026.com/priorities/", ownSite: true })).toBe("(from their own site)");
    expect(src("app/TownyResearch.tsx")).toMatch(/data-research-source>\{sourceLabel\(c\)\}/);
  });
  it("TX Canon 5 links the current Code of Judicial Conduct, clearly labelled", () => {
    expect(JUDICIAL_RULES.tx[1]).toBe("https://www.txcourts.gov/media/1462935/texas-state-code-of-judicial-conduct.pdf");
    expect(JUDICIAL_RULES.tx[2]).toMatch(/^Texas Code of Judicial Conduct, Canon 5/);
    expect(src("lib/judicial.ts")).not.toContain("All_Archived_Documents");
  });
  it("race and measure titles are h3 with the H3 token; no 11-12px text", () => {
    const s = src("app/RaceTiers.tsx");
    expect(s).toContain("<h3 className={H3} data-race-title>");
    expect(s).toMatch(/<h3 className="[^"]*" data-measure-title>/);
    for (const f of ["app/RaceTiers.tsx", "app/EndScreen.tsx", "app/TownyResearch.tsx", "app/IssueMatch.tsx", "app/TownyInterview.tsx", "components/PortraitRow.tsx", "app/card/BallotCard.tsx"]) expect(src(f), f).not.toMatch(/\btext-xs\b|text-\[1[0-2]px\]/);
    expect(src("tailwind.config.ts")).not.toMatch(/"1[0-2]px"/);
  });
  it("names: one line with ellipsis, full name in title; tiles equal height", () => {
    const s = src("components/PortraitRow.tsx");
    expect(s).toMatch(/truncate text-sm font-\[530\] leading-5" title=\{c\.name\}/);
    expect(s).toContain("data-tile-mate-spacer");
    expect(s).toContain("flex-nowrap");
  });
  it("design p8: 45ch line length, calendar links 44px tall, hero capped, footer headings h3", () => {
    expect(src("app/RaceTiers.tsx")).not.toContain("65ch");
    expect(src("components/Prose.tsx")).not.toContain("65ch");
    expect(src("app/EndScreen.tsx")).toContain('flex flex-col items-start gap-0 text-sm" data-cal-links');
    expect(src("app/EndScreen.tsx").match(/inline-flex min-h-11 items-center[^"]*" data-(ics|gcal-early|dates-source)/g)?.length).toBe(3);
    expect(src("app/page.tsx")).toContain("level={3}");
    expect(src("components/Prose.tsx")).toMatch(/text-base font-\[530\]/);
  });
  it("NYC banner says draft, matching the source notes", () => {
    expect(src("app/RaceTiers.tsx")).toContain("Draft: from the NYC Board of Elections&rsquo; draft contest list");
    expect(src("app/RaceTiers.tsx")).not.toMatch(/tentative contest list/);
  });
});
