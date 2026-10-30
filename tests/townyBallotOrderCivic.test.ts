// Civic P1 (Oct 30, 2026, 2:58 PM CT): ballot order per race from Civic's check (civic/bp22/ballot_order_check.json, copied
// to data/ballot_order.json). 78701 (all races) and 6 races in 10001 are confirmed against the official sample ballot:
// Towny says exactly "Listed in the order on the official sample ballot." with that source, and the card shows that order.
// 94103 and the 7 unconfirmed 10001 races keep the unsure line.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { curated, runningFor, BALLOT_ORDER_LINE, UNSURE_ORDER } from "../lib/towny/answer";
import { ORDER_CONFIRMED, ORDER_CONFIRMED_HEAD, ORDER_UNSURE, officialOrder, isOrderConfirmed, inOfficialOrder } from "../lib/ballotOrder";
import { ballotFor } from "../lib/tools";
import data from "../data/ballot_order.json";

const root = new URL("..", import.meta.url).pathname;
const src = (f: string) => readFileSync(root + f, "utf8");
const TX = "https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Corrected-Final2.pdf";
const NY = "https://img1.wsimg.com/isteam/ip/eb67ae7b-312c-407d-a59a-c4b41353c238/71AD_SampleBallot_Nov2026.pdf";
const NY_CONFIRMED = ["ny-governor", "ny-attorney-general", "ny-comptroller", "ny-supreme-1jd", "ny-surrogate-ny", "ny-civil-county-ny"];
type R = { id: string; title: string; level?: string; candidates: { name: string }[] };
const races = (z: string) => (ballotFor(z)!.races as R[]).filter((r) => r.level !== "measure" && r.candidates.length > 0);
const Q = "What order are candidates on my ballot?";

describe("the data", () => {
  it("exact strings", () => {
    expect(ORDER_CONFIRMED).toBe("Listed in the order on the official sample ballot.");
    expect(ORDER_UNSURE).toBe("Ballot order: Unsure, we haven't confirmed it against the official sample ballot yet.");
    expect(BALLOT_ORDER_LINE).toBe(ORDER_UNSURE);
  });
  it("every 78701 race is confirmed, 6 named 10001 races, no 94103 race", () => {
    for (const r of races("78701")) expect(isOrderConfirmed("78701", r.id), r.id).toBe(true);
    expect(races("10001").filter((r) => isOrderConfirmed("10001", r.id)).map((r) => r.id).sort()).toEqual([...NY_CONFIRMED].sort());
    expect(races("10001").filter((r) => !isOrderConfirmed("10001", r.id))).toHaveLength(7);
    for (const r of races("94103")) expect(isOrderConfirmed("94103", r.id), r.id).toBe(false);
    const rows = (data as { races: { zip: string; sourceUrl: string }[] }).races;
    expect(rows.filter((r) => r.zip === "78701")).toHaveLength(58);
    expect(rows.filter((r) => r.zip === "10001")).toHaveLength(6);
    for (const r of rows) expect(r.sourceUrl).toBe(r.zip === "78701" ? TX : NY);
  });
  it("each official order is the same set of names as the ballot data (nothing invented)", () => {
    for (const z of ["78701", "10001"]) for (const r of races(z)) {
      const o = officialOrder(z, r.id); if (!o) continue;
      expect([...o.names].sort(), r.id).toEqual(r.candidates.map((c) => c.name).sort());
    }
  });
  const check = "/workspace/townhall/civic/bp22/ballot_order_check.json";
  it.skipIf(!existsSync(check))("matches Civic's ballot_order_check.json row for row", () => {
    const rows = JSON.parse(readFileSync(check, "utf8")) as { zip: string; race_id: string; official_order: string[]; source_url: string; status: string }[];
    for (const c of rows) {
      const want = c.zip === "78701" || (c.zip === "10001" && (c.status === "MATCH" || c.status === "MISMATCH"));
      expect(isOrderConfirmed(c.zip, c.race_id), `${c.zip} ${c.race_id} ${c.status}`).toBe(want);
      if (want) {
        expect(officialOrder(c.zip, c.race_id)!.names).toEqual(c.official_order.map((n) => n.replace(/\s*\([^)]*\)\s*$/, "")));
        expect(officialOrder(c.zip, c.race_id)!.source.url).toBe(c.source_url);
      }
    }
  });
});

describe("official order is applied", () => {
  it("inOfficialOrder reorders confirmed races only", () => {
    const tx10 = races("78701").find((r) => r.id === "tx-10")!;
    // v3.1 (Oct 30, 3:24 PM CT): ballotFor itself now returns the official order (data order was Rourk, Gober at 9229c66).
    expect(tx10.candidates.map((c) => c.name)).toEqual(["Chris Gober", "Caitlin Rourk"]);
    expect(inOfficialOrder("78701", "tx-10", [...tx10.candidates].reverse()).map((c) => c.name)).toEqual(["Chris Gober", "Caitlin Rourk"]);
    for (const r of races("94103")) expect(inOfficialOrder("94103", r.id, r.candidates)).toBe(r.candidates);
  });
  it("the card page renders candidates through inOfficialOrder", () => {
    const s = src("app/card/page.tsx").replace(/^\s*\/\/.*$/gm, "");
    expect(s).toMatch(/import \{ inOfficialOrder \} from "\.\.\/\.\.\/lib\/ballotOrder"/);
    expect(s).toMatch(/candidates: inOfficialOrder\(zip, r\.id, r\.candidates\)/);
  });
});

