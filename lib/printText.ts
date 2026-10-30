// Pure strings and helpers for the printed ballot (app/card/PrintBallot.tsx). No data imports, so the client bundle stays small.

/** Approved by Adam 2:39 PM CT Oct 30 (via Design). Printed only when Civic's verbatim booth rule for the state is confirmed. */
export const BOOTH_LINE = "You may bring this sheet into the voting station";
/** Printed once above the races when any race's candidate order isn't confirmed against an official sample ballot. Exact text (Design addendum). */
// Civic, Oct 30 2:58 PM CT: races Civic confirmed against the official sample ballot (bp22 ballot_order_check).
export const ORDER_CONFIRMED_LINE = "Listed in the order on the official sample ballot.";
// The one sources line on the printed sheet (Design option a): the homepage "How it works" step 2 wording, "Read the sources."
export const SOURCES_LABEL = "Read the sources:";
// Adam, Oct 30 3:07 PM CT: "Yes, use the Texas phone line." TX (78701) only: /card directly above the print button and
// the TX PDF next to the booth line. Cited to TX Election Code §61.014(a) and SOS Advisory 2026-26 (Civic print24 URLs).
// No phone line for CA or NY (Civic: phone use there is unsure).
export const TX_PHONE_LINE = "Put your phone away inside the voting room; print this sheet instead.";
export const TX_PHONE_SOURCES = [
  { label: "TX Election Code §61.014(a)", url: "https://statutes.capitol.texas.gov/Docs/EL/htm/EL.61.htm" },
  { label: "SOS Advisory 2026-26", url: "https://www.sos.state.tx.us/elections/laws/advisory2026-26.shtml" },
] as const;
/** Design spec card-www (3:03 PM CT): the WHO tile count. */
export const pickedLine = (n: number, m: number) => `${n} of ${m} picked`;
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
