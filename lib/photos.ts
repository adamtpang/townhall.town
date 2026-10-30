// Licensed candidate portraits (Wikimedia Commons or official), keyed by ballot name.
// Fills Politician.photo from lib/types.ts. Unknown names keep photo as-is.
import data from "../data/photos.json";
import TAKEDOWN_IDS from "../data/photo_takedowns.json";
import type { Politician } from "./types";

type Photo = { url: string; credit: string; license: string; page: string };
const photos = (data as { photos: Record<string, Photo> }).photos;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const index = new Map(Object.entries(photos).map(([name, p]) => [norm(name), p]));

export function photoFor(name: string): Photo | null {
  return index.get(norm(name)) ?? null;
}

export function withPhoto<T extends Politician>(p: T): T {
  if (p.photo) return p;
  const found = photoFor(p.name);
  return found ? { ...p, photo: { url: found.url, credit: `${found.credit} (${found.license})`, license: found.license } } : p;
}

/** Civic cropNote focus: [x, y, scale]. x/y = the face point as fractions of the image (CSS object-position and
 *  transform-origin), scale = zoom. Display only; the image is not edited. */
export type Focus = [number, number, number];
type Hosted = { name: string; file: string; file112?: string; sourceUrl: string | null; credit: string; license: string | null; page: string | null; via: string | null; width?: number; focus?: Focus };
const hosted = ((data as unknown as { selfHosted?: Record<string, Hosted> }).selfHosted ?? {}) as Record<string, Hosted>;
export const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Tiles are 56px; at 2x screens a source under 112px wide looks soft (e.g. a 100x125 court photo), so it counts as missing. */
export const MIN_PHOTO_WIDTH = 112;

type Hot = { name: string; url: string; credit: string; page: string; via: string | null; width?: number | null; focus?: Focus };
const hot = ((data as unknown as { hotlinked?: Record<string, Hot> }).hotlinked ?? {}) as Record<string, Hot>;
type Mate = (Hosted | Hot) & { kind: "self" | "hot"; mateName: string };
/** Running mates (Civic role "running mate"), keyed by their ticket's candidate id; shown beside the ticket's photo. */
const mates = ((data as unknown as { runningMates?: Record<string, Mate> }).runningMates ?? {}) as Record<string, Mate>;
/** Races Civic marks incomplete (photo ages not comparable): initials in race mode even when every candidate has a photo. */
export const INCOMPLETE_RACES = new Set<string>(((data as unknown as { incompleteRaces?: string[] }).incompleteRaces ?? []));
export type CandPhoto = { url: string; url112?: string; credit: string; author: string; license?: string; attribution?: string; page?: string; hotlinked?: boolean; focus?: Focus; mate?: CandPhoto & { name: string } };
const toPhoto = (h: Hosted | Hot): CandPhoto | null => {
  if ((h.width ?? 999) < MIN_PHOTO_WIDTH) return null;
  const attribution = cleanCredit(h.credit, h.via);
  // QA fb66b9b P2: author and license are separate fields ("U.S. House of Representatives" + "Public domain"); the
  // visible credit stays "Photo: {attribution}" (Civic's full text).
  const lic = (h as { license?: string | null }).license ?? "";
  const author = /,\s*(?:CC[\s0-9-]|public domain)|\(public domain\)/i.test(attribution) ? creditParts(attribution, lic, h.page).author : attribution;
  // Design p14: every portrait is a self-hosted square (112px and 160px) with the focus already cut in, so no CSS focus.
  // A hotlinked record (none ship since p14) would still render from its URL with its CSS focus.
  if ("file" in h) return { url: h.file, ...(h.file112 ? { url112: h.file112 } : {}), credit: `Photo: ${attribution}`, author, ...(lic ? { license: lic } : {}), attribution, page: h.page ?? undefined };
  return { url: h.url, credit: `Photo: ${attribution}`, author, ...(lic ? { license: lic } : {}), attribution, page: h.page ?? undefined, hotlinked: true, ...(h.focus ? { focus: h.focus } : {}) };
};
/** data/photo_takedowns.json: candidate ids (slugs, e.g. "rob-bonta") whose photo must never show. They get initials. */
export const TAKEDOWNS = new Set<string>(TAKEDOWN_IDS as string[]);
/** Clean credit text: Civic's attribution without "Photo:"; never a raw URL or "Unknown author". */
export const cleanCredit = (a: string, via?: string | null) => {
  const t = String(a || "").replace(/^photo:\s*/i, "").trim();
  return !t || /https?:\/\/|unknown author/i.test(t) ? (via || "Wikimedia Commons") : t;
};

