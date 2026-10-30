// One-tap "Add to Google Calendar" for the voting plan (Adam via Maans, 12:51 PM CT Oct 30).
// Event text is nonpartisan: race names only (from the stakes tier list), no candidate names, answers, fit or
// recommendations. Dates and hours come from the same sourced events as the .ics (whenFor); nothing is invented.
import { gcalDates, mapsUrl } from "./endscreen.mjs";
import { tierFor, type Mk } from "../app/RaceTiers";

export const CARD_BASE = "https://townhall.town/card?zip=";
/** City shown in titles (the three ZIPs we cover). */
export const CITY: Record<string, string> = { "78701": "Austin", "94103": "San Francisco", "10001": "New York" };

export type PlanEvent = { kind: string; title: string; allDay: boolean; start: string; end: string; hm?: number[][] | null; tz: string; details: string; sourceUrl: string };
export type PlanSite = { name: string; address: string } | null | undefined;
type TierRace = Parameters<typeof tierFor>[0];

/** Race names from the tier list: "Most at stake" then "High stakes", in the same order the list shows them (max 5).
 *  Court races are left out, as in the Who section. If no race is in those two tiers, the first 3 of the list. */
export function topRaceTitles(races: TierRace[], market: (id: string) => Mk = () => null, max = 5): string[] {
  const rows = races
    .map((r, i) => ({ r, i, ...tierFor(r, market(r.id)) }))
    .filter((x) => !x.r.judicial && x.r.title)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const top = rows.filter((x) => x.tier === "most" || x.tier === "high");
  return (top.length ? top : rows.slice(0, 3)).slice(0, max).map((x) => x.r.title);
}

/** Google Calendar template link for one sourced event (Election Day or early voting). */
export function planEventUrl(o: { e: PlanEvent; zip: string; site?: PlanSite; lookupUrl?: string | null; dependsOnAddress?: boolean; topRaces?: string[] }): string {
  const { e, zip, site, lookupUrl, dependsOnAddress, topRaces = [] } = o;
  const city = CITY[zip];
  const text = `${e.kind === "election" ? "Vote: Election Day" : "Vote: Early voting"}${city ? `, ${city}` : ""}`;
  const lines = [
    topRaces.length ? `Top races on your ballot: ${topRaces.join("; ")}` : null,
    site ? `Polling place: ${site.name}, ${site.address}` : null,
    site ? `Map: ${mapsUrl(site.address)}` : null,
    lookupUrl && (dependsOnAddress || !site) ? `Find your assigned polling place: ${lookupUrl}` : null,
    e.details,
    `Your ballot card: ${CARD_BASE}${zip}`,
  ].filter(Boolean);
  const q = new URLSearchParams({ action: "TEMPLATE", text, dates: gcalDates(e), ctz: e.tz, location: site ? `${site.name}, ${site.address}` : "", details: lines.join("\n") });
  // Spaces as %20 (not "+") so every client decodes the text the same way.
  return `https://calendar.google.com/calendar/render?${q.toString().replace(/\+/g, "%20")}`;
}

/** QA phone pass (Oct 30): the Nov 3 Election Day event leads; early voting (if still on) follows. */
export function electionFirst<T extends { kind?: string }>(events: T[]): T[] {
  return [...events].sort((a, b) => Number(b.kind === "election") - Number(a.kind === "election"));
}
