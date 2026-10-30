// Polymarket strip (Adam, Oct 30 2026 2:58 PM CT: "i want a polymarket banner at the top").
// Markets, slugs and labels are Civic's (data/poly-strip.json from civic/poly25/banner_markets.json). Prices are only
// ever the live Gamma fetch for this render: no stored, estimated or filled-in number. Any gap hides the chip; no chip
// or data older than 1 hour hides the whole strip.
import STRIP from "../data/poly-strip.json";
import { pctOf } from "./marketLine";

/** Left label: copy pending Adam's OK. Empty means omitted. */
export const STRIP_LABEL = "";
/** Under Fiona Ma's odds only (Adam 3:07 PM Oct 30: "Yes, show the no-market line for Romero"). ca-ltgov stays out of the strip. */
export const ROMERO_LINE = true;
export const ROMERO_TEXT = "No Polymarket market found for Gloria Romero.";
export const MAX_AGE_MS = 60 * 60 * 1000;
export const MAX_CHIPS = 3;

export type StripEvent = { zip: string; slug: string; title: string; url: string; markets: { slug: string; question: string }[] };
export const STRIP_EVENTS = (STRIP as { events: Record<string, StripEvent> }).events;

export type LiveEvent = { slug: string; servedAt: string; markets: Record<string, { name: string; sides: { outcome: string; prob: number }[] }> };
export type StripRow = { slug: string; question: string; sides: { outcome: string; pct: string }[]; note?: string };
export type StripChip = { id: string; title: string; url: string; rows: StripRow[] };
export type Strip = { chips: StripChip[]; asOf: string; asOfLabel: string };
type BallotLite = { state?: string; races: { id: string; candidates: { name: string; party?: string | null }[] }[]; measures?: { id: string }[] };

/** "3:05 PM CT": 12-hour Central time of Polymarket's response. */
export function asOfCT(iso: string): string {
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  return d.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }) + " CT";
}

const lastName = (s: string) => String(s).replace(/\s*\([^)]*\)\s*$/, "").trim().split(/\s+/).pop()!.toLowerCase();

/** Which strip events a page shows: home gets the two national control markets; a ZIP gets its first races with a
 *  market in the site's race order (races, then measures), at most 3. ca-ltgov is never in STRIP_EVENTS. */
export function stripIdsFor(ballot: BallotLite | null): string[] {
  if (!ballot) return ["national-senate", "national-house"];
  const ids = [...ballot.races.map((r) => r.id), ...(ballot.measures ?? []).map((m) => m.id)];
  return ids.filter((id) => STRIP_EVENTS[id]).slice(0, MAX_CHIPS);
}

/** Sub-market order. CA: last name (CA ballot order is unconfirmed, never called ballot order). Party markets: the
 *  site's candidate order for that race, matched by party. National: alphabetical by Civic's question. */
export function orderMarkets(id: string, ev: StripEvent, live: LiveEvent, ballot: BallotLite | null) {
  const ms = [...ev.markets];
  if (ballot?.state === "CA") return ms.sort((a, b) => lastName(live.markets[a.slug]?.name || a.question).localeCompare(lastName(live.markets[b.slug]?.name || b.question)));
  const race = ballot?.races.find((r) => r.id === id);
  if (race) {
    const party = (q: string) => (/democrat/i.test(q) ? "democratic" : /republican/i.test(q) ? "republican" : "");
    const rank = (q: string) => { const p = party(q); const i = p ? race.candidates.findIndex((c) => String(c.party || "").toLowerCase().startsWith(p)) : -1; return i < 0 ? 99 : i; };
    return ms.sort((a, b) => rank(a.question) - rank(b.question));
  }
  return ms.sort((a, b) => a.question.localeCompare(b.question));
}

/** Builds the strip from live events only. Null (strip hidden) when nothing complete and fresh is left. */
export function buildStrip(ids: string[], live: Record<string, LiveEvent | null | undefined>, ballot: BallotLite | null, now = Date.now()): Strip | null {
  const chips: StripChip[] = [];
  const times: number[] = [];
  for (const id of ids) {
    const ev = STRIP_EVENTS[id];
    const l = live[id];
    if (!ev || !l || l.slug !== ev.slug) continue;
    const t = Date.parse(l.servedAt);
    if (!isFinite(t) || now - t > MAX_AGE_MS || t - now > 5 * 60 * 1000) continue;
    const rows: StripRow[] = [];
    let complete = true;
    for (const m of orderMarkets(id, ev, l, ballot)) {
      const lm = l.markets[m.slug];
      const yes = lm?.sides.find((s) => s.outcome === "Yes"), no = lm?.sides.find((s) => s.outcome === "No");
      // Every market shows Yes and No; a market missing either side drops the whole chip (never a lone side).
      if (!yes || !no) { complete = false; break; }
      const row: StripRow = { slug: m.slug, question: m.question, sides: [{ outcome: "Yes", pct: pctOf(yes.prob) }, { outcome: "No", pct: pctOf(no.prob) }] };
      if (ROMERO_LINE && m.slug.startsWith("will-fiona-ma-win-the-california-lieutenant-governor")) row.note = ROMERO_TEXT;
      rows.push(row);
    }
    if (!complete || !rows.length) continue;
    chips.push({ id, title: ev.title, url: ev.url, rows });
    times.push(t);
  }
  if (!chips.length) return null;
  const asOf = new Date(Math.min(...times)).toISOString();
  return { chips, asOf, asOfLabel: asOfCT(asOf) };
}
