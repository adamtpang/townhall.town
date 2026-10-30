// Licensed candidate portraits (Wikimedia Commons or official), keyed by ballot name.
// Fills Politician.photo from lib/types.ts. Unknown names keep photo as-is.
import data from "../data/photos.json";
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

type Hosted = { name: string; file: string; sourceUrl: string; credit: string; license: string; page: string | null; via: string; width?: number };
const hosted = ((data as { selfHosted?: Record<string, Hosted> }).selfHosted ?? {}) as Record<string, Hosted>;
export const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Tiles are 56px; at 2x screens a source under 112px wide looks soft (e.g. a 100x125 court photo), so it counts as missing. */
export const MIN_PHOTO_WIDTH = 112;

/** Self-hosted portrait from public/portraits, built by scripts/ingest-photos.mjs from Civic's photos_batch.json only
 *  (licensed: Wikimedia Commons or public-domain government work). No Ballotpedia images, no hotlinks, never generated. */
export function withLicensedPhoto<T extends Politician & { aka?: string | null }>(p: T): T {
  const h = hosted[slug(p.name)] ?? (p.aka ? hosted[slug(p.aka)] : undefined);
  if (!h || (h.width ?? 999) < MIN_PHOTO_WIDTH) return { ...p, photo: null };
  // Civic's attribution text, verbatim (it already names the author, license and source).
  const credit = /^photo:/i.test(h.credit) ? h.credit : `Photo: ${h.credit}`;
  return { ...p, photo: { url: h.file, credit, license: h.license, page: h.page ?? undefined } };
}

/** Photo fairness, used by ballotFor (lib/tools.ts) on every race. All-or-none per race: photos only if every candidate in the race has one, otherwise initials for everyone. */
export function allOrNone<T extends { photo?: unknown }>(cands: T[]): T[] {
  return cands.length && cands.every((c) => c.photo) ? cands : cands.map((c) => ({ ...c, photo: null }));
}
