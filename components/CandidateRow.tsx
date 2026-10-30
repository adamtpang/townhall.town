"use client";
// One candidate row, shared by /card and the Who section (Adam, Oct 29 11:28 PM CT): photo (or initials), every sourced
// position with its source link, the site link, and, for candidates with no sourced position, the neutral line
// "No public position found yet. Sources checked:" with the sources our researchers recorded. Never a guess.
import { Portrait, PhotoCredit, CREDIT, type Photo } from "./Portrait";
import { stancesFor, sourceLabel, ISSUES } from "../lib/issues";
import { overlapLabel } from "../lib/overlapCore.mjs";
import { gradeLabel } from "../lib/grades.mjs";
import { stanceForm } from "../lib/stanceForm";
import { HIT } from "../lib/typeScale";
import CHECKED from "../data/sources-checked.json";
import { liveUrl } from "../lib/links";

export type RowCand = { name: string; party?: string | null; photo?: Photo; campaignSite?: string | null; officialSite?: string | null };
type O = { status: string; agree: number; n: number; sourced: number; sourcedIds: string[] };
type Checked = { url: string; title?: string | null; note?: string | null; down?: string };
const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const NO_POSITION = "No public position found yet. Sources checked:";
export const NO_POSITION_UNCHECKED = "No public position found yet. Where to look:";
/** VOTE411 is the League of Women Voters' own voter guide (enter an address to see the ballot). */
export const LWV_GUIDE = "https://www.vote411.org/ballot";
const ext = <span className="sr-only"> (opens in a new tab)</span>;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
/** Sources Civic recorded as checked for this candidate (data/sources-checked.json). */
export function sourcesChecked(name: string): Checked[] {
  const raw = ((CHECKED as { bySlug: Record<string, { checked: Checked[] }> }).bySlug[slug(name)]?.checked) ?? [];
  // Dead links hidden (lib/links.ts); sites Civic marked down stay as plain text with the note (data/link-notes.json).
  return raw.flatMap((x) => { if (x.down) return [x]; const url = liveUrl(x.url); return url ? [{ ...x, url }] : []; });
}
/** Issues where Civic recorded no usable position. Design p9: one wording, "No record found". */
export function noRecordIssues(name: string, ids: string[]) {
  const st = stancesFor(name);
  return ids.filter((id) => st[id] && st[id].value === null && st[id].status && /no public statement|still being sourced|no record/i.test(String(st[id].status)));
}
function voteLine(st: { voteRecord?: string; quote?: string; bill?: string }) {
  if (!st?.voteRecord) return null;
  const vote = st.voteRecord.split(" (")[0];
  const bill = st.bill ?? /^([A-Z]{1,4} \d+)\b/.exec(st.quote || "")?.[1];
  return bill ? `${vote} on ${bill}` : vote;
}

/** League of Women Voters guide links read as one plain label (design p10). */
const checkedLabel = (x: Checked) => (/lwv|league of women voters|vote411/i.test(`${x.url} ${x.title ?? ""}`) ? "League of Women Voters guide" : (x.title || host(x.url)).replace(/\s*\((via|direct fetch|search snippet)[^)]*\)\s*/gi, " ").trim());
/** Drop internal notes and keep one link per domain (design p10 P2). */
export function cleanChecked(list: Checked[]): Checked[] {
  const seen = new Set<string>();
  return list.filter((x) => { const h = host(x.url); if (seen.has(h)) return false; seen.add(h); return true; });
}
const issueLabel = (id: string) => ISSUES.find((i) => i.id === id)?.label ?? id;
const side = (v: unknown) => (typeof v === "number" ? Math.sign(v) : 0);

/** Design p10 P1: visible = name, grade, the issues the voter answered Yes/No (each linked to its source) and the
 *  photo credit. Everything else (all quotes, unclear items, "No record found", sources checked) sits behind one
 *  disclosure per candidate. Nothing is removed, only folded. */
