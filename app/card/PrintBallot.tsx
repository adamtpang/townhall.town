// The printed "take it to the polls" ballot (Adam, Oct 30 2:28 PM CT). Shown only in print (window.print() / Save as
// PDF); hidden on screen. Every line comes from the same sourced data as the card (lib/endscreen.mjs, data/civic/*,
// lib/plan.ts, lib/logistics.ts, data/ballots.json). Names and parties only: no overlap answers, grades, odds or
// recommendation wording. Links can't be clicked on paper, so each source is printed as a URL and cited by number.
import { bring, type St } from "../../lib/plan";
import { NO_ONLINE_VOTING } from "../../lib/logistics";

export type PrintRace = { id: string; title?: string; judicial: boolean; source?: string | null; candidates: { name: string; party?: string | null }[] };
export type PrintMeasure = { id: string; title: string; source?: string | null };
export type PrintData = { state: St; verify?: { label: string; url: string } | null; races: PrintRace[]; measures: PrintMeasure[] };
type Ev = { start: string; end: string; hours?: string | null; sourceUrl: string; daily?: { label: string; hours: string; appliesTo: string | null }[] };
type Site = { name: string; address: string; sourceUrl?: string };

const longDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });

export default function PrintBallot({ zip, place, today, ed, early, earlyLine, mail, site, lookupUrl, dependsOnAddress, data }: {
  zip: string; place: string; today: string; ed?: Ev; early?: Ev; earlyLine?: string | null; mail?: { text: string; sourceUrl: string } | null;
  site?: Site; lookupUrl?: string | null; dependsOnAddress?: boolean; data: PrintData;
}) {
  // Numbered source list, first-cited first, one entry per URL.
  const urls: string[] = [];
  const cite = (u?: string | null) => { if (!u) return null; let i = urls.indexOf(u); if (i < 0) { urls.push(u); i = urls.length - 1; } return <sup className="pb-cite">[{i + 1}]</sup>; };
  const id = bring(data.state);
  const races = data.races.filter((r) => r.candidates.length);
  return (
    <div id="ballot-print" className="hidden print:block" aria-hidden data-print-ballot>
      <p className="pb-eyebrow">townhall.town · {place} · ZIP {zip}</p>
      <h1 className="pb-h1">Your ballot card</h1>
      <p className="pb-sub">Take it to the polls. Nonpartisan. Not a government site. No endorsements.</p>

      <div className="pb-when">
        {ed ? <p className="pb-ed" data-print-ed>Election Day: {longDate(ed.start)}{ed.hours ? `, ${ed.hours}` : ""}{cite(ed.sourceUrl)}</p> : null}
        {early && earlyLine ? <p data-print-early>{earlyLine}.{cite(early.sourceUrl)}</p> : null}
        {mail ? <p>{mail.text}{cite(mail.sourceUrl)}</p> : null}
      </div>

      <div className="pb-grid">
        <section className="pb-box" data-print-where>
          <h2 className="pb-h2">Where</h2>
          {site ? (<>
            <p className="pb-strong">{site.name}{cite(site.sourceUrl)}</p>
            <p>{site.address}</p>
            {dependsOnAddress && lookupUrl ? <p className="pb-small">Find your assigned polling place: <span className="pb-url">{lookupUrl}</span></p> : null}
          </>) : lookupUrl ? (
            <p>Your polling place is assigned by home address. Find it: <span className="pb-url">{lookupUrl}</span>{cite(lookupUrl)}</p>
          ) : <p>No sourced polling place for this ZIP yet.</p>}
        </section>
        <section className="pb-box" data-print-hours>
          <h2 className="pb-h2">Hours and what to bring</h2>
          {ed ? <p>Election Day: {ed.hours ? `polls open ${ed.hours}` : "poll hours not found in an official source"}{cite(ed.sourceUrl)}</p> : null}
          {early?.daily?.length ? early.daily.map((d, i, all) => <p key={i}>Early voting, {d.label}: {d.hours}{d.appliesTo && new Set(all.map((x) => x.appliesTo)).size > 1 ? ` (${d.appliesTo})` : ""}</p>) : early?.hours ? <p>Early voting: {early.hours}</p> : null}
          <p className="pb-strong pb-gap">Bring: {id.text}{cite(id.source.url)}</p>
          <p className="pb-small">{NO_ONLINE_VOTING}</p>
        </section>
      </div>

      <h2 className="pb-h2 pb-section">On your ballot</h2>
      <ol className="pb-races" data-print-races={races.length}>
        {races.map((r) => (
          <li key={r.id} className="pb-race" data-print-race={r.id}>
            <p className="pb-race-title">{r.title || r.id}{cite(r.source)}</p>
            <ul>{r.candidates.map((c) => <li key={c.name}><span className="pb-name">{c.name}</span>{c.party ? <span className="pb-party">, {c.party}</span> : null}</li>)}</ul>
          </li>
        ))}
      </ol>

      {data.measures.length ? (<>
        <h2 className="pb-h2 pb-section">Measures</h2>
        <ol className="pb-races" data-print-measures={data.measures.length}>
          {data.measures.map((m) => <li key={m.id} className="pb-race" data-print-measure={m.id}><p className="pb-race-title">{m.title}{cite(m.source)}</p></li>)}
        </ol>
      </>) : null}

      {data.verify ? <p className="pb-small pb-gap">Confirm with your official sample ballot: {data.verify.label}, <span className="pb-url">{data.verify.url}</span>{cite(data.verify.url)}</p> : null}

      <section className="pb-sources" data-print-sources={urls.length}>
        <h2 className="pb-h2">Sources</h2>
        <ol>{urls.map((u, i) => <li key={u}><span className="pb-num">[{i + 1}]</span> <span className="pb-url">{u}</span></li>)}</ol>
      </section>
      <p className="pb-foot" data-print-footer>townhall.town · Generated {longDate(today)}</p>
    </div>
  );
}
