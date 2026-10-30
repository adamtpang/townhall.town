// Pure strings and helpers for the printed ballot (app/card/PrintBallot.tsx). No data imports, so the client bundle stays small.

/** Approved by Adam 2:39 PM CT Oct 30 (via Design). Printed only when Civic's verbatim booth rule for the state is confirmed. */
export const BOOTH_LINE = "You may bring this sheet into the voting station";
/** Printed once above the races when any race's candidate order isn't confirmed against an official sample ballot. Exact text (Design addendum). */
export const ORDER_UNSURE_LINE = "Ballot order: Unsure, we haven't confirmed it against the official sample ballot yet.";
/** Design spec 4.2, verbatim. */
export const NON_ENDORSEMENT = "Your notes, not an endorsement. townhall.town does not endorse candidates.";
/** The one call to action for the printed sheet (Adam approved this exact label). */
export const PRINT_CTA = "Print or download your ballot";

/** Display only: drop the party text when it just repeats the candidate's name (e.g. "Karen Ortiz" / "Karen Ortiz (independent line)"). Data is unchanged. */
export function displayParty(name: string, party?: string | null): string | null {
  if (!party) return null;
  const norm = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+party$/i, "").trim().toLowerCase();
  return norm(party) === norm(name) ? null : party;
}
