import order from "../data/issue_order.json";
import { ISSUES, type Issue } from "./issues";
import { poleName } from "./overlapCore.mjs";

type Statement = { statement: string; yesMeansPole: 1 | -1; poles?: Record<string, string> };
type Row = { issue: string; rank: number; reason?: string; sourceUrl?: string };
type File = { intro: string; statements: Record<string, Statement>; zips: Record<string, { place?: string; order?: string[]; issues?: Row[] }> };
const F = order as unknown as File;

/** Civic's intro line, shown above the questions. */
export const ISSUE_INTRO = F.intro;

/** Issues for a ZIP in Civic's rank order (data/issue_order.json): one neutral statement per issue,
 *  the local reason with its source, and yesMeansPole (+1 = Yes is the +5 pole, -1 = Yes is the -5 pole). */
export function issuesFor(zip: string, state: "TX" | "CA" | "NY"): Issue[] {
  const base = ISSUES.filter((i) => !i.caOnly || state === "CA");
  const z = F.zips?.[zip];
  const rows = [...(z?.issues ?? [])].sort((a, b) => a.rank - b.rank);
  const ids = rows.length ? rows.map((r) => r.issue) : (z?.order ?? base.map((i) => i.id));
  const out: Issue[] = [];
  for (const id of ids) {
    const i = ISSUES.find((x) => x.id === id);
    if (!i) continue;
    const st = F.statements[id];
    const r = rows.find((x) => x.issue === id);
    out.push({ ...i, question: st?.statement || i.question, poles: st?.poles, reason: r?.reason, reasonUrl: r?.sourceUrl, yesMeansPole: poleName(st?.yesMeansPole ?? 1) });
  }
  return out.length ? out : base.map((i) => ({ ...i, yesMeansPole: "high" }));
}
