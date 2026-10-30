import data from "../data/vote_matters.json" with { type: "json" };
const n = (x) => x.toLocaleString("en-US");
/** One sourced "Your vote matters most here" sentence for a ZIP, or null (omit when unsourced). Detail lives in the sources. */
export function voteMatters(zip) {
  const r = data.zips[zip];
  if (!r || !r.castSourceUrl || !r.eligibleSourceUrl) return null;
  const stayedHome = r.eligible - r.cast;
  if (r.kind === "turnout") {
    if (!(r.registered > 0) || !(stayedHome > 0)) return null;
    return {
      margin: null, stayedHome,
      text: `${n(r.cast)} of ${n(r.registered)} registered ${r.county} voters cast a ballot in ${r.election}. ${n(stayedHome)} ${r.who} didn't vote.`,
      sources: [
        { label: r.castSourceLabel, url: r.castSourceUrl },
        ...(r.supplementUrl ? [{ label: r.supplementLabel, url: r.supplementUrl }] : []),
        { label: "Adult citizens (Census ACS 2024, B29001)", url: r.eligibleSourceUrl },
      ],
    };
  }
  if (!r.sourceUrl) return null;
  const margin = Math.abs(r.yes - r.no);
  const pts = ((margin / r.total) * 100).toFixed(1);
  return {
    margin, stayedHome,
    text: `${n(margin)} votes decided ${r.short} in ${r.year}. ${n(stayedHome)} ${r.who} didn't vote.`,
    sources: [
      { label: `Statement of Vote: ${r.contest}, ${n(r.total)} cast, a ${pts}-point gap, the closest of ${r.closestOf}`, url: r.sourceUrl },
      { label: "Ballots cast in SF", url: r.castSourceUrl },
      { label: "Adult citizens (Census ACS 2024, B29001)", url: r.eligibleSourceUrl },
    ],
  };
}
