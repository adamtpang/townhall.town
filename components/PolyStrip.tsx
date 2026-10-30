// Polymarket strip: server component, no client JS (panels use the native popover attribute). See lib/polyStrip.ts.
import { fetchPolymarketEventSides } from "../lib/marketsCore.mjs";
import { buildStrip, stripIdsFor, stripLabelFull, STRIP_EVENTS, STRIP_LABEL, type LiveEvent, type Strip, type StripChip } from "../lib/polyStrip";

type BallotArg = Parameters<typeof stripIdsFor>[0];
export const STRIP_REVALIDATE = 300;
const LINK = "text-ink hover:text-ink underline decoration-ink/40 decoration-1 underline-offset-4 hover:decoration-ink";
const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>;
// Data older than 1 hour is hidden even when a cached page is served late (inline, ~150 bytes, no fetch).
const STALE_GUARD = "(function(s){if(s&&!(Date.now()-Date.parse(s.dataset.asof)<=36e5))s.hidden=true})(document.currentScript&&document.currentScript.parentElement)";

export async function loadStrip(ballot: BallotArg, now = Date.now()): Promise<Strip | null> {
  const ids = stripIdsFor(ballot);
  const got = await Promise.allSettled(ids.map((id) => fetchPolymarketEventSides(STRIP_EVENTS[id].slug, { revalidate: STRIP_REVALIDATE })));
  const live: Record<string, LiveEvent | null> = {};
  ids.forEach((id, i) => { const g = got[i]; live[id] = g.status === "fulfilled" ? (g.value as LiveEvent) : null; });
  return buildStrip(ids, live, ballot, now);
}

const sides = (r: StripChip["rows"][number]) => r.sides.map((s) => `${s.outcome} ${s.pct}`).join(" · ");

function Chip({ c, asOfLabel }: { c: StripChip; asOfLabel: string }) {
  const chipCls = `inline-flex min-h-11 items-center ${LINK}`;
  if (c.rows.length === 1) {
    return (
      <a href={c.url} target="_blank" rel="noopener" className={chipCls} data-strip-chip>
        <span className="font-[530]">{c.title}</span>: {sides(c.rows[0])} ↗{NEW_TAB}
      </a>
    );
  }
  const pid = `pm-${c.id}`;
  return (
    <>
      <button type="button" popoverTarget={pid} className={chipCls} data-strip-chip>
        <span className="font-[530]">{c.title}</span>&nbsp;· {c.rows.length} markets
      </button>
      <div id={pid} popover="auto" className="m-auto w-[min(92vw,560px)] max-h-[80vh] overflow-auto whitespace-normal border border-[var(--market-border)] bg-white p-5 text-sm font-[450] text-ink shadow-lg" data-strip-panel>
        <p className="text-base font-[530]"><a href={c.url} target="_blank" rel="noopener" className={`inline-flex min-h-11 items-center ${LINK}`}>{c.title} ↗{NEW_TAB}</a></p>
        <ul className="mt-2 space-y-3">
          {c.rows.map((r) => (
            <li key={r.slug} data-strip-row>
              <p className="font-[530]">{r.question}</p>
              <p className="tabular-nums">{sides(r)}</p>
              {r.note ? <p className="text-sm text-ink/60" data-romero-line>{r.note}</p> : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-ink/60">as of {asOfLabel}</p>
        <button type="button" popoverTarget={pid} popoverTargetAction="hide" className={`mt-2 inline-flex min-h-11 items-center ${LINK}`}>Close</button>
      </div>
    </>
  );
}

/** Renders nothing without fresh, complete live data. */
export function PolyStripView({ strip }: { strip: Strip | null }) {
  if (!strip) return null;
  return (
    <section aria-label={stripLabelFull(strip.asOfLabel)} data-poly-strip data-asof={strip.asOf} className="border-b border-[var(--market-border)] bg-[var(--market-bg)] text-ink">
      <div className="mx-auto flex max-w-site flex-col px-6 py-1 text-sm font-[450] tabular-nums lg:h-12 lg:flex-row lg:items-center lg:gap-5 lg:px-10 lg:py-0">
        <p className="relative flex min-h-11 shrink-0 items-center gap-3" data-strip-label>
          <span aria-hidden className="inline-block h-2 w-2 shrink-0 bg-[var(--market-mark)]" />
          <span><a href="https://polymarket.com" target="_blank" rel="noopener" className={LINK}>{STRIP_LABEL}{NEW_TAB}</a><span className="text-ink/60" data-strip-asof>{` · as of ${strip.asOfLabel}`}</span></span>
        </p>
        <ul className="relative flex min-w-0 flex-1 snap-x snap-mandatory scroll-px-5 items-center gap-5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)] after:w-6 after:shrink-0 after:content-['']" data-strip-scroller>
          {strip.chips.map((c) => <li key={c.id} className="shrink-0 snap-start"><Chip c={c} asOfLabel={strip.asOfLabel} /></li>)}
        </ul>
      </div>
      <script dangerouslySetInnerHTML={{ __html: STALE_GUARD }} />
    </section>
  );
}

export default async function PolyStrip({ ballot = null }: { ballot?: BallotArg }) {
  let strip: Strip | null = null;
  try { strip = await loadStrip(ballot); } catch { strip = null; }
  return <PolyStripView strip={strip} />;
}
