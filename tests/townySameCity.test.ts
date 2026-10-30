// Civic, Oct 30 2:10 PM CT: another part of a covered city gets that city's same-city line (not OUT_OF_SCOPE). A race on
// every ballot in that city is answered from the covered ZIP's data first, with the same-city line as a note.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { curated, SF_DOE } from "../lib/towny/answer";
import { routeTurn, sameCity, cityOfZip, outOfScope, OUT_OF_SCOPE, SAME_CITY } from "../lib/townyChat";

const NYC = "Towny shows the ballot for ZIP 10001 in Manhattan. Other parts of New York City have different races on their ballots. For yours, check vote.nyc.";
const ATX = "Towny shows the ballot for ZIP 78701 in downtown Austin. Ballots in other ZIPs have different races. For yours, check your county election office or vote.gov.";
const SF = "Towny shows the ballot for ZIP 94103 in San Francisco. Other parts of the city have different district races on their ballots. For yours, check the SF Department of Elections.";
const src = (f: string) => readFileSync(new URL("..", import.meta.url).pathname + f, "utf8");

describe("same-city lines, exactly as Civic wrote them", () => {
  it("strings and links", () => {
    expect(SAME_CITY["10001"]).toEqual({ reply: NYC, links: [{ label: "vote.nyc", url: "https://vote.nyc" }] });
    expect(SAME_CITY["78701"]).toEqual({ reply: ATX, links: [{ label: "vote.gov", url: "https://vote.gov" }] });
    expect(SAME_CITY["94103"]).toEqual({ reply: SF, links: [SF_DOE] });
    expect(SF_DOE.url).toBe("https://www.sf.gov/departments/department-elections");
  });
});

describe("other parts of a covered city", () => {
  const line: [string, string, string, string][] = [
    ["10001", "What's on the ballot in Brooklyn?", NYC, "https://vote.nyc"],
    ["10001", "Where do I vote in the Bronx?", NYC, "https://vote.nyc"],
    ["10001", "I'm in Staten Island", NYC, "https://vote.nyc"],
    ["10001", "What's on my ballot in 11201?", NYC, "https://vote.nyc"],
    ["10001", "Who is running for state senate in Queens?", NYC, "https://vote.nyc"],
    ["78701", "78759", ATX, "https://vote.gov"],
    ["78701", "What's on my ballot in 78759?", ATX, "https://vote.gov"],
    ["78701", "Who's running for city council in east Austin?", ATX, "https://vote.gov"],
    ["94103", "What's on the ballot in the Sunset?", SF, SF_DOE.url],
    ["94103", "94110", SF, SF_DOE.url],
    ["94103", "Who is running for supervisor in Noe Valley?", SF, SF_DOE.url],
  ];
  for (const [zip, q, reply, url] of line) it(`${zip} "${q}": the same-city line only`, () => {
    const r = curated(zip, q)!;
    expect(r.reply).toBe(reply);
    expect(r.links.map((l) => l.url)).toEqual([url]);
    expect(r.reply).not.toContain(OUT_OF_SCOPE);
    // The panel sends it to the server with the page's own ZIP; never OUT_OF_SCOPE or "Which ZIP?".
    expect(routeTurn(q, zip)).toEqual({ kind: "ask", zip });
  });

  const race: [string, string, RegExp, string][] = [
    ["10001", "Who's running for governor in Brooklyn?", /^Governor and Lieutenant Governor: /, NYC],
    ["78701", "Who is running for Senate in east Austin?", /^U\.S\. Senator: /, ATX],
    ["78701", "Who's running for governor in 78759?", /^Governor of Texas: /, ATX],
    ["94103", "Who is running for governor in 94110?", /^Governor of California: /, SF],
    ["94103", "Who is running for Public Defender in the Mission District?", /^Public Defender: /, SF],
  ];
  for (const [zip, q, starts, note] of race) it(`${zip} "${q}": the answer from ${zip}'s data, then the same-city note`, () => {
    const r = curated(zip, q)!;
    expect(r.reply).toMatch(starts);
    expect(r.reply.endsWith(` ${note}`)).toBe(true);
    expect(r.reply).toContain("Ballot order: Unsure, we haven't confirmed it against the official sample ballot yet.");
    const hosts = r.links.map((l) => new URL(l.url).hostname);
    expect(new Set(hosts).size).toBe(hosts.length);
    expect(r.links.map((l) => l.url)).toContain(SAME_CITY[zip as keyof typeof SAME_CITY].links[0].url);
  });

  it("the same answer with no place named is unchanged", () => {
    expect(curated("10001", "Who's running for governor?")!.reply).not.toContain(NYC);
  });

  it("ZIP ranges", () => {
    for (const z of ["10002", "10469", "10301", "11201", "11375", "11691"]) expect(cityOfZip(z)).toBe("10001");
    for (const z of ["78702", "78759", "78799"]) expect(cityOfZip(z)).toBe("78701");
    for (const z of ["94110", "94122", "94158"]) expect(cityOfZip(z)).toBe("94103");
    for (const z of ["10001", "78701", "94103", "77002", "90012", "94301", "11550", "78664", "78665", "78681", "78613", "78660"]) expect(cityOfZip(z)).toBeNull();
  });

  it("streets named like places are not a place", () => {
    expect(sameCity("Is there a polling place on Queens Blvd?")).toBeNull();
    expect(sameCity("Brooklyn Bridge")).toBeNull();
  });
});

describe("other cities and states keep OUT_OF_SCOPE", () => {
  for (const q of ["What's on the ballot in Chicago?", "Where do I vote in Ohio?", "Pflugerville", "Cedar Park", "Round Rock",
    "What's on the ballot in Round Rock?", "Who is running for Senate in Round Rock?", "78664", "78681", "77002", "90210", "Houston"]) it(q, () => {
    expect(curated("10001", q)?.reply ?? routeTurn(q, "10001").kind).not.toMatch(/^Towny shows the ballot/);
    expect(routeTurn(q, "10001")).toMatchObject({ kind: "fixed", reply: OUT_OF_SCOPE });
  });
  it("boroughs are no longer out of scope; Round Rock is its own city (Adam, 2:17 PM CT)", () => {
    for (const q of ["Brooklyn", "Queens", "the Bronx", "Staten Island"]) expect(outOfScope(q)).toBe(false);
    expect(outOfScope("Round Rock")).toBe(true);
    expect(sameCity("Round Rock")).toBeNull();
    const r = curated("78701", "Round Rock")!;
    expect(r.reply).toBe(OUT_OF_SCOPE);
    expect(r.links.map((l) => l.url)).toEqual(["https://vote.gov"]);
  });
});

describe("panel", () => {
  it("skips the covered ZIP's FAQ for another part of the city", () => {
    expect(src("components/towny/TownyFab.tsx")).toMatch(/sameCity\(t\) \? null : faqFor\(/);
  });
});
