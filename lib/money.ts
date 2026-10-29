// Campaign money from the FEC (federal candidates only), keyed by FEC candidate id.
// Fills Politician.money from lib/types.ts. Refresh with scripts/cache-finance.mjs.
import data from "../data/finance.json";
import type { Money, Politician } from "./types";

const finance = data as unknown as { fetchedAt: string; candidates: Record<string, Omit<Money, "fetchedAt"> & { status?: string }> };

export function fecId(p: Politician): string | null {
  return p.finance?.url?.match(/fec\.gov\/data\/candidate\/([A-Z0-9]+)/)?.[1] ?? null;
}

export function withMoney<T extends Politician>(p: T): T {
  const id = fecId(p);
  const m = id ? finance.candidates[id] : undefined;
  if (!m || m.status || m.raised == null) return p;
  return { ...p, money: { ...m, fetchedAt: finance.fetchedAt } };
}