describe("Towny answers, per ZIP", () => {
  it("78701: the exact confirmed line with the Travis County sample ballot", () => {
    const c = curated("78701", Q, "2026-10-30")!;
    expect(c.intent).toBe("ballot-order");
    // v3.1: candidates are named; confirmed = candidate order within each race, never the order of the races.
    // QA 297e948 P1: one line (ORDER_CONFIRMED_HEAD) replaces the old opener + confirmed header pair.
    expect(c.reply).toContain(`\n${ORDER_CONFIRMED_HEAD}`);
    expect(c.reply).not.toContain("The races are not listed in the order they appear on the ballot.");
    expect(c.reply).not.toContain("That is the order of the candidates");
    expect(c.reply).toContain("U.S. Senator: Ken Paxton, James Talarico, Ted Brown.");
    expect(c.links[0]).toEqual({ label: "Travis County sample ballot", url: TX });
    expect(c.reply).not.toMatch(/Unsure/);
  });
  it("78701 per race: names in official order", () => {
    expect(curated("78701", "Who is listed first for U.S. Senate?", "2026-10-30")!.reply).toBe(`U.S. Senator: Ken Paxton, James Talarico, Ted Brown. ${ORDER_CONFIRMED}`);
    const run = runningFor("78701", "Who is running for Congress?")!;
    expect(run.reply).toMatch(/^Depending on your address, you'll have one of these: U\.S\. Representative, District 10: Chris Gober, Caitlin Rourk; U\.S\. Representative, District 37: /);
    expect(run.reply.endsWith(` ${ORDER_CONFIRMED}`)).toBe(true);
    expect(run.links[0].url).toBe(TX);
  });
  it("94103: the unsure line, never the confirmed one", () => {
    const c = curated("94103", Q, "2026-10-30")!;
    expect(c.reply).toContain(`${ORDER_UNSURE} That applies to these races:`);
    expect(c.reply).toContain("Governor of California: Xavier Becerra, Steve Hilton.");
    expect(c.links.map((l) => l.url)).toContain("https://www.sf.gov/departments/department-elections");
    expect(runningFor("94103", "Who is running for Governor?")!.reply.endsWith(` ${UNSURE_ORDER}`)).toBe(true);
    expect(JSON.stringify(c)).not.toContain(ORDER_CONFIRMED);
  });
  it("10001: confirmed for the 6, unsure for the other 7", () => {
    const c = curated("10001", Q, "2026-10-30")!;
    const [ok, no] = [c.reply.slice(0, c.reply.indexOf(ORDER_UNSURE)), c.reply.slice(c.reply.indexOf(ORDER_UNSURE))];
    expect(ok).toContain(ORDER_CONFIRMED_HEAD);
    for (const r of races("10001")) {
      if (NY_CONFIRMED.includes(r.id)) { expect(ok, r.title).toContain(r.title); expect(no, r.title).not.toContain(r.title); }
      else { expect(no, r.title).toContain(r.title); }
    }
    expect(no).toContain(ORDER_UNSURE);
    expect(c.links[0]).toEqual({ label: "Copy of an official NYC Board of Elections ballot (New York County, Assembly District 71), posted on a third-party website, not the Board's", url: NY });
    expect(c.links[1]).toEqual({ label: "Find My Poll Site / View Sample Ballot, NYC Board of Elections", url: "https://findmypollsite.vote.nyc/" });
    expect(curated("10001", "Who is listed first for comptroller?", "2026-10-30")!.reply).toMatch(new RegExp(`${ORDER_CONFIRMED.replace(/\./g, "\\.")}$`));
    const sen = runningFor("10001", "Who is running for State Senate?")!;
    expect(sen.reply.endsWith(` ${UNSURE_ORDER}`)).toBe(true);
    expect(sen.reply).not.toContain(ORDER_CONFIRMED);
  });
  it("same-city answers keep the unsure line (Civic checked the covered ZIP's own ballot)", () => {
    const c = curated("10001", "Who's running for governor in Brooklyn?", "2026-10-30")!;
    expect(c.reply).not.toContain(ORDER_CONFIRMED);
  });
  it("POST /api/interview: one ballot-order question per ZIP", async () => {
    const { POST } = await import("../app/api/interview/route");
    const ask = async (zip: string, ip: string) => (await POST(new Request("https://x/api/interview", { method: "POST", body: JSON.stringify({ zip, messages: [{ text: Q }] }), headers: { "x-forwarded-for": ip, "content-type": "application/json" } }))).json();
    const tx = (await ask("78701", "203.0.113.71")).reply; expect(tx).toContain(ORDER_CONFIRMED_HEAD); expect(tx).not.toContain(ORDER_UNSURE);
    const sf = (await ask("94103", "203.0.113.72")).reply; expect(sf).toContain(ORDER_UNSURE); expect(sf).not.toContain(ORDER_CONFIRMED); expect(sf).not.toContain(ORDER_CONFIRMED_HEAD);
    const ny = await ask("10001", "203.0.113.73");
    expect(ny.reply).toContain(ORDER_CONFIRMED_HEAD); expect(ny.reply).toContain(ORDER_UNSURE);
  });
});
