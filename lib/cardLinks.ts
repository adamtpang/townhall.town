// Official links per ZIP (Adam, Oct 30 3:07 PM CT: "Yes, add Civic's official links today"). URLs are copied exactly from
// /workspace/townhall/civic/gaps25/data_gaps.md (top 4 gaps); labels are Civic's gap names from that file. Each URL was
// curled on Oct 30 (box, CT) and returned 200. SF results: Civic confirmed https://sfelections.gov/results/ (.gov, with
// the trailing slash) at 3:08 PM CT; sfelections.org/results is not used. None of these print on the PDF or show on home.
export type OfficialLink = { label: string; url: string };

export const LABEL_RESULTS = "Results-night links to official results pages";
export const LABEL_TRACKING = "Mail ballot tracking";
export const LABEL_WAIT = "Live wait times";
export const LABEL_REG_CA = "Registration status lookup (CA)";
/** Adam approved this fold label at 3:08 PM CT Oct 30. */
export const FOLD_LABEL = "Election night and tracking";

const R = (url: string): OfficialLink => ({ label: LABEL_RESULTS, url });
const T = (url: string): OfficialLink => ({ label: LABEL_TRACKING, url });

/** Results, mail tracking and CA registration status: the closed fold under the print button on /card. */
export const FOLD_LINKS: Record<string, OfficialLink[]> = {
  "78701": [R("https://results.enr.clarityelections.com/TX/Travis/")],
  "94103": [
    R("https://sfelections.gov/results/"),
    T("https://california.ballottrax.net/voter/"),
    T("https://www.sos.ca.gov/elections/ballot-status/wheres-my-ballot"),
    { label: LABEL_REG_CA, url: "https://voterstatus.sos.ca.gov/" },
    { label: LABEL_REG_CA, url: "https://www.sos.ca.gov/elections/voter-registration/same-day-reg" },
  ],
  "10001": [R("https://enr.boenyc.gov/"), R("https://vote.nyc/page/election-results-summary"), T("https://requestballot.vote.nyc/tracking")],
};

/** Live wait times: one link in the WHERE tile, only where Civic has one that isn't already the lookup link (SF's is). */
export const WAIT_LINK: Record<string, OfficialLink> = {
  "78701": { label: LABEL_WAIT, url: "https://updates.electionlink.net/widgets/travistx/2026-11-03/index.html" },
  "10001": { label: LABEL_WAIT, url: "https://vote.nyc/page/election-day-wait-time-map" },
};

export const linkHost = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
