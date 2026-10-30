// The printed "take it to the polls" ballot (Adam, Oct 30 2:28 PM CT; Design addendum 2:38 PM CT; Design + Civic fixes
// 2:58 PM CT). Shown only in print (window.print() / Save as PDF); hidden on screen. Order: masthead, trust line, one-line
// facts (where, Election Day, early voting, the booth line), then the races straight away. The verbatim voter rules (ID,
// hours, booth, devices) sit at the end under "Rules", each with its source. Every voter rule is printed verbatim from
// Civic's data/civic/voter_rules.json and only when its status is confirmed; where to vote is the official lookup link per
// ZIP (never a guessed address). Names and parties only: no overlap answers, grades, odds or recommendation wording.
// Links can't be clicked on paper, so each link prints as a short label with a numbered note, and the full URL is printed
// once in the numbered list at the end (the only place long URLs may break anywhere). No QR code: no QR library is in the
// dependencies.
import { BOOTH_LINE, NON_ENDORSEMENT, ORDER_CONFIRMED_LINE, ORDER_UNSURE_LINE, SOURCES_LABEL, TX_PHONE_LINE, TX_PHONE_SOURCES, displayParty, pickedLine, splitStart, SPLIT_GROUPS } from "../../lib/printText";
import type { OrderCite, PrintRules, VoterRule } from "../../lib/printRules";
import type { St } from "../../lib/plan";

export type PrintRace = { id: string; title?: string; judicial: boolean; orderConfirmed: boolean; candidates: { name: string; party?: string | null }[] };
export type PrintMeasure = { id: string; title: string };
export type PrintData = { state: St; verify?: { label: string; url: string } | null; whereExtra?: { label: string; url: string } | null; rules: PrintRules; orderCite?: OrderCite | null; races: PrintRace[]; measures: PrintMeasure[] };
type Ev = { start: string; end: string; hours?: string | null; sourceUrl: string; daily?: { label: string; hours: string; appliesTo: string | null }[] };

const longDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
const shortDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
/** Choice words for a retention race, read from its title as the data writes them ("(retention: Yes/No)"). None: no boxes. */
export const retentionChoices = (title?: string) => { const m = /\(retention:\s*([^)/]+)\/([^)]+)\)/i.exec(title || ""); return m ? [m[1].trim(), m[2].trim()] : null; };
/** Title with its last word and the dagger in one nowrap span (Design 3:06 PM CT), so the † never sits alone on a line. */
export function DaggerTitle({ title, unsure, id }: { title: string; unsure: boolean; id?: string }) {
  if (!unsure) return <>{title}</>;
  const i = title.lastIndexOf(" ");
  return <>{i > 0 ? title.slice(0, i + 1) : ""}<span className="whitespace-nowrap">{i > 0 ? title.slice(i + 1) : title}<sup className="pb-dagger" data-print-dagger aria-describedby={id}>†</sup></span></>;
}
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

