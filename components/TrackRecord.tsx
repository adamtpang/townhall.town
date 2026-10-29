import type { TrackRecord } from "../lib/types";

const CLASS_LABEL: Record<string, string> = { consistent: "Consistent", inconsistent: "Inconsistent", "mixed/unclear": "Mixed or unclear" };
const ext = <span className="sr-only"> (opens in a new tab)</span>;

/** Said vs. did from Civic's accountability.json. A score shows only with 3+ checkable pairs; otherwise
 *  "Not enough records" or "No voting record". Method: /methodology/accountability. */
export function TrackRecordBlock({ name, t }: { name: string; t: TrackRecord }) {
  return (
    <div className="py-2 text-sm" data-track-record={name}>
      <p className="text-base text-black"><span className="font-[530]">{name}:</span> {t.display}{t.score !== null && t.mixedUnclear ? `, plus ${t.mixedUnclear} mixed or unclear` : ""}</p>
      {t.offices && <p className="text-xs text-black/60" data-offices>Offices held: {t.offices.join("; ")}</p>}
      {t.pairs.length > 0 && (
        <details><summary className="inline-flex min-h-11 cursor-pointer items-center text-black/60">Checked pairs ({t.pairs.length})</summary>
          <ul className="space-y-3 pb-2">
            {t.pairs.map((a, i) => (
              <li key={i}>
                <p className="font-[530]">{a.issue}: <span className="font-[450] text-black/70">{CLASS_LABEL[a.classification] || a.classification}</span></p>
                <p className="mt-1 text-black/80">Said: &ldquo;{a.said.quote}&rdquo; <a href={a.said.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[#3760F2]">source ↗{ext}</a></p>
                <p className="text-black/80">Record: {a.did.text}{a.did.date ? ` (${a.did.date})` : ""} <a href={a.did.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[#3760F2]">official record ↗{ext}</a></p>
                <p className="text-xs text-black/60">{a.reason}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function TrackRecordList({ cands }: { cands: { name: string; accountability: TrackRecord }[] }) {
  return (
    <details className="group/t" data-track-records>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-black/60 hover:text-[#3760f2] [&::-webkit-details-marker]:hidden">Said vs. did<span aria-hidden className="ml-2 inline-block group-open/t:rotate-180">↓</span></summary>
      <div className="max-w-2xl pb-2">
        <p className="text-xs leading-4 text-black/60">What they said, compared with the official record. <a href="/methodology/accountability" className="inline-flex min-h-11 items-center text-[#3760F2]">How we check</a></p>
        {cands.map((c) => <TrackRecordBlock key={c.name} name={c.name} t={c.accountability} />)}
      </div>
    </details>
  );
}
