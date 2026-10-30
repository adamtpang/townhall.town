"use client";
import { plain } from "../lib/plain";
const listOf = (xs: string[]) => (xs.length < 3 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
import { useState } from "react";
import { type Photo } from "../components/Portrait";
import { PortraitRow } from "../components/PortraitRow";
import type { MeasureMath } from "../lib/measures";
import officesData from "../data/offices.json";
const OFFICES = officesData.offices;
type Avg = { name: string; prob: number }[];
import type { RaceMeta } from "../lib/raceMeta";
import { ISSUES } from "../lib/issues";
const ISSUE_LABEL: Record<string, string> = Object.fromEntries(ISSUES.map((i) => [i.id, i.label]));
type RaceLite = { id: string; title: string; level: string; source?: string; office?: string; officeSource?: string; verify?: string; appliesNote?: string; judicialNote?: string; dependsOnAddress?: boolean; tentative?: boolean; judicial?: "ny" | "tx" | "ca" | boolean; meta?: RaceMeta | null; candidates?: { name: string; party?: string | null; photo?: Photo }[] };
type Mk = { avg: Avg; quotes: { url?: string; platform?: string }[] } | null;

/**
 * Tier formula (races only, never candidates):
 *   score = impact x competitiveness
 *   impact: 3 = President, U.S. Senate, Governor; 2 = U.S. House, other statewide executive, ballot measures;
 *           1.5 = state legislature; 1 = judicial and local.
 *   competitiveness (Civic competitiveness.json label): Competitive = 2.0, Not closely contested or no data = 1.0.
 *           Never names who is ahead.
 *   Most at stake >= 4.5, High stakes >= 3, Moderate stakes >= 2, else Lower stakes.
 */
export function impactOf(r: RaceLite): { v: number; why: string } {
  const t = r.title.toLowerCase();
  if (/president|u\.s\. senate|^governor/.test(t)) return { v: 3, why: "top federal or statewide office" };
  if (r.level === "measure") return { v: 2, why: "statewide ballot measure" };
  // Statewide boards (SBOE, Railroad Commission) are state offices, not local (QA P2 / Civic rule c).
  if (/state board of education|railroad commission/.test(t)) return { v: 1, why: "state office" };
  // County / city / precinct offices are local even when titled Treasurer or Commissioner (QA P2).
  if (/\bcounty\b|\bcity\b|precinct|municipal|board of/.test(t) && !/court at law|district court|court of|justice/.test(t)) return { v: 1, why: "local office" };
  if (/u\.s\. house|lieutenant governor|attorney general|comptroller|secretary of state|treasurer|controller|insurance commissioner|superintendent|commissioner/.test(t))
    return { v: 2, why: /u\.s\. house/.test(t) ? "your U.S. House seat" : "statewide executive office" };
  if (/court|judge|justice|appeals/.test(t)) return { v: 1, why: "judicial seat" };
  if (/state senate|state house|state representative|assembly|senate district|house district/.test(t)) return { v: 1.5, why: "state legislature" };
  return { v: 1, why: r.level === "local" || r.level === "county" ? "local office" : "lower-profile office" };
}
export type Group = "most" | "high" | "moderate" | "lower";
export const TIER_LABELS = ["Most at stake", "High stakes", "Moderate stakes", "Lower stakes"] as const;
export function tierFor(r: RaceLite, _mk?: Mk) {
  const imp = impactOf(r);
  const comp = r.meta?.closeness === "Competitive" ? 2 : 1;
  const score = imp.v * comp;
  const tier: Group = score >= 4.5 ? "most" : score >= 3 ? "high" : score >= 2 ? "moderate" : "lower";
  const why = `${imp.why[0].toUpperCase()}${imp.why.slice(1)}.`;
  return { tier, score, why };
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-01" -> "Oct 1, 2026" (no Date(), so no timezone shift). Anything else is shown as written. */
export function newsDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m && +m[2] >= 1 && +m[2] <= 12 ? `${MON[+m[2] - 1]} ${+m[3]}, ${m[1]}` : d;
}

/** Civic news.json only: headline exactly as written, outlet, date, link. No summaries. */
function NewsList({ items }: { items: RaceMeta["news"] }) {
  return (
    <details className="group/n" data-news>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-black/60 hover:text-[#3760f2] [&::-webkit-details-marker]:hidden">News coverage ({items.length})<span aria-hidden className="ml-2 inline-block group-open/n:rotate-180">↓</span></summary>
      <ul className="max-w-2xl space-y-1 pb-2">
        {items.map((n) => (
          <li key={n.url} className="text-sm"><a href={n.url} target="_blank" rel="noreferrer" className="text-black underline-offset-2 hover:underline">{n.title}</a> <span className="text-black/60">· {n.outlet} · <time dateTime={n.date}>{newsDate(n.date)}</time></span></li>
        ))}
      </ul>
    </details>
  );
}

export default function RaceTiers({ races, market, measures = [] }: { races: RaceLite[]; market: (id: string) => Mk; measures?: MeasureMath[] }) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const rows = races.map((r, i) => ({ r, i, ...tierFor(r, market(r.id)), mk: market(r.id) })).sort((a, b) => b.score - a.score || a.i - b.i);
  const tiers = ["most", "high", "moderate", "lower"] as const;
  const TIER_NAME = { most: "Most at stake", high: "High stakes", moderate: "Moderate stakes", lower: "Lower stakes" } as const;
  const [showAll, setShowAll] = useState(false);
  // Design P1: court races sit in one collapsed group; Moderate and Lower wait behind one "Show all" button.
  const isJudicial = (r: RaceLite) => !!r.judicial || impactOf(r).why === "judicial seat";
  const judicial = rows.filter((x) => isJudicial(x.r));
  const nonJudicial = rows.filter((x) => !isJudicial(x.r));
  const hiddenCount = nonJudicial.filter((x) => x.tier === "moderate" || x.tier === "lower").length;
  const groups = [
    ...tiers.filter((t) => t === "most" || t === "high" || showAll).map((t) => ({ key: t as string, name: TIER_NAME[t] as string, list: nonJudicial.filter((x) => x.tier === t), eager: t === "most" || t === "high", open: true })),
  ].filter((g) => g.list.length);
  const judicialGroup = judicial.length ? [{ key: "judicial", name: `Judicial races (${judicial.length})`, list: judicial, eager: false, open: false }] : [];
  const raceItem = ({ r, why }: { r: RaceLite; why: string }, eager: boolean) => (
                  <li key={r.id} className="font-[450]">
                    <p className="text-lg font-[530]" data-race-title>{r.title}</p>
                    {r.candidates?.length ? <PortraitRow cands={r.candidates} eager={eager} /> : null}
                    <p className="text-sm text-black/60" data-why>{why}{r.meta && r.meta.closeness !== "No market data" ? <> <span data-closeness>{r.meta.closeness}.</span></> : null}{r.meta?.contest ? <> {r.meta.contest}.</> : null}{r.meta?.rankedChoice ? <> Ranked-choice: you can rank candidates in order.</> : null}</p>
                    {r.judicialNote ? <p className="text-sm text-black/60" data-judicial-note>{r.judicialNote}</p> : null}
                    {r.dependsOnAddress ? <p className="text-sm text-black" data-depends>Depends on your address.{r.appliesNote ? <span className="text-black/60"> {plain(r.appliesNote)}</span> : null}</p> : null}
                    {/\bPlace \d+/.test(r.title) ? <p className="text-sm text-black/60" data-place-hint>&ldquo;Place&rdquo; is the numbered seat being filled; each place is its own separate contest.</p> : null}
                    {r.tentative ? <p className="text-sm text-black/60" data-tentative>Tentative: from the NYC Board of Elections&rsquo; tentative contest list. Check your sample ballot.</p> : null}
                    {(r.source || r.verify) && (
                      <p className="flex flex-wrap items-center gap-x-1 text-xs leading-4 text-black/60" data-race-links>
                        {r.source && <a href={r.source} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-3 after:-inset-y-4 after:content-['']">Race source ↗<span className="sr-only"> (opens in a new tab)</span></a>}
                        {r.meta?.closenessBasis.map((x) => <span key={x.url} className="contents"><span aria-hidden>·</span><a href={x.url} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-3 after:-inset-y-4 after:content-['']">{x.label} rating ↗<span className="sr-only"> (opens in a new tab)</span></a></span>)}
                        {r.verify && <><span aria-hidden>·</span><span>{r.verify}</span></>}
                      </p>
                    )}
                    {r.meta?.why ? (
                      <details className="group/w" data-why-matters>
                        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-black/60 hover:text-[#3760f2] [&::-webkit-details-marker]:hidden">Why this race matters<span aria-hidden className="ml-2 inline-block group-open/w:rotate-180">↓</span></summary>
                        <div className="max-w-2xl pb-2 text-sm">
                          <p className="text-base">{r.meta.why.summary}</p>
                          {r.meta.why.problems.length > 0 && <ul className="mt-2 space-y-1">{r.meta.why.problems.map((p) => <li key={p.label + p.geography}>{plain(p.label)}: {p.value}{p.unit === "%" ? "%" : ` ${p.unit}`} ({plain(p.geography)}, {plain(String(p.year))}) <a href={p.sourceUrl} title={`${p.label} (${p.geography}, ${p.year})`} target="_blank" rel="noreferrer" data-own-line className="flex min-h-11 w-fit items-center whitespace-nowrap">{host(p.sourceUrl)} ↗</a></li>)}</ul>}
                          {r.meta.why.authority.length > 0 && (
                            <div className="mt-2" data-authority>
                              <p className="text-black/60">What this office does on each issue</p>
                              <ul className="space-y-1">{r.meta.why.authority.map((a) => <li key={a.issue + a.role}>{listOf(a.issues.map((i) => ISSUE_LABEL[i] ?? i))}: {a.role} <a href={a.sourceUrl} target="_blank" rel="noreferrer" data-own-line className="flex min-h-11 w-fit items-center">{a.cite} ↗</a></li>)}</ul>
                            </div>
                          )}
                        </div>
                      </details>
                    ) : null}
                    {r.meta?.news.length ? <NewsList items={r.meta.news} /> : null}
                    <OfficeCard id={r.id} fallback={r.office && r.officeSource && !/^unsure/i.test(r.office) ? { learn: r.office, sourceUrl: r.officeSource } : undefined} />
                  </li>
  );
  return (
    <section className="border-t border-black py-24" id="tiers">
      <p className="nds-caption-upper text-black/60">01</p>
      <h2 className="mt-3 font-serif text-[40px] font-[530] leading-none tracking-[-0.02em] text-black md:text-[56px]">What matters on your ballot</h2>
      <p className="mt-4 max-w-2xl text-black/60">Races, ranked by how much the office does and how close the race is. Never candidates.</p>
      <p className="mt-2 max-w-2xl text-sm text-black/60" data-tier-legend>Most at stake: the biggest offices in the closest races. Then High, Moderate and Lower stakes. A race is &ldquo;Competitive&rdquo; when published race ratings or prediction markets call it close; otherwise &ldquo;Not closely contested&rdquo;. Neither says who is ahead.</p>
      <div className="mt-10">
        {groups.map(({ key, name, list, eager, open }) => (
            <details key={key} open={open} className="group border-t border-black/15 py-6" data-tier={key}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-6 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-[530]">{name}</span>
                <span className="ml-auto text-sm text-black/60">{list.length} race{list.length === 1 ? "" : "s"}</span>
                <span aria-hidden className="inline-block text-sm text-black/60 group-open:rotate-180">↓</span>
              </summary>
              {key === "most" && <p className="mt-2 text-sm text-black/60">Closest races with the biggest offices.</p>}
              <ul className="mt-6 space-y-10">
                {list.map((x) => raceItem(x, eager))}
              </ul>
            </details>
        ))}
        {hiddenCount > 0 && !showAll && (
          <button type="button" onClick={() => setShowAll(true)} data-show-all className="mt-6 inline-flex min-h-11 items-center border border-black/30 px-5 text-base text-black hover:border-black">Show all {nonJudicial.length} races</button>
        )}
        {judicialGroup.map(({ key, name, list, eager, open }) => (
            <details key={key} open={open} className="group border-t border-black/15 py-6" data-tier={key}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-6 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-[530]">{name}</span>
                <span className="ml-auto text-sm text-black/60">{list.length} race{list.length === 1 ? "" : "s"}</span>
                <span aria-hidden className="inline-block text-sm text-black/60 group-open:rotate-180">↓</span>
              </summary>
              {key === "most" && <p className="mt-2 text-sm text-black/60">Closest races with the biggest offices.</p>}
              <ul className="mt-6 space-y-10">
                {list.map((x) => raceItem(x, eager))}
              </ul>
            </details>
        ))}
        {measures.length > 0 && <MeasureRows measures={measures} />}
      </div>
    </section>
  );
}

/** 'unsure' in sourced data renders as a plain statement, never blank. */
const said = (v?: string | null) => (!v || /^\s*unsure\b/i.test(v) ? "No official estimate" : v.replace(/\bunsure\b/gi, "no official estimate"));

/** Learn in 30 seconds: what the office does, from data/offices.json (Civic, sourced). No source, no summary. */
function OfficeCard({ id, fallback }: { id: string; fallback?: { learn: string; sourceUrl: string } }) {
  const o = (OFFICES as Record<string, { learn?: string | null; sourceUrl?: string | null }>)[id];
  const ok = o?.learn && o.sourceUrl && !/^\s*unsure/i.test(o.learn) ? { learn: o.learn, sourceUrl: o.sourceUrl } : fallback;
  if (!ok) return <p className="text-xs leading-4 text-black/60" data-office-unverified>Office description not yet verified</p>; // No source, no description.
  return (
    <details className="group/o" data-office={id}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-black/60 hover:text-[#3760f2] [&::-webkit-details-marker]:hidden">
        What this office does<span aria-hidden className="ml-2 inline-block group-open/o:rotate-180">↓</span>
      </summary>
      <p className="max-w-2xl pb-2 text-base">
        {ok.learn}{" "}
        <a href={ok.sourceUrl} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-3 after:-inset-y-4 after:content-[''] whitespace-nowrap text-sm">{host(ok.sourceUrl)} ↗</a>
      </p>
    </details>
  );
}

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };

/** Measures: one compact expandable row per measure. Numbers are quoted from official analyses and each links its source. */
function MeasureRows({ measures }: { measures: MeasureMath[] }) {
  return (
    <details className="group border-t border-black/15 py-6" data-tier="measures">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-6 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-[530]">Measures</span>
        <span className="text-sm text-black/60">{measures.length} measure{measures.length === 1 ? "" : "s"}: cost and what changes<span className="ml-2 inline-block group-open:rotate-180">↓</span></span>
      </summary>
      <ul className="mt-6 sm:pl-[7.5rem]">
        {measures.map((m) => (
          <li key={m.id} className="border-t border-black/10 first:border-t-0">
            <details className="group/m" data-measure={m.id}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="text-base font-medium">{m.title}</span>
                <span aria-hidden className="text-sm font-[450] text-black/50 group-open/m:rotate-180">↓</span>
              </summary>
              {m.officialTitle && <p className="pb-4 text-sm" data-official-title><span className="text-xs uppercase tracking-wide text-black/50">Official ballot title</span><br />{m.officialTitle}{m.officialTitleSource && <> <a href={m.officialTitleSource} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-3 after:-inset-y-4 after:content-[''] whitespace-nowrap">{host(m.officialTitleSource)} ↗</a></>}</p>}
{(() => {
                const all = [["Cost", m.cost.value, m.cost.sourceUrl], ["Who pays", m.whoPays.text, m.whoPays.sourceUrl], ["If yes", (m.ifYes ?? m.whatChanges).text, (m.ifYes ?? m.whatChanges).sourceUrl], ["If no", m.ifNo?.text, m.ifNo?.sourceUrl]] as const;
                const none = (v?: string | null) => said(v) === "No official estimate";
                const rows = all.filter(([, v]) => !none(v));
                const src = m.officialTitleSource || all.find(([, , u]) => u)?.[2];
                const noCost = none(m.cost.value) && none(m.whoPays.text);
                return (
                  <div className="pb-6">
                    {rows.length > 0 && (
                      <dl className="grid gap-4 sm:grid-cols-2">
                        {rows.map(([k, v, u]) => (
                          <div key={k}>
                            <dt className="text-xs uppercase tracking-wide text-black/50">{k}</dt>
                            <dd className="mt-1 text-sm">
                              {said(v)}{" "}
                              {u && <a href={u} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-3 after:-inset-y-4 after:content-[''] whitespace-nowrap">{host(u)} ↗</a>}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {(noCost || rows.length === 0) && (
                      <p className="mt-2 text-sm text-black/70" data-measure-oneline>
                        {rows.length === 0 ? "No plain-language explainer yet; read the official text." : "No official cost estimate published."}{" "}
                        {(rows.length ? m.cost.sourceUrl || src : src) && <a href={(rows.length ? m.cost.sourceUrl || src : src)!} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-3 after:-inset-y-4 after:content-[''] whitespace-nowrap">{host((rows.length ? m.cost.sourceUrl || src : src)!)} ↗</a>}
                      </p>
                    )}
                  </div>
                );
              })()}
            </details>
          </li>
        ))}
      </ul>
    </details>
  );
}
