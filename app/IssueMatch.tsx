"use client";
import { useEffect, useState } from "react";
import { Slider } from "../components/ui/slider";
import { Checkbox } from "../components/ui/checkbox";
import { ISSUES, overlap, stancesFor, type Answers } from "../lib/issues";

type Cand = { name: string; party?: string | null };
type RaceLite = { id: string; office?: string; title?: string; name?: string; candidates: Cand[] };
const KEY = "townhall.issueAnswers.v2";
// Candidate tier within a race, from overlap % only (needs 2+ sourced stances on issues you answered).
const tierOf = (pct: number) => (pct >= 85 ? "S" : pct >= 70 ? "A" : pct >= 50 ? "B" : "C");

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
    <section className="border-t border-black py-24" id="what-matters">
      <p className="nds-caption-upper text-black/60">02</p>
      <h2 className="mt-3 font-serif text-6xl leading-none tracking-tight text-black sm:text-7xl">Who lines up with you</h2>
      <h3 className="mt-8 text-2xl font-medium tracking-tight">What matters to you?</h3>
            <p className="mt-2 text-sm text-black/50">Your answers stay on this device. No sign-in, nothing sent to a server.</p>
      <a href="#overlap" className="mt-4 inline-block text-sm">See your issue overlap ↓</a>

      <div className="mt-6 grid grid-cols-1 gap-0">
        {issues.map((i) => {
          const v = answers[i.id];
          const skipped = typeof v !== "number";
          return (
            <div key={i.id} className="border-t border-black/15 py-4" data-issue={i.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-navy">{i.label}</p>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Checkbox checked={skipped} onCheckedChange={(c) => set(i.id, c === true ? null : 0)} aria-label={`Skip ${i.label}`} /> Skip
                </label>
              </div>
              <Slider className={`mt-4 ${skipped ? "opacity-40" : ""}`} min={-5} max={5} step={1} value={[skipped ? 0 : (v as number)]}
                onValueChange={([x]) => set(i.id, x)} aria-label={i.label} />
              <div className="mt-2 flex justify-between gap-4 text-xs text-slate-500">
                <span className="max-w-[45%]"><b className="block text-black">-5</b>{i.low}</span>
                <span className="text-base font-medium text-black">{skipped ? "Skipped" : (v as number) > 0 ? `+${v}` : v}</span>
                <span className="max-w-[45%] text-right"><b className="block text-black">+5</b>{i.high}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10" id="overlap">
        <h3 className="text-2xl font-medium tracking-tight">Issue overlap</h3>
        <p className="mt-1 border-l-2 border-[#3760f2] pl-4 text-sm text-black/70">
          <strong>Issue overlap, not a recommendation.</strong> It compares your answers with positions candidates have stated in sourced material, only where both exist. Most candidates have few or no sourced positions, so a missing score says nothing about them. Candidates are shown in ballot order.
        </p>
        {answeredCount === 0 ? (
          <p className="mt-4 text-slate-600">Answer at least one issue above to see overlap and candidate tiers. With no answers, nothing is tiered.</p>
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
                      <li key={c.name} className="border-t border-black/15 py-3 text-sm" data-overlap={c.name}>
                        <p className="font-medium text-navy">{c.name}{c.party ? <span className="font-normal text-slate-500"> · {c.party}</span> : null}</p>
                        {o.n < 2 ? (
                          <p className="mt-1 text-slate-500">{o.n === 0 ? "No sourced positions on your issues." : "Not enough record."}</p>
                        ) : (
                          <>
                            <p className="mt-1 text-slate-800">{o.n >= 2 && o.pct !== null ? <span className="mr-3 inline-block min-w-[2rem] font-serif text-5xl leading-none">{tierOf(o.pct)}</span> : null}{o.pct}% issue overlap on {o.n} of {o.m} issues</p>
                            <p className="text-xs text-slate-500">{o.n >= 2 ? "Tier based on your answers and sourced records." : "Not enough record to tier."}</p>
                            <p className="text-xs text-slate-500">Based on {o.n} sourced position{o.n === 1 ? "" : "s"}.{o.n === 1 ? " Thin evidence: one position only." : ""}</p>
                            <details className="mt-2" open={o.n >= 2}>
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
