"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { H1 } from "../../lib/typeScale";
import { stancesFor, type Answers } from "../../lib/issues";
import { overlapStatus } from "../../lib/overlapCore.mjs";
import { gradesForRace } from "../../lib/grades.mjs";
import { PhotoGroup } from "../../components/Portrait";
import RaceFooter from "../../components/RaceFooter";
import CandidateRow, { type RowCand } from "../../components/CandidateRow";
import { whenFor, whereFor, buildIcs, mapsUrl, earlySingleDay } from "../../lib/endscreen.mjs";
import { decodeAnswers, cardPath } from "../../lib/card.mjs";
import { electionFirst, planEventUrl, topRaceTitles } from "../../lib/gcal";
import { Button } from "../../components/ui/button";
import PrintBallot, { type PrintData } from "./PrintBallot";
import { ORDER_UNSURE_LINE, SPLIT_GROUPS, TX_PHONE_LINE, TX_PHONE_SOURCES, ballotSlots, pickedLine, splitStart } from "../../lib/printText";
import PrintButton from "../../components/PrintButton";
import { SiteHeader } from "../../components/SiteChrome";
import { LangProvider, LangToggle, useT } from "../../lib/i18n";
import { ChevronDown } from "lucide-react";
import { FOLD_LABEL, FOLD_LINKS, WAIT_LINK, linkHost } from "../../lib/cardLinks";
import { DaggerTitle } from "./PrintBallot";
import type { OrderLine } from "../../lib/types";

const ANSWERS_KEY = "th-answers-v1";
/** Picks per ZIP ({raceId: candidate name}), this device only (Plan.tsx key). */
const PICKS_KEY = "townhall.picks.v1";
const todayCT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
type RaceLite = { id: string; title?: string; level?: string; judicial: boolean; meta?: unknown; order?: OrderLine | null; candidates: RowCand[] };

/** One printable page: overlap lines (not a recommendation), where, when, calendar. State is the URL hash or this device only. */
export default function BallotCard(props: { zip: string; place: string; county?: string | null; ids: string[]; races: RaceLite[]; print?: PrintData }) {
  return <LangProvider><Card {...props} /></LangProvider>;
}

const tileBox = "rounded-none border border-black/10 bg-white lg:col-span-4";
const tile = `${tileBox} p-5`;
const tileH = "text-xl leading-7 font-[530] text-black";
const small = "text-sm leading-5 text-black/60";
const ext = <span className="sr-only"> (opens in a new tab)</span>;
const extLink = "flex min-h-11 items-center th-link underline-offset-2 hover:underline";

