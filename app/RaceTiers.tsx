"use client";
import { useState } from "react";
import { Portrait, type Photo } from "../components/Portrait";
type Avg = { name: string; prob: number }[];
type RaceLite = { id: string; title: string; level: string; source?: string; officeSource?: string; candidates?: { name: string; party?: string | null; photo?: Photo }[] };
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
  const why = `${imp.why[0].toUpperCase()}${imp.why.slice(1)}; ${lead ? `market leader at ${Math.round(lead.prob * 100)}%, ${comp >= 1.6 ? "close" : comp >= 1.3 ? "leaning" : "lopsided"}` : "no market, so no competitiveness boost"}.`;
  return { tier, score, why };
}

export default function RaceTiers({ races, market }: { races: RaceLite[]; market: (id: string) => Mk }) {
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
                    {r.candidates?.length ? (
                      <div className="my-3 flex gap-3 overflow-x-auto pb-1">
                        {/* One failed or missing photo switches the whole race to initials, so tiles stay consistent. */}
                        {r.candidates.map((c) => (
                          <div key={c.name} className="w-28 shrink-0 md:w-40">
                            <Portrait name={c.name} photo={c.photo} credit={false} boxClassName="h-[140px] md:h-52" forceInitials={failed[r.id] || r.candidates!.some((x) => !x.photo?.url)} onFail={() => setFailed((f) => ({ ...f, [r.id]: true }))} />
                            <p className="mt-1 text-sm font-medium leading-tight text-black/80">{c.name}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-sm text-black/60">
                      {why}{" "}
                      {r.source && <a href={r.source} target="_blank" rel="noreferrer">race source</a>}
                      {mk?.quotes?.[0]?.url && <> · <a href={mk.quotes[0].url} target="_blank" rel="noreferrer">market</a></>}
                    </p>
                    {!mk?.quotes?.length && <p className="mt-1 text-sm text-black/50">No market odds yet</p>}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
