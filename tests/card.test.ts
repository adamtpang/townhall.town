import { describe, it, expect } from "vitest";
import { encodeAnswers, decodeAnswers, cardPath } from "../lib/card.mjs";
describe("ballot card URL state", () => {
  const ids = ["housing", "taxes", "safety", "energy"];
  it("round-trips answers in the hash", () => {
    const a = { housing: 5, taxes: -5, safety: 0, energy: null };
    expect(encodeAnswers(a, ids)).toBe("yxn-");
    expect(decodeAnswers("yxn-", ids)).toEqual(a);
    expect(cardPath("78701", a, ids)).toBe("/card?zip=78701#a=yxn-");
  });
  it("ignores junk", () => { expect(decodeAnswers("zz", ids)).toEqual({ housing: null, taxes: null, safety: null, energy: null }); });
});