export default function CandidateRow({ c, o, grade, ids, answeredYesNo = true, answers = {} }: { c: RowCand; o: O; grade: string | null; ids: string[]; answeredYesNo?: boolean; answers?: Record<string, number | null | undefined> }) {
  const st = stancesFor(c.name);
  const site = liveUrl(c.campaignSite) || liveUrl(c.officialSite) || null;
  const checked = o.sourced < 2 ? cleanChecked(sourcesChecked(c.name)) : [];
  // Civic "unsure" items: display only, never scored (value stays null).
  const unsure = ids.filter((id) => st[id]?.status === "unsure" && st[id].value === null);
  const noRec = noRecordIssues(c.name, ids);
  const asked = o.sourcedIds.filter((id) => typeof answers[id] === "number" && answers[id] !== 0);
  const same = asked.filter((id) => side(answers[id]) === side(st[id].value));
  const diff = asked.filter((id) => side(answers[id]) !== side(st[id].value));
  const srcLink = (id: string, text: string) => { const s = st[id]; return s.sourceUrl
    ? <a key={id} href={s.sourceUrl} target="_blank" rel="noreferrer" title={s.year ? `${sourceLabel(s.sourceUrl)}, ${s.year}` : `${sourceLabel(s.sourceUrl)}, date unsure`} className={`${HIT} text-[#3760F2]`} data-answered-position={id}>{text} ↗{ext}</a>
    : <span key={id}>{text}</span>; };
  const join = (xs: string[]) => xs.map((id, i) => <span key={id}>{i ? ", " : ""}{srcLink(id, issueLabel(id))}</span>);
  const hasMore = o.sourcedIds.length > 0 || unsure.length > 0 || checked.length > 0;
  return (
    <li className="flex gap-3 py-3" data-overlap={c.name} data-status={o.status} data-photo-state={c.photo?.url ? "img" : "initials"}>
      <Portrait name={c.name} photo={c.photo} credit={false} className="w-12 shrink-0" boxClassName="[&>span]:text-base" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-[530] text-black">{c.name}</p>
        {/* QA 7391b20 P1-2 + design (12:10 AM): the letter follows its count inline ("… 4 of 7 issues they've stated · B"); Civic's label, verbatim, sits under it at the credit
            size (12/16, weight 450, black/60). No letter unless the race is eligible and this candidate has one. */}
        {o.status === "ok" ? (
          <p className="text-base text-black/80" data-grade-line>
            {overlapLabel(c.name, o)}{grade ? <> · <span className="font-[530] text-black" data-grade-slot>{grade}</span></> : null}
          </p>
        ) : null}
        {grade ? <p className={`mt-0.5 ${CREDIT}`} data-grade={grade}>{gradeLabel(o.agree, o.n)}</p> : null}
        {o.status === "answer" && answeredYesNo ? <p className="text-sm text-black/60">Answer Yes or No on more of their issues to compare (Neutral isn&rsquo;t compared).</p> : null}
        {asked.length > 0 ? (
          <p className="mt-1 text-sm leading-5 text-black/80" data-answered-n={asked.length}>
            {same.length ? <><span className="font-[530]">Same as your answer:</span> {join(same)}.</> : null}
            {same.length && diff.length ? " " : null}
            {diff.length ? <><span className="font-[530]">Different:</span> {join(diff)}.</> : null}
          </p>
        ) : null}
        {o.sourced < 2 ? (
          // QA 7391b20 P2: never an empty source list. With nothing recorded as checked, point to their own site and
          // the League of Women Voters guide instead (we don't claim either was checked).
          <p className="mt-1 text-sm leading-5 text-black/80" data-no-position>{o.sourced === 0 ? (checked.length ? NO_POSITION : NO_POSITION_UNCHECKED) : "No public position found yet on other issues."}</p>
        ) : null}
        {o.sourced === 0 && checked.length === 0 ? (
          <ul className="mt-1 flex flex-col gap-y-2 text-sm" data-no-position-links>
            {site ? <li><a href={site} target="_blank" rel="noreferrer" className="flex min-h-11 items-center text-[#3760F2]" data-site-link>{liveUrl(c.campaignSite) ? "Campaign site" : "Official site"} ↗{ext}</a></li> : null}
            <li><a href={LWV_GUIDE} target="_blank" rel="noreferrer" className="flex min-h-11 items-center text-[#3760F2]" data-lwv-link>League of Women Voters guide ↗{ext}</a></li>
          </ul>
        ) : null}
        {site && !(o.sourced === 0 && checked.length === 0) ? <p className="mt-1 text-sm"><a href={site} target="_blank" rel="noreferrer" className={`${HIT} text-[#3760F2]`} data-site-link>{liveUrl(c.campaignSite) ? "Campaign site" : "Official site"} ↗{ext}</a></p> : null}
        {hasMore ? (
          <details className="mt-1" data-all-positions>
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-[#3760F2]">{o.sourcedIds.length > 0 ? "Show all positions" : `Show ${checked.length} source${checked.length === 1 ? "" : "s"}`}</summary>
            {o.sourcedIds.length > 0 ? (
              <ul className="space-y-1" data-sourced-n={o.sourcedIds.length}>
                {o.sourcedIds.map((id) => { const s = st[id]; return (
                  <li key={id} className="text-sm leading-5 text-black/80" data-position={id}>
                    <span className="font-[530]">{issueLabel(id)}:</span>{" "}
                    {voteLine(s) ? <>{voteLine(s)}</> : stanceForm(s) === "summary" ? <><span className="text-black/60" data-bp-summary>Ballotpedia summary:</span> {s.quote}</> : s.quote ? <>&ldquo;{s.quote}&rdquo;</> : s.summary ? <><span className="text-black/60" data-summary>Summary:</span> {s.summary}</> : null}{" "}
                    {s.year ? <><span className="text-black/60" data-quote-year>({s.year})</span>{" "}</> : null}
                    {s.sourceUrl ? <a href={s.sourceUrl} target="_blank" rel="noreferrer" title={s.year ? undefined : "Date unsure"} className={`${HIT} text-[#3760F2]`} data-own-line>{sourceLabel(s.sourceUrl)} ↗{ext}</a> : null}
                  </li>
                ); })}
              </ul>
            ) : null}
            {unsure.length > 0 ? (
              <ul className="mt-1 space-y-1" data-unsure-n={unsure.length}>
                {unsure.map((id) => <li key={id} className="text-sm leading-5 text-black/60" data-unsure={id}><span className="font-[530]">{issueLabel(id)}: unclear, not compared.</span> {st[id].summary}{st[id].sourceUrl ? <>{" "}<a href={st[id].sourceUrl!} target="_blank" rel="noreferrer" className={`${HIT} text-[#3760F2]`}>{sourceLabel(st[id].sourceUrl)} ↗{ext}</a></> : null}</li>)}
              </ul>
            ) : null}
            {o.sourced >= 2 && noRec.length > 0 ? <p className="mt-1 text-sm text-black/60" data-null-status>No record found: {noRec.map(issueLabel).join(", ")}</p> : null}
            {checked.length > 0 ? (
              <div className="mt-1 text-sm leading-5 text-black/80" data-sources-checked>
                {o.sourcedIds.length > 0 ? <p>Sources checked:</p> : null}
                <ul className="mt-1 flex flex-col gap-y-2">
                  {checked.map((x) => x.down ? <li key={x.url} className="flex min-h-11 items-center text-black/60" data-site-down>{host(x.url)} ({x.down})</li> : <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center text-[#3760F2]" data-checked-source>{checkedLabel(x)} ↗{ext}</a></li>)}
                </ul>
              </div>
            ) : null}
          </details>
        ) : null}
        {c.photo?.url ? <PhotoCredit photo={c.photo} name={c.name} /> : null}
      </div>
    </li>
  );
}
