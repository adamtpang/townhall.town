// feat/finance (Oct 30): PR #32 party + FEC money, with Civic finance_fixes18 data and QA main-bbcc940 fixes.
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import finance from "../data/finance.json";
import { ballotFor } from "../lib/tools";
import { VERIFIED_FEC_IDS, withMoney } from "../lib/money";
import { usd, usdCash, reportLabel, fecIdOf, isFederalRace } from "../lib/fec";
import { fmtDay, ES_FOR_TEST } from "../lib/i18n";
import RaceTiers, { FinanceRow, showFinanceFor } from "../app/RaceTiers";
import { SHOW_FINANCE } from "../lib/flags";

const CIVIC = JSON.parse(fs.readFileSync(new URL("./fixtures/finance_fixes18.json", import.meta.url), "utf8").toString()) as never as never[];
type Row = { raised: number; cashOnHand: number; coverageThrough: string; lastReport: string; note?: string; verified?: string; source: { url: string } };
const C = (finance as unknown as { candidates: Record<string, Row> }).candidates;

// Pinned exactly as Civic's finance_fixes18 (Ortiz: processed FEC totals through 06-30, per Adam's brief).
const PIN: Record<string, [string, number, number, string, string]> = {
  S6TX00479: ["James Talarico", 146349912.38, 9922857.4, "2026-10-14", "PRE-GENERAL"],
  S6TX00388: ["Ken Paxton", 22327473.92, 4784408.3, "2026-10-14", "PRE-GENERAL"],
  S4TX00888: ["Ted Brown", 14257.28, 1288.35, "2026-10-14", "PRE-GENERAL"],
  H6TX31102: ["Caitlin Rourk", 576475.06, 79336.45, "2026-10-14", "PRE-GENERAL"],
  H6TX10221: ["Chris Gober", 3103392.03, 165564.77, "2026-10-14", "PRE-GENERAL"],
  H2TX35144: ["Greg Casar", 1382791.38, 544085.42, "2026-10-14", "PRE-GENERAL"],
  H6TX35038: ["Lauren Peña", 132161.88, 4453.73, "2026-10-14", "PRE-GENERAL"],
  H6CA11268: ["Connie Chan", 2404664.18, 581804.91, "2026-10-14", "PRE-GENERAL"],
  H8CA11116: ["Scott Wiener", 5808855.03, 611039.24, "2026-10-14", "PRE-GENERAL"],
  H6NY12172: ["Micah Lasher", 3493973.6, 309209.29, "2026-10-14", "PRE-GENERAL"],
  H6NY12404: ["Caroline Shinkle", 272962.88, 126423.53, "2026-10-14", "PRE-GENERAL"],
  H6NY12313: ["Wilneida Negron", 57807.2, 6086.87, "2026-09-30", "OCTOBER QUARTERLY"],
  H6NY12297: ["Karen Ortiz", 46267.96, 23468.52, "2026-06-30", "JULY QUARTERLY"],
};
const ZIPS = ["78701", "94103", "10001"];
const federal = (zip: string) => ballotFor(zip)!.races.filter((r) => isFederalRace(r as never));
const html = (zip: string) => renderToStaticMarkup(h(RaceTiers, { races: ballotFor(zip)!.races as never, market: () => null as never, zip }));

