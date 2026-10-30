/** QA P1: model narration must never show tool syntax. Anything with tool_code, default_api, print( or a
 *  backtick is replaced with deterministic text built from the ballot counts. */
const BAD = /tool_code|default_api|print\(|`/i;
export const UNSUPPORTED = "Austin, SF and NYC for now.";
export function cleanNarration(text, zip, races, measures) {
  const t = String(text ?? "").trim();
  if (t && !BAD.test(t)) return t;
  return `ZIP ${zip}: ${races} race${races === 1 ? "" : "s"} and ${measures} measure${measures === 1 ? "" : "s"} on the Nov 3, 2026 ballot. Each item below links to its source.`;
}
