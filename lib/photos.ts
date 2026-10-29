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

type Hosted = { name: string; file: string; sourceUrl: string; credit: string; license: string; page: string | null; via: string };
const hosted = ((data as { selfHosted?: Record<string, Hosted> }).selfHosted ?? {}) as Record<string, Hosted>;
export const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Self-hosted portrait from public/portraits (built by scripts/portraits.mjs from licensed or Ballotpedia files), or none.
 *  No hotlinks: a candidate without a self-hosted file has photo null, and the race then shows no portraits. */
export function withLicensedPhoto<T extends Politician>(p: T): T {
  const h = hosted[slug(p.name)];
  if (!h) return { ...p, photo: null };
  const credit = h.via === "Wikimedia Commons" ? `Photo: ${h.credit} (${h.license}), Wikimedia Commons` : h.credit;
  return { ...p, photo: { url: h.file, credit, license: h.license, page: h.page ?? undefined } };
}
