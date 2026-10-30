/** Civic rule: every judicial race carries this sentence (TX, CA retention and NY courts alike). */
export const JUDICIAL_NOTE = "Judicial candidates’ positions on these issues aren’t public.";
/** The conduct rule behind JUDICIAL_NOTE, per state: [plain rule, official source URL, citation label]. */
export const JUDICIAL_RULES = {
  ny: ["Judicial candidates can\u2019t state positions on issues", "https://www.law.cornell.edu/regulations/new-york/22-NYCRR-100.5", "22 NYCRR 100.5(A)(4)(d)"],
  tx: ["Texas judicial candidates can\u2019t pledge or promise how they\u2019ll rule on cases or classes of cases", "https://www.txcourts.gov/All_Archived_Documents/SupremeCourt/AdministrativeOrders/miscdocket/02/02916700.pdf", "Code of Judicial Conduct, Canon 5"],
  ca: ["California judicial candidates can\u2019t make statements that commit them on issues likely to come before the courts", "https://www.courts.ca.gov/documents/ca_code_judicial_ethics.pdf", "Code of Judicial Ethics, Canon 5"],
} as const;
export type JudicialState = keyof typeof JUDICIAL_RULES;
/** Source for a judicial race's note: the race's own `judicial` code, else the ballot's state. */
export function judicialSource(judicial: unknown, state?: string): { url: string; label: string } | undefined {
  const k = (typeof judicial === "string" ? judicial : String(state ?? "")).toLowerCase();
  const j = (JUDICIAL_RULES as Record<string, readonly string[]>)[k];
  return j ? { url: j[1], label: j[2] } : undefined;
}
