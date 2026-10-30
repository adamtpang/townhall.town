// Civic P2 on 297e948 (Adam, Oct 30 2026 3:47 PM CT): the CA certified-list link is labeled
// "California Secretary of State, certified list of candidates", never its bare hostname, wherever it renders.
import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CA_CERT_LIST_LABEL, hostLabel, isCaCertList, nameBareCertHost } from "../lib/sourceName";
import { curated } from "../lib/towny/answer";
import { linkText } from "../lib/townyChat";
import { host as logisticsHost } from "../lib/logistics";
import { checkedLabel } from "../components/CandidateRow";
import { sourceLabel as researchLabel } from "../app/TownyResearch";

const CERT = "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf";
const SOV = "https://elections.cdn.sos.ca.gov/sov/2022-general/sov/06-summary.pdf";
const BARE = "elections.cdn.sos.ca.gov";
const QS = ["Who is running for Associate Justice of the Supreme Court?", "Who is running for Court of Appeal?"];
const root = join(__dirname, "..");

describe("label helpers", () => {
  it("names the certified list; other links (same host included) keep their hostname", () => {
    expect(CA_CERT_LIST_LABEL).toBe("California Secretary of State, certified list of candidates");
    expect(isCaCertList(CERT)).toBe(true);
    expect(hostLabel(CERT)).toBe(CA_CERT_LIST_LABEL);
    expect(hostLabel(SOV)).toBe(BARE);
    expect(hostLabel("https://www.sf.gov/x")).toBe("sf.gov");
    expect(linkText({ url: CERT, label: BARE }, [{ url: CERT }])).toBe(CA_CERT_LIST_LABEL);
    expect(logisticsHost(CERT)).toBe(CA_CERT_LIST_LABEL);
    expect(checkedLabel({ url: CERT } as Parameters<typeof checkedLabel>[0])).toBe(CA_CERT_LIST_LABEL);
    expect(researchLabel({ url: CERT })).toBe(`(quoted on ${CA_CERT_LIST_LABEL})`);
  });
  it("model text: a bare hostname label is named; URLs stay intact; untouched when the host serves another PDF", () => {
    expect(nameBareCertHost(`Source: ${BARE}`)).toBe(`Source: ${CA_CERT_LIST_LABEL}`);
    expect(nameBareCertHost(`Source (${BARE}): ${CERT}`)).toBe(`Source (${CA_CERT_LIST_LABEL}): ${CERT}`);
    expect(nameBareCertHost(`Source: ${CERT}`)).toBe(`Source: ${CERT}`);
    expect(nameBareCertHost(`${BARE}: ${SOV}`)).toBe(`${BARE}: ${SOV}`);
  });
  it("shipped UI uses the shared label (RaceTiers, CandidateRow, TownyResearch, research steps, Towny chat)", () => {
    for (const f of ["app/RaceTiers.tsx", "components/CandidateRow.tsx", "app/TownyResearch.tsx", "app/api/research/route.ts", "lib/townyChat.ts", "lib/towny/answer.ts", "lib/logistics.ts", "lib/tools.ts", "app/api/towny-test/route.ts"])
      expect(readFileSync(join(root, f), "utf8"), f).toMatch(/from "[./]+\/(?:lib\/)?sourceName"/);
    expect(readFileSync(join(root, "app/RaceTiers.tsx"), "utf8")).not.toMatch(/\{new URL\([^)]*\)\.hostname/);
  });
});

let interview: (zip: string, text: string) => Promise<{ reply: string; links: { label: string; url: string }[] }>;
let townyTest: (zip: string, message: string) => Promise<{ reply: string; handledBy: string; links?: { label: string; url: string }[]; guard?: string[] }>;
const run = vi.fn();
let ip = 40;
beforeAll(async () => {
  vi.resetModules();
  vi.doMock("../lib/townyRun", () => ({ runTowny: run }));
  const i = await import("../app/api/interview/route");
  const t = await import("../app/api/towny-test/route");
  interview = async (zip, text) => (await i.POST(new Request("https://x/api/interview", { method: "POST", body: JSON.stringify({ zip, messages: [{ text }] }), headers: { "x-forwarded-for": `198.51.100.${ip++}`, "content-type": "application/json" } }))).json();
  townyTest = async (zip, message) => (await t.POST(new Request("https://x/api/towny-test", { method: "POST", body: JSON.stringify({ zip, message }) }))).json();
});

describe("Towny replies on both endpoints", () => {
  it("/api/interview and curated: the certified-list link carries the named label", async () => {
    for (const q of QS) {
      for (const links of [curated("94103", q)!.links, (await interview("94103", q)).links]) {
        const l = links.find((x) => x.url === CERT)!;
        expect(l, q).toBeTruthy();
        expect(l.label).toBe(CA_CERT_LIST_LABEL);
        expect(links.some((x) => x.label === BARE)).toBe(false);
      }
    }
  });
  it("/api/towny-test model path: a bare-hostname label is named", async () => {
    run.mockResolvedValueOnce({ ok: true, model: "m", reply: `Associate Justice of the Supreme Court: Kelli M. Evans and Joshua Groban are up for retention (Yes or No). Source: ${BARE} (${CERT})`, toolCalls: [], attempts: [] });
    const j = await townyTest("94103", QS[0]);
    expect(j.handledBy).toBe("model");
    expect(j.reply).toContain(`Source: ${CA_CERT_LIST_LABEL} (${CERT})`);
    expect(j.reply.replace(CERT, "")).not.toContain(BARE);
    expect(j.guard).toContain("named the CA certified list");
  });
  it("/api/towny-test code path: Sources never use the bare hostname as a label", async () => {
    for (const z of ["94103", "78701", "10001"]) {
      const j = await townyTest(z, "What order are candidates on my ballot?");
      expect(j.handledBy).toBe("code");
      expect(j.reply).not.toContain(`${BARE}:`);
    }
  });
});
