// Civic #3 (Oct 30 1:54 PM CT): NYC Proposal 1 yes/no lines quote the CFB voter guide verbatim when the data has its
// sentence (cfbQuote). Today the data has no CFB sentence, so the current curated lines stay.
import { describe, it, expect, vi } from "vitest";

const YES = 'A "yes" vote speeds up process to use public space while maintaining community input.';
vi.mock("../data/measures.json", async (orig) => {
  const d = structuredClone(((await orig()) as { default: { measures: { id: string; ifYes: object; ifNo: object }[] } }).default);
  const m = d.measures.find((x) => x.id === "nyc-prop-1")!;
  (m.ifYes as { cfbQuote?: string }).cfbQuote = YES; // fixture: the live CFB sentence, as Civic would add it
  return { default: d };
});
const { answerFollowup, CFB_GUIDE } = await import("../lib/towny/followup");
const ask = (q: string) => answerFollowup({ zip: "10001", question: q, answers: {} }, { useModel: false, live: false });

describe("NYC Proposal 1 CFB quotes", () => {
  it("with cfbQuote: quoted character for character, attributed, and confirmed against the curated nycvotes.org record", async () => {
    const r = await ask("What is Proposal 1?");
    expect(r.reply).toContain(`NYC Campaign Finance Board voter guide: "${YES}" [nycvotes.org]`);
    expect(r.claims.find((c) => c.id === "nyc-prop-1.yes")?.status).toBe("confirmed");
    expect(r.reply).toContain("A no vote: Keeps the longer process");
  });
});
