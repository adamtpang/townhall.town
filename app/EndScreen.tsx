"use client";
import { H2, H3, HIT } from "../lib/typeScale";
import { JUDICIAL_RULES, judicialShort } from "../lib/judicial";
import { useMemo } from "react";
import { Button } from "../components/ui/button";
import { stancesFor, type Answers } from "../lib/issues";
import { SHOW_ACCOUNTABILITY } from "../lib/flags";
import { overlapStatus, METHOD, RECORD_METHOD } from "../lib/overlapCore.mjs";
import TownyResearch from "./TownyResearch";
import WhoRaces from "../components/WhoRaces";
import RaceFooter from "../components/RaceFooter";
import { cardPath } from "../lib/card.mjs";
import { gradesForRace } from "../lib/grades.mjs";
import { PhotoGroup } from "../components/Portrait";
import CandidateRow, { type RowCand } from "../components/CandidateRow";
import { whenFor, whereFor, buildIcs, mapsUrl, earlySingleDay } from "../lib/endscreen.mjs";
import { electionFirst, planEventUrl, topRaceTitles } from "../lib/gcal";
import type { Mk } from "./RaceTiers";

type Cand = RowCand & { ballotpedia?: string | null };
type RaceLite = { id: string; title?: string; level?: string; judicial?: "ny" | "tx" | "ca" | boolean; candidates: Cand[] };
const todayCT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const ext = <span className="sr-only"> (opens in a new tab)</span>;


