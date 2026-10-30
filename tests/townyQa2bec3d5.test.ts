// Follow-up on 2bec3d5 (Adam, Oct 30 2:08 PM CT): 94103's office link is the SF Department of Elections page on sf.gov in the
// ballot-order and who's-running replies; on /card the overlap chip uses the card's own race list, never "Enter your ZIP".
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { curated, BALLOT_ORDER_LINE, SF_DOE } from "../lib/towny/answer";
import { OFFICES } from "../lib/towny/faq";

const root = new URL("..", import.meta.url).pathname;
const src = (f: string) => readFileSync(root + f, "utf8");

describe("94103 office link", () => {
  it("ballot order: the exact line, linked to the SF Department of Elections", () => {
    const r = curated("94103", "What order are candidates on my ballot?")!;
    expect(r.reply).toBe(BALLOT_ORDER_LINE);
    expect(r.links).toEqual([{ label: "SF Department of Elections", url: "https://www.sf.gov/departments/department-elections" }]);
  });
  it("who's running: the SF Department of Elections first, no sfelections.org", () => {
    const r = curated("94103", "Who is running for Governor of California?")!;
    expect(r.intent).toBe("running");
    expect(r.links[0]).toEqual(SF_DOE);
    expect(r.links.some((l) => /sfelections\.org/.test(l.url))).toBe(false);
  });
  it("other ZIPs keep their offices", () => {
    expect(curated("78701", "What order are candidates on my ballot?")!.links).toEqual([OFFICES["78701"]]);
    expect(curated("10001", "What order are candidates on my ballot?")!.links).toEqual([OFFICES["10001"]]);
  });
});

describe("/card overlap chip", () => {
  it("the card marks its own overlap section and the chip goes there", () => {
    expect(src("app/card/BallotCard.tsx")).toMatch(/data-card-overlap/);
    const fab = src("components/towny/TownyFab.tsx");
    expect(fab).toMatch(/\[data-card-overlap\]/);
  });
  it("a page with its own ZIP never says Enter your ZIP, and hides the chip with nowhere to go", () => {
    const fab = src("components/towny/TownyFab.tsx");
    expect(fab).toMatch(/if \(pageOwnZip\) return;\s*\n\s*return say\(\{ text: "Enter your ZIP on the page first/);
    expect(fab).toMatch(/c !== WHO_CHIP \|\| !pageOwnZip \|\| !!whoTarget\(\)/);
    expect(fab).toMatch(/m\.chips\.filter\(showChip\)\.map/);
  });
});
