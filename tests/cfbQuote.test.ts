// NYC proposal yes/no lines (Civic, Oct 30): the CFB voter guide's own sentences, copied verbatim from nycvotes.org,
// shown as 'NYC Campaign Finance Board voter guide: "..."' with the CFB page as the chip. Both lines or neither.
import { describe, it, expect, vi } from "vitest";

const YES = 'A "yes" vote speeds up process to use public space while maintaining community input.';
const NO = 'A "no" vote maintains longer process with mandatory public hearing to use public space and Council review of sidewalk cafes.';
const P1 = "https://www.nycvotes.org/whats-on-the-ballot/2026-general-election-voter-guide/ballot-proposals-2026/ballot-proposal-1/";
// Fixture: nyc-prop-2 with only its yes sentence, to prove a lone quote is never shown next to our own summary.
vi.mock("../data/measures.json", async (orig) => {
  const d = structuredClone(((await orig()) as { default: { measures: { id: string; ifYes: object; ifNo: object }[] } }).default);
  const m = d.measures.find((x) => x.id === "nyc-prop-2")!;
  delete (m.ifNo as { cfbQuote?: string }).cfbQuote;
  return { default: d };
});
const { answerFollowup, CFB_GUIDE } = await import("../lib/towny/followup");
const { measuresFor, measureSide, cfbPair } = await import("../lib/measures");
const ask = (q: string) => answerFollowup({ zip: "10001", question: q, answers: {} }, { useModel: false, live: false });

describe("NYC proposal CFB quotes", () => {
  it("Proposal 1: both CFB sentences, character for character, attributed, confirmed against the nycvotes.org page", async () => {
    const m = measuresFor("10001").find((x) => x.id === "nyc-prop-1")!;
    expect(m.ifYes?.cfbQuote).toBe(YES);
    expect(m.ifNo?.cfbQuote).toBe(NO);
    expect(m.cfbSource).toBe(P1);
    expect(measureSide(m, "ifYes")).toEqual({ text: `${CFB_GUIDE}: "${YES}"`, sourceUrl: P1, cfb: true });
    expect(measureSide(m, "ifNo")).toEqual({ text: `${CFB_GUIDE}: "${NO}"`, sourceUrl: P1, cfb: true });
    const r = await ask("What is Proposal 1?");
    expect(r.reply).toContain(`${CFB_GUIDE}: "${YES}" [nycvotes.org]`);
    expect(r.reply).toContain(`${CFB_GUIDE}: "${NO}" [nycvotes.org]`);
    expect(r.reply).not.toContain("A no vote: Keeps the longer process");
    expect(r.claims.find((c) => c.id === "nyc-prop-1.yes")?.status).toBe("confirmed");
    expect(r.claims.find((c) => c.id === "nyc-prop-1.no")?.status).toBe("confirmed");
  });
  it("a measure with only one CFB sentence shows neither (never mixed with our summary)", async () => {
    const m = measuresFor("10001").find((x) => x.id === "nyc-prop-2")!;
    expect(cfbPair(m)).toBeNull();
    expect(measureSide(m, "ifYes")?.cfb).toBe(false);
    const r = await ask("What is Proposal 2?");
    expect(r.reply).not.toContain(CFB_GUIDE);
  });
});
