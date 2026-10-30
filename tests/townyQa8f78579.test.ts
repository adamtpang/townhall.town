// QA delta on 8f78579 (Oct 30, 2026, 3:05 PM CT): two P1s and one P2, folded into v3.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { linkText, host } from "../lib/townyChat";
import { pollingLinks } from "../lib/towny/faq";
import { townyFact } from "../lib/townyFacts";
import { SF_LOOKUP_LABEL } from "../lib/endscreen.mjs";

const root = new URL("..", import.meta.url).pathname;
const src = (f: string) => readFileSync(root + f, "utf8");

describe("P1: two sfelections.org links get distinct labels", () => {
  it("SF lookup and Voter Portal show their own labels; a lone link still shows its host", () => {
    const links = pollingLinks("94103");
    expect(links.map((l) => host(l.url))).toEqual(["sfelections.org", "sfelections.org"]);
    expect(links.map((l) => linkText(l, links))).toEqual([SF_LOOKUP_LABEL, "Voter Portal"]);
    const all = [{ label: "SF Department of Elections", url: "https://www.sf.gov/departments/department-elections" }, ...links];
    expect(all.map((l) => linkText(l, all))).toEqual(["sf.gov", "SF Department of Elections polling place lookup", "Voter Portal"]);
  });
  it("the panel renders linkText, not the bare host", () => {
    const fab = src("components/towny/TownyFab.tsx");
    expect(fab).toMatch(/data-towny-source>\{linkText\(l, all\)\} ↗/);
    expect(fab).not.toMatch(/\{host\(l\.url\)\}/);
  });
});

describe("P1: the conversation grows at 300% zoom", () => {
  it("short viewports: full-height panel that scrolls as one; log at least 60dvh; composer pinned", () => {
    const css = src("app/globals.css");
    const block = /@media \(max-height: 700px\) \{([\s\S]*?)\n\}/.exec(css)![1];
    expect(block).not.toMatch(/70dvh/);
    expect(block).toMatch(/\[data-towny-panel\] \{[^}]*height: 100dvh !important;[^}]*overflow-y: auto;/);
    expect(block).toMatch(/\[data-towny-panel\] > \[data-towny-scroll\] \{ flex: 1 0 auto; min-height: 60dvh;/);
    expect(block).toMatch(/\[data-towny-panel\] > form \{ position: sticky; bottom: 0;/);
    expect(src("components/towny/TownyFab.tsx")).toMatch(/min-h-0 flex-1 overflow-y-auto px-4 py-4" data-towny-scroll>/);
  });
});

describe("P2: SF hours answer includes the Election Day row from the data", () => {
  it("94103 on Oct 30", () => {
    const r = townyFact("94103", "Where do I vote and what are the early voting hours?", "2026-10-30")!.reply;
    expect(r).toContain("Hours: Fri, Oct 30 to Mon, Nov 2 (weekdays): 8:00 AM-5:00 PM PT (City Hall Voting Center);");
    expect(r.endsWith(" Election Day, Tue, Nov 3: 7:00 AM-8:00 PM PT (City Hall Voting Center and all 501 polling places).")).toBe(true);
    const data = JSON.parse(src("data/election_dates.json"));
    expect(data.jurisdictions["94103"].earlyVoting.dailyHours).toContainEqual({ dates: "2026-11-03", hours: "7:00 AM-8:00 PM", appliesTo: "City Hall Voting Center and all 501 polling places" });
  });
  it("10001 and 78701 have no such row and are unchanged", () => {
    expect(townyFact("10001", "early voting hours", "2026-10-30")!.reply).not.toMatch(/Election Day/);
    expect(townyFact("78701", "early voting hours", "2026-10-30")!.reply).not.toMatch(/Election Day,/);
  });
});
