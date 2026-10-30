import { describe, it, expect } from "vitest";
import { findQuotes, textOf } from "../lib/research";
import { limited } from "../lib/rateLimit";
describe("research", () => {
  it("quotes verbatim sentences only, skipping boilerplate", () => {
    const t = textOf("<nav>Home Donate</nav><p>I will fight to lower property taxes for every homeowner in Travis County.</p><p>Subscribe to our newsletter for updates on taxes and more.</p><script>var tax=1</script>");
    const q = findQuotes(t, ["taxes", "housing"]);
    expect(q).toEqual([{ issue: "taxes", quote: "I will fight to lower property taxes for every homeowner in Travis County." }]);
  });
  it("returns nothing when no issue is mentioned", () => { expect(findQuotes(textOf("<p>Thank you for visiting this campaign website today, friends.</p>"), ["housing"])).toEqual([]); });
  it("rate limits at 10/min with 429 JSON", async () => {
    const req = new Request("http://x/api", { headers: { "x-forwarded-for": "203.0.113.9" } });
    for (let i = 0; i < 10; i++) expect(limited(req)).toBeNull();
    const r = limited(req)!; expect(r.status).toBe(429); expect((await r.json()).error).toBe("rate_limited");
  });
});
