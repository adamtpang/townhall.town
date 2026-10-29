import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { TOWNY_PROMPT_TEMPLATE, townyPrompt } from "../lib/townyPrompt";
import { keywordOf, FIXED_REPLY, deleteMyData, getPrivacySummary, redact, outputFlags } from "../lib/townyControls";
import { planRows, getElectionDates, getPollingLocations, LOGISTICS_ZIPS, NO_ONLINE_VOTING } from "../lib/logistics";
import { getCandidatePositions, issueIdsFor } from "../lib/townyTools";
import { dataTools } from "../lib/dataTools";
import { CONTENT } from "../lib/content";
import * as townyTest from "../app/api/towny-test/route";

describe("Towny system prompt", () => {
  it("is Civic's towny_prompt.md block, unchanged", () => {
    expect(TOWNY_PROMPT_TEMPLATE.length).toBe(7021);
    expect(createHash("sha256").update(TOWNY_PROMPT_TEMPLATE).digest("hex")).toBe("369b6740199a268b6d2cc8670abf610dcf40c1af9210f3eec893a9570f8f733d");
  });
  it("only fills in {{TODAY}}", () => {
    const p = townyPrompt("Thursday, October 29, 2026");
    expect(p).not.toContain("{{TODAY}}");
    expect(p).toBe(TOWNY_PROMPT_TEMPLATE.split("{{TODAY}}").join("Thursday, October 29, 2026"));
  });
  it("the agent route uses it", () => {
    const src = readFileSync("app/api/agent/route.ts", "utf8");
    expect(src).toContain("townyPrompt(");
    expect(src).not.toMatch(/const SYSTEM = `/);
  });
});

describe("No third-party address or coordinate tools", () => {
  it("getVoterInfo and getStateLegislators are gone", () => {
    expect(Object.keys(dataTools).sort()).toEqual(["getCampaignFinance", "getCountyUnemployment", "getSponsoredBills"]);
    for (const f of ["lib/dataTools.ts", "app/api/agent/route.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/civicinfo|openstates|getVoterInfo|getStateLegislators/i);
    }
  });
});

describe("Logistics come from Civic's data files", () => {
  it("covers the three ZIPs", () => expect(LOGISTICS_ZIPS.sort()).toEqual(["10001", "78701", "94103"]));
  it("every row links an official source", () => {
    for (const z of LOGISTICS_ZIPS) for (const r of planRows(z, "2026-10-29")) expect(r.src).toMatch(/^https:\/\//);
  });
  it("SF: conditional registration is open through Election Day", () => {
    const j = getElectionDates("94103")!;
    expect(j.registration.openOnOct30).toBe(true);
    const reg = planRows("94103", "2026-10-29").find((r) => r.k === "Register")!;
    expect(reg.title).toBe("You can still register and vote");
    expect(reg.detail?.join(" ")).toBe(j.registration.notes);
  });
  it("Austin and NYC: registration deadline has passed", () => {
    for (const z of ["78701", "10001"]) expect(planRows(z, "2026-10-29").find((r) => r.k === "Register")!.title).toMatch(/has passed/);
  });
  it("dates and hours are the JSON's", () => {
    for (const z of LOGISTICS_ZIPS) {
      const j = getElectionDates(z)!;
      const ed = planRows(z, "2026-10-29").find((r) => r.title.startsWith("Election Day"))!;
      expect(ed.title).toBe(`Election Day, ${j.electionDay.hours}`);
    }
  });
  it("early voting is marked past once it ends", () => {
    expect(planRows("78701", "2026-11-02").find((r) => r.title.startsWith("Early voting"))!.past).toBe(true);
  });
  it("polling place row uses the official lookup", () => {
    for (const z of LOGISTICS_ZIPS) expect(planRows(z, "2026-10-29").find((r) => r.k === "Where")!.src).toBe(getPollingLocations(z)!.lookupUrl);
  });
  it("says you can't vote online", () => {
    for (const z of LOGISTICS_ZIPS) expect(planRows(z).some((r) => r.title === NO_ONLINE_VOTING)).toBe(true);
  });
  it("the Plan UI has no hand-written dates", () => {
    const src = readFileSync("app/BallotAgent.tsx", "utf8");
    expect(src).toContain("planRows(zip)");
    expect(src).not.toMatch(/k: "(Oct|Nov) \d/);
    expect(src).not.toContain("function GamePlan");
  });
});

describe("Towny controls run in code, before the model", () => {
  it("keywords", () => {
    for (const w of ["STOP", "stop", " Unsubscribe ", "CANCEL", "quit"]) expect(keywordOf(w)).toBe("stop");
    for (const w of ["HELP", "info"]) expect(keywordOf(w)).toBe("help");
    for (const w of ["START", "unstop"]) expect(keywordOf(w)).toBe("start");
    for (const w of ["DELETE MY DATA", "delete my data", "forget me"]) expect(keywordOf(w)).toBe("delete");
    for (const w of ["stop sign ballot measure?", "who should I vote for", "help me find my polling place"]) expect(keywordOf(w)).toBeNull();
    expect(FIXED_REPLY.help).toContain("townhall.town/privacy");
  });
  it("delete only claims what is true", () => {
    const d = deleteMyData();
    expect(d.message).toMatch(/does not store/i);
    expect(d.message).not.toMatch(/we deleted your (number|messages)/i);
  });
  it("privacy summary does not claim zero retention or no-training", () => {
    const t = JSON.stringify(getPrivacySummary());
    expect(t).toMatch(/not (been )?turned on/i);
    expect(t).not.toMatch(/never train|zero data retention is on/i);
  });
  it("redacts email, phone, street address and SSN", () => {
    const r = redact("I'm jo@example.com, 512-555-0134, at 1100 Congress Ave, SSN 123-45-6789. Who is on my ballot?");
    expect(r.text).not.toMatch(/example\.com|555-0134|1100 Congress|123-45-6789/);
    expect(r.redacted.sort()).toEqual(["address", "email", "phone", "ssn"]);
    expect(r.text).toContain("Who is on my ballot?");
  });
  it("flags persuasive output", () => {
    expect(outputFlags("You should vote for Smith.").length).toBeGreaterThan(0);
    expect(outputFlags("Here is what each candidate has said, with sources.")).toEqual([]);
  });
});

describe("Candidate positions", () => {
  it("published stances carry a quote and source", () => {
    const r: any = getCandidatePositions("James Talarico");
    expect(r.onCoveredBallot).toBe(true);
    if (r.status === "published") for (const p of r.positions) { expect(p.quote.length).toBeGreaterThan(0); expect(p.sourceUrl).toMatch(/^https?:\/\//); }
  });
  it("no record means no public statement found", () => {
    expect(getCandidatePositions("Kevin McCormick").status).toBe("no public statement found");
  });
});

describe("/api/towny-test is preview-only", () => {
  const env = process.env.VERCEL_ENV;
  afterEach(() => { process.env.VERCEL_ENV = env; });
  it("404 JSON on production", async () => {
    process.env.VERCEL_ENV = "production";
    const res = await townyTest.POST(new Request("https://townhall.town/api/towny-test", { method: "POST", body: JSON.stringify({ message: "hi" }) }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
    expect((await townyTest.GET()).status).toBe(404);
  });
  it("keywords are answered by code, not the model", async () => {
    process.env.VERCEL_ENV = "preview";
    const res = await townyTest.POST(new Request("https://x/api/towny-test", { method: "POST", body: JSON.stringify({ message: "STOP" }) }));
    const j = await res.json();
    expect(j.handledBy).toBe("code");
    expect(j.reply).toBe(FIXED_REPLY.stop);
  });
  it("400 on a bad body", async () => {
    process.env.VERCEL_ENV = "preview";
    const res = await townyTest.POST(new Request("https://x/api/towny-test", { method: "POST", body: "{" }));
    expect(res.status).toBe(400);
  });
});

describe("Privacy page is truthful", () => {
  const text = JSON.stringify(CONTENT["/privacy"]);
  it("no longer claims only race identifiers are sent", () => expect(text).not.toMatch(/race identifiers, not information about you/));
  it("does not claim zero retention or no-training", () => {
    expect(text).toMatch(/have not turned on the gateway's zero-data-retention or no-training routing/);
    expect(text).not.toMatch(/we don't allow these companies to train/i);
  });
  it("coordinates go in the body", () => expect(text).toMatch(/never in the web address/));
});

describe("getCandidatePositions: names and everyday issue words", () => {
  it("maps everyday words to tracked issues, and untracked topics to none", () => {
    expect(issueIdsFor("rent")).toEqual(["housing"]);
    expect(issueIdsFor("health care")).toEqual(["healthcare"]);
    expect(issueIdsFor("the border")).toEqual(["immigration"]);
    expect(issueIdsFor("AI regulation")).toEqual([]);
  });
  it("a race or office name is not a candidate", () => {
    expect(getCandidatePositions("Governor", "rent").status).toBe("unknown candidate");
    expect(getCandidatePositions("U.S. Senate Texas").status).toBe("unknown candidate");
  });
  it("rent finds a published housing quote; an untracked topic finds none", () => {
    const r = getCandidatePositions("James Talarico", "rent") as any;
    expect(r.status).toBe("published");
    expect(r.positions[0].sourceUrl).toMatch(/^https:\/\//);
    expect(getCandidatePositions("James Talarico", "AI regulation").status).toBe("no public statement found");
  });
});