describe("data/finance.json: Civic finance_fixes18", () => {
  it("exactly the 13 Civic rows are verified, with Civic's ids and figures to the cent", () => {
    expect(VERIFIED_FEC_IDS.sort()).toEqual(Object.keys(PIN).sort());
    for (const [id, [, raised, coh, thr, rep]] of Object.entries(PIN)) {
      expect(C[id], id).toMatchObject({ raised, cashOnHand: coh, coverageThrough: thr, lastReport: rep });
      expect(C[id].source.url).toBe(`https://www.fec.gov/data/candidate/${id}/?cycle=2026`);
    }
  });
  it("matches Civic's JSON for every row except Ortiz (processed fallback) and Paxton (label)", () => {
    expect(CIVIC.length).toBe(13);
    for (const r of CIVIC as unknown as { fecId: string; receipts: number; cashOnHand: number; coverageEndDate: string; reportUsed: string }[]) {
      if (r.fecId === "H6NY12297") continue;
      expect(C[r.fecId].raised).toBe(r.receipts);
      expect(C[r.fecId].cashOnHand).toBe(r.cashOnHand);
      expect(C[r.fecId].coverageThrough).toBe(r.coverageEndDate);
      if (r.fecId !== "S6TX00388") expect(C[r.fecId].lastReport).toBe(r.reportUsed);
    }
  });
  it("Ted Brown is S4TX00888 (S6TX00594 is a different person); Paxton is PRE-GENERAL; Ortiz carries Civic's note", () => {
    expect(C.S6TX00594).toBeUndefined();
    expect(C.S6TX00388.lastReport).toBe("PRE-GENERAL");
    expect(C.H6NY12297.note).toBe("A newer filing (Oct 30) is not yet processed by FEC.");
    expect(JSON.stringify(finance)).not.toContain("TERMINATION REPORT\",\n   \"committee\": {\n    \"id\": \"C00901918");
  });
  it("Lauren B. Peña resolves to H6TX35038 even though the ballot only has an FEC search link", () => {
    expect(fecIdOf({ name: "Lauren B. Peña", finance: { url: "https://www.fec.gov/data/candidates/?search=Lauren%20Pe%C3%B1a" } })).toBe("H6TX35038");
  });
});

describe("only checked rows render", () => {
  it("unchecked rows (Minton, Ngabo, Hart, Stoker, Hook, Tijerina, Flores) never attach money", () => {
    for (const [id, row] of Object.entries(C)) {
      if (row.verified) continue;
      const p = withMoney({ name: "x", finance: { label: "FEC", url: `https://www.fec.gov/data/candidate/${id}/` } } as never) as { money?: unknown };
      expect(p.money, id).toBeUndefined();
    }
  });
  it("every money figure on the 3 ballots is one of Civic's 13, and none appears outside federal races", () => {
    for (const zip of ZIPS) {
      for (const r of ballotFor(zip)!.races) for (const c of r.candidates as { name: string; money?: { raised: number } }[]) {
        if (!c.money) continue;
        expect(isFederalRace(r as never), `${zip} ${r.id} ${c.name}`).toBe(true);
        expect(Object.values(PIN).some((p) => p[1] === c.money!.raised)).toBe(true);
      }
      const out = html(zip);
      for (const n of ["Minton", "Ngabo", "Rhonda Hart", "Stoker", "Kristin Hook", "Tijerina", "Eric Flores"]) expect(out).not.toContain(n);
    }
  });
  it("finance renders on federal races in the 3 ZIPs only", () => {
    const fed = { id: "tx-10", title: "U.S. House", level: "federal", candidates: [{ name: "A" }] };
    expect(showFinanceFor(fed as never, "78701")).toBe(SHOW_FINANCE);
    expect(showFinanceFor(fed as never, "77002")).toBe(false);
    expect(showFinanceFor(fed as never, undefined)).toBe(false);
    expect(showFinanceFor({ ...fed, id: "tx-sen-14", level: "state" } as never, "78701")).toBe(false);
    for (const zip of ZIPS) {
      // SSR shows Most/High tiers (Moderate/Lower sit behind "Show all"): every rendered federal race has a finance row,
      // and no other race does.
      const fedTitles = new Set(federal(zip).map((r) => r.title));
      const parts = html(zip).split(/data-race-title="true">/).slice(1);
      let n = 0;
      for (const part of parts) {
        const title = part.slice(0, part.indexOf("</h3>")).replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
        const has = /data-finance="true"/.test(part.split(/<h3 /)[0]);
        expect(has, `${zip} ${title}`).toBe(fedTitles.has(title));
        n += has ? 1 : 0;
      }
      if (zip === "78701") expect(n, zip).toBeGreaterThan(0); // CA-11 and NY-12 sit behind "Show all" in SSR; covered by the browser check
    }
  });
});

