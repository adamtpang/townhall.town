// Civic (Oct 30, 1:37 + 1:38 PM CT), Design (1:38 PM CT) and QA pre-pass on 1ee5f9c (1:39 PM CT), folded into one commit.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { curated, runningFor, UNSURE_ORDER } from "../lib/towny/answer";
import { ORDER_CONFIRMED, inOfficialOrder } from "../lib/ballotOrder";
import { faqFor, whenWhere, UNSURE_DATE, OFFICES } from "../lib/towny/faq";
import { routeTurn, OUT_OF_SCOPE } from "../lib/townyChat";
import { UNSUPPORTED_MESSAGE } from "../lib/site";
import { TOWNY_BRIEF } from "../lib/towny/brief";
import { townyFact } from "../lib/townyFacts";
import { ballotFor } from "../lib/tools";

const root = new URL("..", import.meta.url).pathname;
const src = (f: string) => readFileSync(root + f, "utf8");
const ZIPS = ["78701", "94103", "10001"] as const;
const OFFICE = { "78701": "https://votetravis.gov", "94103": "https://www.sf.gov/departments/department-elections", "10001": "https://vote.nyc" } as const;
// Adam, Oct 30 2:08 PM CT: who's-running and ballot-order replies link 94103's SF Department of Elections page on sf.gov.
const RUN_OFFICE = { ...OFFICE, "94103": "https://www.sf.gov/departments/department-elections" } as const;
const host = (u: string) => new URL(u).hostname.replace(/^www\./, "");
const ask = (zip: string, office: string) => runningFor(zip, `Who is running for ${office}?`);

describe("Civic 1: dates only from cited sources", () => {
  it("94103: early voting runs through Monday, November 2, 2026; Nov 3 is Election Day, not early voting", () => {
    const a = whenWhere("94103", "2026-10-30").a;
    expect(a).toContain("Early voting runs through Monday, November 2, 2026.");
    expect(a).toContain("Election Day is Tuesday, November 3, 2026.");
    expect(a).not.toMatch(/early voting[^.]*Nov(ember)? 3/i);
    expect(whenWhere("94103", "2026-11-02").a).toMatch(/Early voting ends today, Monday, November 2, 2026\./);
    expect(whenWhere("94103", "2026-11-03").a).toMatch(/Early voting ended Monday, November 2, 2026\./);
    const links = whenWhere("94103", "2026-10-30").links;
    expect(links[0]).toEqual({ label: "SF Department of Elections", url: "https://www.sf.gov/departments/department-elections" });
  });
  it("election_dates.json: the 94103 early-voting end is 2026-11-02 and no Nov 3 row sits under early voting", () => {
    for (const f of ["data/election_dates.json", "data/civic/election_dates.json"]) {
      const j = JSON.parse(src(f));
      const ev = (j.jurisdictions ?? j)["94103"].earlyVoting;
      expect(ev.end).toBe("2026-11-02");
      // Rebase onto 7c281a6 (Oct 30): election dates follow 7c281a6's data (c9892a4), which keeps the Election Day row in
      // dailyHours; Towny's early-voting reply still never says Nov 3 (checked below).
    }
    const f = townyFact("94103", "When does early voting end?", "2026-10-30")!;
    expect(f.reply).not.toMatch(/Nov 3/);
    expect(townyFact("94103", "When is early voting?", "2026-11-03")!.reply).toMatch(/ended on Nov 2/);
  });
  it("78701 (ends Fri Oct 30) and 10001 (through Sun Nov 1) are verified: dates, no unsure line", () => {
    expect(whenWhere("78701", "2026-10-30").a).toMatch(/Early voting ends today, Friday, October 30, 2026\./);
    expect(whenWhere("10001", "2026-10-30").a).toMatch(/Early voting runs through Sunday, November 1, 2026\./);
    for (const z of ZIPS) expect(whenWhere(z, "2026-10-30").a).not.toContain(UNSURE_DATE);
  });
  it("the unsure line is exact, and the office link comes first on every ZIP", () => {
    expect(UNSURE_DATE).toBe("Unsure: we couldn't confirm this in a cited source.");
    for (const z of ZIPS) expect(whenWhere(z, "2026-10-30").links[0].url).toBe(OFFICE[z]);
    expect(OFFICES["94103"].label).toBe("SF Department of Elections");
  });
});

