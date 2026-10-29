// Said vs did for one politician. Shadcn theme tokens only. Nonpartisan:
// shows the record and its sources, never a verdict on who to vote for.
import { keptRate, type AccountabilityDetail } from "../../lib/accountability";

const STYLE: Record<string, string> = {
  kept: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  broken: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
  "in progress": "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  compromise: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  unclear: "bg-muted text-muted-foreground",
  "no record found": "bg-muted text-muted-foreground",
};
const label = (r: AccountabilityDetail) => (r.compromise ? "compromise" : r.status);
const pretty = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PromiseTracker({ name, records }: { name: string; records: AccountabilityDetail[] }) {
  const rate = keptRate(records);
  return (
    <section className="space-y-3" aria-label={`Said vs did: ${name}`}>
      <div className="flex items-end justify-between gap-4">
        <h3 className="font-semibold">Said vs did</h3>
        <div className="text-right">
          <span className="text-xl font-semibold tabular-nums">{rate == null ? "-" : `${rate}%`}</span>
          <span className="ml-1 text-xs text-muted-foreground">promises kept, {records.length} checked</span>
        </div>
      </div>
      <ol className="space-y-3">
        {records.map((r, i) => (
          <li key={i} className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{r.issue}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STYLE[label(r)] ?? STYLE.unclear}`}>{pretty(label(r))}</span>
            </div>
            <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Said</div>
                <p>{r.promise}</p>
                <a className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground" href={r.promiseSource.url} target="_blank" rel="noreferrer">
                  {r.promiseSource.label}
                </a>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Did</div>
                <p>{r.record}</p>
                {r.recordSource ? (
                  <a className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground" href={r.recordSource.url} target="_blank" rel="noreferrer">
                    {r.recordSource.label}
                  </a>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{r.rationale}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
