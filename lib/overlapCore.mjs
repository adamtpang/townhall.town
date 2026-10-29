// Issue overlap rules (Civic, hard requirements). Plain JS so node --test can run it without a TS toolchain.
// - Only issues where the voter answered AND the candidate has a sourced stance count. Unmapped issues are no data, never disagreement.
// - Fewer than 2 such issues: no percentage ("Not enough sourced positions").
// - Percentage = share of counted issues where the voter and the candidate are on the same side (same sign, or within 1 step).
// - Never sorts: returns rows in the order given (ballot order).
export const MIN_ISSUES = 2;
export const METHOD =
  "Counts only issues where you moved a slider and the candidate has a sourced position. An issue counts as overlap when you are on the same side of center, or within 1 step. Issues with no sourced position are left out, not counted against anyone.";

/** @param {Record<string, number|null|undefined>} answers @param {Record<string, {value:number}>} stances @param {string[]} issueIds */
export function overlapFor(answers, stances, issueIds) {
  const counted = issueIds.filter((id) => typeof answers[id] === "number" && stances[id] && typeof stances[id].value === "number");
  const agree = counted.filter((id) => {
    const a = /** @type {number} */ (answers[id]), v = stances[id].value;
    return a * v > 0 || Math.abs(a - v) <= 1;
  });
  const n = counted.length;
  return { n, agree: agree.length, counted, pct: n >= MIN_ISSUES ? Math.round((agree.length / n) * 100) : null, enough: n >= MIN_ISSUES };
}

/** Rows in the given (ballot) order. Never sorted by pct. */
export function overlapRows(cands, answers, stancesOf, issueIds) {
  return cands.map((c) => ({ c, st: stancesOf(c.name), o: overlapFor(answers, stancesOf(c.name), issueIds) }));
}

export const overlapLabel = (name, o) => `Your answers overlap with ${name} on ${o.agree} of ${o.n} issues they've stated`;
