// Civic's photo file is the portrait source of truth: node scripts/ingest-photos.mjs
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
const batch = JSON.parse(fs.readFileSync("data/civic/photos_batch.json", "utf8"));
// Never shown, even with a URL: txcourts.gov judge portraits (no reuse terms), the Alida Fisher video still (not a portrait).
export const EXCLUDE = (id, p) =>
  /txcourts\.gov/i.test(`${p.photoUrl ?? ""} ${p.pageUrl ?? ""}`) /* image or its page, not notes that mention a search */ || id === "alida-fisher" ||
  /news|press agency|getty|associated press|\bAP\b|reuters/i.test(String(p.sourceType ?? "")); // never news photos (Adam 12:16 AM)
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
const LOCAL = { "tom-baker": "data/photo-local/tom-baker.png" };
const UA = { "User-Agent": "townhall/1.0 (https://townhall.town; civic data)" };
const out = {}; const hot = {}; const mates = {}; const failed = []; const excluded = [];
const incomplete = new Set();
const focusOf = (id) => (FOCUS[id] ? { focus: FOCUS[id] } : {});
for (const [id, p] of Object.entries(batch)) {
  if (id.startsWith("_") || !p) continue;
  if (/photo ages not comparable/i.test(p.raceNote ?? "") && p.raceId) incomplete.add(p.raceId);
  if (!p.photoUrl && !p.localFile) continue;
  if (EXCLUDE(id, p)) { excluded.push(id); continue; }
  let rec = null;
  try {
    if (!p.localFile && LOCAL[id]) p.localFile = LOCAL[id];
    if (p.localFile && fs.existsSync(p.localFile)) {
      const file = `/portraits/${id}.webp`;
      let img = sharp(fs.readFileSync(p.localFile)); const meta = await img.metadata();
      if (CROP[id]) { const [l, t, w, h] = CROP[id]; img = img.extract({ left: Math.round(l * meta.width), top: Math.round(t * meta.height), width: Math.round(w * meta.width), height: Math.round(h * meta.height) }); meta.width = Math.round(w * meta.width); meta.height = Math.round(h * meta.height); } // stored size = the cropped file's, not the source's
      await img.resize({ width: 400, withoutEnlargement: true }).webp({ quality: 72 }).toFile(`public${file}`);
      rec = { kind: "self", v: { name: id, file, sourceUrl: p.photoUrl ?? null, credit: credit(p), license: p.license ?? null, page: p.pageUrl ?? null, via: p.sourceType ?? null, width: meta.width, height: meta.height, ...focusOf(id) } };
    } else if (isLicensed(p)) {
      const file = `/portraits/${id}.avif`;
      const r = await fetch(p.photoUrl, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      let img = sharp(Buffer.from(await r.arrayBuffer())); const meta = await img.metadata();
      if (CROP[id]) { const [l, t, w, h] = CROP[id]; img = img.extract({ left: Math.round(l * meta.width), top: Math.round(t * meta.height), width: Math.round(w * meta.width), height: Math.round(h * meta.height) }); meta.width = Math.round(w * meta.width); meta.height = Math.round(h * meta.height); } // stored size = the cropped file's, not the source's
      await img.resize({ width: 400, withoutEnlargement: true }).avif({ quality: 50 }).toFile(`public${file}`);
      rec = { kind: "self", v: { name: id, file, sourceUrl: p.photoUrl, credit: credit(p), license: p.license, page: p.pageUrl ?? null, via: p.sourceType ?? null, width: meta.width, height: meta.height, ...focusOf(id) } };
      await new Promise((r) => setTimeout(r, 150));
    } else if (isOwnSource(p) && /^https:\/\//.test(p.photoUrl ?? "") && p.pageUrl) {
      // Retry rate limits and bot challenges (429, 202, 5xx); a 404 or a non-image page is left out.
      let r, ct = "";
      for (let i = 0; i < 4; i++) {
        r = await fetch(p.photoUrl, { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36" } });
        ct = r.headers.get("content-type") ?? "";
        if (r.ok && /^image\//.test(ct)) break;
        if (![202, 429].includes(r.status) && r.status < 500) break;
        await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
      }
      if (!r.ok || !/^image\//.test(ct)) throw new Error(`HTTP ${r.status} ${ct}`);
      const meta = await sharp(Buffer.from(await r.arrayBuffer())).metadata().catch(() => ({}));
      rec = { kind: "hot", v: { name: id, url: p.photoUrl, credit: credit(p), page: p.pageUrl, via: p.sourceType, license: p.license ?? null, width: p.photoWidth ?? meta.width ?? null, ...focusOf(id) } };
    } else { failed.push(`${id}: not licensed and not the candidate's own campaign/official/social photo`); continue; }
  } catch (e) { failed.push(`${id}: ${String(e)}`); continue; }
  if (p.role === "running mate" && p.ticketId) { mates[p.ticketId] = { ...rec.v, kind: rec.kind, mateName: p.name }; continue; }
  (rec.kind === "self" ? out : hot)[id] = rec.v;
}
const keep = new Set([...Object.values(out), ...Object.values(mates).filter((m) => m.kind === "self")].map((o) => o.file.replace("/portraits/", "")));
let removed = 0;
for (const f of fs.readdirSync("public/portraits")) if (!keep.has(f)) { fs.unlinkSync(`public/portraits/${f}`); removed++; }
const photos = {
  asOf: "2026-10-30",
  method: "Civic data/civic/photos_batch.json (headshot pass, Oct 30 12:40 AM CT): Civic's saved local copies and licensed photos are self-hosted (resized only); candidates' own public campaign, official or social-profile headshots are hotlinked; each is credited to its source page. No news photos; never generated.",
  photos: {}, selfHosted: out, hotlinked: hot, runningMates: mates, incompleteRaces: [...incomplete].sort(),
  hotlinkedNote: "Candidates' own public headshots (not licensed for reuse): shown from their source URL, never copied, credited to the source page.",
  selfHostedNote: "Built by scripts/ingest-photos.mjs from data/civic/photos_batch.json. Resized only (Civic cropNote applied as CSS focus). Never generated.",
  leftOut: failed, excluded,
};
fs.writeFileSync("data/photos.json", JSON.stringify(photos, null, 1) + "\n");
console.log(`self-hosted ${Object.keys(out).length}, hotlinked ${Object.keys(hot).length}, running mates ${Object.keys(mates).length}, incomplete races ${incomplete.size}, excluded ${excluded.length}, left out ${failed.length}, removed old files ${removed}`);
for (const f of failed) console.log("  left out:", f);
