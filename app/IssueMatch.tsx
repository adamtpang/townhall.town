"use client";
import { useEffect, useState } from "react";
import { Slider } from "../components/ui/slider";
import { ISSUES, overlap, stancesFor, type Answers } from "../lib/issues";

type Cand = { name: string; party?: string | null };
type RaceLite = { id: string; office?: string; title?: string; name?: string; candidates: Cand[] };
const KEY = "townhall.issueAnswers.v1";

export default function IssueMatch({ state, races }: { state: "TX" | "CA"; races: RaceLite[] }) {
  const issues = ISSUES.filter((i) => !i.caOnly || state === "CA");
  const ids = issues.map((i) => i.id);
  const [answers, setAnswers] = useState<Answers>({});
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setAnswers(JSON.parse(raw) || {}); } catch { /* ignore */ }
  }, []);
  function set(id: string, v: number | null) {
    const next = { ...answers, [id]: v };
    setAnswers(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  const answeredCount = ids.filter((id) => typeof answers[id] === "number").length;
  const withCands = races.filter((r) => r.candidates?.length);

  return (
    <section className="border-t border-slate-200 py-12" id="what-matters">
      <h2 className="text-2xl font-bold tracking-tight text-navy">What matters to you?</h2>
      <p className="mt-1 text-slate-600">Move a slider toward the direction you prefer, or leave it on Skip. Skipped issues are left out of the overlap.</p>
      <p className="mt-2 text-sm font-medium text-slate-700">Your answers stay on this device. No sign-in, nothing sent to a server.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {issues.map((i) => {
          const v = answers[i.id];
          const skipped = typeof v !== "number";
          return (
            <div key={i.id} className="rounded-lg border border-slate-200 bg-white p-4" data-issue={i.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-navy">{i.label}</p>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input type="checkbox" checked={skipped} onChange={(e) => set(i.id, e.target.checked ? null : 0)} /> Skip
                </label>
              </div>
              <Slider className={`mt-4 ${skipped ? "opacity-40" : ""}`} min={-10} max={10} step={1} value={[skipped ? 0 : (v as number)]}
                onValueChange={([x]) => set(i.id, x)} aria-label={i.label} />
              <div className="mt-2 flex justify-between gap-4 text-xs text-slate-500">
                <span className="max-w-[45%]">{i.low}</span>
                <span className="text-slate-700">{skipped ? "Skipped" : (v as number) > 0 ? `+${v}` : v}</span>
                <span className="max-w-[45%] text-right">{i.high}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        <h3 className="text-xl font-bold text-navy">Issue overlap</h3>
        <p className="mt-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <strong>Issue overlap, not a recommendation.</strong> It compares your answers with positions candidates have stated in sourced material, only where both exist. Most candidates have few or no sourced positions, so a missing score says nothing about them. Candidates are shown in ballot order.
        </p>
        {answeredCount === 0 ? (
          <p className="mt-4 text-slate-600">Answer at least one issue above to see overlap.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {withCands.map((r) => (
              <div key={r.id}>
                <p className="font-semibold text-slate-800">{r.title || r.id}</p>
                <ul className="mt-2 grid gap-2 md:grid-cols-2">
                  {r.candidates.map((c) => {
                    const st = stancesFor(c.name);
                    const o = overlap(answers, st, ids);
                    return (
                      <li key={c.name} className="rounded-md border border-slate-200 bg-white p-3 text-sm" data-overlap={c.name}>
                        <p className="font-medium text-navy">{c.name}{c.party ? <span className="font-normal text-slate-500"> · {c.party}</span> : null}</p>
                        {o.n === 0 ? (
                          <p className="mt-1 text-slate-500">No sourced positions on your issues.</p>
                        ) : (
                          <>
                            <p className="mt-1 text-slate-800">{o.pct}% issue overlap on {o.n} of {o.m} issues</p>
                            <p className="text-xs text-slate-500">Based on {o.n} sourced position{o.n === 1 ? "" : "s"}.{o.n === 1 ? " Thin evidence: one position only." : ""}</p>
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-navy-700">Show sourced positions</summary>
                              <ul className="mt-2 space-y-2">
                                {o.shared.map((id) => (
                                  <li key={id} className="text-xs text-slate-600">
                                    <span className="font-medium">{ISSUES.find((i) => i.id === id)?.label}:</span> “{st[id].quote}”{" "}
                                    <a href={st[id].sourceUrl} target="_blank" rel="noreferrer">source</a>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