describe("FinanceRow per candidate (QA P1s)", () => {
  it("SHOW_FINANCE defaults on; '0' is the off switch", () => {
    expect(SHOW_FINANCE).toBe(process.env.NEXT_PUBLIC_SHOW_FINANCE !== "0");
    expect(fs.readFileSync("lib/flags.ts", "utf8")).toContain('process.env.NEXT_PUBLIC_SHOW_FINANCE !== "0"');
  });
  it("every federal candidate shows money with their own date and their own fec.gov page; party is the ballot's", () => {
    for (const zip of ZIPS) for (const r of federal(zip)) {
      const out = renderToStaticMarkup(h(FinanceRow, { r: r as never }));
      for (const c of r.candidates as { name: string; party?: string; money?: Row }[]) {
        const id = fecIdOf(c as never)!;
        expect(id, c.name).toBeTruthy();
        expect(c.money, `${zip} ${c.name}`).toBeTruthy();
        expect(c.money!.raised).toBe(PIN[id][1]);
        expect(out).toContain(`href="https://www.fec.gov/data/candidate/${id}/"`);
        expect(out).toContain(`data-through="${PIN[id][3]}"`);
        expect(out).toContain(c.party ?? "Party: unsure");
      }
      expect(out).not.toMatch(/REPUBLICAN PARTY|DEMOCRATIC PARTY|LIBERTARIAN PARTY|\bIDP\b|\bIND\b/);
    }
  });
  it("cash on hand under $10K renders to the dollar (Peña $4,454, Ted Brown $1,288, Negron $6,087)", () => {
    const row = (zip: string, id: string) => renderToStaticMarkup(h(FinanceRow, { r: federal(zip).find((x) => x.id === id) as never }));
    expect(row("78701", "tx-37")).toContain('data-coh="true">$4,454<');
    expect(row("78701", "us-senate-tx")).toContain('data-coh="true">$1,288<');
    expect(row("10001", "ny-12")).toContain('data-coh="true">$6,087<');
    expect(row("10001", "ny-12")).toContain('data-coh="true">$23K<');
  });
  it("the FEC report label (lastReport) shows under the through date when the data has it", () => {
    expect(reportLabel("PRE-GENERAL")).toBe("Pre-general report");
    expect(reportLabel("OCTOBER QUARTERLY")).toBe("October quarterly report");
    expect(reportLabel("JULY QUARTERLY")).toBe("July quarterly report");
    expect(reportLabel("YEAR-END")).toBe("Year-end report");
    expect(reportLabel(null)).toBeNull();
    const ny = renderToStaticMarkup(h(FinanceRow, { r: federal("10001").find((x) => x.id === "ny-12") as never }));
    expect(ny).toContain('data-last-report="PRE-GENERAL">Pre-general report<');
    expect(ny).toContain('data-last-report="OCTOBER QUARTERLY">October quarterly report<');
    expect(ny).toContain('data-last-report="JULY QUARTERLY">July quarterly report<');
    for (const zip of ZIPS) for (const r of federal(zip)) {
      const out = renderToStaticMarkup(h(FinanceRow, { r: r as never }));
      expect((out.match(/data-last-report=/g) ?? []).length, r.id).toBe((r.candidates as { money?: Row }[]).filter((c) => c.money?.lastReport).length);
    }
  });
  it("race list: money columns use the photo row's tracks and gaps so each figure sits under its portrait", () => {
    const out = html("78701");
    const sen = out.split(/<h3 /).find((p) => p.includes("U.S. Senate"))!;
    const photo = sen.match(/<ul role="list" aria-label="Candidates"[^>]*>/)![0];
    const money = sen.match(/<ul[^>]*data-finance-align="portraits"[^>]*>/)![0];
    expect(photo).toContain("grid-template-columns:repeat(3, minmax(0, var(--tile-max)))");
    expect(money).toContain("grid-template-columns:repeat(3, minmax(0, var(--tile-max)))");
    for (const k of ["[--tile-max:72px]", "md:[--tile-max:88px]", "lg:[--tile-max:112px]", "gap-x-2", "md:gap-x-3", "lg:gap-x-4", "justify-start"]) expect(money).toContain(k);
    expect(photo).toMatch(/gap-2 .*md:gap-3 .*lg:gap-4/);
    // Who lines up has no photo row above the money, so it keeps the two-up grid.
    expect(renderToStaticMarkup(h(FinanceRow, { r: federal("78701")[0] as never }))).toContain('data-finance-align="grid"');
  });
  it("below sm: race-list money is a full-width divide-y list, one line per candidate in portrait order; columns from sm", () => {
    for (const zip of ZIPS) {
      const out = html(zip);
      for (const part of out.split(/<h3 /).slice(1)) {
        if (!part.includes("data-finance")) continue;
        const before = part.split("data-money-list")[0];
        const tiles = [...before.matchAll(/aria-label="([^"]+)" data-tile-label/g)].map((x) => x[1]);
        const list = part.match(/<div class="my-2 sm:hidden" data-money-list="true">[\s\S]*?<\/ul>/)![0];
        expect(list).toContain("divide-y");
        const lines = [...list.matchAll(/data-money-line="([^"]+)"/g)].map((x) => x[1]);
        expect(lines.length).toBeGreaterThan(0);
        expect(lines).toEqual(tiles);
        expect(list).not.toMatch(/text-xs|text-\[1[0-3]px\]/);
        expect((list.match(/data-line-fec/g) ?? []).length).toBe(lines.length);
        expect(list).toMatch(/tabular-nums/);
        const cols = part.match(/<ul[^>]*data-finance-align="[^"]+"[^>]*>/)![0];
        expect(cols).toContain("hidden sm:grid");
      }
    }
  });
  it("money list: one line per row; amount is the FEC link; differing dates get a marker explained in one caption", () => {
    const r = federal("10001").find((x) => x.id === "ny-12")!;
    const out = renderToStaticMarkup(h(FinanceRow, { r: r as never, align: true }));
    const list = out.match(/data-money-list="true">[\s\S]*?<\/ul>/)![0];
    const lines = [...out.matchAll(/data-money-line="([^"]+)"/g)].map((x) => x[1]);
    expect(lines).toEqual(r.candidates!.map((c: { name: string }) => c.name.replace(/&/g, "&amp;")));
    // No through date or report text on any line; markers only on the differing rows, * then dagger per distinct date.
    expect(list).not.toMatch(/>[^<]*through [A-Z]|>[^<]*quarterly report|>[^<]*Pre-general report/);
    expect(list).not.toContain("data-line-through");
    const marks = [...list.matchAll(/data-line-mark="([^"]+)">([^<]+)</g)].map((x) => [x[1], x[2]]);
    expect(marks).toEqual([["2026-09-30", "*"], ["2026-06-30", "\u2020"]]);
    expect(list).toMatch(/class="align-super text-sm leading-none" data-line-mark/);
    // Each line is a single 44px flex row: name truncates rather than wrapping.
    for (const li of list.match(/<li [^>]*>/g)!) expect(li).toContain("flex min-h-11 min-w-0 items-center justify-between");
    expect(list).toMatch(/class="min-w-0 truncate font-\[530\] text-black\/80" title="Karen Ortiz">Karen Ortiz</);
    // Full details stay on the FEC link (title + aria-label): raised, cash, through date, report, new tab.
    expect(list).toContain('aria-label="Wilneida Negron: Raised $58K, Cash on hand $6,087, through Sep 30, 2026, October quarterly report. FEC page (opens in a new tab)"');
    expect(list).toContain('title="Karen Ortiz: Raised $46K, Cash on hand $23K, through Jun 30, 2026, July quarterly report. FEC page (opens in a new tab)"');
    expect(list).toContain('title="Micah C. Lasher: Raised $3.5M, Cash on hand $309K, through Oct 14, 2026, Pre-general report. FEC page (opens in a new tab)"');
    // Caption block (space-y-1): caption, then one line per footnote; Ortiz's note sits on her (†) line.
    const cap = out.match(/<div class="([^"]+)" data-money-list-caption="true">([\s\S]*?)<\/div>/)!;
    expect(cap[1]).toBe("mt-1 space-y-1 text-sm leading-5 text-black/60");
    const capLines = [...cap[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
    expect(capLines).toEqual([
      "Raised, FEC filings through Oct 14, 2026.",
      "* Through Sep 30, 2026.",
      "\u2020 Through Jun 30, 2026. Karen Ortiz: newer Oct 30 filing not yet processed by FEC.",
    ]);
    // The separate "Campaign money from FEC filings." line is sm-up only next to the list.
    expect(out).toMatch(/class="mb-2 text-sm text-black\/60 hidden sm:block" data-finance-caption="true">Campaign money from FEC filings\.</);
    // Who lines up (no align) has no list and keeps its caption at every width.
    const who = renderToStaticMarkup(h(FinanceRow, { r: r as never }));
    expect(who).not.toContain("data-money-list");
    expect(who).toMatch(/class="mb-2 text-sm text-black\/60" data-finance-caption/);
  });
  it("money list: a race where every filing shares a date has no markers and a one-sentence caption", () => {
    for (const zip of ["78701", "94103"]) for (const r of federal(zip)) {
      const out = renderToStaticMarkup(h(FinanceRow, { r: r as never, align: true }));
      expect(out, r.id).not.toContain("data-line-mark");
      expect(out.match(/data-money-list-caption="true"><p>([\s\S]*?)<\/p>/)![1], r.id).toBe("Raised, FEC filings through Oct 14, 2026.");
    }
  });
  it("race list below sm: links stack as 44px rows; photo credits collapse into one disclosure after the links", () => {
    const out = html("78701");
    const sen = out.split(/<h3 /).find((p) => p.includes("U.S. Senate"))!;
    const links = sen.match(/<p class="([^"]+)" data-race-links="true">([\s\S]*?)<\/p>/)!;
    expect(links[1]).toBe("flex flex-col items-start text-sm leading-5 text-black/60 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1");
    const as = [...links[2].matchAll(/<a [^>]*class="([^"]+)"[^>]*>([^<]+)/g)];
    expect(as.map((a) => a[2])).toEqual(expect.arrayContaining(["Source ↗", "Cook Political Report ↗"]));
    for (const a of as) expect(a[1]).toMatch(/^relative z-\[1\] inline-flex min-h-11 items-center$/);
    expect(links[2]).not.toMatch(/<span aria-hidden="true">·/); // dots are sm-up only
    // Credits: sm-up line unchanged under the photo row; phones get "Photo credits (N)" right after the links.
    expect(sen).toMatch(/<div class="hidden sm:block" data-credits-sm="true"><div class="-mt-1 mb-2"><div class="md:flex/);
    const after = sen.slice(sen.indexOf("data-race-links"));
    const d = after.match(/<details class="group\/pc sm:hidden" data-phone-credits="(\d+)"><summary class="([^"]+)">Photo credits \((\d+)\)/)!;
    expect(after.indexOf("data-phone-credits")).toBeLessThan(after.indexOf("data-office"));
    expect(d[2]).toContain("inline-flex min-h-11");
    expect(d[2]).toContain("text-sm");
    const r = ballotFor("78701")!.races.find((x) => x.id === "us-senate-tx")!;
    const real = (r.candidates as { photo?: { url?: string; mate?: unknown } }[]).reduce((k, c) => k + (c.photo?.url ? (c.photo.mate ? 2 : 1) : 0), 0);
    expect(+d[1]).toBe(real);
    expect(+d[3]).toBe(real);
    const body = after.slice(after.indexOf("data-phone-credits"), after.indexOf("</details>"));
    expect((body.match(/data-race-credit=/g) ?? []).length).toBe((r.candidates as { photo?: { url?: string } }[]).filter((c) => c.photo?.url).length);
    expect(body).not.toMatch(/text-\[1[0-3]px\]|text-xs/);
  });
  it("NY-12: four candidates, four dates (Lasher/Shinkle Oct 14, Negron Sep 30, Ortiz Jun 30 + note)", () => {
    const r = federal("10001").find((x) => x.id === "ny-12")!;
    const out = renderToStaticMarkup(h(FinanceRow, { r: r as never }));
    expect((out.match(/data-money="true"/g) ?? []).length).toBe(4);
    expect(out).toContain("through Oct 14, 2026");
    expect(out).toContain("through Sep 30, 2026");
    expect(out).toContain("through Jun 30, 2026");
    expect(out).toMatch(/data-money-note="true">A newer filing \(Oct 30\) is not yet processed by FEC\.</);
    expect(out).toMatch(/class="text-sm text-black\/60" data-money-note/);
    expect(out).toContain("$46K");
    expect(out).toContain("$23K");
  });
  it("78701: Ted Brown and Lauren Peña show money (no blank tiles)", () => {
    const out = federal("78701").map((r) => renderToStaticMarkup(h(FinanceRow, { r: r as never }))).join("");
    expect(out).toContain("https://www.fec.gov/data/candidate/S4TX00888/");
    expect(out).toContain("https://www.fec.gov/data/candidate/H6TX35038/");
    expect(out).not.toContain("data-no-fec");
  });
  it("a federal candidate with no entry says 'No FEC filing found' and links FEC search; party falls back to 'Party: unsure'", () => {
    const r = { id: "tx-99", title: "U.S. House", level: "federal", candidates: [{ name: "Pat Doe", finance: null }] };
    const out = renderToStaticMarkup(h(FinanceRow, { r: r as never }));
    expect(out).toContain("No FEC filing found");
    expect(out).toContain("Party: unsure");
    expect(out).toContain("https://www.fec.gov/data/candidates/?search=Pat%20Doe");
    expect(out).not.toContain("$0");
  });
  it("'Nonpartisan' shows once per race, not under every tile", () => {
    const r = { id: "x", title: "x", level: "federal", candidates: ["A", "B", "C"].map((name) => ({ name, party: "Nonpartisan" })) };
    const out = renderToStaticMarkup(h(FinanceRow, { r: r as never }));
    expect((out.match(/Nonpartisan/g) ?? []).length).toBe(1);
  });
  it("no 11-12px text, no grades, no 'best'/'vote for'", () => {
    const fin = ZIPS.flatMap(federal).map((r) => renderToStaticMarkup(h(FinanceRow, { r: r as never }))).join("");
    expect(fin).not.toMatch(/text-\[1[12]px\]|text-xs/);
    expect(fin).not.toMatch(/\bbest\b|vote for|grade/i);
  });
});

