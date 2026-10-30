import { describe, it, expect } from "vitest";
import { labelMarketPrices } from "../lib/api/agent";

const results = {
  getRaces: { races: [{ id: "tx-cd37", title: "U.S. Representative, District 37" }], measures: [] },
  getMarketOdds: { "tx-cd37": { status: "live", quotes: [{ outcomes: [{ name: "Greg Casar", prob: 0.98 }, { name: "Other", prob: 0.02 }] }] } },
};

describe("agent trace QA (Oct 30 prod check P1-5)", () => {
  it("labels a bare market number as a Polymarket price", () => {
    expect(labelMarketPrices("- U.S. Representative, District 37 is not competitive, with Greg Casar at 98%.", results)).toBe(
      "- U.S. Representative, District 37 is not competitive, with Greg Casar at Polymarket price 98%.",
    );
  });
  it("leaves already-labelled prices and non-market lines alone", () => {
    expect(labelMarketPrices("- Greg Casar leads at Polymarket price 98%.", results)).toBe("- Greg Casar leads at Polymarket price 98%.");
    expect(labelMarketPrices("- Prop A adds 2% to the rate.", results)).toBe("- Prop A adds 2% to the rate.");
  });
  it("never rewrites numbers that are not market prices", () => {
    expect(labelMarketPrices("- Greg Casar race: 51.7% statewide.", results)).toBe("- Greg Casar race: 51.7% statewide.");
  });
});