export default function PrintBallot({ zip, today, ed, early, earlyLine, lookupUrl, dependsOnAddress, jurisdiction, data, picks = {} }: {
  zip: string; today: string; ed?: Ev; early?: Ev; earlyLine?: string | null; picks?: Record<string, string>;
  lookupUrl?: string | null; dependsOnAddress?: boolean; jurisdiction?: string | null; data: PrintData;
}) {
  // Numbered notes, first-cited first, one entry per URL (label kept from the first cite).
  const notes: { url: string; label: string }[] = [];
  const note1 = (u: string | null | undefined, label: string) => { if (!u) return null; let i = notes.findIndex((n) => n.url === u); if (i < 0) { notes.push({ url: u, label }); i = notes.length - 1; } else if (!notes[i].label.split("; ").includes(label)) notes[i].label += `; ${label}`; return i + 1; };
  const cite = (label: string, ...us: (string | null | undefined)[]) => { const n = us.map((u) => note1(u, label)).filter((x): x is number => x != null); return n.length ? <span className="pb-cite">{"\u00a0"}[{n.join(",\u00a0")}]</span> : null; };
  const rule = (r: VoterRule) => <p className="pb-rule" data-rule={r.topic}>&ldquo;{r.text}&rdquo; <span className="pb-src">{r.sourceName}</span>{cite(r.sourceName, ...r.sourceUrls)}</p>;
  const { booth, devices, id, hours } = data.rules;
  const races = data.races.filter((r) => r.candidates.length);
  const unconfirmed = races.filter((r) => !r.orderConfirmed).length;
  const oc = data.orderCite ?? null;
  const county = (jurisdiction || "").replace(/,\s*[A-Z]{2,3}$/, "");
  const zipPage = `https://townhall.town/card?zip=${zip}`;
  // Page 1 mirrors the /card tiles: Who, When (early voting first, then Election Day), Where. Cited first, so their notes
  // come first in the list. The SF Voter Portal sits in Where too (QA P1 #3), from polling_locations.json.
  const picked = races.filter((r) => picks[r.id] && r.candidates.some((c) => c.name === picks[r.id])).length;
  const whoP = <p data-print-who><b>Who:</b> {pickedLine(picked, races.length)}</p>;
  const earlyP = early && earlyLine ? <p data-print-early>{earlyLine}.{cite("Early voting", early.sourceUrl)}</p> : null;
  const edLine = ed ? <p data-print-ed>Election Day: {longDate(ed.start)}{cite("Election dates", ed.sourceUrl)}</p> : null;
  const extra = data.whereExtra ? <> <span className="pb-label">{data.whereExtra.label}</span>{cite(data.whereExtra.label, data.whereExtra.url)}</> : null;
  const whereLine = lookupUrl && dependsOnAddress === false
    ? <p data-print-where-line><b>Where:</b> Any {county} vote center. <span className="pb-label">{host(lookupUrl)}</span>{cite("Where to vote", lookupUrl)}{extra}</p>
    : lookupUrl
      ? <p data-print-where-line><b>Where:</b> Your polling place is assigned by home address. Look it up at <span className="pb-label">{host(lookupUrl)}</span>{cite("Where to vote", lookupUrl)}.{extra}</p>
      : <p data-print-where-line><b>Where:</b> No sourced polling place for this ZIP yet.</p>;
  const boothP = booth ? <p className="pb-strong" data-print-booth-line>{BOOTH_LINE}.</p> : null;
  // Adam 3:07 PM CT: the TX phone line, next to the booth line on the TX sheet only. Text only, cited.
  const phoneP = data.state === "TX" && booth ? <p data-print-phone-line>{TX_PHONE_LINE}{cite(TX_PHONE_SOURCES[0].label, TX_PHONE_SOURCES[0].url)}{cite(TX_PHONE_SOURCES[1].label, TX_PHONE_SOURCES[1].url)}</p> : null;
  const ocAlso = (o: OrderCite) => o.also ? <> <span className="pb-src">{o.also.label}</span>{cite(o.also.label, o.also.url)}</> : null;
  const sheetCite = unconfirmed === 0 && oc ? <>{cite(oc.label, oc.url)}{ocAlso(oc)}</> : null;
  const raceIds = races.map((r) => r.id);
  const raceItem = (r: PrintRace) => (
        <li key={r.id} className="pb-race" data-print-race={r.id} data-order-confirmed={r.orderConfirmed ? "1" : "0"}>
          <p className="pb-race-title"><DaggerTitle title={r.title || r.id} unsure={!r.orderConfirmed} id="pb-order-unsure" /></p>
          {unconfirmed && r.orderConfirmed && oc ? <p className="pb-order" data-print-order-confirmed="race">{ORDER_CONFIRMED_LINE}{cite(oc.label, oc.url)}</p> : null}
          <ul>{r.candidates.map((c) => { const p = displayParty(c.name, c.party); const ch = retentionChoices(r.title); const mark = picks[r.id] === c.name ? " pb-box-on" : "";
            return ch
              ? <li key={c.name} className="pb-cand pb-cand-ret" data-print-retention={ch.join("/")}><span><span className="pb-name">{c.name}</span>{p ? <span className="pb-party">, {p}</span> : null}</span><span className="pb-choices">{ch.map((w) => <span key={w} className="pb-choice"><span className="pb-box-mark" aria-hidden />{w}</span>)}</span></li>
              : <li key={c.name} className="pb-cand"><span className={`pb-box-mark${mark}`} aria-hidden data-print-picked={mark ? "1" : undefined} /><span><span className="pb-name">{c.name}</span>{p ? <span className="pb-party">, {p}</span> : null}</span></li>; })}</ul>
        </li>

  );
  // Split districts (Design P1, 3:43 PM CT): the group intro and the races it introduces print as one unbreakable block.
  const segs: { sp: ReturnType<typeof splitStart>; rs: PrintRace[] }[] = [];
  for (let i = 0; i < races.length; i++) {
    const sp = splitStart(zip, races[i].id, raceIds);
    const g = sp ? (SPLIT_GROUPS[zip] || []).find((x) => x.includes(races[i].id))! : null;
    let j = i + 1;
    if (g) while (j < races.length && g.includes(races[j].id)) j++;
    segs.push({ sp, rs: races.slice(i, j) }); i = j - 1;
  }
  return (
    <div id="ballot-print" className="hidden print:block" aria-hidden data-print-ballot>
      <header className="pb-mast">
        <p className="pb-wm">townhall.town</p>
        <div className="pb-ttl"><p className="pb-h1">Your ballot{ed ? `, ${shortDate(ed.start)}` : ""}</p><p>ZIP {zip}{jurisdiction ? ` · ${jurisdiction}` : ""}</p></div>
      </header>
      <p className="pb-ne" data-print-non-endorsement>{NON_ENDORSEMENT} Nonpartisan. Not a government site.</p>

      <section className="pb-facts" data-print-facts>
        <div data-print-cell="who">{whoP}</div>
        <div data-print-cell="when"><p><b>When:</b></p>{earlyP}{edLine}</div>
        <div data-print-cell="where">{whereLine}</div>
        {boothP || phoneP ? <div className="pb-facts-row">{boothP}{phoneP}</div> : null}
      </section>

      <h2 className="pb-h2 pb-section">Races</h2>
      {unconfirmed ? <p className="pb-muted" id="pb-order-unsure" data-print-order-unsure={unconfirmed}>† {ORDER_UNSURE_LINE}</p>
        : oc ? <p className="pb-muted" data-print-order-confirmed="sheet">{ORDER_CONFIRMED_LINE} <span className="pb-src">{oc.label}</span>{sheetCite}</p> : null}
      <ol className="pb-races" data-print-races={races.length}>
        {segs.map((g) => g.sp ? (
          <li key={`g-${g.rs[0].id}`} className="pb-split-group" data-print-split-group={g.rs.map((r) => r.id).join(" ")}>
            <div className="pb-split" data-print-split={g.rs[0].id}>{g.sp.line ? <p data-print-split-line>{g.sp.line}</p> : null}<p data-print-split-link><span className="pb-label">{host(g.sp.url)}</span>{cite("Official lookup", g.sp.url)}</p></div>
            <ol className="pb-split-races">{g.rs.map(raceItem)}</ol>
          </li>
        ) : raceItem(g.rs[0]))}
      </ol>

      {data.measures.length ? (<>
        <h2 className="pb-h2 pb-section">Measures</h2>
        <ol className="pb-measures" data-print-measures={data.measures.length}>
          {data.measures.map((m) => <li key={m.id} data-print-measure={m.id}>{m.title}</li>)}
        </ol>
      </>) : null}

      <p className="pb-sourcesline" data-print-sources-line={zipPage}>{SOURCES_LABEL} <a href={zipPage} className="pb-label">{zipPage}</a></p>

      <h2 className="pb-h2 pb-section">Rules</h2>
      <section className="pb-rules" data-print-rules>
        {id ? <div data-print-id><p className="pb-rule-h">ID</p>{rule(id)}</div> : null}
        {hours ? <div data-print-hours><p className="pb-rule-h">Election Day hours</p>{rule(hours)}</div> : null}
        {booth ? <div data-print-booth><p className="pb-rule-h">This sheet</p>{rule(booth)}</div> : null}
        {devices ? <div data-print-devices><p className="pb-rule-h">Phones and devices</p>{rule(devices)}</div> : null}
        {data.verify ? <p className="pb-gap">Check your official sample ballot: {data.verify.label}{cite(data.verify.label, data.verify.url)}</p> : null}
        <ol className="pb-notes" data-print-sources={notes.length}>{notes.map((n, i) => <li key={n.url} data-print-note={i + 1}><span className="pb-num">[{i + 1}]</span> {n.label}: <span className="pb-url">{n.url.replace(/^https?:\/\/(www\.)?/, "")}</span>{oc?.also && n.url === oc.url ? <> · {oc.also.label}: <span className="pb-url">{oc.also.url.replace(/^https?:\/\/(www\.)?/, "")}</span></> : null}</li>)}</ol>
      </section>
      <p className="pb-foot" data-print-footer>townhall.town · ZIP {zip} · Printed {longDate(today)}. Check your county for changes.</p>
    </div>
  );
}
