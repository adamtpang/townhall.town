// Civic photos.json is the portrait source of truth: node scripts/ingest-photos.mjs
// Downloads each imageUrl once, resizes and re-encodes only (never edits faces), writes public/portraits/{slug}.avif
// and data/photos.json "selfHosted". Anything not in Civic's file (all Ballotpedia images) is dropped and its file deleted.
import fs from "node:fs";
import sharp from "sharp";
const civic = JSON.parse(fs.readFileSync("data/civic/photos.json", "utf8"));
const batch2 = JSON.parse(fs.readFileSync("data/civic/photos_batch2.json", "utf8"));
// Removed by Civic, never shipped: courts.ca.gov images (site terms bar this use) and Travis County photos whose
// page alt text names a different (previous) judge. Checked against each record's whole JSON, credit included.
const BLOCK = /courts\.ca\.gov/i;
const seen = new Set();
civic.photos = [...civic.photos, ...batch2.photos].filter((p) => {
  if (BLOCK.test(JSON.stringify(p))) { console.error("blocked", p.slug); return false; }
  if (seen.has(p.slug)) return false;
  seen.add(p.slug); return true;
});
const out = {}, byUrl = new Map();
let ok = 0, fail = 0;
for (const p of civic.photos) {
  const file = `/portraits/${p.slug}.avif`;
  try {
    let buf = byUrl.get(p.imageUrl);
    if (!buf) {
      const r = await fetch(p.imageUrl, { headers: { "User-Agent": "townhall/1.0 (https://townhall.town; civic data)" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      buf = Buffer.from(await r.arrayBuffer());
      byUrl.set(p.imageUrl, buf);
    }
    const meta = await sharp(buf).metadata();
    await sharp(buf).resize({ width: 400, withoutEnlargement: true }).avif({ quality: 50 }).toFile(`public${file}`);
    // Credit is the publisher only; no job titles (e.g. Gabriel Padilla's current title is unconfirmed).
    out[p.slug] = { name: p.slug, file, sourceUrl: p.imageUrl, credit: p.credit, license: p.license, page: p.sourcePage, via: p.via, width: meta.width, height: meta.height };
    ok++;
  } catch (e) { console.error("skip", p.slug, String(e)); fail++; }
  await new Promise((r) => setTimeout(r, 150));
}
const keep = new Set(Object.values(out).map((o) => o.file.replace("/portraits/", "")));
let removed = 0;
for (const f of fs.readdirSync("public/portraits")) if (!keep.has(f)) { fs.unlinkSync(`public/portraits/${f}`); removed++; }
const photos = { asOf: civic.asOf, method: civic.method, photos: {}, selfHosted: out, selfHostedNote: `Built by scripts/ingest-photos.mjs from Civic data/civic/photos.json + photos_batch2.json on ${new Date().toISOString().slice(0, 10)}. Resized and re-encoded only. No Ballotpedia images.` };
fs.writeFileSync("data/photos.json", JSON.stringify(photos, null, 1) + "\n");
console.log(`self-hosted ${ok}, failed ${fail}, removed old files ${removed}`);
