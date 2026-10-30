import { describe, it, expect } from "vitest";
import { findQuotes, findOwnWords, ownIssueLinks, sameSite, textOf } from "../lib/research";
import { limited } from "../lib/rateLimit";
describe("research", () => {
  // Civic rule (b): own words, in quotation marks, the candidate named as speaker, exact substring of the page text.
  const page = textOf(`<p>Smith has long said rents are too high and wants more housing for working families.</p>
<p>“We need to build more housing so families can afford to stay in Austin,” Smith said at a forum.</p>
<p>Jones said, "Property taxes are too high and we have to cut the city budget now for everyone."</p>
<p>"Public safety means more police officers walking a beat in every neighborhood," she said.</p>
<p>"Our schools need more teachers and better pay for every one of them," said Smith's opponent.</p>
<p>I will fight to lower property taxes for every homeowner in Travis County.</p>`);
  it("keeps only quoted words attributed to the candidate by name", () => {
    const q = findQuotes(page, ["housing", "taxes", "safety", "education"], 1, "Jane Smith");
    expect(q).toEqual([{ issue: "housing", quote: "We need to build more housing so families can afford to stay in Austin" }]);
    for (const x of q) expect(page).toContain(x.quote);
  });
  it("never counts reporter narration, unquoted page copy, pronoun or other speakers", () => {
    const q = findQuotes(page, ["taxes", "safety", "education"], 1, "Jane Smith");
    expect(q).toEqual([]);
  });
  it("returns nothing without a candidate name", () => { expect(findQuotes(page, ["housing"])).toEqual([]); });
  it("rate limits at 10/min with 429 JSON", async () => {
    const req = new Request("http://x/api", { headers: { "x-forwarded-for": "203.0.113.9" } });
    for (let i = 0; i < 10; i++) expect(limited(req)).toBeNull();
    const r = limited(req)!; expect(r.status).toBe(429); expect((await r.json()).error.code).toBe("rate_limited"); expect(r.headers.get("retry-after")).toBeTruthy();
  });
});

describe("QA P1 #1: own-site words vs third-party pages", () => {
  const own = "Priorities\nHousing\nAs governor, I will treat housing like the essential infrastructure it is. We will build more.\n“Becerra will cut every tax for every family in this state,” said a supporter.";
  it("own campaign site: first-person sentence counts, exact substring", () => {
    const q = findOwnWords(own, ["housing"], 1);
    expect(q).toEqual([{ issue: "housing", quote: "As governor, I will treat housing like the essential infrastructure it is." }]);
    expect(own.includes(q[0].quote)).toBe(true);
  });
  it("own site: quoted text from someone else never counts as theirs", () => {
    expect(findOwnWords(own, ["taxes"], 1)).toEqual([]);
  });
  it("third-party page: the same unquoted sentence does not count; quotes need the candidate named", () => {
    expect(findQuotes(own, ["housing"], 1, "Xavier Becerra")).toEqual([]);
    const news = "“As governor, I will treat housing like the essential infrastructure it is,” Becerra said at the rally.";
    expect(findQuotes(news, ["housing"], 1, "Xavier Becerra").map((x) => x.quote)).toEqual(["As governor, I will treat housing like the essential infrastructure it is"]);
  });
  it("finds the candidate's issue pages and recognises their own site", () => {
    expect(ownIssueLinks('<a href="/priorities/">P</a><a href="https://other.com/issues">x</a>', "https://xavierbecerra2026.com/")).toEqual(["https://xavierbecerra2026.com/priorities/"]);
    expect(sameSite("https://www.xavierbecerra2026.com/priorities/", "https://xavierbecerra2026.com/")).toBe(true);
    expect(sameSite("https://ballotpedia.org/Xavier_Becerra", "https://xavierbecerra2026.com/")).toBe(false);
  });
});
