// Accountability plug-in for the shared contract in lib/types.ts.
// HIDDEN: data/accountability.json contains factual errors, so no said-vs-did
// record, status or kept rate may reach users (UI, API JSON or agent narration).
// The data file is intentionally not imported, so it is not bundled.
import type { AccountabilityRecord, Politician } from "./types";

export type AccountabilityDetail = AccountabilityRecord & { issue: string; rationale: string; compromise?: boolean };

/** Hidden: always returns no records. */
export function getAccountability(_name: string): AccountabilityDetail[] {
  return [];
}

/** Hidden: always null. */
export function keptRate(_records: AccountabilityDetail[]): number | null {
  return null;
}

/** Hidden: returns the Politician unchanged (no accountability field). */
export function withAccountability<T extends Politician>(p: T): T {
  return p;
}
