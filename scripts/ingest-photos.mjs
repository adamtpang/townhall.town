// Civic's licensed photo file is the portrait source of truth (Oct 29 11:42 PM CT): node scripts/ingest-photos.mjs
// Reads data/civic/photos_batch.json (one entry per candidate id: photoUrl + license + attribution, or
// "no licensed photo found" + sourcesChecked). Every license in it (public domain, CC0, CC BY, CC BY-SA) allows
// self-hosting with attribution, so each photo is downloaded once, resized / face-cropped only (never edited or
// generated), written to public/portraits/{id}.avif, and recorded in data/photos.json "selfHosted" with its
// attribution. Anything not in the file is deleted. Race-level fairness (initials for the whole race unless every
// candidate has a photo) is applied at render time by allOrNone in lib/photos.ts.
import fs from "node:fs";
import sharp from "sharp";
const batch = JSON.parse(fs.readFileSync("data/civic/photos_batch.json", "utf8"));
// Never shown, even with a URL: txcourts.gov judge portraits (no reuse terms on the site), the Alida Fisher
// video still (not a portrait), and ticket entries whose running mate has no licensed photo (NY: Todd Hood).
export const EXCLUDE = (id, p) =>
  /txcourts\.gov/i.test(JSON.stringify(p)) || id === "alida-fisher" || /no licensed photo found for running mate/i.test(p.note ?? "");
// Event photos Civic flagged "crop to face": [left, top, width, height] as fractions of the source.
const CROP = { "michael-e-gates": [0.27, 0.03, 0.3, 0.56] };
const out = {};
let ok = 0, skipped = 0, fail = 0;
for (const [id, p] of Object.entries(batch)) {
  if (id.startsWith("_") || !p?.photoUrl) continue;
  if (EXCLUDE(id, p)) { console.error("excluded", id); skipped++; continue; }
  const file = `/portraits/${id}.avif`;
  try {
    const r = await fetch(p.photoUrl, { headers: { "User-Agent": "townhall/1.0 (https://townhall.town; civic data)" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    let img = sharp(Buffer.from(await r.arrayBuffer()));
    const meta = await img.metadata();
    if (CROP[id]) {
      const [l, t, w, h] = CROP[id];
      img = img.extract({ left: Math.round(l * meta.width), top: Math.round(t * meta.height), width: Math.round(w * meta.width), height: Math.round(h * meta.height) });
    }
    await img.resize({ width: 400, withoutEnlargement: true }).avif({ quality: 50 }).toFile(`public${file}`);
    out[id] = { name: id, file, sourceUrl: p.photoUrl, credit: p.attribution, license: p.license, page: p.pageUrl ?? null, via: p.sourceType, width: meta.width, height: meta.height };
    ok++;
  } catch (e) { console.error("skip", id, String(e)); fail++; }
  await new Promise((r) => setTimeout(r, 200));
}
const keep = new Set(Object.values(out).map((o) => o.file.replace("/portraits/", "")));
let removed = 0;
for (const f of fs.readdirSync("public/portraits")) if (!keep.has(f)) { fs.unlinkSync(`public/portraits/${f}`); removed++; }
const photos = { asOf: "2026-10-30", method: "Civic data/civic/photos_batch.json: licensed photos only (Wikimedia Commons or public-domain government work), each with attribution.", photos: {}, selfHosted: out, selfHostedNote: `Built by scripts/ingest-photos.mjs from data/civic/photos_batch.json. Resized (and face-cropped where Civic noted) only. Never generated.` };
fs.writeFileSync("data/photos.json", JSON.stringify(photos, null, 1) + "\n");
console.log(`self-hosted ${ok}, excluded ${skipped}, failed ${fail}, removed old files ${removed}`);