describe("Civic 2 + QA P1: who is running, by office name, on all 3 ZIPs", () => {
  // Civic P1 (Oct 30, 2:58 PM CT): Governor is confirmed against the official sample ballot in 78701 and 10001 (sample ballot
  // linked first); 94103 keeps the exact unsure line with the office first. Ballotpedia is never first.
  it("ballot order: confirmed line + sample ballot where Civic confirmed it, else the exact unsure line; Ballotpedia only after", () => {
    const SAMPLE: Record<string, string> = { "78701": "https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Corrected-Final2.pdf", "10001": "https://img1.wsimg.com/isteam/ip/eb67ae7b-312c-407d-a59a-c4b41353c238/71AD_SampleBallot_Nov2026.pdf" };
    for (const z of ZIPS) {
      const c = ask(z, "Governor")!;
      expect(c.intent).toBe("running");
      expect(UNSURE_ORDER).toBe("Unsure: we couldn't confirm the ballot order in a cited source.");
      expect(c.reply).not.toMatch(/Listed in ballot order/);
      if (z === "94103") { expect(c.reply.endsWith(` ${UNSURE_ORDER}`)).toBe(true); expect(c.links[0].url).toBe(RUN_OFFICE[z]); }
      else { expect(c.reply.endsWith(` ${ORDER_CONFIRMED}`)).toBe(true); expect(c.reply).not.toContain(UNSURE_ORDER); expect(c.links[0].url).toBe(SAMPLE[z]); expect(c.links.some((l) => l.url === RUN_OFFICE[z])).toBe(true); }
      expect(c.links.slice(1).some((l) => host(l.url) === "ballotpedia.org")).toBe(true);
      expect(c.links.findIndex((l) => host(l.url) === "ballotpedia.org")).toBeGreaterThan(0);
    }
    expect(src("lib/townyFacts.ts")).not.toMatch(/in ballot order/);
  });
  it("Governor works on 94103 and 10001 (and 78701)", () => {
    expect(ask("78701", "Governor")!.reply).toMatch(/^Governor of Texas: Greg Abbott, /);
    expect(ask("94103", "Governor")!.reply).toMatch(/^Governor of California: /);
    expect(ask("10001", "governor")!.reply).toMatch(/^Governor and Lieutenant Governor: /);
  });
  it("'Senate' and 'senator' -> U.S. Senator on 78701 (official sample-ballot order: Paxton, Talarico, Brown); state senate races on 10001", () => {
    for (const q of ["Senate", "senator", "the senate"]) {
      const c = ask("78701", q)!;
      expect(c.reply).toMatch(/^U\.S\. Senator: Ken Paxton, James Talarico, Ted Brown\. /);
    }
    const ny = ask("10001", "Senate")!.reply;
    expect(ny).toMatch(/State Senator, District 47: /); expect(ny).toMatch(/State Senator, District 28: /);
    expect(ask("94103", "Senate")!.intent).toBe("running-none");
  });
  it("house / congress -> U.S. Representative or U.S. House; every matching race is listed", () => {
    for (const q of ["the House", "Congress", "congress"]) {
      const tx = ask("78701", q)!.reply;
      expect(tx).toMatch(/U\.S\. Representative, District 10: .+U\.S\. Representative, District 37: /);
      expect(tx).not.toMatch(/State Representative/);
      expect(ask("94103", q)!.reply).toMatch(/^U\.S\. House California District 11: /);
      expect(ask("10001", q)!.reply).toMatch(/^U\.S\. House New York District 12: /);
    }
  });
  it("mayor, council, attorney general on all 3 ZIPs", () => {
    for (const z of ZIPS) {
      expect(ask(z, "mayor")!.intent).toBe("running-none"); // no mayoral race on these ballots
      expect(ask(z, "attorney general")!.reply).toMatch(/^Attorney General of (Texas|California|New York): /);
    }
    expect(ask("78701", "city council")!.reply).toMatch(/^Austin City Council, District 9: /);
    expect(ask("94103", "council")!.reply).toMatch(/^Board of Supervisors, District 6: .+Board of Supervisors, District 8: /);
    expect(ask("10001", "council")!.reply).toMatch(/^Member of the City Council, 3rd Council District: /);
    expect(ask("78701", "lieutenant governor")!.reply).toMatch(/^Lieutenant Governor of Texas: /);
    expect(ask("78701", "lieutenant governor")!.reply).not.toMatch(/Governor of Texas: Greg/);
  });
  it("each name comes from the ballot data; nothing invented", () => {
    for (const z of ZIPS) for (const q of ["Senate", "Governor", "Congress", "council", "attorney general"]) {
      const c = ask(z, q)!; if (c.intent !== "running") continue;
      const b = ballotFor(z)!;
      let rest = c.reply.split(` ${UNSURE_ORDER}`).join("").split(` ${ORDER_CONFIRMED}`).join("");
      const line = (r: { id: string; title: string; candidates: { name: string }[] }) => `${r.title}: ${inOfficialOrder(z, r.id, r.candidates).map((x) => x.name).join(", ")}.`;
      while (rest.length) {
        const race = (b.races as { id: string; title: string; candidates: { name: string }[] }[]).find((r) => rest.startsWith(line(r)));
        expect(race, rest).toBeTruthy();
        rest = rest.slice(line(race!).length).trimStart();
      }
    }
  });
  it("QA P2-1: 'No record found. Searched: ...' links every host it names", () => {
    for (const z of ZIPS) {
      const c = ask(z, "dogcatcher")!;
      const named = c.reply.replace(/^No record found\. Searched: the \d{5} ballot from /, "").replace(/\.$/, "").split(", ");
      expect(named.length).toBeGreaterThan(1);
      expect(c.links.map((l) => host(l.url))).toEqual(named);
    }
  });
});

