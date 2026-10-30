/** How a sourced stance is shown, the same bar for every candidate (QA P2, 60582ae):
 *  - "vote": a roll-call record, shown as the vote itself.
 *  - "summary": text from a Ballotpedia page. Ballotpedia mixes its own summaries with candidates' words,
 *    so it is labeled "Ballotpedia summary" and never shown in quotation marks.
 *  - "quote": the candidate's own words (their own site, or a page quoting them), in quotation marks. */
export type StanceForm = "vote" | "summary" | "quote";
export function stanceForm(st: { voteRecord?: string | null; sourceUrl?: string | null }): StanceForm {
  if (st?.voteRecord) return "vote";
  try { if (/(^|\.)ballotpedia\.org$/i.test(new URL(String(st?.sourceUrl)).hostname)) return "summary"; } catch { /* no URL */ }
  return "quote";
}
