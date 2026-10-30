// Client-safe FEC helpers for the party + money display (PR #32, Civic finance_fixes18, QA main-bbcc940).
// No data import here, so RaceTiers can use it without bundling data/finance.json.

/** Civic finance_fixes18 (Oct 30): the ballot lists only an FEC search link for these candidates; FEC id confirmed by Civic. */
export const FEC_ID_OVERRIDE: Record<string, string> = { "Lauren B. Peña": "H6TX35038" };

export function fecIdOf(c: { name: string; finance?: { url?: string | null } | null }): string | null {
  return c.finance?.url?.match(/fec\.gov\/data\/candidate\/([A-Z0-9]+)/)?.[1] ?? FEC_ID_OVERRIDE[c.name] ?? null;
}

/** QA P1-1: each candidate links their own FEC candidate page. */
export const fecCandidateUrl = (id: string) => `https://www.fec.gov/data/candidate/${id}/`;
export const fecSearchUrl = (name: string) => `https://www.fec.gov/data/candidates/?search=${encodeURIComponent(name)}`;

/** Finance shows only on federal races (U.S. Senate, U.S. House) in the three supported ZIPs. */
export const FINANCE_ZIPS = ["78701", "94103", "10001"] as const;
export function isFederalRace(r: { id: string; level?: string; title?: string }): boolean {
  if (r.level !== "federal") return false;
  return /^us-senate\b/.test(r.id) || /^[a-z]{2}-\d+$/.test(r.id);
}

/** QA P2-1: $999,500+ reads $1.0M (never $1000K); negatives keep the sign and show whole dollars ("-$3,004"). */
export function usd(n: number): string {
  if (n < 0) return `-$${Math.round(-n).toLocaleString("en-US")}`;
  if (n >= 999_500) {
    const m = n / 1e6;
    return m >= 9.95 ? `$${Math.round(m)}M` : `$${m.toFixed(1)}M`;
  }
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}
/** Cash on hand (Adam 1:52 PM Oct 30): under $10K to the dollar ($4,454, not $4K); $10K and up as usd(). */
export function usdCash(n: number): string {
  return n >= 0 && n < 10_000 ? `$${Math.round(n).toLocaleString("en-US")}` : usd(n);
}

/** FEC report label (Adam 1:52 PM Oct 30): show the filing (lastReport) when the data has it, e.g. "PRE-GENERAL" -> "Pre-general report". */
const REPORT_LABEL: Record<string, string> = { "PRE-GENERAL": "Pre-general report", "OCTOBER QUARTERLY": "October quarterly report", "JULY QUARTERLY": "July quarterly report" };
export function reportLabel(r?: string | null): string | null {
  if (!r || !r.trim()) return null;
  const k = r.trim().toUpperCase();
  if (REPORT_LABEL[k]) return REPORT_LABEL[k];
  const w = k.toLowerCase().replace(/[_]+/g, " ");
  return `${w[0].toUpperCase()}${w.slice(1)} report`;
}
