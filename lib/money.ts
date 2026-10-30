// Campaign money from the FEC (federal candidates only), keyed by FEC candidate id.
// Fills Politician.money from lib/types.ts. Refresh with scripts/cache-finance.mjs.
import data from "../data/finance.json";
import type { Money, Politician } from "./types";
import { fecIdOf } from "./fec";

const finance = data as unknown as { fetchedAt: string; candidates: Record<string, Omit<Money, "fetchedAt"> & { status?: string; verified?: string }> };

export function fecId(p: Politician): string | null {
  return fecIdOf(p);
}

/** Only rows Civic checked in finance_fixes18 (the federal races on 78701, 94103 and 10001) are ever attached.
 *  Unchecked rows (Minton, Ngabo, Hart, Stoker, Hook, Tijerina, Flores, ...) stay in the file but never render. */
export const VERIFIED_FEC_IDS = Object.keys(finance.candidates).filter((k) => !!finance.candidates[k].verified);

export function withMoney<T extends Politician>(p: T): T {
  const id = fecId(p);
  const m = id ? finance.candidates[id] : undefined;
  if (!m || m.status || m.raised == null || !m.verified) return p;
  return { ...p, money: { ...m, fetchedAt: finance.fetchedAt } };
}
