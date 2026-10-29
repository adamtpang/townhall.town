// Issue overlap rules (Civic, hard requirements). Plain JS so node --test can run it without a TS toolchain.
// 3-bucket model: each answer is Yes (+5), Neutral (0) or No (-5), or null (unanswered).
// - Counted issues: the voter answered Yes or No AND the candidate has a sourced, non-zero stance value.
//   Neutral, unanswered, unmapped and "No public statement found" (value null) are all left out, never counted against anyone.
// - Overlap = same side (same sign).
// - Fewer than 2 counted issues: no count shown. Never a percentage on screen (count only).
// - Never sorts: rows come back in the order given (ballot order).
export const MIN_ISSUES = 2;
export const YES = 5, NEUTRAL = 0, NO = -5;
export const METHOD =
  "Counts only issues where you answered Yes or No and the candidate has a sourced position. An issue counts as overlap when you are on the same side. Neutral answers, unanswered questions and issues with no sourced position are left out, not counted against anyone.";

const side = (x) => (typeof x === "number" && x !== 0 ? Math.sign(x) : 0);

/** @param {Record<string, number|null|undefined>} answers @param {Record<string, {value:number|null}>} stances @param {string[]} issueIds */
export function overlapFor(answers, stances, issueIds) {
  const counted = issueIds.filter((id) => side(answers[id]) !== 0 && stances[id] && side(stances[id].value) !== 0);
  const agree = counted.filter((id) => side(answers[id]) === side(stances[id].value));
  const n = counted.length;
  return { n, agree: agree.length, counted, pct: n >= MIN_ISSUES ? Math.round((agree.length / n) * 100) : null, enough: n >= MIN_ISSUES };
}

/** Rows in the given (ballot) order. Never sorted by pct. */
export function overlapRows(cands, answers, stancesOf, issueIds) {
  return cands.map((c) => ({ c, st: stancesOf(c.name), o: overlapFor(answers, stancesOf(c.name), issueIds) }));
}

export const overlapLabel = (name, o) => `Your answers overlap with ${name} on ${o.agree} of ${o.n} issues they've stated`;

/** Bucket an old slider value (-5..+5) into Yes/Neutral/No. */
export const bucket = (v) => (typeof v !== "number" ? null : v > 0 ? YES : v < 0 ? NO : NEUTRAL);

/** Migrate older stored answers into th-answers-v1 shape. */
export function migrateAnswers(old) {
  const out = {};
  for (const [k, v] of Object.entries(old || {})) out[k] = bucket(v);
  return out;
}

/** Store a button press: tapping the selected bucket again clears it. yesMeansPole 'low' flips the sign. */
export function press(answers, id, choice, yesMeansPole = "high") {
  const flip = yesMeansPole === "low" ? -1 : 1;
  const val = choice === "yes" ? YES * flip : choice === "no" ? NO * flip : NEUTRAL;
  const cur = answers[id];
  return { ...answers, [id]: cur === val ? null : val };
}
/** Which button is selected for a stored value. */
export function choiceOf(v, yesMeansPole = "high") {
  if (typeof v !== "number") return null;
  if (v === 0) return "neutral";
  const flip = yesMeansPole === "low" ? -1 : 1;
  return v * flip > 0 ? "yes" : "no";
}

/** Sourced stances (non-zero, numeric) among the issues asked. One threshold everywhere: < MIN_ISSUES means "Not enough sourced positions". */
export const sourcedIdsOf = (stances, issueIds) => issueIds.filter((id) => stances[id] && side(stances[id].value) !== 0);
export const sourcedCount = (stances, issueIds) => sourcedIdsOf(stances, issueIds).length;

/** Per-candidate status for display: 'few' (under 2 sourced), 'answer' (sourced but under 2 of them answered Yes/No), 'ok'. */
export function overlapStatus(answers, stances, issueIds) {
  const o = overlapFor(answers, stances, issueIds);
  const sourcedIds = sourcedIdsOf(stances, issueIds); // independent of the voter's answers
  const sourced = sourcedIds.length;
  return { ...o, sourced, sourcedIds, status: sourced < MIN_ISSUES ? "few" : o.enough ? "ok" : "answer" };
}

/** issue_order.json yesMeansPole is numeric: +1 means Yes = the +5 ("high") pole, -1 means Yes = the -5 ("low") pole. */
export function poleName(n) {
  return n === -1 || n === "-1" || n === "low" ? "low" : "high";
}
/** A candidate's stance expressed on the Yes(+5) / No(-5) button scale: stance.value * yesMeansPole. */
export function buttonValue(stanceValue, yesMeansPole) {
  if (stanceValue === null || stanceValue === undefined) return null;
  const v = stanceValue * (yesMeansPole === -1 || yesMeansPole === "low" ? -1 : 1);
  return v === 0 ? 0 : v; // avoid -0
}
