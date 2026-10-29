"use client";
import { useState } from "react";
import { Portrait, type Photo } from "../components/Portrait";
import type { MeasureMath } from "../lib/measures";
import officesData from "../data/offices.json";
const OFFICES = officesData.offices;
type Avg = { name: string; prob: number }[];
type RaceLite = { id: string; title: string; level: string; source?: string; office?: string; officeSource?: string; verify?: string; candidates?: { name: string; party?: string | null; photo?: Photo }[] };
type Mk = { avg: Avg; quotes: { url?: string; platform?: string }[] } | null;

/**
 * Tier formula (races only, never candidates):
 *   score = impact x competitiveness
 *   impact: 3 = President, U.S. Senate, Governor; 2 = U.S. House, other statewide executive, ballot measures;
 *           1.5 = state legislature; 1 = judicial and local.
 *   competitiveness: 1 + (1 - |p_leader - 0.5| * 2) using the averaged market price of the leading outcome
 *           (2.0 at a 50/50 race, 1.0 at 100/0). No market = 1.0 (no boost, never inferred).
 *   S >= 4.5, A >= 3, B >= 2, else C.
 */
export function impactOf(r: RaceLite): { v: number; why: string } {
  const t = r.title.toLowerCase();
  if (/president|u\.s\. senate|^governor/.test(t)) return { v: 3, why: "top federal or statewide office" };
  if (r.level === "measure") return { v: 2, why: "statewide ballot measure" };
  if (/u\.s\. house|lieutenant governor|attorney general|comptroller|secretary of state|treasurer|controller|insurance commissioner|superintendent|commissioner/.test(t))
    return { v: 2, why: /u\.s\. house/.test(t) ? "your U.S. House seat" : "statewide executive office" };
  if (/court|judge|justice|appeals/.test(t)) return { v: 1, why: "judicial seat" };
  if (/state senate|state house|state representative|assembly|senate district|house district/.test(t)) return { v: 1.5, why: "state legislature" };
  return { v: 1, why: r.level === "local" || r.level === "county" ? "local office" : "lower-profile office" };
}
export function tierFor(r: RaceLite, mk: Mk) {
  const imp = impactOf(r);
  const lead = mk?.avg?.[0];
  const comp = lead ? 1 + (1 - Math.abs(lead.prob - 0.5) * 2) : 1;
  const score = imp.v * comp;
  const tier = score >= 4.5 ? "S" : score >= 3 ? "A" : score >= 2 ? "B" : "C";
  const why = `${imp.why[0].toUpperCase()}${imp.why.slice(1)}${lead ? `; market leader at ${Math.round(lead.prob * 100)}%, ${comp >= 1.6 ? "close" : comp >= 1.3 ? "leaning" : "lopsided"}` : ". No market odds yet"}.`;
  return { tier, score, why };
}

const lead = (mk: Mk) => !!mk?.avg?.length;

