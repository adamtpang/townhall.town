// Issue overlap rules (Civic, hard requirements). Plain JS so node --test can run it without a TS toolchain.
// 5-bucket model (Adam 9:58 AM CT Oct 30): each answer is -2, -1, 0, +1 or +2 (stored as -5, -2.5, 0, 2.5, 5 so older
// Yes (+5) / Neutral (0) / No (-5) answers read as +2 / 0 / -2 with no rewrite), or null (unanswered).
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
  // Adam 9:58 AM CT Oct 30: 5 buckets (-2..+2). Each counted issue is weighted by how strongly you answered
  // (|+-2| = 1, |+-1| = 0.5), so pct = weight on the same side / total weight. With only +-2 answers this is agree / n.
  const w = (id) => Math.abs(answers[id]) / YES;
  const tw = counted.reduce((t, id) => t + w(id), 0), aw = agree.reduce((t, id) => t + w(id), 0);
  return { n, agree: agree.length, counted, pct: n >= MIN_ISSUES && tw > 0 ? Math.round((aw / tw) * 100) : null, enough: n >= MIN_ISSUES };
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

/** Sourced stances (non-zero, numeric) among the issues asked. One threshold everywhere: < MIN_ISSUES means no overlap count or grade; the row still lists what is sourced. */
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

/** The 5 buttons: -2..+2 on the question's agree scale (stored value = b * 2.5, flipped when Yes means the low pole). */
export const STEP = YES / 2;
export const BUCKETS = [
  { b: -2, label: "Strongly disagree" }, { b: -1, label: "Disagree" }, { b: 0, label: "Neutral" }, { b: 1, label: "Agree" }, { b: 2, label: "Strongly agree" },
];
export function press5(answers, id, b, yesMeansPole = "high") {
  const flip = yesMeansPole === "low" ? -1 : 1;
  const val = b === 0 ? 0 : b * STEP * flip;
  return { ...answers, [id]: answers[id] === val ? null : val };
}
/** Which of the 5 buttons a stored value selects (old +-5 answers select +-2). */
export function bucketOf(v, yesMeansPole = "high") {
  if (typeof v !== "number") return null;
  if (v === 0) return 0;
  const flip = yesMeansPole === "low" ? -1 : 1;
  return Math.max(-2, Math.min(2, Math.round((v * flip) / STEP)));
}
/** Stored answers from any older shape: numbers pass through (+-5 = +-2), "yes"/"neutral"/"no" become +5/0/-5. */
export function normalizeAnswers(a) {
  const out = {};
  for (const [k, v] of Object.entries(a || {})) out[k] = typeof v === "number" ? v : v === "yes" ? YES : v === "no" ? NO : v === "neutral" ? NEUTRAL : null;
  return out;
}
/** Record (accountability, Adam 9:58 AM): of the N issues asked for this ZIP, how many have a sourced stance or a
 *  recorded vote in shipped data (value not null and a source URL). score = round(100 * X / N). Never a letter. */
export function recordFor(stances, issueIds) {
  const ids = issueIds.filter((id) => stances[id] && stances[id].value !== null && stances[id].value !== undefined && stances[id].sourceUrl);
  const N = issueIds.length;
  return { x: ids.length, n: N, ids, score: N ? Math.round((100 * ids.length) / N) : 0 };
}
export const RECORD_METHOD = "Record = issues with a sourced stance or recorded vote, out of the issues asked for your ZIP. Score = 100 x that share, rounded. It measures how much is on the record, not whether a position is right.";
