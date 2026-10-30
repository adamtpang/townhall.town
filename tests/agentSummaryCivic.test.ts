import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { marketBullet, measureBullet, censusBullet, factBullets, priceList, MARKET_LABEL } from "../lib/api/agent";

const tx37 = { contest: "U.S. Representative, District 37", leader: "Greg Casar", polymarketPricePct: 98, competitive: false, outcomes: [{ name: "Greg Casar", pct: 98 }, { name: "Lauren Peña", pct: 2 }], url: "https://polymarket.com/event/tx-37-house-election-winner" };
const prop42 = { contest: "Proposition 42 (Personal property taxes, Retroactive taxes)", leader: "Yes (passes)", polymarketPricePct: 51, competitive: true, outcomes: [{ name: "Yes (passes)", pct: 51 }, { name: "No (fails)", pct: 49 }], url: "https://polymarket.com/event/california-retroactive-tax-prohibition-proposition" };
const rent = { label: "Renters paying 30%+ of income on rent", value: "30.3%", unit: "%", stateValue: 51.7, table: "B25070", year: "ACS 2024 5-year (2020-2024)", source: { url: "https://censusreporter.org/data/table/?table=B25070&geo_ids=86000US78701" } };

describe("Civic summary23 P0 #1: market bullet shows every outcome, the label and the link", () => {
  it("widest-gap wording matches report line 186 exactly", () => {
    expect(marketBullet([tx37])!.text).toBe("- No contest has a top Polymarket price between 35% and 65%. Widest price gap: U.S. Representative, District 37. Polymarket prices (market price, not a poll or forecast): Greg Casar 98%, Lauren Peña 2%. Source: https://polymarket.com/event/tx-37-house-election-winner");
  });
  it("closest-contest wording matches report line 183 and states the rule", () => {
    const b = marketBullet([tx37, prop42])!;
    expect(b.text).toBe("- Closest contest on Polymarket (top price nearest 50%): Proposition 42 (Personal property taxes, Retroactive taxes). Polymarket prices (market price, not a poll or forecast): Yes (passes) 51%, No (fails) 49%. Source: https://polymarket.com/event/california-retroactive-tax-prohibition-proposition");
    expect(b.sourceUrl).toBe(prop42.url);
  });
  it("never 'lopsided', never a lone leader price", () => {
    for (const b of [marketBullet([tx37])!, marketBullet([prop42])!]) {
      expect(b.text).not.toMatch(/lopsided|leads at|has a leader/);
      expect(b.text).toContain(MARKET_LABEL);
      expect((b.text.match(/\d+%/g) ?? []).filter((x) => !/^(35|65|50)%$/.test(x)).length).toBeGreaterThanOrEqual(2);
    }
    expect(priceList(tx37)).toBe("Greg Casar 98%, Lauren Peña 2%");
  });
});

