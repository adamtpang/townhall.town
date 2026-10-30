/** QA P2 (60582ae): data notes keep their technical basis (ZCTA, ACS table ids, "TENTATIVE") for the record and for
 *  link titles; the visible UI gets the same fact in plain words. Never changes a number. */
export function plain(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(/^SPLIT( \(sliver\))?:\s*/, "")
    .replace(/^unsure:\s*/i, "Unsure: ")
    .replace(/\s*\(ZCTA\)/g, "")
    .replace(/\.?\s*(This may be an?|Possible) edge artifact[^.;]*(;\s*verify by address)?\.?/gi, ". Check by address.")
    .replace(/\bNYC BOE\b/g, "NYC Board of Elections")
    .replace(/\((marked )?TENTATIVE,\s*/g, "(draft, ")
    .replace(/\bTENTATIVE contest list\b/g, "draft contest list")
    .replace(/\bTENTATIVE\b/g, "draft")
    .replace(/Census ACS 2024 5-year|ACS 2024 5-year/g, "Census estimate")
    .replace(/Census ACS 5-year estimate|ACS 5-year estimate/g, "Census estimate")
    .replace(/Census estimate \((\d{4})-(\d{4})\)/g, "Census estimate, $1\u2013$2")
    .replace(/,?\s*ZCTA level,?/g, ",")
    .replace(/\bZCTA\b/g, "ZIP area")
    .replace(/\s*\(?\b[BC]\d{5}[A-Z]?\b\)?/g, "")
    .replace(/\s+,/g, ",").replace(/,\s*\)/g, ")").replace(/\(\s*,\s*/g, "(").replace(/\.\s*\./g, ".").replace(/\s{2,}/g, " ")
    .trim();
}
