// The official election office per covered ZIP (Civic review, Oct 30 1:37 PM CT). Ballot order is cited to the office's
// sample ballot, never to Ballotpedia. Every URL below is already in the shipped data:
//   78701 votetravis.gov bedsheet sample ballot (data/ballots.json verify link), 94103 the SF Voter Portal, which has the
//   "View My Voter Information Pamphlet and Sample Ballot" tab (sfelections.org/tools/portal/), 10001 "Find My Poll Site /
//   View Sample Ballot" (findmypollsite.vote.nyc).
export type Office = {
  /** "Travis County Elections" */
  name: string;
  /** For "Verify with <verifyWith>." */
  verifyWith: string;
  /** Chip label (the office's domain). */
  label: string;
  /** The office's sample ballot. */
  sampleBallot: string;
  /** The office's home page, for dates and places. */
  home: string;
};

export const OFFICES: Record<string, Office> = {
  "78701": { name: "Travis County Elections", verifyWith: "Travis County Elections", label: "votetravis.gov", sampleBallot: "https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Corrected-Final2.pdf", home: "https://votetravis.gov/" },
  "94103": { name: "SF Department of Elections", verifyWith: "the SF Department of Elections", label: "sfelections.org", sampleBallot: "https://sfelections.org/tools/portal/", home: "https://sfelections.org/" },
  "10001": { name: "NYC Board of Elections", verifyWith: "the NYC Board of Elections", label: "vote.nyc", sampleBallot: "https://findmypollsite.vote.nyc/", home: "https://vote.nyc/" },
};

/** The office for a source host, so "Couldn't reach <host>; showing saved data. Verify with <office>." names the right one. */
export const officeFor = (zip: string): Office | null => OFFICES[zip] ?? null;
