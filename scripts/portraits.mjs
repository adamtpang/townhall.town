// Self-host candidate portraits: node scripts/portraits.mjs
// Source order per candidate: data/photos.json licensed file (Wikimedia/official) > the photo already in the ballot data (Ballotpedia).
// Writes public/portraits/{slug}.avif and records file, sourceUrl, credit, license and page in data/photos.json "selfHosted".
// Never generates or edits faces: resize + re-encode only.
import fs from "node:fs";
import sharp from "sharp";
const photos = JSON.parse(fs.readFileSync("data/photos.json", "utf8"));
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const lic = new Map(Object.entries(photos.photos).map(([n, p]) => [norm(n), p]));
export const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const people = new Map();
const walk = (o) => {
  if (Array.isArray(o)) return o.forEach(walk);
  if (o && typeof o === "object") {
    if (typeof o.name === "string" && "photo" in o) people.set(o.name, o);
    Object.values(o).forEach(walk);
  }
};
walk(JSON.parse(fs.readFileSync("data/ballots.json", "utf8")));
if (fs.existsSync("data/ny.json")) walk(JSON.parse(fs.readFileSync("data/ny.json", "utf8")));
const out = {};
let ok = 0, miss = 0;
for (const [name, c] of people) {
  const l = lic.get(norm(name));
  const src = l ? { url: l.url, credit: l.credit, license: l.license, page: l.page, via: "Wikimedia Commons" }
    : c.photo?.url ? { url: c.photo.url, credit: c.photo.credit || "Photo via Ballotpedia", license: c.photo.license || "see Ballotpedia page", page: c.ballotpedia || null, via: "Ballotpedia" } : null;
  if (!src) { miss++; continue; }
  const s = slug(name), file = `/portraits/${s}.avif`;
  try {
    const r = await fetch(src.url, { headers: { "User-Agent": "townhall/1.0 (https://townhall.town)" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    await sharp(buf).resize({ width: 400, withoutEnlargement: true }).avif({ quality: 50 }).toFile(`public${file}`);
    out[s] = { name, file, sourceUrl: src.url, credit: src.credit, license: src.license, page: src.page, via: src.via };
    ok++;
  } catch (e) { console.error("skip", name, String(e)); miss++; }
}
photos.selfHosted = out;
photos.selfHostedNote = "Built by scripts/portraits.mjs on " + new Date().toISOString().slice(0, 10) + ". Resized and re-encoded only. Ballotpedia-sourced files keep Ballotpedia's credit; their license is as stated on the Ballotpedia page.";
fs.writeFileSync("data/photos.json", JSON.stringify(photos, null, 1) + "\n");
console.log(`self-hosted ${ok}, without a portrait ${miss}`);
