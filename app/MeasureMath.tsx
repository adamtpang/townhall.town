import data from "../data/measures.json";

type Sourced = { value?: string; text?: string; sourceUrl: string };
type Measure = { id: string; title: string; zips: string[]; jurisdiction: string; cost: Sourced; whoPays: Sourced; whatChanges: Sourced; notes?: string };

const MEASURES = (data as { measures: Measure[] }).measures;

/** "Doing the math" for the measures on this ZIP's ballot: cost, who pays, what changes, each with its official source. */
export default function MeasureMath({ zip, n }: { zip: string; n: string }) {
  const list = MEASURES.filter((m) => m.zips.includes(zip));
  if (!list.length) return null;
  const rows = (m: Measure) => [
    { k: "Cost", v: m.cost.value, src: m.cost.sourceUrl },
    { k: "Who pays", v: m.whoPays.text, src: m.whoPays.sourceUrl },
    { k: "What changes", v: m.whatChanges.text, src: m.whatChanges.sourceUrl },
  ];
  return (
    <section className="border-t border-black py-24" id="measures">
      <p className="nds-caption-upper text-black/60">{n}</p>
      <h2 className="mt-3 font-serif text-6xl leading-none tracking-tight text-black sm:text-7xl">The measures, by the numbers</h2>
      <p className="mt-6 max-w-2xl text-black/60">Cost, who pays and what changes, from official analyses. &ldquo;unsure&rdquo; means the official text gives no figure.</p>
      <ul className="mt-12">
        {list.map((m) => (
          <li key={m.id} className="border-t border-black/15 py-6">
            <details>
              <summary className="cursor-pointer text-xl">
                {m.title} <span className="text-sm text-black/50">· {m.jurisdiction}</span>
              </summary>
              <dl className="mt-4 space-y-4">
                {rows(m).map((r) => (
                  <div key={r.k} className="grid grid-cols-1 gap-1 sm:grid-cols-12">
                    <dt className="text-sm font-medium text-black/50 sm:col-span-3">{r.k}</dt>
                    <dd className="sm:col-span-9">
                      <p>{r.v}</p>
                      <a className="text-sm" href={r.src} target="_blank" rel="noreferrer">official source ↗</a>
                    </dd>
                  </div>
                ))}
                {m.notes && <p className="text-sm text-black/50">{m.notes}</p>}
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
