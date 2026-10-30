// Adam 1:11 PM CT Oct 30 (bigger photos): re-export the existing self-hosted portraits as 256px square webp (q75) from
// the same originals, offline. Each original is verified against data/portraits-manifest.json sourceSha256 and cut with
// the recorded precrop + crop, so the 256 file shows exactly the pixels of the 112/160 files. No new photos are fetched.
// Originals: the candidate's localFile, else .portrait-src/<id> (git-ignored ingest cache; pass other cache dirs as args).
// Crops narrower than 256px are not upscaled: those keep 112/160 only.
import fs from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
const dirs = [".portrait-src", ...process.argv.slice(2)];
const sha = (b) => createHash("sha256").update(b).digest("hex");
const M = JSON.parse(fs.readFileSync("data/portraits-manifest.json", "utf8"));
const P = JSON.parse(fs.readFileSync("data/photos.json", "utf8"));
let made = 0, small = 0; const missing = [];
for (const [id, v] of Object.entries(M.portraits)) {
  const cand = [v.localFile, ...dirs.map((d) => `${d}/${id}`)].filter((f) => f && fs.existsSync(f));
  const buf = cand.map((f) => fs.readFileSync(f)).find((b) => sha(b) === v.sourceSha256);
  if (!buf) { missing.push(id); continue; }
  const f = `/portraits/${id}-256.webp`;
  if (v.crop.width < 256) { small++; delete v.files[256]; if (fs.existsSync(`public${f}`)) fs.unlinkSync(`public${f}`); continue; }
  let img = sharp(buf).rotate();
  if (v.precrop) img = sharp(await img.extract(v.precrop).toBuffer());
  const base = await img.extract(v.crop).flatten({ background: "#f2f2f2" }).toBuffer();
  const b = await sharp(base).resize(256, 256, { fit: "cover" }).webp({ quality: 75, effort: 6 }).toBuffer();
  fs.writeFileSync(`public${f}`, b); v.files[256] = { file: f, bytes: b.length, sha256: sha(b) }; made++;
}
M.sizes = [112, 160, 256];
for (const o of [...Object.values(P.selfHosted), ...Object.values(P.runningMates)]) {
  const id = o.file.replace(/^\/portraits\//, "").replace(/-160\.webp$/, "");
  const m = M.portraits[id];
  if (m?.files[256]) o.file256 = m.files[256].file; else delete o.file256;
}
fs.writeFileSync("data/photos.json", JSON.stringify(P, null, 1) + "\n");
fs.writeFileSync("data/portraits-manifest.json", JSON.stringify(M, null, 1) + "\n");
console.log(`256px: ${made} written, ${small} crops under 256px kept at 160, ${missing.length} originals missing`, missing.join(" "));
