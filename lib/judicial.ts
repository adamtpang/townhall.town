/** Civic rule: every judicial race carries this sentence (TX, CA retention and NY courts alike). */
export const JUDICIAL_NOTE = "Judicial candidates’ positions on these issues aren’t public.";
/** The conduct rule behind JUDICIAL_NOTE, per state: [plain rule, official source URL, citation label]. */
export const JUDICIAL_RULES = {
  ny: ["Judicial candidates can\u2019t state positions on issues", "https://www.law.cornell.edu/regulations/new-york/22-NYCRR-100.5", "22 NYCRR 100.5(A)(4)(d)"],
  tx: ["Texas judicial candidates can\u2019t pledge how they\u2019ll rule", "https://www.txcourts.gov/media/1462935/texas-state-code-of-judicial-conduct.pdf", "Texas Code of Judicial Conduct, Canon 5 (current text, txcourts.gov)"],
  ca: ["California judicial candidates can\u2019t make statements that commit them on issues likely to come before the courts", "https://www.courts.ca.gov/documents/ca_code_judicial_ethics.pdf", "Code of Judicial Ethics, Canon 5"],
} as const;
/** Short on-screen link text (Design p9 P0: the full citation overflowed 390px when nowrap). Full citation goes in title. */
export const JUDICIAL_SHORT: Record<string, string> = { ny: "22 NYCRR 100.5", tx: "Canon 5", ca: "Canon 5" };
export function judicialShort(label: string): string {
  const k = (Object.keys(JUDICIAL_RULES) as (keyof typeof JUDICIAL_RULES)[]).find((x) => JUDICIAL_RULES[x][2] === label);
  return k ? JUDICIAL_SHORT[k] : label;
}
export type JudicialState = keyof typeof JUDICIAL_RULES;
/** Source for a judicial race's note: the race's own `judicial` code, else the ballot's state. */
export function judicialSource(judicial: unknown, state?: string): { url: string; label: string } | undefined {
  const k = (typeof judicial === "string" ? judicial : String(state ?? "")).toLowerCase();
  const j = (JUDICIAL_RULES as Record<string, readonly string[]>)[k];
  return j ? { url: j[1], label: j[2] } : undefined;
}
