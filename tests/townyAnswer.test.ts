// QA judge-path-prod P1-1, P1-2, P2 (Oct 30, 1:25 PM CT): the 3 failing questions on all 3 ZIPs, answered from curated data.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { curated, helpful, runningFor, HELP_REPLY } from "../lib/towny/answer";
import { WHO_LINE } from "../lib/towny/faq";
import { WHO_CHIP } from "../lib/townyChat";
import { ballotFor } from "../lib/tools";

const ZIPS = ["78701", "94103", "10001"] as const;
const OFFICE = { "78701": "https://votetravis.gov", "94103": "https://www.sf.gov/departments/department-elections", "10001": "https://vote.nyc" };
const root = new URL("..", import.meta.url).pathname;
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe.each(ZIPS)("Towny curated answers, %s", (zip) => {
  it("Who should I vote for? -> Civic's line and the overlap chip", () => {
    const c = curated(zip, "Who should I vote for?", "2026-10-30")!;
    expect(c.reply).toBe(WHO_LINE);
    expect(c.chips).toEqual([WHO_CHIP]);
  });
  it("What is the polling place? -> Election Day, official office link, no hardcoded sites or hours", () => {
    const c = curated(zip, "What is the polling place?", "2026-10-30")!;
    expect(c).not.toBeNull();
    expect(c.reply).toMatch(/Tuesday, November 3, 2026/);
    expect(c.links.map((l) => l.url.replace(/\/$/, ""))).toContain(OFFICE[zip]);
    expect(c.reply).not.toMatch(/\d{1,2}(:\d\d)? ?(a\.?m|p\.?m)\b/i);
    expect(c.reply).not.toMatch(/\b(library|school|center|church|hall)\b/i);
    if (zip === "78701") { expect(c.reply).toMatch(/early voting/i); expect(curated(zip, "Where do I vote?", "2026-10-31")!.reply).toMatch(/ended/); }
  });
  it("Who is running for Governor? -> candidates in ballot order from the ballot data, with a source", () => {
    const c = curated(zip, "Who is running for Governor?", "2026-10-30")!;
    const race = ballotFor(zip)!.races.find((r) => /^Governor\b/.test(r.title))!;
    expect(race).toBeTruthy();
    const names = race.candidates.map((x) => x.name);
    expect(c.reply).toContain(`${race.title}: ${names.join(", ")}.`);
    if (zip !== "10001") expect(c.reply).not.toMatch(/Lieutenant Governor of/);
    expect(c.links.length).toBeGreaterThan(0);
    for (const l of c.links) expect(l.url).toMatch(/^https:\/\//);
  });
  it("an office not on this ballot -> 'No record found.' plus what was searched", () => {
    const c = runningFor(zip, "Who is running for Dogcatcher?")!;
    expect(c.reply).toMatch(/^No record found\. Searched: the \d{5} ballot from .+\.$/);
  });
  it("What's on my ballot? and the FAQ questions are answered; unknown questions get help with chips", () => {
    expect(curated(zip, "What's on my ballot?", "2026-10-30")!.reply).toMatch(/ballot has \d+ race/);
    expect(curated(zip, "Why only 3 ZIPs?", "2026-10-30")!.intent).toBe("faq-zips");
    expect(curated(zip, "How do I add my city?", "2026-10-30")!.intent).toBe("faq-city");
    const h = helpful(zip);
    expect(h.reply).toBe(HELP_REPLY);
    expect(h.chips!.length).toBeGreaterThanOrEqual(3);
    // Each help chip itself gets a curated answer (no chip leads to a dead end).
    for (const chip of h.chips!) expect(curated(zip, chip, "2026-10-30"), chip).not.toBeNull();
  });
});

describe("Towny never dead-ends (P1-2) and queues (P2)", () => {
  it("the 'Yes, Neutral and No buttons' copy is gone everywhere", () => {
    for (const f of [...walk(join(root, "app")), ...walk(join(root, "lib")), ...walk(join(root, "components"))].filter((f) => /\.(tsx?|mjs)$/.test(f)))
      expect(readFileSync(f, "utf8"), f).not.toMatch(/Yes, Neutral and No buttons/);
  });
  it("interview route: curated first, model tried twice, then the helpful curated reply instead of a 502", () => {
    const s = readFileSync(join(root, "app/api/interview/route.ts"), "utf8");
    expect(s).toContain("curated(zip, msgs[msgs.length - 1])");
    expect(s).toContain("[MODELS[0], MODELS[1] ?? MODELS[0]]");
    expect(s).toMatch(/return help\(\);\s*}\s*$/m);
    expect(s).not.toContain("upstream_unavailable");
    // curated replies never call the model, so they are answered ahead of the per-client limit; model calls stay limited
    expect(s).toContain("(await curatedFirst(req)) ?? limited(req)");
    expect(s).toContain("rateLimited(INTERVIEW_POLICY, interview)");
  });
  it("page chat and floating panel queue a second message instead of dropping it", () => {
    for (const f of ["app/TownyInterview.tsx", "components/towny/TownyFab.tsx"]) {
      const s = readFileSync(join(root, f), "utf8");
      expect(s, f).toContain("queue.current.push(t)");
      expect(s, f).not.toMatch(/if \(!t \|\| busy\) return/);
    }
  });
});
