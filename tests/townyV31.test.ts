// v3.1 (Adam, Oct 30 2026 3:23 PM CT): Civic's towny_order_check NO-GO on the model path (civic/order28/towny_order_check.md).
import { describe, it, expect, vi } from "vitest";
import { curated } from "../lib/towny/answer";
import { ORDER_CONFIRMED, ORDER_CONFIRMED_HEAD, ORDER_UNSURE, orderConfirmedScoped, SPLIT_LINE, NY_PDF_LABEL, NY_FMPS } from "../lib/ballotOrder";
import { getRaces, getCandidates, ballotFor } from "../lib/tools";
import { guardReply } from "../lib/towny/orderGuard";
import { TOWNY_BRIEF } from "../lib/towny/brief";

const NY_PDF = "https://img1.wsimg.com/isteam/ip/eb67ae7b-312c-407d-a59a-c4b41353c238/71AD_SampleBallot_Nov2026.pdf";
const EV7 = "https://vote.nyc/election/general-election-early-voting-day-7";
const NY_CONFIRMED = ["ny-governor", "ny-comptroller", "ny-attorney-general", "ny-supreme-1jd", "ny-surrogate-ny", "ny-civil-county-ny"];
const NY_NEVER = ["ny-12", "ny-sd-47", "ny-sd-28", "ny-ad-75", "nyc-council-3"];
const LOOKUP = { "78701": "https://teamrv-mvp.sos.texas.gov/MVP/mvp.do", "94103": "https://voterstatus.sos.ca.gov/", "10001": "https://findmypollsite.vote.nyc/" } as const;
const SPLITS = { "78701": [["tx-10", "tx-37"], ["tx-hd-49", "tx-house-51"]], "94103": [["sf-supervisor-6", "sf-supervisor-8", "sf-supervisor-10"]], "10001": [["ny-sd-47", "ny-sd-28"], ["ny-civil-3md-ny", "ny-civil-9md-ny"]] } as const;
const ZIPS = ["78701", "94103", "10001"] as const;
const ORDER_Q = "What order are candidates on my ballot?";

