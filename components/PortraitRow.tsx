"use client";
import { AvatarPlaceholder } from "./Avatar";
import { Fragment, useEffect, useRef, useState } from "react";
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

function Tile({ c, eager, label, mate, reserveMate, max, tileMax, grid, raceId, tap, onPick, picked }: { c: C; eager?: boolean; label: string; mate: string | null; reserveMate?: boolean; max: string; tileMax: string; grid?: boolean; raceId?: string; tap?: boolean; onPick?: (name: string, handled: boolean) => void; picked?: boolean }) {
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
    <li className={`flex min-w-0 flex-col ${max}`} style={grid ? undefined : { flex: "1 1 0" }} data-photo-tile data-photo-state={show ? "img" : "placeholder"}>
      <div className={`relative mx-auto aspect-square w-full overflow-hidden bg-black/5 ${tileMax}`}>
        {/* The placeholder always sits underneath, so a slow, lazy or failed image never leaves a blank tile. */}
        {show ? null : <AvatarPlaceholder />}
        {show ? (
          <TileImage imgRef={ref} photo={c.photo!} alt={split(c.name).lead} eager={eager} sizes={grid ? ROW_SIZES : undefined} onFail={() => setBroken(true)} />
        ) : null}
        {/* Crowded rows (over 8): names are hidden, so the tile itself is the control: its aria-label is the name and a tap
            opens that candidate in "Who lines up" (components/WhoRaces.tsx listens for OPEN_CANDIDATE). */}
        {tap && raceId ? (
          <button type="button" aria-label={c.name} title={c.name} data-tile-open className="absolute inset-0 h-full w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            onClick={() => { const handled = !window.dispatchEvent(new CustomEvent(OPEN_CANDIDATE, { detail: { raceId, name: c.name }, cancelable: true })); onPick?.(c.name, handled); }} aria-pressed={picked ? true : undefined} />
        ) : null}
      </div>
      <p className={`mt-1 w-full flex-1 text-center group-data-[dense=true]/row:max-md:sr-only group-data-[densedesk=true]/row:md:sr-only ${NOBREAK} line-clamp-3 text-sm font-[530] leading-5`} title={c.name} aria-label={c.name} data-tile-label><Words text={label} /></p>
      {mate ? <p className={`w-full ${NOBREAK} line-clamp-2 text-center text-sm leading-5 group-data-[dense=true]/row:max-md:sr-only group-data-[densedesk=true]/row:md:sr-only text-black/60`} title={`Running mate: ${split(c.name).mate}`} aria-hidden data-tile-mate><Words text={`w/ ${mate}`} /></p> : reserveMate ? <p aria-hidden className="h-5 group-data-[dense=true]/row:max-md:hidden group-data-[densedesk=true]/row:md:hidden" data-tile-mate-spacer /> : null}
    </li>
  );
}

/** Design portrait spec v2 (+ design p8: names one line, truncated with an ellipsis, full name in title/aria-label; every tile the same height): one flex row, never wraps, never scrolls, ballot order, identical square tiles
 *  (56px at 1024+, 48px at 768-1023, 40px below). Broken or missing photos fall back to a same-size initials tile (Adam's rule). */
/** splitCredits (race list): the caller wraps the race in <PhotoGroup> and shows the phone credits disclosure itself
 *  (Portrait PhoneCredits), so this row skips its own group and shows the credit line from sm only. */
