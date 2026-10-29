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
