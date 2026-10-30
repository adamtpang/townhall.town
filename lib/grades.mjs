// Issue-overlap grades (Adam, Oct 29 2026; preview only). One-line revert: set CANDIDATE_GRADES to false.
// Rules:
// - Computed only from the voter's Yes/No answers vs the candidate's sourced positions (lib/overlapCore.mjs).
// - No sourced positions (status "few"), or not enough answered: no grade.
// - Never for judicial candidates.
// - Only shown after at least one answer; candidates stay in ballot order (never sorted by grade).
// - It is issue overlap, not a recommendation. Grades are never sent by any API.
export const CANDIDATE_GRADES = true;

export const GRADE_NOTE = "issue overlap, not a recommendation";

/** S = agrees on every compared issue; A = at least 3/4; B = at least 1/2; C = below 1/2. */
export function letterFor(agree, n) {
  if (!(n > 0) || agree < 0 || agree > n) return null;
  const r = agree / n;
  return r === 1 ? "S" : r >= 0.75 ? "A" : r >= 0.5 ? "B" : "C";
}

/** @param {{status:string, agree:number, n:number}} o overlapStatus() result @param {boolean} judicial @param {number} answered */
export function gradeFor(o, judicial, answered = 1, enabled = CANDIDATE_GRADES) {
  if (!enabled || judicial || !(answered > 0) || !o || o.status !== "ok") return null;
  return letterFor(o.agree, o.n);
}
