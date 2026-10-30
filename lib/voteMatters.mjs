import data from "../data/vote_matters.json" with { type: "json" };
const n = (x) => x.toLocaleString("en-US");
/** One sourced "Your vote matters most here" sentence for a ZIP, or null (omit when unsourced).
 *  Source labels are 3 words or fewer; the full citation rides in each link's title. */
export function voteMatters(zip) {
  const r = data.zips[zip];
  if (!r || !r.castSourceUrl) return null;
  if (r.kind === "turnout") {
    // Registered non-voters: registered minus ballots counted, both from the one official reconciliation.
    const stayedHome = r.registered - r.cast;
    if (!(r.registered > 0) || !(stayedHome > 0)) return null;
    return {
      margin: null, stayedHome, basis: "registered minus ballots counted (official county reconciliation)",
      text: `${n(r.cast)} of ${n(r.registered)} registered ${r.county} voters cast a ballot in ${r.election}; ${n(stayedHome)} ${r.who} didn't.`,
      sources: [
        { label: r.castSourceLabel, title: r.castSourceTitle, url: r.castSourceUrl },
        ...(r.supplementUrl ? [{ label: r.supplementLabel, title: r.supplementTitle, url: r.supplementUrl }] : []),
      ],
    };
  }
  if (!r.sourceUrl || !r.eligibleSourceUrl) return null;
  const stayedHome = r.eligible - r.cast;
  const margin = Math.abs(r.yes - r.no);
  const pts = ((margin / r.total) * 100).toFixed(1);
  return {
    margin, stayedHome, basis: "adult citizens (Census ACS 2024 1-year, B29001) minus ballots cast in SF (Statement of Vote)",
    text: `${n(margin)} votes decided ${r.short} in ${r.year}; ${n(stayedHome)} ${r.who} didn't vote.`,
    sources: [
      { label: `${r.short} results`, title: `Statement of Vote: ${r.contest}, ${n(r.total)} cast, a ${pts}-point gap, the closest of ${r.closestOf}`, url: r.sourceUrl },
      { label: "SF ballots cast", title: `Statement of Vote, voter participation by county: ${n(r.cast)} ballots cast in San Francisco`, url: r.castSourceUrl },
      { label: "Census ACS 2024", title: `Adult citizens in San Francisco: ${n(r.eligible)} (Census ACS 2024 1-year, table B29001)`, url: r.eligibleSourceUrl },
    ],
  };
}
