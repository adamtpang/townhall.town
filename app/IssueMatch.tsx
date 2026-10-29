"use client";
import { useEffect, useState } from "react";
import { type Photo } from "../components/Portrait";
import { Button } from "../components/ui/button";
import { type Answers } from "../lib/issues";
import { issuesFor, ISSUE_INTRO } from "../lib/issueOrder";
import { migrateAnswers, press, choiceOf } from "../lib/overlapCore.mjs";
import EndScreen from "./EndScreen";

type Cand = { name: string; party?: string | null; photo?: Photo; campaignSite?: string | null; ballotpedia?: string | null; officialSite?: string | null; finance?: { label?: string; url?: string } | null };
type RaceLite = { id: string; office?: string; title?: string; name?: string; candidates: Cand[] };
export const ANSWERS_KEY = "th-answers-v1";
const OLD_KEYS = ["townhall.issueAnswers.v2", "townhall.issueAnswers.v1"];

function load(): Answers {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY);
    if (raw) return JSON.parse(raw) || {};
    for (const k of OLD_KEYS) {
      const old = localStorage.getItem(k);
      if (old) { const m = migrateAnswers(JSON.parse(old)) as Answers; localStorage.setItem(ANSWERS_KEY, JSON.stringify(m)); return m; }
    }
  } catch { /* ignore */ }
  return {};
}

const CHOICES = [{ k: "yes", label: "Yes" }, { k: "neutral", label: "Neutral" }, { k: "no", label: "No" }] as const;

export default function IssueMatch({ zip, state, races }: { zip: string; state: "TX" | "CA" | "NY"; races: RaceLite[] }) {
  const issues = issuesFor(zip, state);
  const ids = issues.map((i) => i.id);
  const [answers, setAnswers] = useState<Answers>({});
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setAnswers(load()); }, []);
  function choose(id: string, k: "yes" | "neutral" | "no", pole: "high" | "low" = "high") {
    const next = press(answers, id, k, pole) as Answers;
    setAnswers(next);
    try { localStorage.setItem(ANSWERS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  function reset() {
    try { for (const k of Object.keys(localStorage)) if (k.startsWith("townhall.") || k.startsWith("th-")) localStorage.removeItem(k); } catch { /* ignore */ }
    setAnswers({}); setConfirm(false);
    window.dispatchEvent(new Event("townhall:reset"));
  }
  const answered = ids.filter((id) => answers[id] !== null && answers[id] !== undefined).length;

  return (
    <>
      <section className="border-t border-black py-24" id="what-matters">
        <p className="nds-caption-upper text-black/60">02</p>
        <h2 className="mt-3 font-serif text-5xl leading-none tracking-tight text-black lg:text-[72px]">Who lines up with you</h2>
        <p className="mt-4 text-base leading-6 text-black" data-issue-intro>{ISSUE_INTRO}</p>
        <p className="mt-2 text-sm text-black/60" aria-live="polite" data-progress>{answered} of {ids.length} answered</p>

        <ol className="mt-6">
          {issues.map((i) => {
            const sel = choiceOf(answers[i.id], i.yesMeansPole);
            return (
              <li key={i.id} className="border-t border-black/15 py-6" data-issue={i.id}>
                <p className="text-sm font-[530] text-black/60">{i.label}</p>
                <p id={`q-${i.id}`} className="mt-1 text-xl leading-7 text-black">{i.question || i.high}</p>
                {i.reason ? <p className="mt-1 text-sm text-black/60" data-reason>Why it&apos;s on your ballot: {i.reason}{i.reasonUrl ? <> <a href={i.reasonUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[#3760F2]">Source ↗</a></> : null}</p> : null}
                <div role="radiogroup" aria-labelledby={`q-${i.id}`} className="mt-4 grid grid-cols-3 gap-2 md:flex md:gap-3">
                  {CHOICES.map((c) => {
                    const on = sel === c.k;
                    return (
                      <button key={c.k} type="button" role="radio" aria-checked={on} data-choice={c.k}
                        onClick={() => choose(i.id, c.k, i.yesMeansPole)}
                        className={`h-14 border text-base font-[530] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3760F2] md:h-12 md:w-[120px] ${on ? "border-black bg-black text-[#F2F2F2]" : "border-black/30 bg-transparent text-black hover:border-black"}`}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
        
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button onClick={() => document.getElementById("end")?.scrollIntoView({ behavior: "smooth" })} className="h-12 rounded-none px-6 text-base bg-black text-[#F2F2F2] hover:bg-black/80" data-see-results>
            See who, where and when
          </Button>
          {!confirm ? (
            <button type="button" onClick={() => setConfirm(true)} data-reset className="inline-flex h-12 items-center border border-black/30 px-5 text-base text-black hover:border-black">Reset my answers</button>
          ) : (
            <span className="inline-flex min-h-11 items-center gap-3 text-sm">Clear answers saved on this device?
              <button type="button" onClick={reset} className="min-h-11 font-[530] text-[#3760F2]">Clear</button>
              <button type="button" onClick={() => setConfirm(false)} className="min-h-11 text-black/60">Cancel</button>
            </span>
          )}
        </div>
      </section>
      <EndScreen zip={zip} races={races} answers={answers} ids={ids} answered={answered} />
    </>
  );
}
