"use client";
import PrintButton from "../components/PrintButton";
import { judicialShort } from "../lib/judicial";
import { pointsFor } from "../lib/mainPoints";
import { plain, printedDate } from "../lib/plain";
import { H2, H3, HIT } from "../lib/typeScale";
const listOf = (xs: string[]) => (xs.length < 3 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
import { useState } from "react";
import { PhoneCredits, PhotoGroup, type Photo } from "../components/Portrait";
import { PortraitRow, labels } from "../components/PortraitRow";
import { measureSide, type MeasureMath } from "../lib/measures";
import officesData from "../data/offices.json";
const OFFICES = officesData.offices;
import { useDay, useT } from "../lib/i18n";
import type { OrderLine, Politician } from "../lib/types";
import { SHOW_FINANCE } from "../lib/flags";
import { FINANCE_ZIPS, fecCandidateUrl, fecIdOf, fecSearchUrl, isFederalRace, usd, usdCash, reportLabel } from "../lib/fec";
import { leaderLine, type PolyQuote, type LeaderLine } from "../lib/marketLine";
import { polymarketCloseness } from "../lib/marketsCore.mjs";
import type { RaceMeta } from "../lib/raceMeta";
import { ISSUES } from "../lib/issues";
import { hostLabel } from "../lib/sourceName";
const ISSUE_LABEL: Record<string, string> = Object.fromEntries(ISSUES.map((i) => [i.id, i.label]));
type RaceLite = { id: string; title: string; level: string; source?: string; office?: string; officeSource?: string; verify?: string; appliesNote?: string; splitNote?: string; sourceNote?: string; judicialNote?: string; judicialNoteSource?: { url: string; label: string }; dependsOnAddress?: boolean; tentative?: boolean; judicial?: "ny" | "tx" | "ca" | boolean; meta?: RaceMeta | null; order?: OrderLine | null; candidates?: { name: string; party?: string | null; photo?: Photo; incumbent?: Politician["incumbent"]; money?: Politician["money"]; finance?: { url?: string | null } | null }[] };
/** The one live Polymarket quote for a contest, or null. Never cached, never estimated. */
export type Mk = PolyQuote | null;

/**
 * Tier formula (races only, never candidates):
 *   score = impact x competitiveness
 *   impact: 3 = President, U.S. Senate, Governor; 2 = U.S. House, other statewide executive, ballot measures;
 *           1.5 = state legislature; 1 = judicial and local.
 *   competitiveness = 2.0 when the sourced race ratings (Cook, Sabato, Inside Elections only) say Competitive,
 *           OR the live Polymarket top contract is between 35% and 65%; otherwise 1.0. Polymarket can only raise a
 *           race, never lower a sourced rating. No market means no market line; nothing is estimated.
 *   Most at stake >= 4.5, High stakes >= 3, Moderate stakes >= 2, else Lower stakes.
 */
export function impactOf(r: RaceLite): { v: number; why: string } {
  const t = r.title.toLowerCase();
  // Rank by race id / level first so certified ballot names ("U.S. Senator", "U.S. Representative, District 10") can't drop a race (QA P1-1).
  const usSenate = /^us-senate\b/.test(r.id) || /u\.s\. senat(e|or)\b/.test(t);
  const usHouse = !usSenate && ((r.level === "federal" && /^[a-z]{2}-\d+$/.test(r.id)) || /u\.s\. (house|representative)\b/.test(t));
  if (usSenate || /president|^governor/.test(t)) return { v: 3, why: "top federal or statewide office" };
  if (usHouse) return { v: 2, why: "your U.S. House seat" };
  if (r.level === "measure") return { v: 2, why: "statewide ballot measure" };
  // Judicial races are judicial seats even when the court is named for a municipal or county district (QA P2, 4c21a5c).
  if (r.judicial) return { v: 1, why: "judicial seat" };
  // Statewide boards (SBOE, Railroad Commission, Board of Equalization) are state offices, not local (QA P2 / Civic rule c).
  if (/state board of education|railroad commission|board of equalization/.test(t)) return { v: 1, why: "state office" };
  // County / city / precinct offices are local even when titled Treasurer or Commissioner (QA P2).
  if (/\bcounty\b|\bcity\b|precinct|municipal|board of/.test(t) && !/court at law|district court|court of|justice/.test(t)) return { v: 1, why: "local office" };
  if (/lieutenant governor|attorney general|comptroller|secretary of state|treasurer|controller|insurance commissioner|superintendent|commissioner/.test(t))
    return { v: 2, why: "statewide executive office" };
  if (/court|judge|justice|appeals/.test(t)) return { v: 1, why: "judicial seat" };
  if (/state senate|state house|state representative|assembly|senate district|house district/.test(t)) return { v: 1.5, why: "state legislature" };
  return { v: 1, why: r.level === "local" || r.level === "county" ? "local office" : "lower-profile office" };
}
export type Group = "most" | "high" | "moderate" | "lower";
export const TIER_LABELS = ["Most at stake", "High stakes", "Moderate stakes", "Lower stakes"] as const;
export function tierFor(r: RaceLite, mk?: Mk, tr?: (s: string) => string) {
  const imp = impactOf(r);
  const comp = r.meta?.closeness === "Competitive" || polymarketCloseness(mk ?? null) === "Competitive" ? 2 : 1;
  const score = imp.v * comp;
  const tier: Group = score >= 4.5 ? "most" : score >= 3 ? "high" : score >= 2 ? "moderate" : "lower";
  const w = tr ? tr(imp.why) : imp.why;
  const why = `${w[0].toUpperCase()}${w.slice(1)}.`;
  return { tier, score, why };
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-01" -> "Oct 1, 2026" (no Date(), so no timezone shift). Anything else is shown as written. */
export function newsDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m && +m[2] >= 1 && +m[2] <= 12 ? `${MON[+m[2] - 1]} ${+m[3]}, ${m[1]}` : d;
}

/** "Leader on Polymarket: <name> at N%", with the market link and fetch time. Only for a live quote. */
export function MarketLine({ line }: { line: LeaderLine | null }) {
  if (!line) return null;
  return (
    <p className="max-w-[45ch] text-sm text-black/60" data-market-line>
      Leader on Polymarket: <span className="text-black">{line.name}</span> at {line.pct}.{" "}
      {line.others?.length ? <span data-market-others>Same market: {line.others.map((o) => `${o.name} at ${o.pct}`).join(", ")}.{" "}</span> : null}
      <a href={line.url} target="_blank" rel="noreferrer" className={`${HIT} inline-flex min-h-11 items-center whitespace-nowrap th-link`} data-market-link>Polymarket market ↗<span className="sr-only"> (opens in a new tab)</span></a>{" "}
      <span data-market-fetched>Fetched {line.fetched}.</span>
    </p>
  );
}

/** Civic news.json only: headline exactly as written, outlet, date, link. No summaries. */
function NewsList({ items }: { items: RaceMeta["news"] }) {
  return (
    <details className="group/n" data-news>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-black/60 hover:text-black [&::-webkit-details-marker]:hidden">News ({items.length})<span aria-hidden className="ml-2 inline-block group-open/n:rotate-180">↓</span></summary>
      <ul className="max-w-2xl space-y-1 pb-2">
        {items.map((n) => (
          <li key={n.url} className="text-sm"><a href={n.url} target="_blank" rel="noreferrer" className={`${HIT} inline-flex min-h-11 items-center text-brand-700 underline-offset-2 hover:underline`} data-news-link>{n.title}</a> <span className="text-black/60">· {n.outlet} · <time dateTime={n.date}>{newsDate(n.date)}</time></span></li>
        ))}
      </ul>
    </details>
  );
}

type MoneyCand = NonNullable<RaceLite["candidates"]>[number];
/** Footnote markers for filing dates that differ from the shared one, in order of first appearance. */
export const MONEY_MARKS = ["*", "\u2020", "\u2021"] as const;
/** Design 2:10 PM Oct 30 (money below sm), refined after Design's GO: one line per candidate in portrait (ballot) order,
 *  name left, amount raised right (tabular-nums, text-sm, divide-y hairlines). No through date or report text on the
 *  line: a row whose filing date differs from the shared one gets one superscript marker after the amount (* then
 *  \u2020 then \u2021 per distinct differing date), explained in the single caption line under the list ("Raised, FEC
 *  filings through <shared date>." plus "* Through <date>." footnotes and any data notes, e.g. Ortiz). Dates come from
 *  the data only. The amount is the FEC link; its title and aria-label carry raised, cash on hand, through date, report
 *  label and "opens in a new tab". Hidden at sm and up, where the under-portrait columns stay. Never smaller than 14px. */
// "A newer filing (Oct 30) is not yet processed by FEC." reads "newer Oct 30 filing not yet processed by FEC." on the
// phone footnote line (same fact, Civic's data text unchanged); any other note is shown as given.
const shortNote = (n: string) => n.replace(/^A newer filing \(([A-Z][a-z]{2} \d{1,2})\) is not yet processed by FEC\.$/, "newer $1 filing not yet processed by FEC.");
function MoneyList({ cands }: { cands: MoneyCand[] }) {
  const t = useT();
  const day = useDay();
  const dated = cands.filter((c) => c.money?.coverageThrough).map((c) => c.money!.coverageThrough!);
  const counts = new Map<string, number>(); for (const d of dated) counts.set(d, (counts.get(d) ?? 0) + 1);
  // Shared date: the most common; ties go to the latest (ISO strings sort by date).
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0]?.[0] ?? "";
  const differing = [...new Set(dated.filter((d) => d !== common))];
  const mark = (d?: string | null) => { const i = d ? differing.indexOf(d) : -1; return i >= 0 ? MONEY_MARKS[i] ?? `${"*".repeat(i - MONEY_MARKS.length + 2)}` : ""; };
  const notes = cands.filter((c) => c.money?.note);
  const full = (c: MoneyCand) => {
    const m = c.money;
    if (!m) return `${c.name}: ${t("No FEC filing found")}`;
    const rep = reportLabel(m.lastReport) ? t(reportLabel(m.lastReport)!) : "";
    return `${c.name}: ${t("Raised")} ${usd(m.raised)}, ${t("Cash on hand")} ${usdCash(m.cashOnHand)}${m.coverageThrough ? `, ${t("through")} ${day(m.coverageThrough)}` : ""}${rep ? `, ${rep}` : ""}. ${t("FEC page")} (opens in a new tab)`;
  };
  return (
    <div className="my-2 sm:hidden" data-money-list>
      <ul className="divide-y divide-black/10 border-y border-black/10" aria-label={t("Raised")}>
        {cands.map((c) => {
          const id = fecIdOf(c);
          const m = c.money;
          const mk = mark(m?.coverageThrough);
          const label = full(c);
          return (
            <li key={c.name} className="flex min-h-11 min-w-0 items-center justify-between gap-3 text-sm leading-5" data-money-line={c.name}>
              <span className="min-w-0 truncate font-[530] text-black/80" title={c.name}>{c.name}</span>
              <a href={id ? fecCandidateUrl(id) : fecSearchUrl(c.name)} target="_blank" rel="noreferrer" title={label} aria-label={label} className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap tabular-nums th-link" data-line-fec>
                <span>{m ? <span className="font-medium" data-line-amount>{usd(m.raised)}</span> : <span className="text-black/60" data-line-none>{t("No FEC filing found")}</span>}{mk ? <span aria-hidden className="align-super text-sm leading-none" data-line-mark={m!.coverageThrough!}>{mk}</span> : null}</span>{"\u00a0"}<span aria-hidden>↗</span>
              </a>
            </li>
          );
        })}
      </ul>
      {/* Design polish (Oct 30): caption, then one line per footnote (marker, through date, and the note of any candidate
          filed through that date), then any other notes, in a space-y-1 block. Note wording shortened for the line only. */}
      <div className="mt-1 space-y-1 text-sm leading-5 text-black/60" data-money-list-caption>
        <p>{common ? `${t("Raised, FEC filings through")} ${day(common)}.` : `${t("Raised, FEC filings")}.`}</p>
        {differing.map((d) => <p key={d} data-money-footnote={d}>{mark(d)} {t("Through")} {day(d)}.{notes.filter((c) => c.money!.coverageThrough === d).map((c) => <span key={c.name} data-money-note-line> {c.name}: {shortNote(c.money!.note!)}</span>)}</p>)}
        {notes.filter((c) => !differing.includes(c.money!.coverageThrough ?? "")).map((c) => <p key={c.name} data-money-note-line>{c.name}: {shortNote(c.money!.note!)}</p>)}
      </div>
    </div>
  );
}

