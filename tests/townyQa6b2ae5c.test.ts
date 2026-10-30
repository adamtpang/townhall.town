// QA pre-pass on 6b2ae5c (Oct 30, 2:00 PM CT): ballot-order intent, out-of-scope places, one link per host, /card mount,
// short-viewport panel cap.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { curated, BALLOT_ORDER_LINE, asksOrder } from "../lib/towny/answer";
import { faqFor, OFFICES } from "../lib/towny/faq";
import { routeTurn, outOfScope, dedupeByHost, OUT_OF_SCOPE } from "../lib/townyChat";

const root = new URL("..", import.meta.url).pathname;
const src = (f: string) => readFileSync(root + f, "utf8");
const ZIPS = ["78701", "94103", "10001"] as const;
const host = (u: string) => new URL(u).hostname.replace(/^www\./, "");
const OOS = "Towny covers Austin (78701), San Francisco (94103) and New York City (10001) right now. For your ballot, check vote.gov.";

describe("P1-1 ballot order", () => {
  const QS = ["What order are candidates on my ballot?", "What's the ballot order?", "Who is listed first?", "Who is listed first on my ballot?",
    "What position on the ballot is Talarico?", "In what order do the names appear?", "Who's first on the ballot?"];
  it("every phrasing, on all 3 ZIPs: the exact unsure line and the official office link, no names", () => {
    expect(BALLOT_ORDER_LINE).toBe("Ballot order: Unsure, we haven't confirmed it against the official sample ballot yet.");
    for (const z of ZIPS) for (const q of QS) {
      const c = curated(z, q, "2026-10-30")!;
      expect(c.intent, `${z} ${q}`).toBe("ballot-order");
      expect(c.reply.split("\n")[0]).toBe(BALLOT_ORDER_LINE);
      expect(c.reply).toBe(BALLOT_ORDER_LINE);
      expect(c.links).toEqual([OFFICES[z]]);
    }
    expect(curated("94103", "What order are candidates on my ballot?")!.links[0].url).toBe("https://sfelections.org");
    expect(curated("78701", "ballot order")!.links[0].url).toBe("https://votetravis.gov");
    expect(curated("10001", "ballot order")!.links[0].url).toBe("https://vote.nyc");
  });
  it("does not fire on other questions", () => {
    for (const q of ["What's on my ballot?", "What do I need in order to vote?", "Who is running for Senate?", "Where do I vote?", "How do I order a mail ballot?"]) expect(asksOrder(q), q).toBe(false);
    expect(curated("94103", "What's on my ballot?")!.intent).not.toBe("ballot-order");
    const s = curated("78701", "Who is running for Senate?")!;
    expect(s.intent).toBe("running");
    for (const n of ["Talarico", "Paxton", "Brown"]) expect(s.reply).toContain(n);
  });
});

describe("P1-2 out of scope: other states, other cities, registering elsewhere", () => {
  const OUT = ["How do I register to vote in Ohio?", "Can I vote in Florida?", "What's on the ballot in New Jersey?", "Who is running in Chicago?",
    "When is early voting in Philadelphia?", "How do I register in another state?", "I'm registering elsewhere, what do I do?", "Polling places in Washington, DC?",
    "Is there a mayor race in Los Angeles?", "Register to vote in Pennsylvania"];
  it("the exact Civic line with vote.gov, from the server (curated) and the panel (routeTurn), on every ZIP", () => {
    expect(OUT_OF_SCOPE).toBe(OOS);
    for (const z of ZIPS) for (const q of OUT) {
      const c = curated(z, q)!;
      expect(c.reply, `${z} ${q}`).toBe(OOS);
      expect(c.links).toEqual([{ label: "vote.gov", url: "https://vote.gov" }]);
      const r = routeTurn(q, z);
      expect(r.kind, q).toBe("fixed");
      if (r.kind === "fixed") { expect(r.reply).toBe(OOS); expect(r.links).toEqual([{ label: "vote.gov", url: "https://vote.gov" }]); }
    }
  });
  it("New York, Texas, California and street or landmark names stay in scope", () => {
    const IN = ["How do I register to vote in New York?", "How do I register to vote in Texas?", "Who is running for Governor of California?",
      "Who is running for Governor of Texas?", "Where do I vote in New York City?", "Is there a polling place near Penn Station?", "Polling place on Florida St?",
      "Vote center near Washington Square?", "Polling site by the Colorado River?", "What about Pennsylvania Station?", "Is Vermont Street a polling place?",
      "Arkansas Street polling place", "What's on my ballot?", "Who is running for Senate?", "Who is the best candidate in Kansas Street area?"];
    for (const q of IN) expect(outOfScope(q), q).toBe(false);
    expect(curated("10001", "How do I register to vote in New York?")?.reply ?? "").not.toBe(OOS);
    expect(curated("78701", "Who is running for Senate?")!.reply).not.toBe(OOS);
  });
});

