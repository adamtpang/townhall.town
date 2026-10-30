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
};
const ALL = (data as { measures: MeasureMath[] }).measures;

/** Measure rows for a ZIP: statewide first, then local, in file order. Every field carries its own source URL. */
export function measuresFor(zip: string): MeasureMath[] {
  return ALL.filter((m) => m.zips.includes(zip));
}

export const shortTitle = (t: string) =>
  t.replace(/^California Proposition /, "CA Prop ").replace(/^City of Austin Proposition /, "Austin Prop ").replace(/^SF Proposition /, "SF Prop ");