/** PR #32 (Sai): party, incumbent and FEC money under each candidate. Federal races in the 3 ZIPs only.
 *  Fixes from QA main-bbcc940: per-candidate "through" date and fec.gov link (P1-1/P1-2), "No FEC filing found" instead of a
 *  blank (P1-4), party from the ballot data only (never FEC codes), $1.0M / -$3,004 formatting (P2-1), dates via i18n (P2-2),
 *  "Nonpartisan" once per race (P2-3). Figures are Civic finance_fixes18 rows only (lib/money.ts VERIFIED_FEC_IDS). */
export function FinanceRow({ r, align = false }: { r: RaceLite; align?: boolean }) {
  const t = useT();
  const day = useDay();
  const cands = r.candidates ?? [];
  const allNonpartisan = cands.length > 0 && cands.every((c) => c.party === "Nonpartisan");
  return (
    <div className="min-w-0 max-w-full" data-finance>
      {/* Adam 1:52 PM Oct 30: in the race list the money sits under each portrait, so the columns use the photo row's
          tracks and gaps (components/PortraitRow: repeat(n, minmax(0, var(--tile-max))), 72/88/112px, gap 8/12/16px).
          Rows over 4 (none of the federal races today) keep the two-up / auto-fill grid. */}
      {align ? <MoneyList cands={cands} /> : null}
      <ul className={align && cands.length <= 4 ? "my-2 hidden sm:grid justify-start gap-x-2 gap-y-2 [--tile-max:72px] md:gap-x-3 md:[--tile-max:88px] lg:gap-x-4 lg:[--tile-max:112px]" : align ? "my-2 hidden sm:grid gap-x-4 gap-y-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]" : "my-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]"}
        style={align && cands.length <= 4 ? { gridTemplateColumns: `repeat(${cands.length}, minmax(0, var(--tile-max)))` } : undefined} data-finance-align={align && cands.length <= 4 ? "portraits" : "grid"}>
        {cands.map((c) => {
          const id = fecIdOf(c);
          const m = c.money;
          return (
            <li key={c.name} className="min-w-0 break-words" data-finance-cand={c.name}>
              <p className="text-sm font-[530] leading-5 text-black/80">{c.name}</p>
              {!allNonpartisan || c.incumbent === true ? (
                <p className="text-sm leading-5 text-black/60" data-party>{allNonpartisan ? "" : c.party || t("Party: unsure")}{c.incumbent === true ? `${allNonpartisan ? "" : " · "}${t("Incumbent")}` : ""}</p>
              ) : null}
              {m ? (
                <div className="mt-1 text-sm leading-5 text-black/80" data-money>
                  <p>{t("Raised")} <span className="font-medium tabular-nums" data-raised>{usd(m.raised)}</span></p>
                  <p className="text-black/60">{t("Cash on hand")} <span className="tabular-nums" data-coh>{usdCash(m.cashOnHand)}</span></p>
                  {m.coverageThrough ? <p className="text-black/60" data-through={m.coverageThrough}>{t("through")} {day(m.coverageThrough)}</p> : null}
                  {reportLabel(m.lastReport) ? <p className="text-black/60" data-last-report={m.lastReport!}>{t(reportLabel(m.lastReport)!)}</p> : null}
                  {m.note ? <p className="text-sm text-black/60" data-money-note>{m.note}</p> : null}
                </div>
              ) : (
                <p className="mt-1 text-sm leading-5 text-black/60" data-no-fec>{t("No FEC filing found")}</p>
              )}
              <a href={id ? fecCandidateUrl(id) : fecSearchUrl(c.name)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm th-link" data-fec-link title={`FEC: ${c.name}`}>
                {t("FEC page")}{"\u00a0"}↗<span className="sr-only"> {c.name} (opens in a new tab)</span>
              </a>
            </li>
          );
        })}
      </ul>
      {allNonpartisan ? <p className="text-sm text-black/60" data-party-once>Nonpartisan</p> : null}
      <p className={`mb-2 text-sm text-black/60${align ? " hidden sm:block" : ""}`} data-finance-caption>{t("Campaign money from FEC filings")}.</p>
    </div>
  );
}
/** Finance only for federal races, and only in the three supported ZIPs. */
export const showFinanceFor = (r: RaceLite, zip?: string) =>
  SHOW_FINANCE && !!r.candidates?.length && isFederalRace(r) && !!zip && (FINANCE_ZIPS as readonly string[]).includes(zip);

export default function RaceTiers({ races, market, measures = [], zip }: { races: RaceLite[]; market: (id: string) => Mk; measures?: MeasureMath[]; zip?: string }) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const t = useT();
  const rows = races.map((r, i) => ({ r, i, ...tierFor(r, market(r.id), t), mk: market(r.id) })).sort((a, b) => b.score - a.score || a.i - b.i);
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
  // Copy cuts (Oct 30): repeated explainers and stats show once, on the first race that has them, in render order.
  const shown = [...groups.flatMap((g) => g.list), ...judicial].map((x) => x.r);
  const firstNote = shown.find((r) => r.judicialNote)?.id;
  const firstPlace = shown.find((r) => /\bPlace \d+/.test(r.title))?.id;
  const statKey = (p: { label: string; geography: string; year: unknown }) => `${p.label}|${p.geography}|${p.year}`;
  const statsFor = new Map<string, NonNullable<NonNullable<RaceLite["meta"]>["why"]>["problems"]>();
  { const seen = new Set<string>(); for (const r of shown) { const ps = (r.meta?.why?.problems ?? []).filter((p) => !seen.has(statKey(p))); ps.forEach((p) => seen.add(statKey(p))); statsFor.set(r.id, ps); } }
  const raceItem = ({ r, mk }: { r: RaceLite; why: string; mk: Mk }, eager: boolean) => (
                  <li key={r.id} className="font-[450]">
                    <PhotoGroup>
                    <h3 className={H3} data-race-title>{r.title}</h3>
                    {r.candidates?.length ? <PortraitRow cands={r.candidates} eager={eager} raceId={r.id} splitCredits /> : null}
                    {showFinanceFor(r, zip) ? <FinanceRow r={r} align /> : null}
                    {r.order ? <p className="max-w-[60ch] text-sm leading-5 text-black/60" data-order-line={r.order.confirmed ? "confirmed" : "unsure"}>{r.order.text}{r.order.url ? <> <a href={r.order.url} target="_blank" rel="noreferrer" className="relative underline underline-offset-2 after:absolute after:-inset-y-3 after:-inset-x-1 after:content-['']" data-order-source>{r.order.label ?? "Source"} ↗<span className="sr-only"> (opens in a new tab)</span></a></> : null}</p> : null}
                    {/* Civic main_points17 (Oct 30): judges (pointType "role") get only a factual role line from their official profile when one
                        exists (8 in Texas), else the plain empty text. Rendered as given; never a stance. */}
                    {isJudicial(r) && r.candidates?.length ? (
                      <ul className="max-w-[60ch] space-y-1 text-sm leading-5 text-black/80" data-judge-points>
                        {r.candidates.map((c) => { const e = pointsFor(r.id, c.name); const x = e?.p[0]; return (
                          <li key={c.name} className="min-w-0" data-judge={c.name}>
                            <span className="font-[530]">{c.name}:</span>{" "}
                            {x ? <>{x.t} <a href={x.u} target="_blank" rel="noreferrer" className="relative inline-flex min-h-11 items-center underline underline-offset-2 after:absolute after:-inset-y-3 after:-inset-x-1 after:content-['']" data-judge-source>{hostLabel(x.u)}<span className="sr-only"> (opens in a new tab)</span></a></> : <span className="text-black/60">{e?.none ?? "No public position found yet"}</span>}
                          </li>
                        ); })}
                      </ul>
                    ) : null}
                    {r.meta?.contest || r.meta?.rankedChoice ? <p className="max-w-[45ch] text-sm text-black/60" data-why>{r.meta?.contest ? <>{r.meta.contest.replace(/\.+$/, "")}.</> : null}{r.meta?.rankedChoice ? <>{r.meta?.contest ? " " : ""}Ranked-choice: you can rank candidates in order.</> : null}</p> : null}
                    <MarketLine line={leaderLine(mk)} />
                    {r.judicialNote && r.id === firstNote ? <p className="max-w-[45ch] text-sm text-black/60" data-judicial-note>{r.judicialNote}{r.judicialNoteSource ? <> <a href={r.judicialNoteSource.url} target="_blank" rel="noreferrer" title={r.judicialNoteSource.label} className={`${HIT} inline-flex min-h-11 items-center break-words th-link`} data-judicial-source>{judicialShort(r.judicialNoteSource.label)} ↗<span className="sr-only"> (opens in a new tab)</span></a></> : null}</p> : null}
                    {r.dependsOnAddress ? <p className="text-sm text-black" data-depends>Depends on your address.{(r.sourceNote ? r.splitNote : r.appliesNote) ? <span className="text-black/60"> {plain(r.sourceNote ? r.splitNote : r.appliesNote)}</span> : null}</p> : null}
                    {r.id === firstPlace ? <p className="text-sm text-black/60" data-place-hint>&ldquo;Place&rdquo; is the numbered seat being filled; each place is its own separate contest.</p> : null}
                    {r.sourceNote ? <div className="max-w-[60ch] text-sm leading-5 text-black/60" data-tentative>{/* QA fb66b9b P2: short lines; TENTATIVE (draft) stays visible first. */}<p className="font-[530] text-black/80">TENTATIVE: draft contest list. Check your sample ballot.</p><ul className="mt-1 space-y-1" data-note-lines>{r.sourceNote.split(/(?<=\.)\s+(?=[A-Z])/).map((l) => <li key={l}>{l}</li>)}</ul></div> : r.tentative ? <p className="text-sm text-black/60" data-tentative>TENTATIVE: from the NYC Board of Elections&rsquo; contest list{printedDate(r.appliesNote) ? `, printed ${printedDate(r.appliesNote)}` : ""}. Check your sample ballot.</p> : null}
                    {/* Below sm the race links stack as block rows, each a 44px inline-flex row; from sm they sit inline as before. */}
                    {(r.source || r.verify || (r.meta?.closenessBasis.length ?? 0) > 0) && (
                      <p className="flex flex-col items-start text-sm leading-5 text-black/60 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1" data-race-links>
                        {r.source && <a href={r.source} target="_blank" rel="noreferrer" className={RLINK} data-race-link>Source ↗<span className="sr-only"> (opens in a new tab)</span></a>}
                        {r.meta?.closenessBasis.map((x, k) => <span key={x.url + k} className="contents">{r.source || k > 0 ? <span aria-hidden className="hidden sm:inline">·</span> : null}<a href={x.url} target="_blank" rel="noreferrer" data-rating-link data-race-link className={RLINK}>{x.label} ↗<span className="sr-only"> (opens in a new tab)</span></a></span>)}
                        {r.verify && <><span aria-hidden className="hidden sm:inline">·</span><span className="inline-flex min-h-11 items-center sm:inline sm:min-h-0" data-race-verify>{r.verify.replace(/^Check that (.+) is yours by address\.$/, "Check $1 by address.")}</span></>}
                      </p>
                    )}
                    {/* Below sm the photo credits collapse into one "Photo credits (N)" disclosure after the race links;
                        from sm the credit line under the photo row is unchanged. */}
                    {r.candidates?.length ? <PhoneCredits cands={r.candidates} label={(() => { const L = labels(r.candidates.map((c) => c.name)); const names = r.candidates.map((c) => c.name); return (n: string) => L[names.indexOf(n)].label; })()} /> : null}
                    {r.meta?.why ? (
                      <details className="group/w" data-why-matters>
                        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-black/60 hover:text-black [&::-webkit-details-marker]:hidden">Why this race matters<span aria-hidden className="ml-2 inline-block group-open/w:rotate-180">↓</span></summary>
                        <div className="max-w-2xl border-l-2 border-brand-600 pb-2 pl-3 text-sm tabular-nums">
                          {(statsFor.get(r.id) ?? []).length > 0 && <ul className="space-y-1">{(statsFor.get(r.id) ?? []).map((p) => <li key={p.label + p.geography}>{plain(p.label)}: {p.value}{p.unit === "%" ? "%" : ` ${p.unit}`} ({plain(p.geography)}, {plain(String(p.year))}) <a href={p.sourceUrl} title={`${p.label} (${p.geography}, ${p.year})`} target="_blank" rel="noreferrer" data-own-line className="flex min-h-11 w-fit items-center whitespace-nowrap">{host(p.sourceUrl)} ↗</a></li>)}</ul>}
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
                    </PhotoGroup>
                  </li>
  );
  return (
    <section className="border-t border-black py-12 lg:py-16" id="tiers">
      <p className="nds-caption-upper text-black/60">01</p>
      <h2 className={`mt-3 ${H2}`}>What matters on your ballot</h2>
      <p className="mt-4 max-w-2xl text-black/60">Races ranked by office and how close the race is. Never candidates.</p>
      {/* Adam 3:05 PM CT: the same print button near the top of the results; it opens the printable sheet on /card. */}
      {zip ? <PrintButton href={`/card?zip=${zip}&print=1`} className="mt-6 sm:w-auto" data-results-print /> : null}
      <p className="mt-2 max-w-2xl text-sm text-black/60" data-tier-legend>Competitive: Cook Political Report, Sabato&rsquo;s Crystal Ball or Inside Elections call it a toss-up or tilt. Polymarket: top outcome between 35% and 65% also counts as Competitive. Market prices are not forecasts or recommendations.</p>
      <div className="mt-10">
        {groups.map(({ key, name, list, eager, open }) => (
            <details key={key} open={open} className="group border-t border-black/15 py-6" data-tier={key}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-6 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-[530]">{name}</span>
                <span className="ml-auto text-sm text-black/60">{list.length} race{list.length === 1 ? "" : "s"}</span>
                <span aria-hidden className="inline-block text-sm text-black/60 group-open:rotate-180">↓</span>
              </summary>
              <ul className="mt-6 space-y-10">
                {list.map((x) => raceItem(x, eager))}
              </ul>
            </details>
        ))}
        {hiddenCount > 0 && !showAll && (
          <button type="button" onClick={() => setShowAll(true)} data-show-all className="mt-6 inline-flex min-h-11 items-center border border-black/45 px-5 text-base text-black hover:border-black [@media(hover:hover)]:hover:bg-brand-50">Show all {nonJudicial.length} races</button>
        )}
        {judicialGroup.map(({ key, name, list, eager, open }) => (
            <details key={key} open={open} className="group border-t border-black/15 py-6" data-tier={key}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-6 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-[530]">{name}</span>
                <span className="ml-auto text-sm text-black/60">{list.length} race{list.length === 1 ? "" : "s"}</span>
                <span aria-hidden className="inline-block text-sm text-black/60 group-open:rotate-180">↓</span>
              </summary>
              <ul className="mt-6 space-y-10">
                {list.map((x) => raceItem(x, eager))}
              </ul>
            </details>
        ))}
        {measures.length > 0 && <MeasureRows measures={measures} market={market} />}
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
  if (!ok) return <p className="text-sm leading-5 text-black/60" data-office-unverified>Office description not yet verified</p>; // No source, no description.
  return (
    <details className="group/o" data-office={id}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-black/60 hover:text-black [&::-webkit-details-marker]:hidden">
        What this office does<span aria-hidden className="ml-2 inline-block group-open/o:rotate-180">↓</span>
      </summary>
      <p className="max-w-2xl pb-2 text-base">
        {ok.learn}{" "}
        <a href={ok.sourceUrl} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] whitespace-nowrap text-sm">{host(ok.sourceUrl)} ↗</a>
      </p>
    </details>
  );
}

/** Race links: a 44px row at every width (stacked below sm, inline from sm). */
const RLINK = "relative z-[1] inline-flex min-h-11 items-center"; // 44px targets at every width (copy-cuts/purple); stacked below sm, inline from sm (bigimg)
const host = (u: string) => hostLabel(u, "source");

/** Measures: one compact expandable row per measure. Numbers are quoted from official analyses and each links its source. */
function MeasureRows({ measures, market }: { measures: MeasureMath[]; market: (id: string) => Mk }) {
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
                <h3 className="text-base font-medium" data-measure-title>{m.title}</h3>
                <span aria-hidden className="text-sm font-[450] text-black/50 group-open/m:rotate-180">↓</span>
              </summary>
              <div className="pb-3"><MarketLine line={leaderLine(market(m.id))} /></div>
              {m.officialTitle && <p className="pb-4 text-sm" data-official-title><span className="text-sm uppercase tracking-wide text-ink/60">Official ballot title</span><br />{m.officialTitle}{m.officialTitleSource && <> <a href={m.officialTitleSource} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] whitespace-nowrap">{host(m.officialTitleSource)} ↗</a></>}</p>}
{(() => {
                const all = [["Cost", m.cost.value, m.cost.sourceUrl], ["Who pays", m.whoPays.text, m.whoPays.sourceUrl], ["If yes", measureSide(m, "ifYes")?.text, measureSide(m, "ifYes")?.sourceUrl ?? null], ["If no", measureSide(m, "ifNo")?.text, measureSide(m, "ifNo")?.sourceUrl ?? null]] as const; // NYC: the CFB voter guide's own pair, quoted, or our summary (lib/measures.ts measureSide)
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
                            <dt className="text-sm uppercase tracking-wide text-ink/60">{k}</dt>
                            <dd className="mt-1 text-sm">
                              {said(v)}{" "}
                              {u && <a href={u} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] whitespace-nowrap">{host(u)} ↗</a>}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {(noCost || rows.length === 0) && (
                      <p className="mt-2 text-sm text-black/70" data-measure-oneline>
                        {rows.length === 0 ? "No plain-language explainer yet; read the official text." : "No official cost estimate published."}{" "}
                        {(rows.length ? m.cost.sourceUrl || src : src) && <a href={(rows.length ? m.cost.sourceUrl || src : src)!} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] whitespace-nowrap">{host((rows.length ? m.cost.sourceUrl || src : src)!)} ↗</a>}
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