/** The 90-second path ends here: Who / Where / When, one primary action each. Data only from sourced files. */
export default function EndScreen({ zip, races, answers, ids, answered, market }: { zip: string; races: RaceLite[]; answers: Answers; ids: string[]; answered: number; market?: (id: string) => Mk }) {
  const today = todayCT();
  const when = useMemo(() => whenFor(zip, today), [zip, today]);
  const where = useMemo(() => whereFor(zip, today), [zip, today]);
  const site = where.sites[0];
  const ed = when.events.find((e: { kind: string }) => e.kind === "election");
  const early = when.events.find((e: { kind: string }) => e.kind === "early");
  // Google Calendar (primary): Election Day uses the Election Day site list, early voting today's list. Race names only.
  const edWhere = useMemo(() => whereFor(zip, ed?.start ?? today), [zip, ed, today]);
  const topRaces = useMemo(() => topRaceTitles(races as never, market), [races, market]);
  const gcalEd = ed ? planEventUrl({ e: ed, zip, site: edWhere.sites[0], lookupUrl: edWhere.lookupUrl, dependsOnAddress: edWhere.dependsOnAddress, topRaces }) : null;
  const gcalEarly = early ? planEventUrl({ e: early, zip, site, lookupUrl: where.lookupUrl, dependsOnAddress: where.dependsOnAddress, topRaces }) : null;
  function downloadIcs() {
    const blob = new Blob([buildIcs(electionFirst(when.events), site ? site.address : "")], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "townhall-dates.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const judicial = races.filter((r) => r.judicial && r.candidates?.length);
  const rowsByRace = races.filter((r) => r.candidates?.length && !r.judicial).map((race) => {
    const rows0 = race.candidates.map((c) => ({ c, o: overlapStatus(answers, stancesFor(c.name), ids) }));
    // Race-level guards (design p11 item 6 as corrected): all letters or none in a race.
    const g = gradesForRace(race, rows0.map((x) => x.o), answered, zip);
    if (g.hidden === "scored" && typeof console !== "undefined") console.info(`[grades] hidden in ${race.id}: a candidate has fewer than 3 scored issues`);
    // Adam 9:58 AM CT Oct 30: no letter grades on cards.
    void g;
    const rows = rows0.map((x) => ({ ...x, grade: null as string | null }));
    return { race, rows, gradesHidden: null as string | null };
  });
  // QA P2: Neutral is a real answer but is never compared, so say that instead of asking for answers again.
  const yesNo = ids.filter((id) => typeof answers[id] === "number" && answers[id] !== 0).length;

  return (
    <section id="end" className="border-t border-black py-24" data-end-screen>
      <p className="nds-caption-upper text-black/60">03</p>
      <h2 className={`mt-3 ${H2}`}>Your plan</h2>
      <a href={cardPath(zip, answers, ids)} className="mt-6 inline-flex h-12 items-center border border-black px-5 text-base font-[530] text-black [@media(hover:hover)]:hover:bg-brand-50" data-card-link>Take it with you: one-page ballot card</a>
      <div className="mt-12 grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-5">
        {/* WHO */}
        <div className="lg:col-span-6" data-end="who">
          <p className="text-sm font-[530] text-black/60">Who</p>
          <h3 className={`mt-2 ${H3}`}>Who lines up with you</h3>
          <p className="mt-3 text-base leading-6 text-black" data-overlap-caption>Issue overlap, not a recommendation.</p>
          <details className="mt-1"><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-black/60">{SHOW_ACCOUNTABILITY ? "How overlap and record work" : "How overlap works"}</summary><p className="pb-2 text-sm text-black/80">{METHOD}</p>{SHOW_ACCOUNTABILITY ? <p className="pb-2 text-sm text-black/80" data-record-rule>{RECORD_METHOD}</p> : null}</details>
          {judicial.length > 0 && (
            <p className="mt-4 max-w-[45ch] text-sm text-black/60" data-judicial-note>
              {(() => {
                const st = judicial.some((r) => r.judicial === "ny") ? "ny" : judicial.some((r) => r.judicial === "ca") ? "ca" : "tx";
                const J = JUDICIAL_RULES[st];
                return <>{J[0]} (<a href={J[1]} title={J[2]} target="_blank" rel="noreferrer" className="relative th-link after:absolute after:-inset-x-1 after:-inset-y-1 after:content-['']">{judicialShort(J[2])} ↗{ext}</a>), so no overlap is shown for {judicial.length} court race{judicial.length === 1 ? "" : "s"}.</>;
              })()}
            </p>
          )}
          {answered < 3 ? <p className="mt-4 text-base text-black/80" data-who-gate>Answer the questions to see overlap.</p> : null}
          {(
            <div className="mt-6 space-y-8">
              {answered > 0 && yesNo === 0 ? <p className="text-base text-black/60" data-neutral-only>You answered Neutral on all {answered} issues. Neutral answers aren&rsquo;t compared, so there&rsquo;s no overlap to show. Pick a side (-2, -1, +1 or +2) on an issue to compare.</p> : null}
              <WhoRaces races={rowsByRace.map(({ race: r, rows, gradesHidden }) => ({
                id: r.id,
                title: r.title || r.id,
                gradesHidden,
                lines: rows.map(({ c, o, grade }) => ({ name: c.name, sourced: o.sourced, agree: o.agree, n: o.n, grade })),
                content: (
                  <>
                    <PhotoGroup><ul className="mt-1 divide-y divide-black/15 border-t border-black/15">
                      {rows.map(({ c, o, grade }) => <CandidateRow key={c.name} raceId={r.id} c={c} o={o} ids={ids} answers={answers} answeredYesNo={yesNo > 0} grade={grade} />)}
                    </ul>
                    <RaceFooter cands={rows.map(({ c }) => c)} gradesHidden={gradesHidden} /></PhotoGroup>
                    {/* QA P2: the live research button on every non-judicial race. */}
                    <TownyResearch zip={zip} raceId={r.id} title={r.title || r.id} names={r.candidates.map((c) => c.name)} issues={ids} />
                  </>
                ),
              }))} />
            </div>
          )}
        </div>

        {/* WHERE */}
        <div className="lg:col-span-3" data-end="where">
          <p className="text-sm font-[530] text-black/60">Where</p>
          <h3 className={`mt-2 ${H3}`}>Where to go</h3>
          {site ? (
            <>
              <p className="mt-4 text-base font-[530]">{site.name}</p>
              <p className="text-base text-black/80">{site.address}</p>
              {/* Civic qa14: final-days site lines (they name the last day) show as written. */}{site.hours && (!/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d/.test(site.hours) || /\(last day\)/.test(site.hours)) && <p data-site-hours className="mt-1 text-sm text-black/60">{where.phase === "early" ? "Early voting: " : "Election Day: "}{site.hours}</p>}
              <Button onClick={() => window.open(mapsUrl(site.address), "_blank", "noopener")} className="mt-4 h-12 w-full rounded-none px-6 text-base lg:w-auto" data-maps-url={mapsUrl(site.address)}>
                Directions ↗{ext}
              </Button>
              <p className="mt-2 text-sm leading-5 text-black/60">{site.proximity ? `${site.proximity}. ` : ""}<a href={site.sourceUrl} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] th-link">Official site list ↗{ext}</a></p>
              {where.sites.length > 1 && (
                <details className="mt-1"><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-black/60">Other sourced sites ({Math.min(where.sites.length - 1, 4)})</summary>
                  <ul className="space-y-1 pb-2">
                    {where.sites.slice(1, 5).map((s: { name: string; address: string; hours?: string }) => (
                      <li key={s.name} className="text-sm"><a href={mapsUrl(s.address)} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] th-link">{s.name} ↗{ext}</a><span className="block text-black/60">{s.address}</span>{s.hours && /\(last day\)/.test(s.hours) && <span className="block text-black/60" data-site-hours>{s.hours}</span>}</li>
                    ))}
                  </ul>
                </details>
              )}
              {where.dependsOnAddress && where.lookupUrl && (
                <p className="text-sm"><a href={where.lookupUrl} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] th-link">Find your assigned polling place ↗{ext}</a></p>
              )}
            </>
          ) : where.lookupUrl ? (
            <>
              <p className="mt-4 text-base text-black/80">Your polling place is assigned by home address.</p>
              <Button onClick={() => window.open(where.lookupUrl!, "_blank", "noopener")} className="mt-4 h-12 w-full rounded-none px-6 text-base lg:w-auto" data-lookup-url={where.lookupUrl}>
                Find your polling place ↗{ext}
              </Button>
            </>
          ) : (
            <p className="mt-4 text-base text-black/60">No sourced polling place for this ZIP yet.</p>
          )}
        </div>

        {/* WHEN */}
        <div className="lg:col-span-3" data-end="when">
          <p className="text-sm font-[530] text-black/60">When</p>
          <h3 className={`mt-2 ${H3}`}>When to go</h3>
          <ul className="mt-4 space-y-3">
            {early && (<li data-early><p className="text-sm font-[530]" data-early-heading>{earlySingleDay(early, today) ?? <>Early voting, {fmt(early.start)} to {fmt(early.end)}</>}</p>
              {early.daily?.length ? (
                <ul className="mt-1 space-y-1" data-daily-hours>
                  {early.daily.map((d: { label: string; hours: string; appliesTo: string | null }, i: number) => (
                    <li key={i} className="text-base text-black/80">{d.label}: {d.hours}{d.appliesTo && early.daily.length > 1 && new Set(early.daily.map((x: { appliesTo: string | null }) => x.appliesTo)).size > 1 ? <span className="block text-sm leading-5 text-black/60">{d.appliesTo}</span> : null}</li>
                  ))}
                </ul>
              ) : early.hours ? <p className="text-base text-black/80">{early.hours}</p> : <p className="text-base text-black/80">Hours vary by day</p>}
              <a href={early.sourceUrl} target="_blank" rel="noreferrer" className="relative text-sm leading-5 th-link after:absolute after:-inset-x-1 after:-inset-y-1 after:content-['']" data-early-source>Early voting source ↗{ext}</a></li>)}
            {ed && (<li><p className="text-sm font-[530]">Election Day, {fmt(ed.start)}</p><p className="text-base text-black/80">{ed.hours ? `Polls open ${ed.hours}` : "Poll hours not found in an official source"}</p></li>)}
            {when.registration && when.registration.openOnOct30 === true && when.registration.sourceUrl && (<li><p className="text-sm font-[530]">Registration</p><p className="text-base text-black/80">You can still register and vote. <a href={when.registration.sourceUrl} target="_blank" rel="noreferrer" className={`${HIT} th-link`} data-how-register>How ↗{ext}</a></p></li>)}
            {when.mail && (<li data-mail><p className="text-sm font-[530]">By mail</p><p className="text-base text-black/80">{when.mail.text} <a href={when.mail.sourceUrl} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] text-sm leading-5 th-link">Source ↗</a></p></li>)}
            {when.missing.map((m: string) => <li key={m} className="text-sm text-black/60">{m}: not found in an official source yet.</li>)}
          </ul>
          {ed && (
            <>
              <Button onClick={() => window.open(gcalEd!, "_blank", "noopener")} className="mt-4 h-12 w-full rounded-none bg-black px-6 text-base text-[#F2F2F2] hover:bg-black/80 lg:w-auto" data-gcal-url={gcalEd}>
                Add to Google Calendar ↗{ext}
              </Button>
              <div className="mt-2 flex flex-col items-start gap-0 text-sm" data-cal-links>
                {early && <a href={gcalEarly!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center th-link hover:underline" data-gcal-early>Early voting to Google ↗{ext}</a>}
                <button type="button" onClick={downloadIcs} className="inline-flex min-h-11 items-center text-black/60 underline decoration-black/20 underline-offset-2 hover:text-black" data-ics>or download .ics</button>
                <a href={ed.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm th-link" data-dates-source>Dates source ↗{ext}</a>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
