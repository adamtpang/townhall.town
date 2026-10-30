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
    expect(r.reply).toContain(`${BALLOT_ORDER_LINE} That applies to these races:`); // v3.1: candidates named
    expect(r.links).toEqual([{ label: "California Secretary of State, voter status lookup", url: "https://voterstatus.sos.ca.gov/" }, { label: "SF Department of Elections", url: "https://www.sf.gov/departments/department-elections" }]);
  });
  it("who's running: the SF Department of Elections first, no sfelections.org", () => {
    const r = curated("94103", "Who is running for Governor of California?")!;
    expect(r.intent).toBe("running");
    expect(r.links[0]).toEqual(SF_DOE);
    expect(r.links.some((l) => /sfelections\.org/.test(l.url))).toBe(false);
  });
  it("other ZIPs keep their offices", () => {
    // Civic P1 (Oct 30, 2:58 PM CT): the confirmed sample ballot comes first (78701's is on votetravis.gov, one link per host).
    // v3.1 (Oct 30, 3:24 PM CT): plus the district lookup for the split races, and the Board's Find My Poll Site for 10001.
    expect(curated("78701", "What order are candidates on my ballot?")!.links).toEqual([{ label: "Travis County sample ballot", url: "https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Corrected-Final2.pdf" }, { label: "Texas Secretary of State, My Voter Portal (look up your districts by address)", url: "https://teamrv-mvp.sos.texas.gov/MVP/mvp.do" }]);
    expect(curated("10001", "What order are candidates on my ballot?")!.links).toEqual([{ label: "Copy of an official NYC Board of Elections ballot (New York County, Assembly District 71), posted on a third-party website, not the Board's", url: "https://img1.wsimg.com/isteam/ip/eb67ae7b-312c-407d-a59a-c4b41353c238/71AD_SampleBallot_Nov2026.pdf" }, { label: "Find My Poll Site / View Sample Ballot, NYC Board of Elections", url: "https://findmypollsite.vote.nyc/" }, OFFICES["10001"]]);
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

describe("SF uses one source everywhere in Towny (Adam, Oct 30 2:17 PM CT)", () => {
  it("when/where, the office table and the brief all use the SF Department of Elections on sf.gov", async () => {
    const { whenWhere, SF_DOE: doe } = await import("../lib/towny/faq");
    expect(OFFICES["94103"]).toEqual({ label: "SF Department of Elections", url: "https://www.sf.gov/departments/department-elections" });
    expect(OFFICES["94103"]).toBe(doe);
    const ww = whenWhere("94103", "2026-10-30");
    expect(ww.links[0]).toEqual(doe);
    expect(ww.a).toContain("SF Department of Elections");
    for (const f of ["lib/towny/faq.ts", "lib/towny/brief.ts", "lib/towny/answer.ts", "lib/townyChat.ts", "lib/townyFacts.ts", "components/towny/TownyFab.tsx"])
      expect(src(f)).not.toMatch(/sfelections\.org/);
    expect(src("lib/towny/brief.ts")).toContain("https://www.sf.gov/departments/department-elections");
  });
});
