// Civic (Oct 30): a measure has both CFB sentences or none. Never one.
import { describe, it, expect } from "vitest";
import data from "../data/measures.json";

type F = { cfbQuote?: string; sourceUrl?: string | null } | undefined;
const ALL = (data as { measures: { id: string; ifYes?: F; ifNo?: F; cfbSource?: string }[] }).measures;

describe("CFB quotes come in pairs", () => {
  it("no measure has only one cfbQuote", () => {
    for (const m of ALL) expect(!!m.ifYes?.cfbQuote, m.id).toBe(!!m.ifNo?.cfbQuote);
  });
  it("every pair cites its nycvotes.org page, which is also each line's source", () => {
    const withPair = ALL.filter((m) => m.ifYes?.cfbQuote);
    expect(withPair.map((m) => m.id)).toEqual(["nyc-prop-1", "nyc-prop-2", "nyc-prop-3", "nyc-prop-4", "nyc-prop-5"]);
    for (const m of withPair) {
      const n = m.id.replace("nyc-prop-", "");
      const url = `https://www.nycvotes.org/whats-on-the-ballot/2026-general-election-voter-guide/ballot-proposals-2026/ballot-proposal-${n}/`;
      expect(m.cfbSource, m.id).toBe(url);
      expect(m.ifYes?.sourceUrl, m.id).toBe(url);
      expect(m.ifNo?.sourceUrl, m.id).toBe(url);
      expect(m.ifYes!.cfbQuote!, m.id).toMatch(/^A [“"]yes[”"] vote /);
      expect(m.ifNo!.cfbQuote!, m.id).toMatch(/^A [“"]no[”"] vote /);
    }
  });
});
