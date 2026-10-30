"use client";
import { AvatarPlaceholder } from "./Avatar";
import { useEffect, useRef, useState } from "react";
import { RaceCredits, PhotoGroup, TileImage, usePhotoFallback, usePhotoOff, type Photo } from "./Portrait";

type C = { name: string; party?: string | null; photo?: Photo };

const SUFFIX = /^(Jr\.?|Sr\.?|II|III|IV)$/i;
/** Ticket names like "Kathy C. Hochul / Adrienne E. Adams": the tile is the first name on the ticket; the rest is the running mate. */
const split = (n: string) => { const [lead, ...mate] = n.split(/\s+\/\s+/); return { lead: lead.trim(), mate: mate.join(" / ").trim() || null }; };
// Drop quoted nicknames, punctuation and suffixes so initials are always two letters (first + last name).
const words = (n: string) => n.replace(/[\u201C\u201D"][^\u201C\u201D"]*[\u201C\u201D"]/g, " ").split(/\s+/).map((w) => w.replace(/[^\p{L}\p{M}'-]/gu, "")).filter((w) => w && !SUFFIX.test(w) && /\p{L}/u.test(w));
export const initials = (n: string) => { const w = words(split(n).lead); return w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase() : "?"; };
export const surname = (n: string) => { const w = words(split(n).lead); return w[w.length - 1] || split(n).lead; };
/** Tile labels: surname, or first + surname when two candidates in the race share a surname. */
export function labels(names: string[]) {
  const sn = names.map(surname);
  return names.map((n, i) => {
    const w = words(split(n).lead);
    const collide = sn.filter((x) => x.toLowerCase() === sn[i].toLowerCase()).length > 1;
    return { label: collide && w.length > 1 ? `${w[0]} ${sn[i]}` : sn[i], mate: split(n).mate ? surname(split(n).mate!) : null };
  });
}

/** QA 94cf301 (Oct 30, 6:53 AM CT; replaces round 0334's ellipsis): tile names wrap, never truncate. Lines break at
 *  spaces first, then after a hyphen ("Echavarria-" / "Garza"), and only a single word still wider than the tile breaks
 *  inside the word (overflow-wrap:anywhere). No ellipsis; the full name stays in title/aria-label. Up to 3 lines. */
const NOBREAK = "[overflow-wrap:anywhere] [word-break:normal] hyphens-none";
function Words({ text }: { text: string }) {
  return <>{text.split(/\s+/).filter(Boolean).map((w, i) => <span key={i}>{i ? " " : ""}<span data-word>{w}</span></span>)}</>;
}

function Tile({ c, eager, label, mate, reserveMate, max, tileMax }: { c: C; eager?: boolean; label: string; mate: string | null; reserveMate?: boolean; max: string; tileMax: string }) {
  const [broken, fail] = usePhotoFallback(c.name);
  const setBroken = (_: boolean) => fail();
  const ref = useRef<HTMLImageElement>(null);
  // onError can fire before hydration attaches the handler; re-check once mounted.
  // A lazy image that hasn't started can also report complete with width 0, so probe the URL instead of trusting that.
  useEffect(() => {
    const i = ref.current; if (!i || !(i.complete && i.naturalWidth === 0) || !c.photo?.url) return;
    let live = true; const probe = new Image(); probe.onerror = () => { if (live) setBroken(true); }; probe.src = c.photo.url;
    return () => { live = false; };
  }, [c.photo?.url]);
  const show = !!c.photo?.url && !broken;
  return (
    <li className={`flex min-w-0 flex-col ${max}`} style={{ flex: "1 1 0" }} data-photo-tile data-photo-state={show ? "img" : "placeholder"}>
      <div className={`relative mx-auto aspect-square w-full overflow-hidden bg-black/5 ${tileMax}`}>
        {/* The placeholder always sits underneath, so a slow, lazy or failed image never leaves a blank tile. */}
        {show ? null : <AvatarPlaceholder />}
        {show ? (
          <TileImage imgRef={ref} photo={c.photo!} alt={split(c.name).lead} eager={eager} onFail={() => setBroken(true)} />
        ) : null}
      </div>
      <p className={`mt-1 w-full flex-1 text-center group-data-[dense=true]/row:max-md:sr-only ${NOBREAK} line-clamp-3 text-sm font-[530] leading-5`} title={c.name} aria-label={c.name} data-tile-label><Words text={label} /></p>
      {mate ? <p className={`w-full ${NOBREAK} line-clamp-2 text-center text-sm leading-5 group-data-[dense=true]/row:max-md:sr-only text-black/60`} title={`Running mate: ${split(c.name).mate}`} aria-hidden data-tile-mate><Words text={`w/ ${mate}`} /></p> : reserveMate ? <p aria-hidden className="h-5 group-data-[dense=true]/row:max-md:hidden" data-tile-mate-spacer /> : null}
    </li>
  );
}

/** Design portrait spec v2 (+ design p8: names one line, truncated with an ellipsis, full name in title/aria-label; every tile the same height): one flex row, never wraps, never scrolls, ballot order, identical square tiles
 *  (56px at 1024+, 48px at 768-1023, 40px below). Broken or missing photos fall back to a same-size initials tile (Adam's rule). */
export function CandidatePortraitRow({ cands, size = "row", eager = false, credits = true }: { cands: C[]; size?: "row" | "mini"; eager?: boolean; credits?: boolean }) {
  if (!cands.length) return null;
  // Design p9 (<768): each item 56px wide (label w-14) with a centered 40px tile and gap-2, so 5 items fit 342px;
  // rows with more than 5 items fall back to 44px items. From 768 up the item is the tile (48 / 56px), gap-3.
  // Design p10 P0: every item flex 1 1 0 with min-width 0 and a max width (40 / 48 / 56px), so any number of candidates
  // shares one row in equal tiles: never wraps, never hides or clips a candidate. Over 6 candidates under 768px the
  // visible label goes sr-only (the name stays in aria-label/title and on the card).
  // Design p11 #1: the item (label width) is separate from the tile. Item max 56px (64px at 1024+); tile max 40px
  // (48px at 768+, 56px at 1024+), centred; label full item width, centred, truncated.
  // Adam 2:58 PM CT "images should be bigger" + Design grid spec #4: the tile is the item, flex 1 1 0, square, max 120px
  // on phones and 160px from 1024 up; still one row, never wraps, never scrolls.
  const max = size === "mini" ? "max-w-[24px] md:max-w-[32px]" : "max-w-[120px] lg:max-w-[160px]";
  const tileMax = size === "mini" ? "" : "max-w-[120px] lg:max-w-[160px]";
  // Design 3:07 PM CT (Oct 30) P1: a ticket (governor + running mate) is two full tiles, never two half photos in one.
  const tiles: C[] = size === "mini" ? cands : cands.flatMap((c) => {
    const mate = c.photo?.mate;
    if (!mate || !c.photo) return [c];
    const { mate: _m, ...lead } = c.photo;
    return [{ name: split(c.name).lead, party: c.party, photo: lead }, { name: mate.name, party: c.party, photo: mate }];
  });
  const dense = size === "row" && tiles.length > 6;
  return (
    <PhotoGroup>
    <ul role="list" aria-label="Candidates" className="group/row my-3 flex flex-nowrap gap-2 md:gap-3" data-dense={dense ? "true" : "false"} data-photo-row>
      {(() => { const L = labels(tiles.map((c) => c.name)); const anyMate = L.some((x) => x.mate); return tiles.map((c, i) => <Tile key={c.name} c={c} eager={eager} max={max} tileMax={tileMax} label={L[i].label} mate={L[i].mate} reserveMate={anyMate} />); })()}
    </ul>
    {size === "row" && credits ? <RowCredits cands={cands} /> : null}{/* credits={false}: the race folder shows them in its own "Photo credits (N)" item. */}
    </PhotoGroup>
  );
}
export const PortraitRow = CandidatePortraitRow;

/** Design p12 #1: one credit line per race under the row (shared with Who and the ballot card). Credits follow the
 *  fallback: a race (or, in candidate mode, a candidate) that reverted to initials drops its credit. */
export function RowCredits({ cands }: { cands: C[] }) {
  const L = labels(cands.map((c) => c.name));
  return <div className="-mt-1 mb-2"><RaceCredits cands={cands} label={(n) => L[cands.findIndex((c) => c.name === n)].label} /></div>;
}
