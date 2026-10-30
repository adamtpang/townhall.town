import { it, expect } from "vitest";
import { voteMatters } from "../lib/voteMatters.mjs";
it("sourced margin for SF, omitted elsewhere", () => {
  const v = voteMatters("94103")!;
  expect(v.margin).toBe(216323);
  expect(v.stayedHome).toBe(204763);
  expect(v.sources.every((s) => s.url.startsWith("https://"))).toBe(true);
  expect(voteMatters("78701")).toBeNull();
  expect(voteMatters("10001")).toBeNull();
});
