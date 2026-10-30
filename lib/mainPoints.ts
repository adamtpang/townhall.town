// Civic main_points16 (Oct 30): the only source for card main points and the record line. Lookup is by race id, then
// candidate id or slug(name); Civic matched some ids by race + name (Gates, Romero, Cohen, the NY governor tickets).
import MP from "./mainPoints.gen.json";
export type MainPoint = { i: string; l: string; t: string; u: string; s: string };
export type CardPoints = { id: string; name: string; p: MainPoint[]; r: { t: string; u: string | null } | null; none: string | null };
const races = (MP as { races: Record<string, Record<string, CardPoints>> }).races;
export const slugName = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const NO_RECORD_LINE = "No voting record found";
export function pointsFor(raceId: string | undefined, name: string): CardPoints | null {
  if (!raceId) return null;
  const r = races[raceId]; if (!r) return null;
  return r[slugName(name)] ?? Object.values(r).find((c) => c.name === name) ?? null;
}