describe("Civic summary23 P0 #2: analyze() always uses factBullets, no model-written bullets", () => {
  const src = readFileSync("lib/api/agent.ts", "utf8");
  const body = src.slice(src.indexOf("async function analyze("), src.indexOf("export function factBullets("));
  it("analyze has no generateText call and returns factBullets", () => {
    expect(body).not.toMatch(/generateText|modelLadder/);
    expect(body).toMatch(/factBullets\(/);
    expect(body).toMatch(/model: "computed"/);
  });
});

describe("Civic summary23 P0 #3: Prop 42 title", () => {
  it("no 'Proposition 42 (Income taxes)' anywhere in data", () => {
    for (const f of ["data/ballots.json", "data/civic/grades_eligibility.json"]) {
      const s = readFileSync(f, "utf8");
      expect(s).not.toContain("Proposition 42 (Income taxes)");
    }
    expect(readFileSync("data/ballots.json", "utf8").split("Proposition 42 (Personal property taxes, Retroactive taxes)").length - 1).toBe(2);
  });
});

describe("Civic summary23 P0 #4: every bullet carries a source", () => {
  it("measure bullet has sourceUrl and whatChanges (report line 189)", () => {
    const b = measureBullet({ measure: "City of Austin Proposition A: Parks, recreation, aquatic and open space bonds", cost: "THIS IS A TAX INCREASE; ... $8.14.", sourceUrl: "https://services.austintexas.gov/edims/document.cfm?id=482565", whatChanges: "Authorizes bonds for parks." })!;
    expect(b.sourceUrl).toBe("https://services.austintexas.gov/edims/document.cfm?id=482565");
    expect(b.whatChanges).toBe("Authorizes bonds for parks.");
    expect(b.text).toMatch(/Official cost text: .* What it does: Authorizes bonds for parks\. Source: https:\/\/services\.austintexas\.gov/);
    expect(b.text).toMatch(/^- First measure on your ballot with an official cost figure: /);
  });
  it("census bullet: ZCTA, named state, one parenthesis level, Census source URL (P1 #6, P2 #11)", () => {
    const b = censusBullet(rent, "78701", "TX")!;
    expect(b.text).toBe("- Renters paying 30%+ of income on rent: 30.3% in ZIP code area (Census ZCTA) 78701, vs 51.7% in Texas (Census ACS 2024 5-year, 2020-2024, table B25070; the local metric farthest from the state figure). Source: https://censusreporter.org/data/table/?table=B25070&geo_ids=86000US78701");
    expect(b.sourceUrl).toBe(rent.source.url);
    expect(b.text).not.toMatch(/\([^)]*\(/);
    expect(censusBullet({ ...rent, value: "40.3%", stateValue: 52.1 }, "10001", "NY")!.text).toContain("in New York");
  });
  it("factBullets: every bullet has a sourceUrl and the URL is in its text", () => {
    const bs = factBullets({ contestsByMarket: [tx37], measuresWithCost: [{ measure: "M", cost: "C", sourceUrl: "https://example.gov/m", whatChanges: "W" }] }, censusBullet(rent, "78701", "TX"));
    expect(bs.map((b) => b.kind)).toEqual(["market", "measure", "census"]);
    for (const b of bs) { expect(b.sourceUrl).toMatch(/^https:\/\//); expect(b.text).toContain(b.sourceUrl!); }
  });
});

describe("Civic summary23 P1: verbatim official cost text", () => {
  const ms = JSON.parse(readFileSync("data/measures.json", "utf8"));
  const all: any[] = Array.isArray(ms) ? ms : Object.values(ms.measures ?? ms);
  const byId = (id: string) => all.find((m) => m.id === id);
  it("CA Prop 1 ties the yearly cost to the housing bond only", () => {
    expect(byId("ca-prop-1").cost.value).toBe("Authorizes $11.25 billion in state general obligation bonds. Fiscal Impact: Increased state cost of $500 million to $600 million annually for about 25 years to repay the housing bond.");
  });
  it("Austin Prop A is the voter information document text", () => {
    expect(byId("austin-prop-a").cost.value).toMatch(/^THIS IS A TAX INCREASE; the issuance of bonds in the amount of \$260,000,000 .* \$193,357,500\. .* \$453,357,500\. .* \$8\.14\. This figure assumes application of a homestead exemption of \$20,000\.$/);
  });
});

describe("Agent summary flag (NEXT_PUBLIC_SHOW_AGENT_SUMMARY), off by default", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it("is off when unset and on only for 1/true", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHOW_AGENT_SUMMARY", "");
    expect((await import("../lib/flags")).SHOW_AGENT_SUMMARY).toBe(false);
    vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_SHOW_AGENT_SUMMARY", "1");
    expect((await import("../lib/flags")).SHOW_AGENT_SUMMARY).toBe(true);
  });
  it("is gated server-side: off means no analyze step, empty narration, no summaryBullets", () => {
    const src = readFileSync("lib/api/agent.ts", "utf8");
    expect(src).toMatch(/SHOW_AGENT_SUMMARY \? await analyze\(/);
    expect(src).toMatch(/narration: SHOW_AGENT_SUMMARY \?[^\n]*: "",/);
    expect(src).toMatch(/summaryBullets: insight\?\.bullets \?\? \[\]/);
  });
  it("the getMarketOdds trace step never shows a price", () => {
    const src = readFileSync("lib/api/agent.ts", "utf8");
    const c = src.slice(src.indexOf('case "getMarketOdds"'), src.indexOf('case "getLocalProblems"'));
    expect(c).not.toMatch(/prob|%/);
  });
});
