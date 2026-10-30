"use client";
import { useMemo } from "react";
import type { Photo } from "../components/Portrait";
import { Button } from "../components/ui/button";
import { stancesFor, sourceLabel, ISSUES, type Answers } from "../lib/issues";
import { overlapStatus, overlapLabel, METHOD, MIN_ISSUES } from "../lib/overlapCore.mjs";
import TownyResearch from "./TownyResearch";
import { cardPath } from "../lib/card.mjs";
import { voteMatters } from "../lib/voteMatters.mjs";
import { whenFor, whereFor, gcalUrl, buildIcs, mapsUrl } from "../lib/endscreen.mjs";

type Cand = { name: string; party?: string | null; photo?: Photo; campaignSite?: string | null; ballotpedia?: string | null };
type RaceLite = { id: string; title?: string; judicial?: "ny" | "tx" | "ca" | boolean; candidates: Cand[] };
const todayCT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const ext = <span className="sr-only"> (opens in a new tab)</span>;

/** A roll-call vote shown as the record itself, e.g. "Voted Nay on SB 8". */
function voteLine(st: { voteRecord?: string; quote?: string; bill?: string }) {
  if (!st?.voteRecord) return null;
  const vote = st.voteRecord.split(" (")[0];
  const bill = st.bill ?? /^([A-Z]{1,4} \d+)\b/.exec(st.quote || "")?.[1];
  return bill ? `${vote} on ${bill}` : vote;
}
/** Issues with no usable position: Civic's status text, exactly as written. Not counted. */
function nullNotes(name: string, ids: string[]): [string, string][] {
  const st = stancesFor(name);
  return ids.filter((id) => st[id] && st[id].value === null && st[id].status).map((id) => [id, st[id].status as string]);
}