function Card({ zip, place, county, ids, races, print }: { zip: string; place: string; county?: string | null; ids: string[]; races: RaceLite[]; print?: PrintData }) {
  const tr = useT();
  const [picks, setPicks] = useState<Record<string, string>>({});
  useEffect(() => { try { setPicks((JSON.parse(localStorage.getItem(PICKS_KEY) || "{}") as Record<string, Record<string, string>>)[zip] ?? {}); } catch { /* none */ } }, [zip]);
  const sheet = useRef<HTMLDialogElement>(null);
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const h = /(?:^|[#&])a=([yxn-]+)/.exec(window.location.hash)?.[1];
    if (h) { setAnswers(decodeAnswers(h, ids) as Answers); return; }
    try { setAnswers(JSON.parse(localStorage.getItem(ANSWERS_KEY) || "{}")); } catch { setAnswers({}); }
  }, [ids]);
  // The end screen's "Print or download your ballot" opens /card?zip=…&print=1: open the print dialog once the card has rendered.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
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
  const rows = races.filter((r) => !r.judicial && r.candidates.length).map((r) => { const l0 = r.candidates.map((c) => ({ c, o: overlapStatus(answers ?? {}, stancesFor(c.name), ids) })); const g = gradesForRace(r, l0.map((x) => x.o), answered, zip); return { r, gradesHidden: g.hidden, list: l0.map((x, i) => ({ ...x, grade: g.grades[i] })) }; }); // rendered on the server too: no 3s "Loading…" (QA 4e15da7) // every non-judicial race, in data order (Adam, 11:28 PM: photos and sources on every row)
  // Card order matches the printed sheet (QA P2): candidates in Civic's confirmed official order where there is one.
  const order = new Map((print?.races ?? []).map((r) => [r.id, r.candidates.map((c) => c.name)]));
  for (const row of rows) { const o = order.get(row.r.id); if (o) row.list.sort((a, b) => o.indexOf(a.c.name) - o.indexOf(b.c.name)); }
  const pr = print?.races ?? [];
  const pickedRaces = pr.filter((r) => picks[r.id] && r.candidates.some((c) => c.name === picks[r.id]));
  // Civic print29 P1: split groups (from ballots.json's dependsOnAddress flags) count as one slot in "n of m picked".
  const groups = print?.splitGroups ?? SPLIT_GROUPS[zip] ?? [];
  const slots = ballotSlots(pr.filter((r) => r.candidates.length), groups);
  const pickedSlots = slots.filter((ids) => pickedRaces.some((r) => ids.includes(r.id))).length;
  const anyUnsure = pr.some((r) => !r.orderConfirmed);
  const earlyText = early ? (earlySingleDay(early, today) ?? `Early voting runs through ${fmt(early.end)}`).replace("Early voting ends today, ", "Early voting ends ") : null;
  const fold = FOLD_LINKS[zip] ?? [];
  const wait = WAIT_LINK[zip];
  const yesNo = answers ? ids.filter((id) => typeof answers[id] === "number" && answers[id] !== 0).length : 0;

  function ics() {
    const blob = new Blob([buildIcs(electionFirst(when.events), site ? site.address : "")], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "townhall-dates.ics";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function share() {
    const url = `${location.origin}${cardPath(zip, answers || {}, ids)}`;
    try { if (navigator.share) { await navigator.share({ title: "My ballot card", url }); return; } await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* cancelled */ }
  }
  const splitP = (id: string, present: string[]) => { const sp = splitStart(zip, id, present, groups); return sp ? <div className="mb-1 text-sm leading-5 text-black/80" data-card-split={id}>{sp.line ? <p data-card-split-line>{sp.line}</p> : null}<a href={sp.url} className="inline-flex min-h-11 items-center th-link underline-offset-2 hover:underline" target="_blank" rel="noreferrer">{linkHost(sp.url)} ↗{ext}</a></div> : null; };
  const link = "relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] th-link underline-offset-2 hover:underline print:text-black";
  return (
    <>
    <div className="sticky top-0 z-30 border-b border-black/10 bg-white/70 backdrop-blur-md print:hidden" data-card-header><SiteHeader compact extra={<LangToggle />} /></div>
    <main id="main" tabIndex={-1} className="scroll-mt-16 mx-auto max-w-[720px] px-5 pb-12 pt-3 text-black lg:max-w-[1280px] lg:px-10 print:max-w-none print:px-0 print:py-0" data-ballot-card>
      {print ? <PrintBallot zip={zip} today={today} ed={ed} early={early} earlyLine={earlyText} lookupUrl={edWhere.lookupUrl} dependsOnAddress={edWhere.dependsOnAddress} jurisdiction={edWhere.jurisdiction ?? where.jurisdiction ?? null} data={print} picks={picks} /> : null}
      <div className={print ? "print:hidden" : undefined}>
      <h1 className="sr-only">Your ballot card</h1>
      <p className={small} data-card-place>{zip} · {county ?? place}</p>
      {/* Design WWW first screen (card-www-spec.md): three flat tiles, then the one print button, then one closed fold. */}
      <div className="mt-3 grid gap-3 lg:grid-cols-12" data-www>
        <section className={tileBox} data-www-tile="who">
          <button type="button" onClick={() => sheet.current?.showModal()} className="block min-h-11 w-full p-5 text-left" aria-haspopup="dialog" data-www-who-open>
            <h2 className={tileH}>{tr("Who")}</h2>
            <p className={`mt-1 ${small}`} data-www-picked>{pickedLine(pickedSlots, slots.length)}</p>
            {pickedRaces.length ? <ul className="mt-2 space-y-2">{pickedRaces.map((r, i) => (
              <li key={r.id} className={i >= 3 ? "hidden lg:block" : undefined} hidden={i >= 6}><p className={small}>{r.title || r.id}</p><p className="text-base leading-6 font-[530]">{picks[r.id]}</p></li>
            ))}</ul> : null}
          </button>
        </section>
        <section className={tile} data-www-tile="when">
          <h2 className={tileH}>{tr("When")}</h2>
          {ed ? <p className="mt-1 text-base leading-6 font-[530]" data-card-date>{tr("Election Day")}: {fmt(ed.start)}{ed.hours ? `, ${ed.hours}` : ""}</p> : null}
          {earlyText ? <p className="mt-1 text-base leading-6 text-black/80" data-early-heading>{earlyText}. <a href={early?.sourceUrl} className="th-link whitespace-nowrap" target="_blank" rel="noreferrer">Source ↗{ext}</a></p> : null}
        </section>
        <section className={tile} data-www-tile="where">
          <h2 className={tileH}>{tr("Where")}</h2>
          {edWhere.lookupUrl && edWhere.dependsOnAddress === false ? <p className="mt-1 text-base leading-6 font-[530]" data-www-any-center>Any {edWhere.jurisdiction ?? county} vote center</p> : null}
          {edWhere.lookupUrl ? <a href={edWhere.lookupUrl} className={extLink} target="_blank" rel="noreferrer" data-card-map data-card-lookup>{where.lookupLabel ?? tr("Find your polling place")} ↗{ext}</a> : <p className="mt-1 text-base text-black/60">No sourced polling place for this ZIP yet.</p>}
          {/* Merge of prod 3cf1594: its Voter Portal link (where.portalUrl, data-card-portal) is the same SF portal as whereExtra. */}
          {print?.whereExtra ? <a href={print.whereExtra.url} className={extLink} target="_blank" rel="noreferrer" data-www-portal data-card-portal>{print.whereExtra.label} ↗{ext}</a>
            : where.portalUrl ? <a href={where.portalUrl} className={extLink} target="_blank" rel="noreferrer" data-card-portal>Voter Portal ↗{ext}</a> : null}
          {wait ? <a href={wait.url} className={extLink} target="_blank" rel="noreferrer" data-www-wait>{wait.label} ↗{ext}</a> : null}
        </section>
      </div>
      <div className="mt-3 lg:w-[calc((100%-1.5rem)/3)]">
        {print?.state === "TX" ? (
          <div className="mb-2" data-card-phone-line>
            <p className={small}>{TX_PHONE_LINE}</p>
            <p className="flex flex-wrap gap-x-2 text-sm">{TX_PHONE_SOURCES.map((x) => <a key={x.url} href={x.url} className="inline-flex min-h-11 items-center th-link underline-offset-2 hover:underline" target="_blank" rel="noreferrer">{x.label} ↗{ext}</a>)}</p>
          </div>
        ) : null}
        {print ? <PrintButton data-card-print /> : null}
        {fold.length ? (
          <details className="group mt-1 border-b border-black/10" data-card-fold>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-base font-[530] [&::-webkit-details-marker]:hidden">{FOLD_LABEL}<ChevronDown aria-hidden className="h-4 w-4 text-black/60 transition-transform group-open:rotate-180" data-fold-chevron /></summary>
            <ul className="pb-2">{fold.map((x) => <li key={x.url}><a href={x.url} className={`${extLink} text-sm`} target="_blank" rel="noreferrer" data-fold-link>{x.label}: {linkHost(x.url)} ↗{ext}</a></li>)}</ul>
          </details>
        ) : null}
      </div>
      <dialog ref={sheet} className="m-0 ml-auto h-dvh max-h-none w-full max-w-md bg-white p-0 text-black backdrop:bg-black/40" aria-labelledby="www-sheet-h" onClick={(e) => { if (e.target === e.currentTarget) sheet.current?.close(); }} data-www-sheet>
        <div className="sticky top-0 flex h-14 items-center justify-between border-b border-black/10 bg-white px-5">
          <h2 id="www-sheet-h" className={tileH}>{tr("Who")}</h2>
          <button type="button" onClick={() => sheet.current?.close()} className="min-h-11 min-w-11 text-xl" aria-label="Close">×</button>
        </div>
        <div className="px-5 py-4">
          <p className={small}>{pickedLine(pickedSlots, slots.length)}</p>
          {anyUnsure ? <p className={`mt-2 ${small}`} id="www-order-unsure" data-www-unsure>† {ORDER_UNSURE_LINE}</p> : null}
          <ul className="mt-3 divide-y divide-black/10">{pr.map((r) => (
            <li key={r.id} className="py-3">{splitP(r.id, pr.map((x) => x.id))}<p className="text-sm leading-5 text-black/60"><DaggerTitle title={r.title || r.id} unsure={!r.orderConfirmed} id="www-order-unsure" /></p>{picks[r.id] ? <p className="text-base leading-6 font-[530]">{picks[r.id]}</p> : null}</li>
          ))}</ul>
        </div>
      </dialog>
      {when.mail ? <p className="mt-10 text-base font-[450] text-black/80">{when.mail.text} <a href={when.mail.sourceUrl} className={link} target="_blank" rel="noreferrer">Source ↗</a></p> : null}

      <section className="mt-10 border-t border-black/15 pt-6" id="card-overlap" data-card-overlap>
        <h2 className="text-sm font-[530] text-black/60" tabIndex={-1}>Who lines up with you</h2>
        <p className="mt-1 text-base leading-6 text-black" data-overlap-caption>Issue overlap, not a recommendation. Court races are not compared.</p>
        
        <>
            {answers === null ? null : answered === 0 ? <p className="mt-3 text-base text-black/80">No answers yet. <a href="/" className={link}>Answer a few questions</a> to compare.</p> : yesNo === 0 ? <p className="mt-3 text-base text-black/80" data-card-no-overlap>Neutral answers aren&rsquo;t compared; answer Yes or No on an issue to compare. <a href="/" className={link}>Change your answers</a>.</p> : null}
            <ul className="mt-3 space-y-6">
              {rows.map(({ r, list, gradesHidden }) => (
                <li key={r.id} data-card-race={r.id} className="break-inside-avoid">
                  {splitP(r.id, rows.map((x) => x.r.id))}
                  <h3 className="text-base font-[530]" data-race-title>{r.title || r.id}</h3>
                  {r.order ? <p className="max-w-[60ch] mt-1 text-sm leading-5 text-black/60" data-order-line={r.order.confirmed ? "confirmed" : "unsure"}>{r.order.text}{r.order.url ? <> <a href={r.order.url} target="_blank" rel="noreferrer" className="relative underline underline-offset-2 after:absolute after:-inset-y-3 after:-inset-x-1 after:content-['']" data-order-source>{r.order.label ?? "Source"} ↗<span className="sr-only"> (opens in a new tab)</span></a></> : null}</p> : null}
                  <PhotoGroup><ul className="mt-1 divide-y divide-black/15 border-t border-black/15">
                    {list.map(({ c, o, grade }) => <CandidateRow key={c.name} raceId={r.id} c={c} o={o} ids={ids} answers={answers ?? {}} answeredYesNo={yesNo > 0} grade={null} cut avatar="lg" />)}
                  </ul>
                  <RaceFooter cands={list.map(({ c }) => c)} gradesHidden={null} /></PhotoGroup>
                </li>
              ))}
            </ul>
        </>
      </section>

      <div className="mt-10 flex flex-wrap gap-3 print:hidden">
        <button type="button" onClick={share} className="h-12 border border-black px-6 text-base font-[530]" data-card-share>{copied ? "Link copied" : "Share link"}</button>
        {gcalEd ? <Button onClick={() => window.open(gcalEd, "_blank", "noopener")} className="h-12 rounded-none border border-black bg-transparent px-6 text-base font-[530] text-black hover:border-black hover:text-black [@media(hover:hover)]:hover:bg-brand-50" data-card-gcal={gcalEd}>Add to Google Calendar ↗<span className="sr-only"> (opens in a new tab)</span></Button> : null}
        {ed ? <button type="button" onClick={ics} className="inline-flex min-h-12 items-center px-2 text-sm text-black/60 underline decoration-black/20 underline-offset-2 hover:text-black" data-card-ics>or download .ics</button> : null}
        <a href="/" className="inline-flex h-12 items-center px-2 text-base th-link">Back to the full ballot</a>
      </div>
      <p className="mt-6 text-sm leading-5 text-black/60">Your answers stay on this device and in this link. <a href={ed?.sourceUrl} className={link} target="_blank" rel="noreferrer">Dates source ↗</a></p>
      </div>
    </main>
    </>
  );
}