export default function RaceTiers({ races, market, measures = [] }: { races: RaceLite[]; market: (id: string) => Mk; measures?: MeasureMath[] }) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const rows = races.map((r, i) => ({ r, i, ...tierFor(r, market(r.id)), mk: market(r.id) })).sort((a, b) => b.score - a.score || a.i - b.i);
  const tiers = ["S", "A", "B", "C"] as const;
  return (
    <section className="border-t border-black py-24" id="tiers">
      <p className="nds-caption-upper text-black/60">01</p>
      <h2 className="mt-3 font-serif text-6xl leading-none tracking-tight text-black sm:text-7xl">What matters on your ballot</h2>
      <p className="mt-4 max-w-2xl text-black/50">Office impact × how close the race is. Ranks races, never candidates.</p>
      <div className="mt-10">
        {tiers.map((t) => {
          const list = rows.filter((x) => x.tier === t);
          if (!list.length) return null;
          const top = t === tiers.find((tt) => rows.some((x) => x.tier === tt));
          return (
            <details key={t} open={top} className="group border-t border-black/15 py-6" data-tier={t}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-6 [&::-webkit-details-marker]:hidden">
                <span className="w-16 font-serif text-7xl leading-none md:w-24">{t}</span>
                <span className="text-sm text-black/60">{list.length} race{list.length === 1 ? "" : "s"}<span className="ml-2 inline-block group-open:rotate-180">↓</span></span>
              </summary>
              <ul className="mt-6 space-y-10 sm:pl-[7.5rem]">
                {list.map(({ r, why, mk }) => (
                  <li key={r.id}>
                    <p className="text-lg font-medium">{r.title}</p>
                    {r.candidates?.length && !failed[r.id] && r.candidates.every((x) => x.photo?.url) ? (
                      // One row, identical tiles, never wraps: N equal columns down to 64px, then scroll-snap sideways.
                      // Any missing or broken portrait hides the whole row, so no candidate looks different.
                      <div className="-mx-6 my-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" data-photo-row>
                        <ul role="list" className="grid snap-x snap-mandatory gap-3 lg:gap-5" style={{ gridTemplateColumns: `repeat(${r.candidates.length}, minmax(64px, 1fr))`, maxWidth: `${r.candidates.length * 160 + (r.candidates.length - 1) * 20}px` }}>
                          {r.candidates.map((c) => (
                            <li key={c.name} className="min-w-0 snap-start" data-photo-tile>
                              <Portrait name={c.name} photo={c.photo} credit={false} onFail={() => setFailed((f) => ({ ...f, [r.id]: true }))} />
                              <p className="mt-2 line-clamp-2 min-h-10 break-words text-sm font-medium leading-5">{c.name}</p>
                              {c.party && <p className="truncate text-xs text-black/60">{c.party}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : r.candidates?.length ? (
                      <p className="my-3 text-base">{r.candidates.map((c) => c.name).join(" · ")}</p>
                    ) : null}
                    <p className="text-sm text-black/60">
                      {why}{" "}
                      {r.source && <a href={r.source} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center">race source</a>}
                      {lead(mk) && mk?.quotes?.[0]?.url && <> · <a href={mk.quotes[0].url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center">market</a></>}
                      {r.verify && <> · {r.verify}</>}
                    </p>
                    <OfficeCard id={r.id} fallback={r.office && r.officeSource && !/^unsure/i.test(r.office) ? { learn: r.office, sourceUrl: r.officeSource } : undefined} />
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
        {measures.length > 0 && <MeasureRows measures={measures} />}
      </div>
    </section>
  );
}

/** 'unsure' in sourced data renders as a plain statement, never blank. */
const said = (v?: string | null) => (!v || /^\s*unsure\b/i.test(v) ? "No official estimate" : v.replace(/\bunsure\b/gi, "no official estimate"));

/** Learn in 30 seconds: what the office does, from data/offices.json (Civic, sourced). No source, no summary. */
function OfficeCard({ id, fallback }: { id: string; fallback?: { learn: string; sourceUrl: string } }) {
  const o = (OFFICES as Record<string, { learn?: string | null; sourceUrl?: string | null }>)[id];
  const ok = o?.learn && o.sourceUrl && !/^\s*unsure/i.test(o.learn) ? { learn: o.learn, sourceUrl: o.sourceUrl } : fallback;
  if (!ok) return null; // No source, no card (Design spec 8.5).
  return (
    <details className="group/o" data-office={id}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-black/60 hover:text-[#3760f2] [&::-webkit-details-marker]:hidden">
        What this office does<span aria-hidden className="ml-2 inline-block group-open/o:rotate-180">↓</span>
      </summary>
      <p className="max-w-2xl pb-2 text-base">
        {ok.learn}{" "}
        <a href={ok.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center whitespace-nowrap text-sm">{host(ok.sourceUrl)} ↗</a>
      </p>
    </details>
  );
}

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };

/** Doing the math: one compact expandable row per measure. Numbers are quoted from official analyses and each links its source. */
function MeasureRows({ measures }: { measures: MeasureMath[] }) {
  return (
    <details className="group border-t border-black/15 py-6" data-tier="measures">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-6 [&::-webkit-details-marker]:hidden">
        <span className="font-serif text-5xl leading-none md:w-24">Props</span>
        <span className="text-sm text-black/60">{measures.length} measure{measures.length === 1 ? "" : "s"}, doing the math<span className="ml-2 inline-block group-open:rotate-180">↓</span></span>
      </summary>
      <ul className="mt-6 sm:pl-[7.5rem]">
        {measures.map((m) => (
          <li key={m.id} className="border-t border-black/10 first:border-t-0">
            <details className="group/m" data-measure={m.id}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="text-base font-medium">{m.title}</span>
                <span aria-hidden className="text-sm text-black/50 group-open/m:rotate-180">↓</span>
              </summary>
              <dl className="grid gap-4 pb-6 sm:grid-cols-2">
                {([["Cost", m.cost.value, m.cost.sourceUrl], ["Who pays", m.whoPays.text, m.whoPays.sourceUrl], ["If yes", (m.ifYes ?? m.whatChanges).text, (m.ifYes ?? m.whatChanges).sourceUrl], ["If no", m.ifNo?.text, m.ifNo?.sourceUrl]] as const).map(([k, v, u]) => (
                  <div key={k}>
                    <dt className="text-xs uppercase tracking-wide text-black/50">{k}</dt>
                    <dd className="mt-1 text-sm">
                      {said(v)}{" "}
                      {u && <a href={u} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center whitespace-nowrap">{host(u)} ↗</a>}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </details>
  );
}