/** The 90-second path ends here: Who / Where / When, one primary action each. Data only from sourced files. */
export default function EndScreen({ zip, races, answers, ids, answered }: { zip: string; races: RaceLite[]; answers: Answers; ids: string[]; answered: number }) {
  const today = todayCT();
  const when = useMemo(() => whenFor(zip, today), [zip, today]);
  const where = useMemo(() => whereFor(zip, today), [zip, today]);
  const site = where.sites[0];
  const ed = when.events.find((e: { kind: string }) => e.kind === "election");
  const early = when.events.find((e: { kind: string }) => e.kind === "early");
  function downloadIcs() {
    const blob = new Blob([buildIcs(when.events, site ? site.address : "")], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "townhall-dates.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const judicial = races.filter((r) => r.judicial && r.candidates?.length);
  const rowsByRace = races.filter((r) => r.candidates?.length && !r.judicial).map((race) => {
    const rows = race.candidates.map((c) => ({ c, o: overlapStatus(answers, stancesFor(c.name), ids) }));
    return { race, rows, any: rows.some((x) => x.o.sourced >= MIN_ISSUES) };
  });
  const zipNone = !rowsByRace.some((r) => r.any);

  return (
    <section id="end" className="border-t border-black py-24" data-end-screen>
      <p className="nds-caption-upper text-black/60">03</p>
      <h2 className="mt-3 font-serif text-5xl leading-none tracking-tight text-black lg:text-[72px]">Your plan</h2>
      {(() => { const vm = voteMatters(zip); return vm ? (
        <div className="mt-12 border-l-2 border-black pl-4" data-vote-matters>
          <p className="text-sm font-[530] text-black/60">Your vote matters here</p>
          <p className="mt-1 text-xl leading-7 text-black"><span className="font-[530]">{vm.lead}</span> {vm.text} {vm.compare}</p>
          <p className="mt-1 text-xs leading-4">{vm.sources.map((s: { label: string; url: string }, i: number) => <span key={s.url}>{i ? " · " : ""}<a href={s.url} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-3 after:content-[''] text-[#3760F2]">{s.label} ↗{ext}</a></span>)}</p>
        </div>
      ) : null; })()}
      <a href={cardPath(zip, answers, ids)} className="mt-6 inline-flex h-12 items-center border border-black px-5 text-base font-[530] text-black hover:bg-black hover:text-[#F2F2F2]" data-card-link>Take it with you: one-page ballot card</a>
      <div className="mt-12 grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-5">
        {/* WHO */}
        <div className="lg:col-span-6" data-end="who">
          <p className="text-sm font-[530] text-black/60">Who</p>
          <h3 className="mt-2 font-serif text-2xl leading-7 lg:text-[32px] lg:leading-9">Who lines up with you</h3>
          <p className="mt-3 text-xs leading-4 text-black/60" data-overlap-caption>Overlap, not a recommendation. Candidates are in ballot order.</p>
          <details className="mt-1"><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-black/60">How overlap is counted</summary><p className="pb-2 text-sm text-black/80">{METHOD} Candidates are listed in ballot order.</p></details>
          {judicial.length > 0 && (
            <p className="mt-4 text-sm text-black/60" data-judicial-note>
              {(() => {
                const st = judicial.some((r) => r.judicial === "ny") ? "ny" : judicial.some((r) => r.judicial === "ca") ? "ca" : "tx";
                const J = {
                  ny: ["Judicial candidates can\u2019t state positions on issues", "https://www.law.cornell.edu/regulations/new-york/22-NYCRR-100.5", "22 NYCRR 100.5(A)(4)(d)"],
                  tx: ["Texas judicial candidates can\u2019t pledge or promise how they\u2019ll rule on cases or classes of cases", "https://www.txcourts.gov/All_Archived_Documents/SupremeCourt/AdministrativeOrders/miscdocket/02/02916700.pdf", "Code of Judicial Conduct, Canon 5"],
                  ca: ["California judicial candidates can\u2019t make statements that commit them on issues likely to come before the courts", "https://www.courts.ca.gov/documents/ca_code_judicial_ethics.pdf", "Code of Judicial Ethics, Canon 5"],
                }[st];
                return <>{J[0]} (<a href={J[1]} target="_blank" rel="noreferrer" className="relative text-[#3760F2] after:absolute after:-inset-3 after:content-['']">{J[2]} ↗{ext}</a>), so no overlap is shown for {judicial.length} court race{judicial.length === 1 ? "" : "s"}.</>;
              })()}
            </p>
          )}
          {zipNone ? (
            <p className="mt-6 text-base text-black" data-zip-none>Not enough sourced positions for any candidate on this ballot yet, so there is no overlap to show. Each candidate&rsquo;s sources are linked in the races above.</p>
          ) : answered === 0 ? (
            <p className="mt-4 text-base text-black/60">Answer Yes, Neutral or No above to see overlap.</p>
          ) : (
            <div className="mt-6 space-y-8">
              {rowsByRace.filter((r) => r.any).map(({ race: r, rows }) => (
                <div key={r.id} data-race={r.id}>
                  <p className="text-base font-[530]">{r.title || r.id}</p>
                  <ul className="mt-1 divide-y divide-black/15 border-t border-black/15">
                    {rows.map(({ c, o }) => (
                      <li key={c.name} className="py-2" data-overlap={c.name} data-status={o.status}>
                        {o.status === "ok" ? (
                          <p className="text-base text-black">{overlapLabel(c.name, o)}</p>
                        ) : (
                          <p className="text-base text-black"><span className="font-[530]">{c.name}</span><span className="text-black/60">: {o.status === "few" ? "Not enough sourced positions" : "Answer Yes or No on more of their issues to compare"}</span></p>
                        )}
                        {nullNotes(c.name, ids).length > 0 && (
                          <p className="text-sm text-black/60" data-null-status>{nullNotes(c.name, ids).map(([id, t]) => `${ISSUES.find((i) => i.id === id)?.label}: ${t}`).join(" · ")}</p>
                        )}
                        {o.sourcedIds.length > 0 && (
                          <details><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-black/60" data-sourced-n={o.sourcedIds.length}>Sourced positions ({o.sourcedIds.length})</summary>
                            <ul className="space-y-2 pb-2">
                              {o.sourcedIds.map((id: string) => { const st = stancesFor(c.name)[id]; return (
                                <li key={id} className="text-sm text-black/80"><span className="font-[530]">{ISSUES.find((i) => i.id === id)?.label}:</span> {voteLine(st) ? <>{voteLine(st)}</> : <>&ldquo;{st.quote}&rdquo;</>} <span className="text-black/60" data-quote-year>{st.year ? `(${st.year})` : "(date unsure)"}</span> {st.sourceUrl ? <a href={st.sourceUrl} target="_blank" rel="noreferrer" data-own-line className="flex min-h-11 w-fit items-center text-[#3760F2]">{sourceLabel(st.sourceUrl)} ↗{ext}</a> : null}</li>
                              ); })}
                            </ul>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {rowsByRace.some((r) => !r.any) && (
                <div data-race-none-list>
                  <p className="text-sm text-black/60" data-race-none>Not enough sourced positions to compare yet in {rowsByRace.filter((r) => !r.any).length} race{rowsByRace.filter((r) => !r.any).length === 1 ? "" : "s"}.</p>
                  <ul className="mt-2 divide-y divide-black/15 border-t border-black/15">
                    {rowsByRace.filter((r) => !r.any).map(({ race: r }) => (
                      <li key={r.id} className="py-2" data-race-none-item={r.id}>
                        <p className="text-base font-[530]">{r.title || r.id}</p>
                        <TownyResearch zip={zip} raceId={r.id} title={r.title || r.id} names={r.candidates.map((c) => c.name)} issues={ids} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* WHERE */}
        <div className="lg:col-span-3" data-end="where">
          <p className="text-sm font-[530] text-black/60">Where</p>
          <h3 className="mt-2 font-serif text-2xl leading-7 lg:text-[32px] lg:leading-9">Where to go</h3>
          {site ? (
            <>
              <p className="mt-4 text-base font-[530]">{site.name}</p>
              <p className="text-base text-black/80">{site.address}</p>
              {site.hours && !/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d/.test(site.hours) && <p className="mt-1 text-sm text-black/60">{where.phase === "early" ? "Early voting: " : "Election Day: "}{site.hours}</p>}
              <Button onClick={() => window.open(mapsUrl(site.address), "_blank", "noopener")} className="mt-4 h-12 w-full rounded-none bg-black px-6 text-base text-[#F2F2F2] hover:bg-black/80 lg:w-auto" data-maps-url={mapsUrl(site.address)}>
                Directions ↗{ext}
              </Button>
              <p className="mt-2 text-xs leading-4 text-black/60">{site.proximity ? `${site.proximity}. ` : ""}<a href={site.sourceUrl} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-3 after:content-[''] text-[#3760F2]">Official site list ↗{ext}</a></p>
              {where.sites.length > 1 && (
                <details className="mt-1"><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-black/60">Other sourced sites ({Math.min(where.sites.length - 1, 4)})</summary>
                  <ul className="space-y-1 pb-2">
                    {where.sites.slice(1, 5).map((s: { name: string; address: string }) => (
                      <li key={s.name} className="text-sm"><a href={mapsUrl(s.address)} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-3 after:content-[''] text-[#3760F2]">{s.name} ↗{ext}</a><span className="block text-black/60">{s.address}</span></li>
                    ))}
                  </ul>
                </details>
              )}
              {where.dependsOnAddress && where.lookupUrl && (
                <p className="text-sm"><a href={where.lookupUrl} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-3 after:content-[''] text-[#3760F2]">Find your assigned polling place ↗{ext}</a></p>
              )}
            </>
          ) : where.lookupUrl ? (
            <>
              <p className="mt-4 text-base text-black/80">Your polling place is assigned by home address.</p>
              <Button onClick={() => window.open(where.lookupUrl!, "_blank", "noopener")} className="mt-4 h-12 w-full rounded-none bg-black px-6 text-base text-[#F2F2F2] hover:bg-black/80 lg:w-auto" data-lookup-url={where.lookupUrl}>
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
          <h3 className="mt-2 font-serif text-2xl leading-7 lg:text-[32px] lg:leading-9">When to go</h3>
          <ul className="mt-4 space-y-3">
            {early && (<li data-early><p className="text-sm font-[530]">Early voting, {fmt(early.start)} to {fmt(early.end)}</p>
              {early.daily?.length ? (
                <ul className="mt-1 space-y-1" data-daily-hours>
                  {early.daily.map((d: { label: string; hours: string; appliesTo: string | null }, i: number) => (
                    <li key={i} className="text-base text-black/80">{d.label}: {d.hours}{d.appliesTo && early.daily.length > 1 && new Set(early.daily.map((x: { appliesTo: string | null }) => x.appliesTo)).size > 1 ? <span className="block text-xs leading-4 text-black/60">{d.appliesTo}</span> : null}</li>
                  ))}
                </ul>
              ) : early.hours ? <p className="text-base text-black/80">{early.hours}</p> : <p className="text-base text-black/80">Hours vary by day</p>}
              <a href={early.sourceUrl} target="_blank" rel="noreferrer" className="relative text-xs leading-4 text-[#3760F2] after:absolute after:-inset-x-3 after:-inset-y-1 after:content-['']">Early voting source ↗{ext}</a></li>)}
            {ed && (<li><p className="text-sm font-[530]">Election Day, {fmt(ed.start)}</p><p className="text-base text-black/80">{ed.hours ? `Polls open ${ed.hours}` : "Poll hours not found in an official source"}</p></li>)}
            {when.registration && when.registration.openOnOct30 === true && when.registration.sourceUrl && (<li><p className="text-sm font-[530]">Registration</p><p className="text-base text-black/80">You can still register and vote. <a href={when.registration.sourceUrl} target="_blank" rel="noreferrer" className="text-[#3760F2]">How ↗{ext}</a></p></li>)}
            {when.mail && (<li data-mail><p className="text-sm font-[530]">By mail</p><p className="text-base text-black/80">{when.mail.text} <a href={when.mail.sourceUrl} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-3 after:content-[''] text-xs leading-4 text-[#3760F2]">Source ↗</a></p></li>)}
            {when.missing.map((m: string) => <li key={m} className="text-sm text-black/60">{m}: not found in an official source yet.</li>)}
          </ul>
          {ed && (
            <>
              <Button onClick={() => window.open(gcalUrl(ed, site ? site.address : ""), "_blank", "noopener")} className="mt-4 h-12 w-full rounded-none bg-black px-6 text-base text-[#F2F2F2] hover:bg-black/80 lg:w-auto" data-gcal-url={gcalUrl(ed, site ? site.address : "")}>
                Add to Google Calendar ↗{ext}
              </Button>
              <div className="mt-2 flex flex-col items-start gap-2 text-sm" data-cal-links>
                <button type="button" onClick={downloadIcs} className="relative text-[#3760F2] after:absolute after:-inset-x-3 after:-inset-y-1 after:content-[''] hover:underline" data-ics>Download .ics (Apple, Outlook)</button>
                {early && <a href={gcalUrl(early, site ? site.address : "")} target="_blank" rel="noreferrer" className="relative text-[#3760F2] after:absolute after:-inset-x-3 after:-inset-y-1 after:content-[''] hover:underline" data-gcal-early>Early voting to Google ↗{ext}</a>}
                <a href={ed.sourceUrl} target="_blank" rel="noreferrer" className="relative text-xs leading-4 text-[#3760F2] after:absolute after:-inset-x-3 after:-inset-y-1 after:content-['']">Dates source ↗{ext}</a>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
