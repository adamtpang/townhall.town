// Photo exclusion rules used by scripts/ingest-photos.mjs. Pure functions so tests can import them.
import sharp from "sharp";
// Never shown, even with a URL: txcourts.gov judge portraits (no reuse terms), the Alida Fisher video still (not a portrait).
// Civic qa_fixes8 rule 3: radio and TV station credits are media photos, even with an open Commons license. A credit
// that is a bare US call sign (WBLS, KXAN-TV) or names a radio/TV station or broadcaster is excluded like news.
export const isMediaCredit = (p) => {
  const c = String(p.attribution ?? "").replace(/^photo:\s*/i, "").trim();
  return /^[KW][A-Z]{2,3}(?:[- ](?:AM|FM|TV|DT|LP|HD\d?))?$/.test(c) ||
    /\b(radio|television|tv)\b|\bbroadcast(?:er|ing)?\b|\b[KW][A-Z]{2,3}-(?:AM|FM|TV|DT)\b/i.test(`${c} ${p.sourceType ?? ""}`);
};
// Civic qa_fixes8 rule 2: a campaign or social photo that is the same image as the candidate's txcourts.gov portrait
// counts as the court portrait. Same file name as Civic's recorded txcourtsPortrait.image, or (checked at ingest) the
// same picture by a 64-bit difference hash; see sameImage below.
const base = (u) => String(u ?? "").split("?")[0].split("/").pop().toLowerCase();
export const sameFileAsCourtPortrait = (p) => !!p.txcourtsPortrait?.image && !!p.photoUrl && base(p.photoUrl) === base(p.txcourtsPortrait.image);
export const EXCLUDE = (id, p) =>
  /txcourts\.gov/i.test(`${p.photoUrl ?? ""} ${p.pageUrl ?? ""}`) /* image or its page, not notes that mention a search */ || id === "alida-fisher" ||
  /news|press agency|getty|associated press|\bAP\b|reuters/i.test(String(p.sourceType ?? "")) || // never news photos (Adam 12:16 AM)
  isMediaCredit(p) || sameFileAsCourtPortrait(p);
/** 9x8 grayscale difference hash; two images whose hashes differ in at most 6 of 64 bits are the same picture. */
export async function dhash(buf) {
  const px = await sharp(buf).flatten({ background: "#fff" }).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let h = 0n; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) h = (h << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
  return h;
}
export const hamming = (a, b) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
