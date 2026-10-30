"use client";
import { ToggleGroup } from "../components/ui/toggle-group";
import { plain } from "../lib/plain";
import { H2 } from "../lib/typeScale";
import { useEffect, useState } from "react";
import TownyInterview, { type Fill } from "./TownyInterview";
import { type Photo } from "../components/Portrait";
import { Button } from "../components/ui/button";
import { type Answers } from "../lib/issues";
import { issuesFor, ISSUE_INTRO } from "../lib/issueOrder";
import { migrateAnswers, press, press5, bucketOf, BUCKETS, normalizeAnswers } from "../lib/overlapCore.mjs";
import EndScreen from "./EndScreen";
import { CITY } from "../lib/gcal";
import type { Mk } from "./RaceTiers";
import { useT } from "../lib/i18n";

type Cand = { name: string; party?: string | null; photo?: Photo; campaignSite?: string | null; ballotpedia?: string | null; officialSite?: string | null; finance?: { label?: string; url?: string } | null };
type RaceLite = { id: string; office?: string; title?: string; name?: string; candidates: Cand[] };
export const ANSWERS_KEY = "th-answers-v1";
/** QA P2 (9dfe90d): the ZIP the saved answers were last given for, so the carry-over notice can say "from another ZIP". */
export const ANSWERS_ZIP_KEY = "th-answers-zip-v1";
const OLD_KEYS = ["townhall.issueAnswers.v2", "townhall.issueAnswers.v1"];

function load(): Answers {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY);
    if (raw) { const a = normalizeAnswers(JSON.parse(raw) || {}) as Answers; localStorage.setItem(ANSWERS_KEY, JSON.stringify(a)); return a; }
    for (const k of OLD_KEYS) {
      const old = localStorage.getItem(k);
      if (old) { const m = migrateAnswers(JSON.parse(old)) as Answers; localStorage.setItem(ANSWERS_KEY, JSON.stringify(m)); return m; }
    }
  } catch { /* ignore */ }
  return {};
}