describe("Civic 3: out of scope inside the Towny chat", () => {
  const LINE = "Towny covers Austin (78701), San Francisco (94103) and New York City (10001) right now. For your ballot, check vote.gov.";
  it("77002, Houston and other ZIPs get the exact line with vote.gov linked; the ZIP box copy is unchanged", () => {
    expect(OUT_OF_SCOPE).toBe(LINE);
    for (const q of ["77002", "Houston", "What's on my ballot in Houston?", "90210"]) {
      const r = routeTurn(q, null);
      expect(r.kind).toBe("fixed");
      if (r.kind === "fixed") { expect(r.reply).toBe(LINE); expect(r.links).toEqual([{ label: "vote.gov", url: "https://vote.gov" }]); }
    }
    expect(UNSUPPORTED_MESSAGE).toBe("Austin, SF and NYC for now.");
    expect(src("components/towny/TownyFab.tsx")).toMatch(/r\.reply === OUT_OF_SCOPE[^\n]+links: r\.links/);
  });
});

describe("Civic FAQ (1:38 PM CT) and brief", () => {
  it("match and 3-ZIP answers are exact; vote.gov linked", () => {
    expect(faqFor("How are candidates matched?", null)!.a).toBe("It shows where each candidate's sourced positions overlap with your answers, which you give on a -2 to +2 scale.");
    const z = faqFor("Why only 3 ZIPs?", null)!;
    expect(z.a).toContain("checked against official sources");
    expect(z.a).not.toMatch(/by hand|Austin, SF and NYC for now/);
    expect(z.a).toMatch(/For other places, check vote\.gov\.$/);
    expect(z.links.map((l) => l.url)).toContain("https://vote.gov");
  });
  it("brief and notes agree with the new rules", () => {
    expect(TOWNY_BRIEF).toContain(UNSURE_ORDER);
    expect(TOWNY_BRIEF).toContain(UNSURE_DATE);
    expect(TOWNY_BRIEF).toContain(OUT_OF_SCOPE);
    expect(TOWNY_BRIEF).toMatch(/94103 runs through Monday, November 2, 2026/);
    expect(TOWNY_BRIEF).toContain("It shows where each candidate's sourced positions overlap with your answers, which you give on a -2 to +2 scale.");
    const md = readFileSync(new URL("../../notes/towny-faq.md", import.meta.url), "utf8");
    expect(md).toContain("It shows where each candidate's sourced positions overlap with your answers, which you give on a -2 to +2 scale.");
    expect(md).toContain("For other places, check vote.gov.");
    expect(md).toContain(UNSURE_ORDER);
    expect(md).toContain(OUT_OF_SCOPE);
  });
});

describe("Design (1:38 PM CT) and QA P2-2", () => {
  const fab = src("components/towny/TownyFab.tsx");
  it("button and header mark use theme tokens; no hardcoded navy, blue or ink", () => {
    expect(fab).toMatch(/bg-primary text-primary-foreground/);
    expect(fab).toMatch(/\["--k" as string\]: "hsl\(var\(--primary\)\)"/);
    expect(fab).toMatch(/<TownyMark size=\{40\} className="shrink-0 text-primary" \/>/);
    for (const f of ["components/towny/TownyFab.tsx", "components/towny/TownyMark.tsx"]) expect(src(f)).not.toMatch(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|navy/i);
  });
  it("composer: one border-input, focus-visible outline 2 / offset 2 / ring token; no box-shadow ring, no double border", () => {
    const at = fab.indexOf('id="towny-fab-say"', fab.indexOf("<form")); const ta = fab.slice(at, fab.indexOf("/>", at));
    expect(ta).toMatch(/\bborder border-input\b/);
    expect(ta).toMatch(/focus-visible:outline-2/); expect(ta).toMatch(/focus-visible:outline-offset-2/); expect(ta).toMatch(/focus-visible:outline-ring/);
    expect(ta).toMatch(/focus-visible:ring-0/); expect(ta).toMatch(/focus-visible:shadow-none/);
    expect(ta.match(/\bborder(-[a-z]+)?\b(?!-)/g)!.filter((x) => x.startsWith("border")).length).toBeLessThanOrEqual(2);
    expect(ta).not.toMatch(/border-black/);
  });
  it("phone sheet: dialog, aria-modal, focus trap, Esc returns focus to the button, body scroll lock while open", () => {
    expect(fab).toMatch(/role="dialog"/); expect(fab).toMatch(/aria-modal="true"/);
    expect(fab).toMatch(/e\.key !== "Tab"/); expect(fab).toMatch(/e\.key === "Escape"/);
    expect(fab).toMatch(/setOpen\(false\); requestAnimationFrame\(\(\) => fab\.current\?\.focus\(\)\)/);
    expect(fab).toMatch(/b\.overflow = "hidden"/); expect(fab).toMatch(/b\.overflow = prev/);
    expect(fab).toMatch(/lg:border/); expect(fab).toMatch(/border-border/);
  });
  it("each reply renders once: the log is the live region, no second copy", () => {
    expect(fab).toMatch(/role="log" aria-live="polite"/);
    expect(fab).not.toMatch(/setAnnounce|\{announce\}/);
    expect((fab.match(/aria-live/g) || []).length).toBe(1);
  });
});
