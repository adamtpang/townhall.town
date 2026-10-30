// Civic's photo file is the portrait source of truth: node scripts/ingest-photos.mjs [--offline]
// Design p14 (Oct 30, 4:38 AM CT): every portrait is downloaded at build time and served only from public/portraits as
// two small square webp files ({id}-112.webp, {id}-160.webp), cropped at the per-photo focus (or 50% 20%), so no visitor
// loads a third-party image. Originals are cached in .portrait-src/ (git-ignored); --offline re-crops from that cache.
// data/portraits-manifest.json records each file's source URL, page, and sha256 (source and outputs).
// The rules below (Adam 12:16 AM CT) still decide WHICH photos ship; "hotlinked" photos are now downloaded, not hotlinked.
// Reads data/civic/photos_batch.json (one entry per candidate id). Rules (Adam 12:16 AM CT; headshot pass 12:40 AM CT):
//  - localFile (Civic's saved copy of a signed / expiring URL: imgix, Google Sites, X avatars, social CDNs) is preferred
//    over photoUrl and self-hosted: resized to at most 400px wide, webp, public/portraits/{id}.webp.
//  - licensed images (public domain, CC0, CC BY, CC BY-SA) are downloaded once and self-hosted (avif, 400px).
//  - a candidate's own public campaign, official or own-social-profile headshot is hotlinked from photoUrl after a
//    GET check (200 + image/*); anything that fails the check is left out and listed.
//  - never news photos, never generated. Resize and Civic's cropNote focus (CSS object-position + scale) only.
//  - running mates (role "running mate", ticketId) are attached to their ticket as `mate`.
//  - races Civic marks incomplete (raceNote "photo ages not comparable") go in `incompleteRaces`: initials in race mode.
// data/photo_takedowns.json still wins over everything (lib/photos.ts).
import fs from "node:fs";
import sharp from "sharp";
import { createHash } from "node:crypto";
const batch = JSON.parse(fs.readFileSync("data/civic/photos_batch.json", "utf8"));
// Exclusion rules live in scripts/photo-rules.mjs (unit-tested in tests/qa8.test.ts).
import { EXCLUDE, dhash, hamming } from "./photo-rules.mjs";
export const isLicensed = (p) => /public domain|\bCC0\b|\bCC BY\b|creative commons/i.test(String(p.license ?? "")) && !/campaign|press photo|official site|not licensed/i.test(String(p.license ?? ""));
export const isOwnSource = (p) => /campaign|official|own social profile/i.test(String(p.sourceType ?? ""));
// Office-named official-page credits read "<candidate name> official page" (Adam, qa_fixes6 #5, 1:02 AM CT).
const credit = (p) => {
  const c = String(p.attribution ?? "").replace(/^photo:\s*/i, "").trim();
  return / official page$/i.test(c) && p.name ? `${p.name} official page` : c;
};
// Civic cropNote -> focus [x, y, scale]: the face point (fractions of the image) for object-position and transform-origin,
// and how far to zoom in. Read off each source image by eye (Oct 30, 12:45 AM CT); no pixel is edited.
export const FOCUS = {
  "elijah-ball": [0.49, 0.21, 2], "erwin-tam": [0.59, 0.27, 2], "laurance-lee": [0.34, 0.33, 2.6], "virginia-cheung": [0.26, 0.3, 1.6],
  "chris-gober": [0.51, 0.33, 2.6], "bo-french": [0.3, 0.18, 2], "kai-huang": [0.47, 0.35, 1.3],
  "john-messinger": [0.36, 0.37, 2.2], "benjamin-flores": [0.51, 0.43, 3], "jessica-martinez": [0.5, 0.45, 4], "mike-trouble-lin": [0.61, 0.38, 1.4],
  // Civic qa_fixes7 cropNote (Hilton and Hinojosa now ship Civic's own head-and-shoulders localFiles, so no focus):
  // Becerra framed to mid-chest -> head and shoulders; Abbott -> tighter so the person behind him at top right drops out.
  // Simulated in PIL and viewed (2:50 AM CT).
  "xavier-becerra": [0.5, 0.3, 1.3], "greg-abbott": [0.5, 0.3, 1.15],
  // qa_fixes6: Meyer file is already cut above the banner (CROP); keep the top of the head in the square tile.
  "marc-m-meyer": [0.45, 0.3, 1.1],
  // Civic tx_courts_changes (1:20 AM): two-person campaign photo; zoom on Justice Field (right, in the robe). Simulated and viewed.
  "scott-k-field": [0.66, 0.081, 3.4],
  // Tall portrait with flags: head and shoulders in the square tile (simulated and viewed).
  "tom-baker": [0.5, 0.32, 1.8],
  // Civic qa_fixes8: transparent cutout at a podium, mic at lower left. Head and shoulders, mic out of frame; the tile's
  // light (black/5 on white) background shows through the transparent area. Rendered in Chrome and viewed (4:05 AM CT).
  "letitia-a-james": [0.5, 0.15, 1.3],
  // Civic QA9 (photo_gaps9.md): Hochul's campaign-site street photo (kha.jpg, 800x800) replaces the MTA agency photo.
  // Crowd shot: head and shoulders on her, the sign at left and the people beside her out of frame. Simulated and viewed (4:20 AM CT).
  "kathy-c-hochul-adrienne-e-adams": [0.62, 0.32, 2.2],
  // Civic qa10 cropNotes (photo_fixes10.md), baked into the square files (Design p14) and viewed by eye (4:55 AM CT):
  // Buckingham's campaign hero is a wide ranch shot (hat, bison): tight head and shoulders. Fisher's 300x200 campaign
  // photo stands beside her lawn sign: head and shoulders on the left, the sign out of frame.
  "dawn-buckingham": [0.513, 0.22, 2.4], "alida-fisher": [0.195, 0.02, 1.67],
};
// Older face crops on licensed event photos: [left, top, width, height] as fractions of the source (pixels cut, not edited).
const CROP = {
  // michael-e-gates: crop retired (qa_fixes7 ships his campaign headshot as a localFile).
  // Civic cropNote (qa_fixes6): campaign graphic; keep head and shoulders above the "MARC MEYER (D)" banner (starts ~80% down),
  // so no party label ships in the file. Viewed by eye.
  "marc-m-meyer": [0.1, 0, 0.8, 0.75],
};
// Engineering's saved copy of a campaign-site photo whose host answers hotlinks with a bot challenge (202 sgcaptcha),
// so visitors' browsers would never get the image. Same source and credit as Civic's photoUrl; self-hosted like a localFile.
// Engineering copies of own campaign photos whose host is unreliable. hkt.texasjudges.com answers about half of requests
// with a 210-byte HTTP 202 text/html (Design p13 #1), which blanked TX Supreme Court Places 2 and 7. Fetched 4 AM CT
// Oct 30 from Civic's photoUrl; checked against the txcourts.gov portraits under rule 2 (Kelly: different photo, dHash
// distance 39 of 64 from txcourts kelly-1.jpg; Hawkins is a district judge with no txcourts portrait).
const LOCAL = {
  "tom-baker": "data/photo-local/tom-baker.png",
  "chari-kelly": "data/photo-local/chari-kelly.jpg",
  "kristen-hawkins": "data/photo-local/kristen-hawkins.jpg",
};
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36" };
const OFFLINE = process.argv.includes("--offline");
const CACHE = ".portrait-src";
fs.mkdirSync(CACHE, { recursive: true });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const out = {}; const mates = {}; const failed = []; const excluded = []; const manifest = {};
const incomplete = new Set();
const sameAsCourt = [];
// Download with retries for rate limits and bot challenges (429, 202, 5xx); a 404 or a non-image answer fails.
async function download(url) {
  let r, ct = "";
  for (let i = 0; i < 4; i++) {
    r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) }).catch((e) => ({ ok: false, status: String(e.name || e), headers: new Headers() }));
    ct = r.headers.get("content-type") ?? "";
    if (r.ok && /^image\//.test(ct)) return Buffer.from(await r.arrayBuffer());
    if (typeof r.status === "number" && ![202, 429].includes(r.status) && r.status < 500) break;
    await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
  }
  throw new Error(`HTTP ${r.status} ${ct}`);
}
async function source(id, p) {
  if (!p.localFile && LOCAL[id]) p.localFile = LOCAL[id];
  if (p.localFile && fs.existsSync(p.localFile)) return { buf: fs.readFileSync(p.localFile), from: p.localFile };
  if (!/^https:\/\//.test(p.photoUrl ?? "")) throw new Error("no https photoUrl");
  const cached = `${CACHE}/${id}`;
  if (OFFLINE && fs.existsSync(cached)) return { buf: fs.readFileSync(cached), from: p.photoUrl };
  const buf = await download(p.photoUrl); fs.writeFileSync(cached, buf); return { buf, from: p.photoUrl };
}
// Rule 2 at ingest: fetch the court portrait only to compare (never stored or shipped).
async function sameImage(p, mine) {
  try {
    const r = await fetch(p.txcourtsPortrait.image, { headers: UA }); if (!r.ok) return false;
    return hamming(await dhash(mine), await dhash(Buffer.from(await r.arrayBuffer()))) <= 6;
  } catch { return false; }
}
/** The square a tile showed under CSS object-cover + object-position (x, y) + scale(s) about (x, y): baked into pixels. */
export function squareFor(w, h, [x, y, s] = [0.5, 0.2, 1]) {
  const side = Math.min(w, h), left = x * (w - side), top = y * (h - side);
  const inner = side / s;
  return { left: Math.round(left + x * (side - inner)), top: Math.round(top + y * (side - inner)), width: Math.max(1, Math.round(inner)), height: Math.max(1, Math.round(inner)) };
}
export const SIZES = [112, 160];
async function build(id, p) {
  if (/photo ages not comparable/i.test(p.raceNote ?? "") && p.raceId) incomplete.add(p.raceId);
  if (!p.photoUrl && !p.localFile && !LOCAL[id]) return;
  if (EXCLUDE(id, p)) { excluded.push(id); return; }
  const isLocal = !!(p.localFile || LOCAL[id]);
  if (!isLocal && !isLicensed(p) && !(isOwnSource(p) && p.pageUrl)) { failed.push(`${id}: not licensed and not the candidate's own campaign/official/social photo`); return; }
  let src;
  try { src = await source(id, p); } catch (e) { failed.push(`${id}: ${String(e.message ?? e)} (${p.photoUrl})`); return; }
  if (p.txcourtsPortrait?.image && await sameImage(p, src.buf)) { excluded.push(id); sameAsCourt.push(id); return; }
  let img = sharp(src.buf).rotate(); const meta = await sharp(src.buf).rotate().metadata();
  let W = meta.autoOrient?.width ?? meta.width, H = meta.autoOrient?.height ?? meta.height;
  if (CROP[id]) { const [l, t, w, h] = CROP[id]; const e = { left: Math.round(l * W), top: Math.round(t * H), width: Math.round(w * W), height: Math.round(h * H) }; img = sharp(await img.extract(e).toBuffer()); W = e.width; H = e.height; }
  const sq = squareFor(W, H, FOCUS[id]);
  const base = await img.extract(sq).flatten({ background: "#f2f2f2" }).toBuffer();
  const files = {};
  for (const n of SIZES) {
    const f = `/portraits/${id}-${n}.webp`;
    const b = await sharp(base).resize(n, n, { fit: "cover" }).webp({ quality: 70, effort: 6 }).toBuffer();
    fs.writeFileSync(`public${f}`, b); files[n] = { file: f, bytes: b.length, sha256: sha(b) };
  }
  manifest[id] = { sourceUrl: p.photoUrl ?? null, localFile: p.localFile ?? null, page: p.pageUrl ?? null, sourceSha256: sha(src.buf), sourceBytes: src.buf.length, sourceSize: [W, H], crop: sq, focus: FOCUS[id] ?? [0.5, 0.2, 1], files };
  const v = { name: id, file: files[160].file, file112: files[112].file, sourceUrl: p.photoUrl ?? null, credit: credit(p), license: p.license ?? null, page: p.pageUrl ?? null, via: p.sourceType ?? null, width: W, height: H, ...focusOf(id) };
  if (p.role === "running mate" && p.ticketId) { mates[p.ticketId] = { ...v, kind: "self", mateName: p.name }; return; }
  out[id] = v;
}
const focusOf = (id) => (FOCUS[id] ? { focus: FOCUS[id] } : {});
const entries = Object.entries(batch).filter(([id, p]) => !id.startsWith("_") && p);
for (let i = 0; i < entries.length; i += 8) await Promise.all(entries.slice(i, i + 8).map(([id, p]) => build(id, p)));
const keep = new Set([...Object.values(out), ...Object.values(mates)].flatMap((o) => [o.file, o.file112]).map((f) => f.replace("/portraits/", "")));
let removed = 0;
for (const f of fs.readdirSync("public/portraits")) if (!keep.has(f)) { fs.unlinkSync(`public/portraits/${f}`); removed++; }
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const photos = {
  asOf: "2026-10-30",
  method: "Civic data/civic/photos_batch.json (headshot pass, Oct 30 12:40 AM CT; qa10 4:34 AM CT). Design p14: every portrait (Civic's saved local copies, licensed photos and candidates' own public campaign, official or social-profile headshots) is downloaded at build time and self-hosted as 112px and 160px square webp, cropped at the per-photo focus or 50% 20%; each is credited and linked to its source page. No news, media or agency photos; never generated.",
  photos: {}, selfHosted: sorted(out), hotlinked: {}, runningMates: sorted(mates), incompleteRaces: [...incomplete].sort(),
  selfHostedNote: "Built by scripts/ingest-photos.mjs from data/civic/photos_batch.json; sources and sha256 in data/portraits-manifest.json. Cropped and resized only. Never generated.",
  leftOut: failed.sort(), excluded: excluded.sort(), sameAsCourtPortrait: sameAsCourt.sort(),
};
fs.writeFileSync("data/photos.json", JSON.stringify(photos, null, 1) + "\n");
fs.writeFileSync("data/portraits-manifest.json", JSON.stringify({ builtBy: "scripts/ingest-photos.mjs", sizes: SIZES, portraits: sorted(manifest) }, null, 1) + "\n");
console.log(`self-hosted ${Object.keys(out).length}, running mates ${Object.keys(mates).length}, incomplete races ${incomplete.size}, excluded ${excluded.length}, left out ${failed.length}, removed old files ${removed}`);
for (const f of failed) console.log("  left out:", f);
for (const f of excluded) console.log("  excluded:", f);
