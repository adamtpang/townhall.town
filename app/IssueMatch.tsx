"use client";
import { useEffect, useState } from "react";
import { Slider } from "../components/ui/slider";
import { Checkbox } from "../components/ui/checkbox";
import { type Photo } from "../components/Portrait";
import { PortraitRow } from "../components/PortraitRow";
import { ISSUES, stancesFor, type Answers } from "../lib/issues";
import { overlapFor, overlapLabel, METHOD } from "../lib/overlapCore.mjs";

type Cand = { name: string; party?: string | null; photo?: Photo; campaignSite?: string | null; ballotpedia?: string | null; officialSite?: string | null; finance?: { label?: string; url?: string } | null; causes?: { id: string; label: string; quote: string; source: { label: string; url: string } }[] };
type RaceLite = { id: string; office?: string; title?: string; name?: string; candidates: Cand[] };
const KEY = "townhall.issueAnswers.v2";
// Candidate tier within a race, from overlap % only (needs 2+ sourced stances on issues you answered).
const tierOf = (pct: number) => (pct >= 85 ? "S" : pct >= 70 ? "A" : pct >= 50 ? "B" : "C");

export default function IssueMatch({ state, races }: { state: "TX" | "CA" | "NY"; races: RaceLite[] }) {
  const issues = ISSUES.filter((i) => !i.caOnly || state === "CA");
  const ids = issues.map((i) => i.id);
  const [answers, setAnswers] = useState<Answers>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
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
      <p className="mt-4 text-sm text-black/60">Stays on this device.</p>

      <div className="mt-6 grid grid-cols-1 gap-0">
        {issues.map((i) => {
          const v = answers[i.id];
          const skipped = typeof v !== "number";
          return (
            <div key={i.id} className="border-t border-black/15 py-4" data-issue={i.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-navy">{i.label}</p>
                <label className="-mr-2 flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm text-black/60">
                  <Checkbox checked={skipped} onCheckedChange={(c) => set(i.id, c === true ? null : 0)} aria-label={`Skip ${i.label}`} className="relative border-black/60 after:absolute after:-inset-3 after:content-['']" /> Skip
                </label>
              </div>
              <Slider className={`mt-4 ${skipped ? "opacity-40" : ""}`} min={-5} max={5} step={1} value={[skipped ? 0 : (v as number)]}
                onValueChange={([x]) => set(i.id, x)} aria-label={i.label} />
              <div className="mt-2 flex justify-between gap-4 text-sm text-black/60">
                <span className="truncate">{i.lowShort}</span>
                <span className="truncate text-right">{i.highShort}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10" id="overlap">
        <h3 className="text-2xl font-medium tracking-tight">Issue overlap</h3>
        <p className="mt-1 border-l-2 border-[#3760f2] pl-4 text-sm text-black/70">
          Overlap, not a recommendation. Sourced positions only. Ballot order.
        </p>
        <details className="mt-2"><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-black/60">How overlap is counted</summary><p className="max-w-2xl pb-2 text-sm text-black/80">{METHOD}</p></details>
        {answeredCount === 0 ? (
          <p className="mt-4 text-black/60">Move a slider to see overlap.</p>
        ) : (
          <div className="mt-8 space-y-16">
            {withCands.map((r) => {
              const rows = r.candidates.map((c) => { const st = stancesFor(c.name); return { c, st, o: overlapFor(answers, st, ids) }; });
              return (
              <div key={r.id} data-race={r.id}>
                <p className="font-serif text-3xl leading-tight text-black">{r.title || r.id}</p>
                <PortraitRow cands={r.candidates} />
                <ul className="mt-4 divide-y divide-black/15 border-t border-black/15">
                  {rows.map(({ c, st, o }) => {
                    return (
                      <li key={c.name} className="py-4 text-sm" data-overlap={c.name}>
                        <p className="text-base font-[530] text-black">{c.name}{c.party ? <span className="font-[450] text-black/60"> · {c.party}</span> : null}</p>
                        {c.causes?.length ? (
                          <p className="mt-1 text-xs text-black/60">Talks about{" "}
                            {c.causes.slice(0, 3).map((k, j) => (
                              <span key={k.id}>{j ? " · " : ""}<a href={k.source.url} target="_blank" rel="noreferrer" title={`“${k.quote}” (keyword match in ${k.source.label})`}>{k.label}</a></span>
                            ))}
                          </p>
                        ) : null}
                        {o.enough && o.pct !== null ? (
                          <>
                            <p className="mt-1 text-black"><span className="mr-2 font-serif text-5xl leading-none tabular-nums">{o.pct}%</span><span className="text-sm text-black/60">overlap</span></p>
                            <p className="text-sm text-black/60">{overlapLabel(c.name, o)}</p>
                          </>
                        ) : (
                          <p className="mt-1 text-sm text-black/60">{o.n === 0 ? "We're still sourcing this." : "Not enough sourced positions"}</p>
                        )}
                        {o.n > 0 && (
                          <details className="mt-1" open={o.n < 3}>
                            <summary className="flex min-h-11 cursor-pointer items-center text-sm text-black/60">Sourced positions ({o.n})</summary>
                            <ul className="space-y-2">
                              {o.counted.map((id: string) => (
                                <li key={id} className="text-sm text-black/80">
                                  <span className="font-[530]">{ISSUES.find((i) => i.id === id)?.label}:</span> “{st[id].quote}”{" "}
                                  <a href={st[id].sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center">source ↗</a>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                        <CandLinks c={c} />
                      </li>
                    );
                  })}
                </ul>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/** Known, data-backed links for a candidate. Only URLs present in the data; nothing guessed. */
function CandLinks({ c }: { c: Cand }) {
  const links = [
    c.campaignSite && { href: c.campaignSite, label: "Campaign site" },
    c.ballotpedia && { href: c.ballotpedia, label: "Ballotpedia" },
    c.officialSite && { href: c.officialSite, label: "Official page" },
    c.finance?.url && { href: c.finance.url, label: /fec\.gov/.test(c.finance.url) ? "FEC filings" : /ethics\.state\.tx/.test(c.finance.url) ? "Texas Ethics Commission" : /cal-access|sos\.ca\.gov/i.test(c.finance.url) ? "Cal-Access" : "Campaign finance" },
  ].filter(Boolean) as { href: string; label: string }[];
  if (!links.length) return null;
  return (
    <p className="text-sm">
      {links.map((l, i) => (
        <span key={l.href}>{i ? <span className="text-black/60"> · </span> : null}<a href={l.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center">{l.label} ↗</a></span>
      ))}
    </p>
  );
}
