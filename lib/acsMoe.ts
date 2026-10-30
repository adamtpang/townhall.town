/** QA P1 (Oct 30, 3:47 PM CT): every ZIP-level Census ACS figure shows its margin of error. Only B23025 has a stored MOE
 *  (Civic audit26, data/civic/acs_b23025_censusreporter.json, already in the value as "+/-"). Any other ACS figure has no
 *  stored MOE, so it is marked unsure. No MOE is ever computed or invented here. */
export const NO_MOE_NOTE = "margin of error not in stored data; unsure";
const hasMoe = (v: unknown) => /\+\/-|±/.test(String(v ?? ""));
const isAcs = (p: { table?: string; source?: { label?: string; url?: string } | null; sourceUrl?: string; year?: unknown }) =>
  /^B\d{5}/.test(p.table ?? "") || /Census ACS|censusreporter\.org|data\.census\.gov/i.test(`${p.source?.label ?? ""} ${p.source?.url ?? ""} ${p.sourceUrl ?? ""}`) || /^ACS\b/.test(String(p.year ?? ""));

/** Adds "(margin of error not in stored data; unsure)" to the label of an ACS figure without a stored MOE. */
export function withAcsMoe<T extends { label: string; value: unknown; unsure?: boolean }>(p: T): T {
  if (!isAcs(p as never) || hasMoe(p.value) || p.label.includes(NO_MOE_NOTE)) return p;
  return { ...p, label: `${p.label} (${NO_MOE_NOTE})`, unsure: true };
}

/** Same rule for Civic's issue reasons that cite an ACS ZCTA figure. */
export function reasonWithAcsMoe(reason: string | undefined): string | undefined {
  if (!reason || hasMoe(reason) || !/\bACS\b.*ZCTA[^)]*\)/.test(reason) || reason.includes(NO_MOE_NOTE)) return reason;
  return reason.replace(/(\bACS\b.*?ZCTA[^)]*)\)/, `$1; ${NO_MOE_NOTE})`);
}
