/** QA 7391b20 P2 dead links: candidate-facing links are shown only if they passed scripts/check-links.mjs.
 *  Dead (404/410/5xx/unreachable/http-only) links are hidden; http links whose https version answers are upgraded. */
import STATUS from "../data/link-status.json";
const S = STATUS as { dead: Record<string, string>; replace: Record<string, string> };
// Manual replacement checked by QA (7391b20 report): the candidate's live Ballotpedia page.
const MANUAL: Record<string, string> = { "https://ballotpedia.org/Maria_Luisa_Flores": "https://ballotpedia.org/Lulu_Flores" };
export function liveUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  const r = MANUAL[u] ?? S.replace[u] ?? u;
  if (S.dead[r] || !/^https:\/\//.test(r)) return null;
  return r;
}
