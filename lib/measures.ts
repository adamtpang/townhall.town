import data from "../data/measures.json";

export type Sourced = {
  text: string;
  sourceUrl: string | null;
  /** The NYC Campaign Finance Board voter guide's own yes/no-vote sentence, copied character for character (nycvotes.org).
   *  Only set by Civic from the live page; Towny quotes it verbatim with attribution. Never a paraphrase. */
  cfbQuote?: string;
};
export type MeasureMath = {
  id: string; title: string; zips: string[]; jurisdiction: string;
  cost: { value: string; sourceUrl: string | null }; whoPays: Sourced; whatChanges: Sourced; ifYes?: Sourced; ifNo?: Sourced; notes?: string; officialTitle?: string; officialTitleSource?: string;
  /** The CFB voter guide page both cfbQuotes were copied from (nycvotes.org). */ cfbSource?: string;
};
const ALL = (data as { measures: MeasureMath[] }).measures;

/** Measure rows for a ZIP: statewide first, then local, in file order. Every field carries its own source URL. */
export function measuresFor(zip: string): MeasureMath[] {
  return ALL.filter((m) => m.zips.includes(zip));
}

export const shortTitle = (t: string) =>
  t.replace(/^California Proposition /, "CA Prop ").replace(/^City of Austin Proposition /, "Austin Prop ").replace(/^SF Proposition /, "SF Prop ");

export const CFB_GUIDE = "NYC Campaign Finance Board voter guide";
const isCfb = (u?: string | null) => { try { return !!u && new URL(u).hostname.replace(/^www\./, "") === "nycvotes.org"; } catch { return false; } };
/** Both CFB voter-guide sentences, or none (Civic, Oct 30): a measure with only one cfbQuote never shows either, so a
 *  CFB line is never mixed with our own summary. The chip is the CFB page. */
export function cfbPair(m: Pick<MeasureMath, "ifYes" | "ifNo" | "cfbSource">): { yes: string; no: string; url: string } | null {
  const url = m.cfbSource ?? m.ifYes?.sourceUrl ?? null;
  if (!m.ifYes?.cfbQuote || !m.ifNo?.cfbQuote || !isCfb(url)) return null;
  return { yes: m.ifYes.cfbQuote, no: m.ifNo.cfbQuote, url: url! };
}
/** The yes or no line every renderer shows: the CFB sentence with attribution when the pair exists, else our summary. */
export function measureSide(m: MeasureMath, side: "ifYes" | "ifNo"): { text: string; sourceUrl: string | null; cfb: boolean } | null {
  const p = cfbPair(m);
  if (p) return { text: `${CFB_GUIDE}: "${side === "ifYes" ? p.yes : p.no}"`, sourceUrl: p.url, cfb: true };
  const f = side === "ifYes" ? (m.ifYes ?? m.whatChanges) : m.ifNo;
  return f ? { text: f.text, sourceUrl: f.sourceUrl, cfb: false } : null;
}
