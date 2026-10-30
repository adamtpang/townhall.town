"use client";
import { useEffect, useMemo, useState } from "react";
import { H1 } from "../../lib/typeScale";
import { stancesFor, type Answers } from "../../lib/issues";
import { overlapStatus } from "../../lib/overlapCore.mjs";
import { gradesForRace } from "../../lib/grades.mjs";
import { PhotoGroup } from "../../components/Portrait";
import RaceFooter from "../../components/RaceFooter";
import CandidateRow, { type RowCand } from "../../components/CandidateRow";
import { whenFor, whereFor, buildIcs, mapsUrl, earlySingleDay } from "../../lib/endscreen.mjs";
import { decodeAnswers, encodeAnswers } from "../../lib/card.mjs";
import { electionFirst, planEventUrl, topRaceTitles } from "../../lib/gcal";
import { Button } from "../../components/ui/button";
import type { OrderLine } from "../../lib/types";

const ANSWERS_KEY = "th-answers-v1";
const todayCT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
type RaceLite = { id: string; title?: string; level?: string; judicial: boolean; meta?: unknown; order?: OrderLine | null; candidates: RowCand[] };

/** One printable page: overlap lines (not a recommendation), where, when, calendar. State is the URL hash or this device only. */
export default function BallotCard({ zip, place, ids, races }: { zip: string; place: string; ids: string[]; races: RaceLite[] }) {
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const h = /(?:^|[#&])a=([yxn-]+)/.exec(window.location.hash)?.[1];
    if (h) { setAnswers(decodeAnswers(h, ids) as Answers); return; }
    try { setAnswers(JSON.parse(localStorage.getItem(ANSWERS_KEY) || "{}")); } catch { setAnswers({}); }
  }, [ids]);
  const today = todayCT();
  const when = useMemo(() => whenFor(zip, today), [zip, today]);
  const where = useMemo(() => whereFor(zip, today), [zip, today]);
  const site = where.sites[0];
  const ed = when.events.find((e: { kind: string }) => e.kind === "election");
  const early = when.events.find((e: { kind: string }) => e.kind === "early");
  // Google Calendar (primary): race names from the tier list (sourced ratings; no live market on this page), no answers.
  const edWhere = useMemo(() => whereFor(zip, ed?.start ?? today), [zip, ed, today]);
  const gcalEd = useMemo(() => (ed ? planEventUrl({ e: ed, zip, site: edWhere.sites[0], lookupUrl: edWhere.lookupUrl, dependsOnAddress: edWhere.dependsOnAddress, topRaces: topRaceTitles(races as never) }) : null), [ed, zip, edWhere, races]);
  const answered = answers ? ids.filter((id) => typeof answers[id] === "number").length : 0;
  const rows = races.filter((r) => !r.judicial && r.candidates.length).map((r) => { const l0 = r.candidates.map((c) => ({ c, o: overlapStatus(answers ?? {}, stancesFor(c.name), ids) })); const g = gradesForRace(r, l0.map((x) => x.o), answered, zip); return { r, gradesHidden: g.hidden, list: l0.map((x, i) => ({ ...x, grade: g.grades[i] })) }; }); // rendered on the server too: no 3s "Loading…" (QA 4e15da7) // every non-judicial race, in ballot-data order (Adam, 11:28 PM: photos and sources on every row)
  const yesNo = answers ? ids.filter((id) => typeof answers[id] === "number" && answers[id] !== 0).length : 0;

  function ics() {
    const blob = new Blob([buildIcs(electionFirst(when.events), site ? site.address : "")], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "townhall-dates.ics";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function share() {
    const url = `${location.origin}/card?zip=${zip}#a=${encodeAnswers(answers || {}, ids)}`;
    try { if (navigator.share) { await navigator.share({ title: "My ballot card", url }); return; } await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* cancelled */ }
  }
  const link = "relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] th-link underline-offset-2 hover:underline print:text-black";
  return (
    <main className="mx-auto max-w-[720px] px-5 py-12 text-black print:px-0 print:py-0" data-ballot-card>
      <p className="nds-caption-upper text-black/60">townhall.town · {place}</p>
      <h1 className={`mt-3 ${H1}`}>Your ballot card</h1>
      {ed ? <p className="mt-4 text-xl leading-7 font-[530]" data-card-date>Election Day: {fmt(ed.start)}{ed.hours ? `, ${ed.hours}` : ""}</p> : null}
      {early ? <p className="mt-1 text-base font-[450] text-black/80" data-early-heading>{earlySingleDay(early, today) ?? <>Early voting runs through {fmt(early.end)}</>}. <a href={early.sourceUrl} className={link} target="_blank" rel="noreferrer">Source ↗</a></p> : null}
      {when.mail ? <p className="mt-1 text-base font-[450] text-black/80">{when.mail.text} <a href={when.mail.sourceUrl} className={link} target="_blank" rel="noreferrer">Source ↗</a></p> : null}

      <section className="mt-10 border-t border-black/15 pt-6">
        <h2 className="text-sm font-[530] text-black/60">Where</h2>
        {site ? (<>
          <p className="mt-2 text-base font-[530]">{site.name}</p><p className="text-base text-black/80">{site.address}</p>
          <p className="mt-1 text-sm"><a href={mapsUrl(site.address)} className={link} target="_blank" rel="noreferrer" data-card-map>Map and directions ↗</a> · <a href={site.sourceUrl} className={link} target="_blank" rel="noreferrer">Official site list ↗</a></p>
          {where.dependsOnAddress && where.lookupUrl ? <p className="mt-1 text-sm"><a href={where.lookupUrl} className={link} target="_blank" rel="noreferrer" data-card-lookup>{where.lookupLabel ?? "Find your assigned polling place"} ↗</a></p> : null}
        </>) : where.lookupUrl ? (
          <p className="mt-2 text-base">Your polling place is assigned by home address. <a href={where.lookupUrl} className={link} target="_blank" rel="noreferrer" data-card-map data-card-lookup>{where.lookupLabel ?? "Find it"} ↗</a></p>
        ) : <p className="mt-2 text-base text-black/60">No sourced polling place for this ZIP yet.</p>}
        {where.portalUrl ? <p className="mt-1 text-sm"><a href={where.portalUrl} className={link} target="_blank" rel="noreferrer" data-card-portal>Voter Portal ↗</a></p> : null}
      </section>

      <section className="mt-10 border-t border-black/15 pt-6" id="card-overlap" data-card-overlap>
        <h2 className="text-sm font-[530] text-black/60" tabIndex={-1}>Who lines up with you</h2>
        <p className="mt-1 text-base leading-6 text-black" data-overlap-caption>Issue overlap, not a recommendation. Court races are not compared.</p>
        
        <>
            {answers === null ? null : answered === 0 ? <p className="mt-3 text-base text-black/80">No answers yet. <a href="/" className={link}>Answer a few questions</a> to compare.</p> : yesNo === 0 ? <p className="mt-3 text-base text-black/80" data-card-no-overlap>Neutral answers aren&rsquo;t compared; answer Yes or No on an issue to compare. <a href="/" className={link}>Change your answers</a>.</p> : null}
            <ul className="mt-3 space-y-6">
              {rows.map(({ r, list, gradesHidden }) => (
                <li key={r.id} data-card-race={r.id} className="break-inside-avoid">
                  <p className="text-base font-[530]">{r.title || r.id}</p>
                  {r.order ? <p className="max-w-[60ch] mt-1 text-sm leading-5 text-black/60" data-order-line={r.order.confirmed ? "confirmed" : "unsure"}>{r.order.text}{r.order.url ? <> <a href={r.order.url} target="_blank" rel="noreferrer" className="relative underline underline-offset-2 after:absolute after:-inset-y-3 after:-inset-x-1 after:content-['']" data-order-source>{r.order.label ?? "Source"} ↗<span className="sr-only"> (opens in a new tab)</span></a></> : null}</p> : null}
                  <PhotoGroup><ul className="mt-1 divide-y divide-black/15 border-t border-black/15">
                    {list.map(({ c, o, grade }) => <CandidateRow key={c.name} raceId={r.id} c={c} o={o} ids={ids} answers={answers ?? {}} answeredYesNo={yesNo > 0} grade={null} avatar="lg" />)}
                  </ul>
                  <RaceFooter cands={list.map(({ c }) => c)} gradesHidden={null} /></PhotoGroup>
                </li>
              ))}
            </ul>
        </>
      </section>

      <div className="mt-10 flex flex-wrap gap-3 print:hidden">
        <button type="button" onClick={() => window.print()} className="h-12 bg-black px-6 text-base font-[530] text-[#F2F2F2] hover:bg-black/80" data-card-print>Print</button>
        <button type="button" onClick={share} className="h-12 border border-black px-6 text-base font-[530]" data-card-share>{copied ? "Link copied" : "Share link"}</button>
        {gcalEd ? <Button onClick={() => window.open(gcalEd, "_blank", "noopener")} className="h-12 rounded-none border border-black bg-transparent px-6 text-base font-[530] text-black hover:border-black hover:text-black [@media(hover:hover)]:hover:bg-brand-50" data-card-gcal={gcalEd}>Add to Google Calendar ↗<span className="sr-only"> (opens in a new tab)</span></Button> : null}
        {ed ? <button type="button" onClick={ics} className="inline-flex min-h-12 items-center px-2 text-sm text-black/60 underline decoration-black/20 underline-offset-2 hover:text-black" data-card-ics>or download .ics</button> : null}
        <a href="/" className="inline-flex h-12 items-center px-2 text-base th-link">Back to the full ballot</a>
      </div>
      <p className="mt-6 text-sm leading-5 text-black/60">Your answers stay on this device and in this link. <a href={ed?.sourceUrl} className={link} target="_blank" rel="noreferrer">Dates source ↗</a></p>
    </main>
  );
}