export default function IssueMatch({ zip, state, races, market }: { zip: string; state: "TX" | "CA" | "NY"; races: RaceLite[]; market?: (id: string) => Mk }) {
  const issues = issuesFor(zip, state);
  const t = useT();
  const ids = issues.map((i) => i.id);
  const [answers, setAnswers] = useState<Answers>({});
  const [confirm, setConfirm] = useState(false);
  const [savedZip, setSavedZip] = useState<string | null>(null);
  // Design p9: the carry-over notice only when th-answers-v1 already held answers BEFORE this page load (fresh browser: none).
  const [carriedIds, setCarriedIds] = useState<string[]>([]);
  useEffect(() => { const a = load(); setAnswers(a); setCarriedIds(ids.filter((id) => a[id] !== null && a[id] !== undefined)); try { setSavedZip(localStorage.getItem(ANSWERS_ZIP_KEY)); } catch { /* ignore */ } }, []);
  const markZip = () => { try { localStorage.setItem(ANSWERS_ZIP_KEY, zip); } catch { /* ignore */ } };
  function choose(id: string, b: number, pole: "high" | "low" = "high") {
    const next = press5(answers, id, b, pole) as Answers;
    setAnswers(next);
    setFromChat((w) => { const n = { ...w }; delete n[id]; return n; });
    try { localStorage.setItem(ANSWERS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    markZip();
  }
  const [fromChat, setFromChat] = useState<Record<string, string>>({});
  function fill(fs: Fill[]) {
    const next = { ...answers } as Answers;
    const words = { ...fromChat };
    for (const f of fs) {
      const i = issues.find((x) => x.id === f.issue); if (!i) continue;
      const v = press({}, f.issue, f.choice, i.yesMeansPole) as Answers;
      next[f.issue] = v[f.issue]; words[f.issue] = f.words;
    }
    setAnswers(next); setFromChat(words);
    try { localStorage.setItem(ANSWERS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    markZip();
  }
  function reset() {
    try { for (const k of Object.keys(localStorage)) if (k.startsWith("townhall.") || k.startsWith("th-")) localStorage.removeItem(k); } catch { /* ignore */ }
    setAnswers({}); setFromChat({}); setConfirm(false); setCarriedIds([]);
    window.dispatchEvent(new Event("townhall:reset"));
  }
  const answered = ids.filter((id) => answers[id] !== null && answers[id] !== undefined).length;
  // QA fb66b9b P2: the carry-over notice and the "x of y answered" counter agree: carried answers still set, out of all.
  const carried = carriedIds.filter((id) => answers[id] !== null && answers[id] !== undefined).length;

  return (
    <>
      <section className="border-t border-black py-24" id="what-matters">
        <p className="nds-caption-upper text-black/60">02</p>
        <h2 className={`mt-3 ${H2}`}>Who lines up with you</h2>
        <p className="mt-4 text-base leading-6 text-black" data-issue-intro>{ISSUE_INTRO}</p>
        <p className="mt-2 text-sm font-[530] tabular-nums text-brand-700" aria-live="polite" data-progress>{answered} of {ids.length} answered</p>

        <TownyInterview zip={zip} city={CITY[zip] || "your area"} issues={issues.map((i) => ({ id: i.id, label: i.label }))} onFill={fill} answered={answered} carried={carried} savedZip={savedZip} onReset={() => setConfirm(true)} />

        <ol className="mt-6">
          {issues.map((i) => {
            const sel = bucketOf(answers[i.id], i.yesMeansPole);
            return (
              <li key={i.id} className="border-t border-black/15 py-6" data-issue={i.id}>
                <p className="text-sm font-[530] text-black/60">{i.label}</p>
                <p id={`q-${i.id}`} className="mt-1 text-xl leading-7 text-black">{i.question || i.high}</p>
                {i.reason ? <p className="mt-1 max-w-[45ch] text-sm text-black/60" data-reason>Why it&apos;s on your ballot: {plain(i.reason)}{i.reasonUrl ? <> <a href={i.reasonUrl} title={i.reason} target="_blank" rel="noreferrer" className="relative th-link after:absolute after:-inset-x-1 after:-inset-y-1 after:content-['']">Source ↗</a></> : null}</p> : null}
                {/* Adam 9:58 AM CT Oct 30: 5 buckets, -2 to +2. 44px+ targets; 5 across fit 390px. */}
                {/* Design 10:14 AM CT: shadcn-style ToggleGroup (single), radiogroup + roving focus; 96x48 segments at
                    desktop (480px, left-aligned), full-width 56px-tall segments on phones; no gaps, radius 0. */}
                <ToggleGroup aria-labelledby={`q-${i.id}`} value={sel === null || sel === undefined ? null : String(sel)}
                  onValueChange={(v) => choose(i.id, Number(v), i.yesMeansPole)}
                  className="mt-4 flex w-full divide-x divide-black/45 border border-black/45 md:w-fit"
                  itemClassName="flex h-14 min-w-11 flex-[1_1_0] items-center justify-center text-base leading-6 font-[530] tabular-nums outline-none focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white md:h-12 md:w-24 md:flex-none [touch-action:manipulation] motion-safe:transition-colors motion-safe:duration-300 motion-safe:ease-out data-[state=on]:bg-brand-700 data-[state=on]:text-white data-[state=off]:bg-white data-[state=off]:text-black [@media(hover:hover)]:data-[state=off]:hover:bg-brand-50"
                  items={BUCKETS.map((c) => ({ value: String(c.b), label: c.text, ariaLabel: t(c.label), "data-choice": c.b, "data-bucket": c.b }))} />
                <div aria-hidden className="mt-2 flex w-full justify-between text-xs leading-4 text-black/60 md:w-[482px]" data-bucket-ends><span>{t("Strong no")}</span><span>{t("Strong yes")}</span></div>
                {fromChat[i.id] ? <p className="mt-2 text-sm text-black/60" data-from-chat>Filled from what you wrote: “{fromChat[i.id]}”. Change it if that&apos;s wrong.</p> : null}
              </li>
            );
          })}
        </ol>
        
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button onClick={() => document.getElementById("end")?.scrollIntoView({ behavior: "smooth" })} className="h-12 rounded-none px-6 text-base" data-see-results>
            See who, where and when
          </Button>
          {!confirm ? (
            <button type="button" onClick={() => setConfirm(true)} data-reset className="inline-flex h-12 items-center border border-black/45 px-5 text-base text-black hover:border-black [@media(hover:hover)]:hover:bg-brand-50">Reset my answers</button>
          ) : (
            <span role="alertdialog" aria-live="assertive" aria-label="Confirm reset" className="inline-flex min-h-12 flex-wrap items-center gap-3 text-base text-black" data-reset-confirm>{/* QA phone pass Oct 30: inline row, ink text, outline buttons, no cream panel. */}Clear all answers saved on this device?
              <button type="button" autoFocus onClick={reset} className="inline-flex h-11 items-center border border-black px-4 font-[530] text-black [@media(hover:hover)]:hover:bg-brand-50">Yes, clear</button>
              <button type="button" onClick={() => setConfirm(false)} className="inline-flex h-11 items-center border border-black/45 px-4 text-black hover:border-black [@media(hover:hover)]:hover:bg-brand-50">Cancel</button>
            </span>
          )}
        </div>
      </section>
      <EndScreen zip={zip} races={races} answers={answers} ids={ids} answered={answered} market={market} />
    </>
  );
}
