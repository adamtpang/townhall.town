// The printed "take it to the polls" ballot (Adam, Oct 30 2:28 PM CT; Design addendum 2:38 PM CT). Shown only in print
// (window.print() / Save as PDF); hidden on screen. Every voter rule (booth, devices, ID, Election Day hours) is printed
// verbatim from Civic's data/civic/voter_rules.json and only when its status is confirmed; where to vote is the official
// lookup link per ZIP (never a guessed address). Names and parties only: no overlap answers, grades, odds or recommendation
// wording. Links can't be clicked on paper, so each source is printed as a URL and cited by number. No QR code: no QR
// library is in the dependencies.
import { BOOTH_LINE, NON_ENDORSEMENT, ORDER_UNSURE_LINE, displayParty } from "../../lib/printText";
import type { PrintRules, VoterRule } from "../../lib/printRules";
import type { St } from "../../lib/plan";

export type PrintRace = { id: string; title?: string; judicial: boolean; source?: string | null; orderConfirmed: boolean; candidates: { name: string; party?: string | null }[] };
export type PrintMeasure = { id: string; title: string; source?: string | null };
export type PrintData = { state: St; verify?: { label: string; url: string } | null; rules: PrintRules; races: PrintRace[]; measures: PrintMeasure[] };
type Ev = { start: string; end: string; hours?: string | null; sourceUrl: string; daily?: { label: string; hours: string; appliesTo: string | null }[] };

const longDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
const shortDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

export default function PrintBallot({ zip, today, ed, early, earlyLine, lookupUrl, dependsOnAddress, jurisdiction, data }: {
  zip: string; today: string; ed?: Ev; early?: Ev; earlyLine?: string | null;
  lookupUrl?: string | null; dependsOnAddress?: boolean; jurisdiction?: string | null; data: PrintData;
}) {
  // Numbered source list, first-cited first, one entry per URL.
  const urls: string[] = [];
  const cite1 = (u?: string | null) => { if (!u) return null; let i = urls.indexOf(u); if (i < 0) { urls.push(u); i = urls.length - 1; } return i + 1; };
  const cite = (...us: (string | null | undefined)[]) => { const n = us.map(cite1).filter((x): x is number => x != null); return n.length ? <sup className="pb-cite">[{n.join(", ")}]</sup> : null; };
  const rule = (r: VoterRule, attr: string) => <p className="pb-rule" {...{ [attr]: r.topic }}>&ldquo;{r.text}&rdquo; <span className="pb-src">{r.sourceName}</span>{cite(...r.sourceUrls)}</p>;
  const { booth, devices, id, hours } = data.rules;
  const races = data.races.filter((r) => r.candidates.length);
  const unconfirmed = races.filter((r) => !r.orderConfirmed).length;
  const county = (jurisdiction || "").replace(/,\s*[A-Z]{2,3}$/, "");
  return (
    <div id="ballot-print" className="hidden print:block" aria-hidden data-print-ballot>
      <header className="pb-mast">
        <p className="pb-wm">townhall.town</p>
        <div className="pb-ttl"><p className="pb-h1">Your ballot{ed ? `, ${shortDate(ed.start)}` : ""}</p><p>ZIP {zip}{jurisdiction ? ` · ${jurisdiction}` : ""}</p></div>
      </header>
      <p className="pb-ne" data-print-non-endorsement>{NON_ENDORSEMENT} Nonpartisan. Not a government site.</p>

      <div className="pb-grid">
        <section className="pb-box" data-print-where>
          <h2 className="pb-h2">Where</h2>
          {lookupUrl && dependsOnAddress === false ? (
            <p data-print-where-line>Any {county} vote center: <span className="pb-url">{lookupUrl}</span>{cite(lookupUrl)}</p>
          ) : lookupUrl ? (
            <p data-print-where-line>Your polling place is assigned by home address. Look it up: <span className="pb-url">{lookupUrl}</span>{cite(lookupUrl)}</p>
          ) : <p>No sourced polling place for this ZIP yet.</p>}
          <h2 className="pb-h2 pb-gap">When</h2>
          {ed ? <p className="pb-strong" data-print-ed>Election Day: {longDate(ed.start)}{cite(ed.sourceUrl)}</p> : null}
          {hours ? <div data-print-hours>{rule(hours, "data-rule")}</div> : null}
          {early && earlyLine ? <p className="pb-gap" data-print-early>{earlyLine}.{cite(early.sourceUrl)}</p> : null}
        </section>
        <section className="pb-box" data-print-bring>
          {id ? (<><h2 className="pb-h2">ID</h2><div data-print-id>{rule(id, "data-rule")}</div></>) : null}
          {booth || devices ? <h2 className="pb-h2 pb-gap">This sheet</h2> : null}
          {booth ? (<div data-print-booth><p className="pb-strong" data-print-booth-line>{BOOTH_LINE}.</p>{rule(booth, "data-rule")}</div>) : null}
          {devices ? <div className="pb-gap" data-print-devices>{rule(devices, "data-rule")}</div> : null}
        </section>
      </div>

      <h2 className="pb-h2 pb-section">Races</h2>
      {unconfirmed ? <p className="pb-muted" data-print-order-unsure={unconfirmed}>{ORDER_UNSURE_LINE}</p> : null}
      <ol className="pb-races" data-print-races={races.length}>
        {races.map((r) => (
          <li key={r.id} className="pb-race" data-print-race={r.id} data-order-confirmed={r.orderConfirmed ? "1" : "0"}>
            <p className="pb-race-title">{r.title || r.id}{r.orderConfirmed ? null : <sup className="pb-dagger" data-print-dagger>†</sup>}{cite(r.source)}</p>
            <ul>{r.candidates.map((c) => { const p = displayParty(c.name, c.party); return <li key={c.name} className="pb-cand"><span className="pb-box-mark" aria-hidden /><span><span className="pb-name">{c.name}</span>{p ? <span className="pb-party">, {p}</span> : null}</span></li>; })}</ul>
          </li>
        ))}
      </ol>

      {data.measures.length ? (<>
        <h2 className="pb-h2 pb-section">Measures</h2>
        <ol className="pb-races" data-print-measures={data.measures.length}>
          {data.measures.map((m) => <li key={m.id} className="pb-race" data-print-measure={m.id}><p className="pb-race-title">{m.title}{cite(m.source)}</p></li>)}
        </ol>
      </>) : null}

      {data.verify ? <p className="pb-small pb-gap">Check your official sample ballot: {data.verify.label}, <span className="pb-url">{data.verify.url}</span>{cite(data.verify.url)}</p> : null}

      <section className="pb-sources" data-print-sources={urls.length}>
        <h2 className="pb-h2">Sources</h2>
        <ol>{urls.map((u, i) => <li key={u}><span className="pb-num">[{i + 1}]</span> <span className="pb-url">{u.replace(/^https?:\/\/(www\.)?/, "")}</span></li>)}</ol>
      </section>
      <p className="pb-foot" data-print-footer>townhall.town · ZIP {zip} · Printed {longDate(today)}. Check your county for changes.</p>
    </div>
  );
}
