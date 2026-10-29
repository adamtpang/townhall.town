"use client";
type Avg = { name: string; prob: number }[];
type RaceLite = { id: string; title: string; level: string; source?: string; officeSource?: string };
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
          return (
            <div key={t} className="grid grid-cols-[4rem_1fr] gap-6 border-t border-black/15 py-6 md:grid-cols-[6rem_1fr]">
              <p className="font-serif text-7xl leading-none">{t}</p>
              <ul className="space-y-4">
                {list.map(({ r, why, mk }) => (
                  <li key={r.id}>
                    <p className="text-lg font-medium">{r.title}</p>
                    <p className="text-sm text-black/60">
                      {why}{" "}
                      {r.source && <a href={r.source} target="_blank" rel="noreferrer">race source</a>}
                      {mk?.quotes?.[0]?.url && <> · <a href={mk.quotes[0].url} target="_blank" rel="noreferrer">market</a></>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
