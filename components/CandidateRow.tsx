"use client";
// One candidate row, shared by /card and the Who section (Adam, Oct 29 11:28 PM CT): photo (or initials), every sourced
// position with its source link, the site link, and, for candidates with no sourced position, the neutral line
// "No public position found yet. Sources checked:" with the sources our researchers recorded. Never a guess.
import { Portrait, type Photo } from "./Portrait";
import { stancesFor, sourceLabel, ISSUES } from "../lib/issues";
import { overlapLabel } from "../lib/overlapCore.mjs";
import { gradeLabel } from "../lib/grades.mjs";
import { stanceForm } from "../lib/stanceForm";
import { HIT } from "../lib/typeScale";
import CHECKED from "../data/sources-checked.json";

export type RowCand = { name: string; party?: string | null; photo?: Photo; campaignSite?: string | null; officialSite?: string | null };
type O = { status: string; agree: number; n: number; sourced: number; sourcedIds: string[] };
type Checked = { url: string; title?: string | null; note?: string | null };
const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const NO_POSITION = "No public position found yet. Sources checked:";
const ext = <span className="sr-only"> (opens in a new tab)</span>;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
/** Sources Civic recorded as checked for this candidate (data/sources-checked.json). */
export function sourcesChecked(name: string): Checked[] {
  return ((CHECKED as { bySlug: Record<string, { checked: Checked[] }> }).bySlug[slug(name)]?.checked) ?? [];
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

export default function CandidateRow({ c, o, grade, ids, answeredYesNo = true }: { c: RowCand; o: O; grade: string | null; ids: string[]; answeredYesNo?: boolean }) {
  const st = stancesFor(c.name);
  const site = c.campaignSite || c.officialSite || null;
  const checked = o.sourced < 2 ? sourcesChecked(c.name) : [];
  // Civic "unsure" items: display only, never scored (value stays null).
  const unsure = ids.filter((id) => st[id]?.status === "unsure" && st[id].value === null);
  const noRec = noRecordIssues(c.name, ids);
  return (
    <li className="flex gap-3 py-3" data-overlap={c.name} data-status={o.status} data-photo-state={c.photo?.url ? "img" : "initials"}>
      <Portrait name={c.name} photo={c.photo} credit={false} className="w-12 shrink-0" boxClassName="[&>span]:text-base" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-base font-[530] text-black">{c.name}</p>
          {/* Grade slot: empty unless the race is eligible and this candidate has a letter. */}
          <span className="shrink-0 text-base font-[530] text-black" data-grade-slot>{grade ?? ""}</span>
        </div>
        {o.status === "ok" ? <p className="text-base text-black/80">{overlapLabel(c.name, o)}</p> : null}
        {grade ? <p className="text-sm leading-5 text-black" data-grade={grade}>{gradeLabel(o.agree, o.n)}</p> : null}
        {o.status === "answer" && answeredYesNo ? <p className="text-sm text-black/60">Answer Yes or No on more of their issues to compare (Neutral isn&rsquo;t compared).</p> : null}
        {o.sourcedIds.length > 0 ? (
          <ul className="mt-1 space-y-1" data-sourced-n={o.sourcedIds.length}>
            {o.sourcedIds.map((id) => { const s = st[id]; return (
              <li key={id} className="text-sm leading-5 text-black/80" data-position={id}>
                <span className="font-[530]">{ISSUES.find((i) => i.id === id)?.label}:</span>{" "}
                {voteLine(s) ? <>{voteLine(s)}</> : stanceForm(s) === "summary" ? <><span className="text-black/60" data-bp-summary>Ballotpedia summary:</span> {s.quote}</> : s.quote ? <>&ldquo;{s.quote}&rdquo;</> : s.summary ? <><span className="text-black/60" data-summary>Summary:</span> {s.summary}</> : null}{" "}
                <span className="text-black/60" data-quote-year>{s.year ? `(${s.year})` : "(date unsure)"}</span>{" "}
                {s.sourceUrl ? <a href={s.sourceUrl} target="_blank" rel="noreferrer" className={`${HIT} text-[#3760F2]`} data-own-line>{sourceLabel(s.sourceUrl)} ↗{ext}</a> : null}
              </li>
            ); })}
          </ul>
        ) : null}
        {o.sourced < 2 ? (
          <div className="mt-1 text-sm leading-5 text-black/80" data-no-position>
            <p>{o.sourced === 0 ? NO_POSITION : NO_POSITION.replace("found yet.", "found yet on other issues.")}{checked.length === 0 ? " none recorded yet." : ""}</p>
            {checked.length > 0 ? (
              <ul className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
                {checked.map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className={`${HIT} text-[#3760F2]`} data-checked-source>{x.title || host(x.url)} ↗{ext}</a></li>)}
              </ul>
            ) : null}
          </div>
        ) : null}
        {unsure.length > 0 ? (
          <ul className="mt-1 space-y-1" data-unsure-n={unsure.length}>
            {unsure.map((id) => <li key={id} className="text-sm leading-5 text-black/60" data-unsure={id}><span className="font-[530]">{ISSUES.find((i) => i.id === id)?.label}: unclear, not compared.</span> {st[id].summary}{st[id].sourceUrl ? <>{" "}<a href={st[id].sourceUrl!} target="_blank" rel="noreferrer" className={`${HIT} text-[#3760F2]`}>{sourceLabel(st[id].sourceUrl)} ↗{ext}</a></> : null}</li>)}
          </ul>
        ) : null}
        {o.sourcedIds.length > 0 && noRec.length > 0 ? <p className="mt-1 text-sm text-black/60" data-null-status>No record found: {noRec.map((id) => ISSUES.find((i) => i.id === id)?.label).join(", ")}</p> : null}
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
          {site ? <a href={site} target="_blank" rel="noreferrer" className={`${HIT} text-[#3760F2]`} data-site-link>{c.campaignSite ? "Campaign site" : "Official site"} ↗{ext}</a> : null}
        </p>
        {c.photo?.url ? <p className="mt-1 text-sm leading-5 text-black/50 [word-break:break-word]">{c.photo.page ? <a href={c.photo.page} target="_blank" rel="noreferrer" className="text-black/50 underline decoration-black/20" data-photo-credit>{c.photo.credit}{ext}</a> : <span data-photo-credit>{c.photo.credit}</span>}</p> : null}
      </div>
    </li>
  );
}