describe("formatting (QA P2-1, P2-2)", () => {
  it("usd", () => {
    expect(usd(999_500)).toBe("$1.0M");
    expect(usd(999_999)).toBe("$1.0M");
    expect(usd(999_499)).toBe("$999K");
    expect(usd(-3003.52)).toBe("-$3,004");
    expect(usd(146349912.38)).toBe("$146M");
    expect(usd(9922857.4)).toBe("$9.9M");
    expect(usd(9_960_000)).toBe("$10M");
    expect(usd(1288.35)).toBe("$1K");
    expect(usd(812)).toBe("$812");
    // Adam 1:52 PM Oct 30: cash on hand under $10K to the dollar.
    expect(usdCash(4453.73)).toBe("$4,454");
    expect(usdCash(1288.35)).toBe("$1,288");
    expect(usdCash(6086.87)).toBe("$6,087");
    expect(usdCash(9_999.4)).toBe("$9,999");
    expect(usdCash(10_000)).toBe("$10K");
    expect(usdCash(23468.52)).toBe("$23K");
    expect(usdCash(9922857.4)).toBe("$9.9M");
    expect(usdCash(-3003.52)).toBe("-$3,004");
  });
  it("dates go through i18n", () => {
    expect(fmtDay("2026-10-14", "en")).toBe("Oct 14, 2026");
    expect(fmtDay("2026-10-14", "es")).toBe("14 de oct. de 2026");
    expect(fmtDay("2026-09-30", "es")).toBe("30 de sept. de 2026");
    expect(ES_FOR_TEST["No FEC filing found"]).toBeTruthy();
    expect(ES_FOR_TEST["FEC page"]).toBeTruthy();
  });
});

// Parent steering 1:33 PM Oct 30: /api/agent money objects carry only Civic's 13-row fields.
describe("money objects carry only Civic finance_fixes18 fields", () => {
  const ALLOWED = new Set(["raised", "cashOnHand", "coverageThrough", "lastReport", "fecId", "source", "note"]);
  it("no spent / individual / smallDonorPct / committee / donor lists on any ballot (this is what /api/agent returns as result.ballot)", () => {
    let n = 0;
    for (const zip of ["78701", "94103", "10001"]) for (const r of ballotFor(zip)!.races) for (const c of r.candidates as { money?: Record<string, unknown> }[]) {
      if (!c.money) continue;
      n++;
      for (const k of Object.keys(c.money)) expect(ALLOWED.has(k), k).toBe(true);
      expect(String((c.money.source as { url: string }).url)).toContain(String(c.money.fecId));
    }
    expect(n).toBeGreaterThan(0);
    expect(JSON.stringify(ballotFor("78701"))).not.toMatch(/"(spent|individual|smallDonorPct|inStatePct|committee|topEmployers|topCommittees|donorsSource)"/);
  });
});