describe("P2 Searched hosts: one link per hostname", () => {
  it("dedupeByHost keeps the first link for each host", () => {
    expect(dedupeByHost([{ label: "a", url: "https://votetravis.gov" }, { label: "b", url: "https://www.votetravis.gov/early" }, { label: "c", url: "https://vote.gov" }]))
      .toEqual([{ label: "a", url: "https://votetravis.gov" }, { label: "c", url: "https://vote.gov" }]);
    expect(dedupeByHost(undefined)).toEqual([]);
  });
  it("78701 early voting and 10001 'Where do I vote?' list each host once, office first", () => {
    const cases: [string, string][] = [["78701", "When is early voting?"], ["78701", "When does early voting end?"], ["10001", "Where do I vote?"], ["94103", "Where do I vote?"]];
    for (const [z, q] of cases) {
      for (const links of [curated(z, q, "2026-10-30")!.links, faqFor(q, z, "2026-10-30")?.links ?? []]) {
        const hosts = links.map((l) => host(l.url));
        expect(new Set(hosts).size, `${z} ${q}`).toBe(hosts.length);
      }
      expect(host(curated(z, q, "2026-10-30")!.links[0].url)).toBe(host(OFFICES[z].url));
    }
    for (const z of ZIPS) for (const office of ["Senate", "Governor", "Mayor", "dogcatcher"]) {
      const hosts = curated(z, `Who is running for ${office}?`)!.links.map((l) => host(l.url));
      expect(new Set(hosts).size).toBe(hosts.length);
    }
    expect(src("components/towny/TownyFab.tsx")).toMatch(/links: m\.links \? dedupeByHost\(m\.links\)/);
  });
});

describe("P1-3 /card and P2 short viewports", () => {
  it("/card mounts the same Towny button and panel with its ZIP; printing hides them", () => {
    const page = src("app/card/page.tsx");
    expect(page).toMatch(/import TownyFab from "\.\.\/\.\.\/components\/towny\/TownyFab"/);
    expect(page).toMatch(/<TownyFab zip=\{zip\} \/>/);
    expect(page).toMatch(/if \(!zip \|\| !b\) redirect\("\/"\)/);
    const fab = src("components/towny/TownyFab.tsx");
    expect(fab).toMatch(/data-towny-fab[\s\S]*print:hidden/);
  });
  it("panel is capped at 70dvh on short viewports; header and composer don't shrink; only the log scrolls", () => {
    expect(src("app/globals.css")).toMatch(/@media \(max-height: 700px\) \{\s*\[data-towny-panel\] \{ max-height: 70dvh !important;/);
    const fab = src("components/towny/TownyFab.tsx");
    expect(fab).toMatch(/<header className="flex h-16 shrink-0/);
    expect(fab).toMatch(/<form className="flex shrink-0/);
    expect(fab).toMatch(/min-h-0 flex-1 overflow-y-auto/);
    expect(fab).not.toMatch(/text-xs|text-\[1[12]px\]/);
  });
});
