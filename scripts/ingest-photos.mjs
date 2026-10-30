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
  /txcourts\.gov/i.test(JSON.stringify(p)) || id === "alida-fisher" || /no licensed photo found for running mate/i.test(p.note ?? "") ||
  /news|press agency|getty|associated press|\bAP\b|reuters/i.test(String(p.sourceType ?? "")); // never news photos (Adam 12:16 AM)
// Adam 12:16 AM CT: a candidate's own public campaign or official headshot is allowed even when unlicensed. Only licensed
// images (public domain, CC0, CC BY, CC BY-SA) are self-hosted; the rest are hotlinked from Civic's photoUrl.
export const isLicensed = (p) => /public domain|\bCC0\b|\bCC BY\b|creative commons/i.test(String(p.license ?? "")) && !/campaign|press photo|official site/i.test(String(p.license ?? ""));
export const isOwnSource = (p) => /campaign|official/i.test(String(p.sourceType ?? ""));
const credit = (p) => String(p.attribution ?? "").replace(/^photo:\s*/i, "").trim();
// Event photos Civic flagged "crop to face": [left, top, width, height] as fractions of the source.
const CROP = { "michael-e-gates": [0.27, 0.03, 0.3, 0.56] };
const out = {}; const hot = {};
let ok = 0, skipped = 0, fail = 0;
for (const [id, p] of Object.entries(batch)) {
  if (id.startsWith("_") || !p?.photoUrl) continue;
  if (EXCLUDE(id, p)) { console.error("excluded", id); skipped++; continue; }
  if (!isLicensed(p)) {
    if (isOwnSource(p) && /^https:\/\//.test(p.photoUrl) && p.pageUrl) hot[id] = { name: id, url: p.photoUrl, credit: credit(p), page: p.pageUrl, via: p.sourceType, license: p.license ?? null, width: p.photoWidth ?? null };
    else { console.error("not licensed and not the candidate's own campaign/official photo:", id); skipped++; }
    continue;
  }
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
    out[id] = { name: id, file, sourceUrl: p.photoUrl, credit: credit(p), license: p.license, page: p.pageUrl ?? null, via: p.sourceType, width: meta.width, height: meta.height };
    ok++;
  } catch (e) { console.error("skip", id, String(e)); fail++; }
  await new Promise((r) => setTimeout(r, 200));
}
const keep = new Set(Object.values(out).map((o) => o.file.replace("/portraits/", "")));
let removed = 0;
for (const f of fs.readdirSync("public/portraits")) if (!keep.has(f)) { fs.unlinkSync(`public/portraits/${f}`); removed++; }
const photos = { asOf: "2026-10-30", method: "Civic data/civic/photos_batch.json: licensed photos (self-hosted) plus candidates' own public campaign or official headshots (hotlinked), each credited to its source page. No news photos; never generated.", photos: {}, selfHosted: out, hotlinked: hot, hotlinkedNote: "Candidates' own public campaign or official headshots (not licensed for reuse): shown from their source URL, never copied, credited to the source page.", selfHostedNote: `Built by scripts/ingest-photos.mjs from data/civic/photos_batch.json. Resized (and face-cropped where Civic noted) only. Never generated.` };
fs.writeFileSync("data/photos.json", JSON.stringify(photos, null, 1) + "\n");
console.log(`self-hosted ${ok}, hotlinked ${Object.keys(hot).length}, excluded ${skipped}, failed ${fail}, removed old files ${removed}`);
