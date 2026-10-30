import data from "../data/vote_matters.json" with { type: "json" };
const n = (x) => x.toLocaleString("en-US");
/** Sourced "your vote matters here" line for a ZIP, or null (omit when unsourced). */
export function voteMatters(zip) {
  const r = data.zips[zip];
  if (!r || !r.sourceUrl || !r.castSourceUrl || !r.eligibleSourceUrl) return null;
  const margin = Math.abs(r.yes - r.no);
  const pts = ((margin / r.total) * 100).toFixed(1);
  const stayedHome = r.eligible - r.cast;
  return {
    margin, stayedHome,
    lead: `${n(margin)} votes`,
    text: `decided ${r.contest} out of ${n(r.total)} cast, a ${pts}-point gap. It was the closest of ${r.closestOf}.`,
    compare: `That year ${n(stayedHome)} eligible ${r.county} residents didn't vote.`,
    sources: [{ label: "Statement of Vote", url: r.sourceUrl }, { label: "Ballots cast", url: r.castSourceUrl }, { label: "Eligible residents (Census ACS)", url: r.eligibleSourceUrl }],
  };
}
