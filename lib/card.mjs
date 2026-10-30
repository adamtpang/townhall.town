// Ballot card URL state: answers ride in the URL hash (never sent to a server), one character per issue in Civic order.
const ENC = { 5: "y", 0: "n", [-5]: "x" };
/** {housing:5, taxes:-5, ...} + ordered ids -> "y-x..." ("-" = unanswered). */
export function encodeAnswers(answers, ids) {
  return ids.map((id) => (typeof answers?.[id] === "number" ? ENC[answers[id] > 0 ? 5 : answers[id] < 0 ? -5 : 0] : "-")).join("");
}
export function decodeAnswers(s, ids) {
  const out = {};
  ids.forEach((id, i) => { const c = String(s || "")[i]; out[id] = c === "y" ? 5 : c === "x" ? -5 : c === "n" ? 0 : null; });
  return out;
}
export const cardPath = (zip, answers, ids) => `/card?zip=${encodeURIComponent(zip)}#a=${encodeAnswers(answers, ids)}`;