/** Candidate portrait (Adam 12:16 AM CT): licensed photos are self-hosted from public/portraits (scripts/ingest-photos.mjs);
 *  a candidate's own public campaign or official headshot is hotlinked from its source. Credit: "Photo: {attribution}",
 *  linked to the source page. Never news photos, never generated. Takedowns (data/photo_takedowns.json) get initials. */
export function withLicensedPhoto<T extends Politician & { aka?: string | null }>(p: T): T {
  const ids = [slug(p.name), ...(p.aka ? [slug(p.aka)] : [])];
  if (ids.some((id) => TAKEDOWNS.has(id))) return { ...p, photo: null };
  const h = ids.map((id) => hosted[id]).find(Boolean);
  const x = ids.map((id) => hot[id]).find(Boolean);
  const main = (h && toPhoto(h)) || (x && toPhoto(x)) || null;
  if (main) {
    const m = ids.map((id) => mates[id]).find(Boolean);
    const mp = m && !TAKEDOWNS.has(slug(m.mateName)) ? toPhoto(m) : null;
    return { ...p, photo: mp ? { ...main, mate: { ...mp, name: m!.mateName } } : main };
  }
  return { ...p, photo: null };
}

/** Design p10 credit: "Photo: {author} · {license}" with the license linked. Parsed from Civic's attribution text.
 *  Unknown authors (or a bare URL) become "Wikimedia Commons" (or the source named after "via"). Never a raw URL. */
export function creditParts(attribution: string, license: string, page?: string | null): { author: string; license: string; licenseUrl: string | null } {
  const a = String(attribution || "").replace(/^photo:\s*/i, "").trim();
  const ccUrl = /\((https?:\/\/creativecommons\.org\/[^)\s]+)\)/.exec(a)?.[1] ?? null;
  const via = /,\s*via\s+(.+)$/i.exec(a)?.[1]?.trim() ?? "Wikimedia Commons";
  let author = a.split(/,\s*(?:CC[\s0-9]|public domain)|\s*\(public domain\)/i)[0].replace(/^©\s*\d{4}\s*/, "").trim();
  if (!author || /unknown author/i.test(author) || /https?:\/\//.test(author)) author = via;
  const lic = String(license || "").replace(/\s*\(.*$/, "").trim() || "Public domain";
  return { author, license: lic, licenseUrl: ccUrl ?? page ?? null };
}
export const creditText = (c: { author: string; license: string }) => `Photo: ${c.author} · ${c.license}`;

/** PHOTO_GATE (lib/photoGate.ts) = "race" (default: all-or-none per race, the 11:34 PM fairness rule; reaffirmed 12:20 AM)
 *  or "candidate" (each candidate with a photo shows it; the others get a same-size initials tile). Flip it per build with
 *  NEXT_PUBLIC_PHOTO_GATE=candidate (a build-time value; no project setting needed), or change the default here. */
import { PHOTO_GATE, type PhotoGate } from "./photoGate";
export { PHOTO_GATE, type PhotoGate };
export function gatePhotos<T extends { photo?: unknown }>(cands: T[], gate: PhotoGate = PHOTO_GATE, raceId?: string): T[] {
  if (gate === "candidate") return cands.map((c) => (c.photo ? c : { ...c, photo: null }));
  return raceId && INCOMPLETE_RACES.has(raceId) ? cands.map((c) => ({ ...c, photo: null })) : allOrNone(cands);
}

/** Photo fairness, used by ballotFor (lib/tools.ts) on every race. All-or-none per race: photos only if every candidate in the race has one, otherwise initials for everyone. */
export function allOrNone<T extends { photo?: unknown }>(cands: T[]): T[] {
  return cands.length && cands.every((c) => c.photo) ? cands : cands.map((c) => ({ ...c, photo: null }));
}