describe("P0-1 tools carry a per-race orderStatus", () => {
  it("getRaces and getCandidates: confirmed only where Civic confirmed, with the official source; never Ballotpedia", () => {
    for (const z of ZIPS) {
      const r = getRaces(z)!, c = getCandidates(z)!;
      expect(r.raceListOrder).toMatch(/not ballot order/);
      for (const list of [r.races, c.races]) for (const x of list as { id: string; title: string; orderStatus: { status: string; sourceUrl: string | null; say: string } }[]) {
        // Civic GO 73ddcbf P2: retention races carry no order line.
        if (/\(retention\b/.test(x.title)) { expect(x.orderStatus.status, `${z} ${x.id}`).toBe("retention"); expect(x.orderStatus.say).toBe(""); continue; }
        const want = z === "78701" || (z === "10001" && NY_CONFIRMED.includes(x.id));
        expect(x.orderStatus.status, `${z} ${x.id}`).toBe(want ? "confirmed" : "unsure");
        expect(x.orderStatus.say).toBe(want ? ORDER_CONFIRMED : ORDER_UNSURE);
        if (want) expect(x.orderStatus.sourceUrl).not.toMatch(/ballotpedia/);
        else expect(x.orderStatus.sourceUrl).toBeNull();
        expect(x.orderStatus.sourceUrl).not.toBe(EV7);
      }
    }
  });
  it("the 10001 PDF is never cited for NY-12, the State Senate, AD 75 or Council 3 (tools and answers)", () => {
    const races = getRaces("10001")!.races as { id: string; orderStatus: { sourceUrl: string | null } }[];
    for (const id of NY_NEVER) expect(races.find((r) => r.id === id)!.orderStatus.sourceUrl, id).toBeNull();
    for (const id of NY_CONFIRMED) expect(races.find((r) => r.id === id)!.orderStatus.sourceUrl, id).toBe(NY_PDF);
    for (const q of ["What's the ballot order for congress?", "Who is running for Congress?", "Who is running for State Senate?", "What's the ballot order for state senate?", "Who is running for Assembly?", "Who is running for city council?", "Who is listed first for council?"]) {
      const c = curated("10001", q, "2026-10-30")!;
      expect(c.links.map((l) => l.url), q).not.toContain(NY_PDF);
      expect(c.reply, q).not.toContain(ORDER_CONFIRMED);
    }
  });
  it("the PDF has Civic's exact label and travels with the Board's Find My Poll Site", () => {
    expect(NY_PDF_LABEL).toBe("Copy of an official NYC Board of Elections ballot (New York County, Assembly District 71), posted on a third-party website, not the Board's");
    expect(NY_FMPS).toEqual({ label: "Find My Poll Site / View Sample Ballot, NYC Board of Elections", url: "https://findmypollsite.vote.nyc/" });
    const c = curated("10001", "Who is listed first for comptroller?", "2026-10-30")!;
    expect(c.links[0]).toEqual({ label: NY_PDF_LABEL, url: NY_PDF });
    expect(c.links[1]).toEqual(NY_FMPS);
  });
  it("ny-supreme-1jd is in the official order, Hagler first (Civic's data)", () => {
    const r = (getCandidates("10001", ["ny-supreme-1jd"])!.races[0]).candidates.map((x: { name: string }) => x.name);
    expect(r.slice(0, 3)).toEqual(["Shlomo S. Hagler", "Manuel J. Mendez", "Saliann Scarpulla"]);
    expect(curated("10001", ORDER_Q, "2026-10-30")!.reply).toMatch(/1st Judicial District \(choose up to 6\): Shlomo S\. Hagler, Manuel J\. Mendez, Saliann Scarpulla/);
  });
  it("no answer cites the early-voting-day-7 page as a sample ballot", () => {
    for (const z of ZIPS) for (const q of [ORDER_Q, "Who is running for Governor?", "What are the hours?", "Where is my sample ballot?"]) {
      const c = curated(z, q, "2026-10-30"); if (!c) continue;
      for (const l of c.links) if (l.url === EV7) expect(l.label, `${z} ${q}`).not.toMatch(/sample/i);
    }
  });
});

describe("P0-1 + P1 the order answer names candidates and never presents race order", () => {
  for (const z of ZIPS) it(z, () => {
    const c = curated(z, ORDER_Q, "2026-10-30")!;
    expect(c.intent).toBe("ballot-order");
    // QA 297e948 P1: confirmed ZIPs get one line instead of the contradictory pair; 94103 keeps the old opener.
    expect(c.reply).toMatch(z === "94103" ? /^Here are the candidates in each race\. The races are not listed in the order they appear on the ballot\./ : new RegExp(`^Here are the candidates in each race\\.\n${orderConfirmedScoped(z === "78701" ? 47 : 6).replace(/\./g, "\\.")}`));
    if (z !== "94103") { expect(c.reply).not.toContain("The races are not listed in the order"); expect(c.reply).not.toContain("That is the order of the candidates"); }
    if (z === "78701") { expect(c.reply).toContain(orderConfirmedScoped(47)); expect(c.reply.indexOf(orderConfirmedScoped(47))).toBeLessThan(c.reply.indexOf(ORDER_UNSURE)); expect(c.reply).toContain("Greg Abbott, Gina Hinojosa, Pat Dixon"); }
    if (z === "94103") { expect(c.reply).toContain(ORDER_UNSURE); expect(c.reply).not.toContain(ORDER_CONFIRMED); expect(c.reply).toContain("Xavier Becerra, Steve Hilton"); }
    if (z === "10001") { expect(c.reply.indexOf(orderConfirmedScoped(6))).toBeLessThan(c.reply.indexOf(ORDER_UNSURE)); expect(c.reply).toContain("Micah C. Lasher"); }
    expect(c.links.map((l) => l.url).join(" ")).not.toMatch(/ballotpedia/);
  });
});

describe("P0-2 split districts", () => {
  it("tools mark dependsOnAddress with the lookup", () => {
    for (const z of ZIPS) for (const g of SPLITS[z]) for (const id of g) {
      const r = (getRaces(z)!.races as { id: string; dependsOnAddress?: { say: string; oneOf: string[]; lookupUrl: string } }[]).find((x) => x.id === id)!;
      expect(r.dependsOnAddress, id).toEqual(expect.objectContaining({ say: SPLIT_LINE, oneOf: [...g], lookupUrl: LOOKUP[z] }));
    }
    expect((getRaces("78701")!.races as { id: string; dependsOnAddress?: unknown }[]).find((x) => x.id === "tx-senate")?.dependsOnAddress).toBeUndefined();
  });
  it("order and who-is-running answers say it and link the lookup", () => {
    expect(SPLIT_LINE).toBe("Depending on your address, you'll have one of these");
    for (const z of ZIPS) {
      const c = curated(z, ORDER_Q, "2026-10-30")!;
      expect(c.reply).toContain(`${SPLIT_LINE}: `);
      expect(c.links.map((l) => l.url)).toContain(LOOKUP[z]);
    }
    for (const [z, q] of [["78701", "Who is running for Congress?"], ["78701", "Who is running for State Representative?"], ["94103", "Who is running for Board of Supervisors?"], ["10001", "Who is running for State Senate?"]] as const) {
      const c = curated(z, q, "2026-10-30")!;
      expect(c.reply, q).toMatch(new RegExp(`^${SPLIT_LINE}: `));
      expect(c.links.map((l) => l.url), q).toContain(LOOKUP[z]);
    }
  });
  it("brief tells the model the same", () => {
    expect(TOWNY_BRIEF).toContain(SPLIT_LINE);
    for (const u of Object.values(LOOKUP)) expect(TOWNY_BRIEF).toContain(u);
    expect(TOWNY_BRIEF).toContain(ORDER_UNSURE);
    expect(TOWNY_BRIEF).toMatch(/Never present the list of races as the order of the ballot/);
  });
});

describe("P1 78701 Court of Criminal Appeals links", () => {
  it("Places 3, 4 and 9 no longer link the Texas Supreme Court page", () => {
    for (const id of ["tx-court-of-criminal-appeals-place-3", "tx-court-of-criminal-appeals-place-4", "tx-court-of-criminal-appeals-place-9"]) {
      const r = (ballotFor("78701")!.races as { id: string; source?: string }[]).find((x) => x.id === id)!;
      expect(r.source, id).not.toMatch(/Texas_Supreme_Court/);
      expect(r.source, id).toBe("https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Corrected-Final2.pdf");
    }
  });
});

describe("P1 SF hours intent", () => {
  for (const q of ["What are the hours?", "What time do polls open and close?", "Where can I vote early and what are the hours?"]) it(q, () => {
    const c = curated("94103", q, "2026-10-30")!;
    expect(c.reply).toMatch(/8:00 AM-5:00 PM PT/);
    expect(c.reply).toContain("Election Day, Tue, Nov 3: 7:00 AM-8:00 PM PT (City Hall Voting Center and all 501 polling places).");
  });
  it("78701 and 10001 hours answers add the Election Day hours from the data", () => {
    expect(curated("78701", "What are the hours?", "2026-10-30")!.reply).toContain("Election Day, Tue, Nov 3: 7:00 AM-7:00 PM CT.");
    expect(curated("10001", "What time do polls open and close?", "2026-10-30")!.reply).toContain("Election Day, Tue, Nov 3: 6:00 AM-9:00 PM ET.");
  });
});

describe("model-path guard", () => {
  it("replaces order claims with the per-race lines and adds the split line", () => {
    const bad = "Here are the races in the order they appear on your ballot:\n1. U.S. House New York District 12: Micah C. Lasher, Caroline Shinkle.\n2. Justice of the Supreme Court: Saliann Scarpulla, Shlomo S. Hagler. Source: official sample ballot (vote.nyc).\n3. State Senator, District 47: Erik D. Bottcher. State Senator, District 28: Liz Krueger.";
    const g = guardReply("10001", bad);
    expect(g.reply).not.toMatch(/in the order they appear on your ballot/);
    expect(g.reply).not.toMatch(/official sample ballot \(vote\.nyc\)/);
    expect(g.reply).toContain(`${ORDER_UNSURE} (U.S. House New York District 12`);
    expect(g.reply).not.toContain("The races here are not listed in the order");
    expect(g.reply).toMatch(new RegExp(`${ORDER_CONFIRMED_HEAD.replace(/\./g, "\\.")} \\(Candidate order within: Justice of the Supreme Court, 1st Judicial District`));
    expect(g.reply).toContain(NY_PDF);
    expect(g.reply).toContain(NY_FMPS.url);
    expect(g.reply).toContain(`${SPLIT_LINE}: State Senator, District 47 or State Senator, District 28.`);
    expect(g.changed.length).toBeGreaterThan(0);
  });
  it("leaves clean replies alone", () => {
    const ok = "Election Day is Tuesday, November 3, 2026.";
    expect(guardReply("94103", ok)).toEqual({ reply: ok, changed: [] });
  });
});

describe("/api/towny-test routes order and hours questions to the deterministic answer", () => {
  it("never calls the model for them", async () => {
    vi.resetModules();
    const run = vi.fn();
    vi.doMock("../lib/townyRun", () => ({ runTowny: run }));
    const { POST } = await import("../app/api/towny-test/route");
    for (const z of ZIPS) {
      const j = await (await POST(new Request("https://x/api/towny-test", { method: "POST", body: JSON.stringify({ message: ORDER_Q, zip: z }) }))).json();
      expect(j.handledBy, z).toBe("code");
      expect(j.intent).toBe("ballot-order");
      expect(j.reply).toContain(SPLIT_LINE);
      expect(j.reply).toMatch(/\n\nSources: /);
    }
    const h = await (await POST(new Request("https://x/api/towny-test", { method: "POST", body: JSON.stringify({ message: "What are the hours?", zip: "94103" }) }))).json();
    expect(h.reply).toContain("Election Day, Tue, Nov 3: 7:00 AM-8:00 PM PT");
    expect(run).not.toHaveBeenCalled();
    vi.doUnmock("../lib/townyRun");
  });
});
