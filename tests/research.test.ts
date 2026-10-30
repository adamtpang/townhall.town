import { describe, it, expect } from "vitest";
import { findQuotes, textOf } from "../lib/research";
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
