// QA fb66b9b P0 (Oct 30, 12:51 AM CT): party photo parity per photo mode. Used by tests/photoParity.test.ts and
// scripts/photo-parity.mjs. Counts what each mode renders (before any load failure).
import { ballotFor } from "./tools";
import { withLicensedPhoto, gatePhotos, type PhotoGate } from "./photos";

type C = { name: string; party?: string | null; photo?: unknown };
const partyOf = (p?: string | null) => (/^democrat/i.test(p ?? "") ? "D" : /^republican/i.test(p ?? "") ? "R" : null);

export function parity(zips: string[], gate: PhotoGate) {
  const seen = new Set<string>();
  const out = { races: 0, pictured: 0, partly: [] as string[], oneParty: [] as string[], dem: { shown: 0, of: 0 }, rep: { shown: 0, of: 0 }, cands: { shown: 0, of: 0 } };
  for (const zip of zips) {
    const b = ballotFor(zip); if (!b) continue;
    for (const r of b.races as unknown as { id: string; candidates: C[] }[]) {
      if (seen.has(r.id) || !r.candidates?.length) continue; seen.add(r.id);
      const raw = r.candidates.map((c) => withLicensedPhoto({ ...c, photo: undefined } as never) as C);
      const shown = gatePhotos(raw, gate, r.id);
      out.races++;
      const k = shown.filter((c) => c.photo).length;
      out.cands.shown += k; out.cands.of += shown.length;
      if (k) out.pictured++;
      if (k && k < shown.length) out.partly.push(`${r.id} ${k}/${shown.length}`);
      const ps = shown.map((c) => ({ p: partyOf(c.party), on: !!c.photo }));
      for (const x of ps) { if (x.p === "D") { out.dem.of++; if (x.on) out.dem.shown++; } if (x.p === "R") { out.rep.of++; if (x.on) out.rep.shown++; } }
      const hasD = ps.some((x) => x.p === "D"), hasR = ps.some((x) => x.p === "R");
      if (hasD && hasR) {
        const dOn = ps.some((x) => x.p === "D" && x.on), rOn = ps.some((x) => x.p === "R" && x.on);
        const dAll = ps.filter((x) => x.p === "D").every((x) => x.on), rAll = ps.filter((x) => x.p === "R").every((x) => x.on);
        if (dOn !== rOn || dAll !== rAll) out.oneParty.push(`${r.id} (D ${dOn ? (dAll ? "all" : "some") : "none"}, R ${rOn ? (rAll ? "all" : "some") : "none"})`);
      }
    }
  }
  return out;
}
