import data from "../data/measures.json";

export type Sourced = { text: string; sourceUrl: string | null };
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
