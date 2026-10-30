// Issue-overlap grades (Adam, Oct 29 2026; preview only). One-line revert: set CANDIDATE_GRADES to false.
// Rules:
// - Computed only from the voter's Yes/No answers vs the candidate's sourced positions (lib/overlapCore.mjs).
// - Per-race gate (Civic, Oct 29 11:36 PM CT): a race shows grades only when Civic's eligibility file marks it
//   gradesEligible (or lists it in {races:[ids]}). The file is copied in by scripts/refresh-grades.sh into
//   lib/gradesEligibility.gen.mjs. FAIL CLOSED: no file, or no flag for a race, means no grades anywhere in it.
// - Judicial races, ballot measures and unopposed races never show grades, even if a file lists them.
// - A letter needs at least 2 compared issues (MIN_ISSUES); S and A need at least 3 (MIN_TOP_SAMPLE), else capped at B.
// - Candidates stay in ballot-data order (never sorted by grade). Grades are never sent by any API.
import ELIG from "./gradesEligibility.gen.mjs";
export const CANDIDATE_GRADES = true;

export const GRADE_NOTE = "issue overlap, not a recommendation";
/** S and A need a sample of at least this many compared issues (QA 4e15da7 P1); with fewer, the letter is capped at B. */
export const MIN_TOP_SAMPLE = 3;
/** Civic's label, word for word, shown next to every letter. */
export const gradeLabel = (agree, n) =>
  `Grade shows how many of your issue picks match this candidate's sourced stances (${agree} of ${n} issue${n === 1 ? "" : "s"}). It is not an endorsement or a rating of the candidate.`;
/** Plain rule, shown on screen. Must match the code below. */
export const GRADE_RULE =
  "Grades appear only in races Civic has checked as having comparable sourced records for every candidate (never court races, measures or unopposed races), and only once you and a candidate share at least 2 sourced issues you answered Yes or No. S means you match on every one, A on at least 3 of 4, B on at least half, C on fewer than half. S and A need at least 3 issues; with 2, the highest grade is B.";

/** S = matches on every compared issue; A = at least 3/4; B = at least 1/2; C = below 1/2. S/A need n >= MIN_TOP_SAMPLE. */
export function letterFor(agree, n) {
  if (!(n > 0) || agree < 0 || agree > n) return null;
  const r = agree / n;
  const g = r === 1 ? "S" : r >= 0.75 ? "A" : r >= 0.5 ? "B" : "C";
  return (g === "S" || g === "A") && n < MIN_TOP_SAMPLE ? "B" : g;
}

/** Normalise Civic's file to a Set of eligible race ids ("raceId" or "zip:raceId"). Accepts:
 *  {races:[ids]}; {races:{id:{gradesEligible}}}; {races:[{id|raceId, zip?, gradesEligible}]}; {zip:{id:{gradesEligible}}}; {zip:[{...}]}.
 *  Anything without an explicit gradesEligible === true (or not in a plain id list) is not eligible. @param {any} file */
export function eligibleSet(file) {
  const out = new Set();
  if (!file || typeof file !== "object") return out;
  const add = (id, zip) => { if (typeof id === "string" && id) out.add(zip ? `${zip}:${id}` : id); };
  const walk = (v, zip) => {
    if (Array.isArray(v)) for (const x of v) { if (typeof x === "string") add(x, zip); else if (x && x.gradesEligible === true) add(x.raceId ?? x.id ?? x.race, x.zip ?? zip); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (x && typeof x === "object" && !Array.isArray(x) && "gradesEligible" in x) { if (x.gradesEligible === true) add(x.raceId ?? x.id ?? k, x.zip ?? zip); } }
  };
  if (file.races) walk(file.races);
  for (const [k, v] of Object.entries(file)) if (/^\d{5}$/.test(k)) walk(v?.races ?? v, k);
  return out;
}
const DEFAULT_SET = eligibleSet(ELIG && ELIG.present ? ELIG.data : null);

/** Is this race allowed to show grades? Fail closed. @param {any} race @param {string|null} [zip] @param {Set<string>} [set] */
export function raceGradesEligible(race, zip, set = DEFAULT_SET) {
  if (!race || race.judicial || race.level === "measure" || race.measure || !Array.isArray(race.candidates) || race.candidates.length < 2) return false;
  return set.has(race.id) || (!!zip && set.has(`${zip}:${race.id}`));
}

/** @param {{status:string, agree:number, n:number}} o overlapStatus() result. race/zip/set: the per-race gate.
 * @param {boolean} judicial @param {number} [answered] @param {boolean} [enabled] @param {any} [race] @param {string|null} [zip] @param {Set<string>} [set] */
export function gradeFor(o, judicial, answered = 1, enabled = CANDIDATE_GRADES, race = null, zip = null, set = DEFAULT_SET) {
  if (!enabled || judicial || !(answered > 0) || !o || o.status !== "ok") return null;
  if (!raceGradesEligible(race, zip, set)) return null;
  return letterFor(o.agree, o.n);
}

/** Race-level fairness guards (design p11 item 6, corrected by Civic, Oct 30 12:51 AM CT). Letters show in a race only when
 *  (a) every candidate has at least MIN_SCORED_ISSUES scored stances (sourced, non-unsure, non-zero): defense in depth, and
 *  (c) every candidate shares at least MIN_ISSUES (2) compared issues with this voter (o.n).
 *  Otherwise no letter for anyone in the race; the "x of y issues" counts stay. A C on 0 of 2 is a real result and shows.
 *  Fail closed. Returns one grade per row (ballot order) and why letters were hidden, if they were. */
export const MIN_SCORED_ISSUES = 3;
/** Shown under a contested race whose letters were removed (eligibility gate, (a) or (c)); counts stay. Adam's wording, verbatim. */
// Design p14 #4 (Oct 30, 4:38 AM CT): shortened to fit one line at 390.
export const GRADES_ABSENT_LINE = "Letters need sourced records for every candidate.";
/** QA 94cf301 P2-E3 (Oct 30, 6:53 AM CT): the accurate reason when letters are hidden only because this voter shares
 *  fewer than 2 answered issues with at least one candidate (gradesForRace hidden === "overlap"). */
export const GRADES_OVERLAP_LINE = "Letters need at least 2 of your answered issues to overlap with each candidate's sourced stances.";
/** @param {string|null|undefined} hidden */
export const gradesAbsentLine = (hidden) => (hidden === "overlap" ? GRADES_OVERLAP_LINE : GRADES_ABSENT_LINE);
const OVERLAP_MIN = 2; // = MIN_ISSUES in lib/overlapCore.mjs
/** @param {any} race @param {{status:string, agree:number, n:number, sourced:number}[]} os @param {number} answered @param {string|null} [zip] @param {Set<string>} [set] @param {boolean} [enabled] */
export function gradesForRace(race, os, answered = 1, zip = null, set = DEFAULT_SET, enabled = CANDIDATE_GRADES) {
  const none = (hidden) => ({ grades: os.map(() => null), hidden });
  if (!enabled || !race || race.judicial || !(answered > 0)) return none(null);
  if (!raceGradesEligible(race, zip, set)) return none(race.level === "measure" || race.measure || !(race.candidates?.length >= 2) ? null : "eligibility"); // contested race outside Civic's list: explainer line
  if (!os.length || os.some((o) => !o || !(o.sourced >= MIN_SCORED_ISSUES))) return none("scored");
  if (os.some((o) => !(o.n >= OVERLAP_MIN))) return none("overlap");
  return { grades: os.map((o) => gradeFor(o, false, answered, enabled, race, zip, set)), hidden: null };
}
