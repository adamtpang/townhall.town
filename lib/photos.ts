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

/** Prefer a clearly licensed portrait from data/photos.json over an existing photo; keep the existing one when none is listed. */
export function withLicensedPhoto<T extends Politician>(p: T): T {
  const found = photoFor(p.name);
  if (!found) return p;
  return { ...p, photo: { url: found.url, credit: `Photo: ${found.credit} (${found.license}), Wikimedia Commons`, license: found.license, page: found.page } };
}
