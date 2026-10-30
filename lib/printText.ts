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

// Civic P1, Oct 30 3:26 PM CT: races where a ZIP spans several districts. Before the first race of each group, the card,
// the Who sheet and the PDF say this line with the state's official lookup. Race ids are this repo's ids for TX-10/TX-37,
// HD 49/51, SF Supervisor D6/D8/D10, NY SD 47/28 and (Civic, 3:37 PM CT) NYC Civil Court 3rd/9th Municipal Court Districts.
export const SPLIT_LINE = "Depending on your address, you\u2019ll have one of these";
/** Adam approved SPLIT_LINE at 3:35 PM CT Oct 30. Set false to show only the lookup link. */
export const SHOW_SPLIT_LINE = true;
export const SPLIT_LOOKUP: Record<string, string> = {
  "78701": "https://teamrv-mvp.sos.texas.gov/MVP/mvp.do",
  "94103": "https://voterstatus.sos.ca.gov/",
  "10001": "https://findmypollsite.vote.nyc/",
};
export const SPLIT_GROUPS: Record<string, string[][]> = {
  "78701": [["tx-10", "tx-37"], ["tx-hd-49", "tx-house-51"]],
  "94103": [["sf-supervisor-6", "sf-supervisor-8", "sf-supervisor-10"]],
  "10001": [["ny-sd-47", "ny-sd-28"], ["ny-civil-3md-ny", "ny-civil-9md-ny"]],
};
/** The split line and lookup URL when raceId is the first race of a split group listed (of those present), else null. */
export function splitStart(zip: string, raceId: string, present: string[]): { line: string | null; url: string } | null {
  const url = SPLIT_LOOKUP[zip];
  for (const g of SPLIT_GROUPS[zip] || []) {
    const shown = present.filter((id) => g.includes(id));
    if (shown.length > 1 && shown[0] === raceId && url) return { line: SHOW_SPLIT_LINE ? SPLIT_LINE : null, url };
  }
  return null;
}
