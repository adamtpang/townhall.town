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
  // Only fields from Civic's 13 finance_fixes18 rows leave this function (and so /api/agent): raised, cash on hand,
  // through-date, report label, FEC id + link, note. Spent, individual, smallDonorPct, inStatePct, committee and the
  // donor lists from the old cache are dropped even where the row still has them.
  const money: Money = { raised: m.raised, cashOnHand: m.cashOnHand, coverageThrough: m.coverageThrough ?? null, lastReport: m.lastReport ?? null, fecId: id!, source: m.source, ...(m.note ? { note: m.note } : {}) };
  return { ...p, money };
}