export function CandidatePortraitRow({ cands, size = "row", eager = false, raceId, splitCredits = false }: { cands: C[]; size?: "row" | "mini"; eager?: boolean; raceId?: string; splitCredits?: boolean }) {
  if (!cands.length) return null;
  // Design p9 (<768): each item 56px wide (label w-14) with a centered 40px tile and gap-2, so 5 items fit 342px;
  // rows with more than 5 items fall back to 44px items. From 768 up the item is the tile (48 / 56px), gap-3.
  // Design p10 P0: every item flex 1 1 0 with min-width 0 and a max width (40 / 48 / 56px), so any number of candidates
  // shares one row in equal tiles: never wraps, never hides or clips a candidate. Over 6 candidates under 768px the
  // visible label goes sr-only (the name stays in aria-label/title and on the card).
  // Design p11 #1: the item (label width) is separate from the tile. Item max 56px (64px at 1024+); tile max 40px
  // (48px at 768+, 56px at 1024+), centred; label full item width, centred, truncated.
  // Design big photos (Adam 1:11 PM Oct 30: bigger): row size is a CSS grid, one column per candidate,
  // repeat(n, minmax(0, var(--tile-max))) with justify-content start, so every candidate shares one line in equal
  // square tiles that shrink to fit (never wrap, never scroll). --tile-max 72px / gap 8px below 768, 88px / 12px at
  // md, 112px / 16px at lg. The item is the tile; the 14px label (never 12px) is the tile's width, centred. Placeholders
  // fill the same square. Over 6 candidates under 768px, or over 8 from 768 up, the label goes sr-only.
  const grid = size === "row";
  const max = grid ? "" : "max-w-[24px] md:max-w-[32px]";
  const tileMax = "";
  const dense = grid && cands.length > 6;
  const denseDesk = grid && cands.length > 8;
  const n = cands.length;
  // Design 1:54 PM Oct 30 (crowded rows): over 8 candidates, phones use gap-1 (4px) and the tiles flex down to fit, so
  // an 11-candidate row is ~27px tiles at 390 (11 x 27 + 10 x 4 = 337 <= 342). Every candidate stays visible at equal
  // size on one row: no wrap, no sideways scroll. Rows of 8 or fewer keep gap-2. md/lg gaps are unchanged.
  const crowded = grid && n > 8;
  // A race that "Who lines up" doesn't list (court races) has nowhere to open, so the tap shows that candidate's full name
  // under the row instead (the hidden label, made visible); a second tap on the same tile hides it.
  const [picked, setPicked] = useState<string | null>(null);
  const onPick = (name: string, handled: boolean) => setPicked((cur) => (handled || cur === name ? null : name));
  // Design 2:10 PM Oct 30 (narrow phones): below 360px every row over 6 candidates also uses gap-1 (an 8-candidate row is
  // ~30.5px tiles at 320). Still one row, equal tiles, every candidate visible, no sideways scroll. 360px and up unchanged.
  const narrowTight = grid && n > 6 && !crowded;
  const rowClass = `group/row my-3 grid justify-start ${crowded ? "gap-1" : narrowTight ? "gap-2 max-[359px]:gap-1" : "gap-2"} [--tile-max:120px] md:gap-3 md:[--tile-max:140px] lg:gap-4 lg:[--tile-max:160px]`;
  const Wrap = splitCredits ? Fragment : PhotoGroup;
  return (
    <Wrap>
    <ul role="list" aria-label="Candidates" className={grid ? rowClass : "group/row my-3 flex flex-nowrap gap-2 md:gap-3"} style={grid ? { gridTemplateColumns: `repeat(${n}, minmax(0, var(--tile-max)))` } : undefined} data-dense={dense ? "true" : "false"} data-crowded={crowded ? "true" : "false"} data-densedesk={denseDesk ? "true" : "false"} data-photo-row>
      {(() => { const L = labels(cands.map((c) => c.name)); const anyMate = L.some((x) => x.mate); return cands.map((c, i) => <Tile key={c.name} c={c} eager={eager} grid={grid} max={max} tileMax={tileMax} label={L[i].label} mate={L[i].mate} reserveMate={anyMate} raceId={raceId} tap={crowded} onPick={onPick} picked={picked === c.name} />); })()}
    </ul>
    {crowded ? <p className={`${picked ? "-mt-1 mb-2" : ""} text-sm font-[530] leading-5 text-black`} aria-live="polite" data-tile-picked>{picked ?? ""}</p> : null}
    {size === "row" ? (splitCredits ? <div className="hidden sm:block" data-credits-sm><RowCredits cands={cands} /></div> : <RowCredits cands={cands} />) : null}
    </Wrap>
  );
}
export const PortraitRow = CandidatePortraitRow;
/** Window event a crowded-row tile fires to open that candidate in "Who lines up": detail { raceId, name }. */
export const OPEN_CANDIDATE = "townhall:open-candidate";
/** Image sizes for row tiles (matches --tile-max). Design 2:58 PM CT (Oct 30): 120px under 768, 140px to 1023, 160px from 1024. */
export const ROW_SIZES = "(max-width: 767px) 120px, (max-width: 1023px) 140px, 160px";

/** Design p12 #1: one credit line per race under the row (shared with Who and the ballot card). Credits follow the
 *  fallback: a race (or, in candidate mode, a candidate) that reverted to initials drops its credit. */
function RowCredits({ cands }: { cands: C[] }) {
  const L = labels(cands.map((c) => c.name));
  return <div className="-mt-1 mb-2"><RaceCredits cands={cands} label={(n) => L[cands.findIndex((c) => c.name === n)].label} /></div>;
}
