"use client";
import { useEffect, useRef, useState } from "react";
import type { Photo } from "./Portrait";

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

function Tile({ c, eager, label, mate }: { c: C; eager?: boolean; label: string; mate: string | null }) {
  const [broken, setBroken] = useState(false);
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
    <li className="min-w-[28px]" style={{ flex: "0 1 var(--p)", width: "var(--p)" }} data-photo-tile data-photo-state={show ? "img" : "initials"}>
      <div className="relative aspect-square w-full overflow-hidden bg-black/5">
        {/* Initials always sit underneath, so a slow, lazy or failed image never leaves a blank tile. */}
        <span role={show ? undefined : "img"} aria-hidden={show ? true : undefined} aria-label={show ? undefined : `Photo not available: ${c.name}`}
          className="absolute inset-0 flex items-center justify-center font-sans text-sm font-[530] leading-none text-black/60 lg:text-base">{initials(c.name)}</span>
        {show ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={ref} src={c.photo!.url} alt={split(c.name).lead} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : null}
      </div>
      <p className="mt-1 w-[calc(var(--p)+8px)] truncate text-xs font-[530] leading-4" title={c.name} aria-label={c.name} data-tile-label>{label}</p>
      {mate ? <p className="truncate text-xs leading-4 text-black/60" title={`Running mate: ${split(c.name).mate}`} aria-hidden data-tile-mate>w/ {mate}</p> : null}
    </li>
  );
}

/** Design portrait spec v2: one flex row, never wraps, never scrolls, ballot order, identical square tiles
 *  (56px at 1024+, 48px at 768-1023, 40px below). Broken or missing photos fall back to a same-size initials tile (Adam's rule). */
export function CandidatePortraitRow({ cands, size = "row", eager = false }: { cands: C[]; size?: "row" | "mini"; eager?: boolean }) {
  if (!cands.length) return null;
  const vars = size === "mini" ? "[--p:24px] md:[--p:32px]" : "[--p:40px] md:[--p:48px] lg:[--p:56px]";
  return (
    <>
    <ul role="list" aria-label="Candidates in ballot order" className={`my-3 flex flex-nowrap gap-2 overflow-hidden md:gap-3 ${vars}`} data-photo-row>
      {(() => { const L = labels(cands.map((c) => c.name)); return cands.map((c, i) => <Tile key={c.name} c={c} eager={eager} label={L[i].label} mate={L[i].mate} />); })()}
    </ul>
    {size === "row" && cands.some((c) => c.photo?.url) ? (
      <details className="-mt-1 mb-2 text-xs leading-4 text-black/60" data-photo-credits>
        <summary className="inline-flex min-h-11 cursor-pointer items-center">Photo credits</summary>
        <ul className="space-y-1">{cands.filter((c) => c.photo?.url).map((c) => (
          <li key={c.name}>{c.name}: {c.photo!.page ? <a href={c.photo!.page} target="_blank" rel="noreferrer" className="text-[#3760F2]">{c.photo!.credit}</a> : c.photo!.credit}{c.photo!.license && !c.photo!.credit.includes(c.photo!.license) ? ` (${c.photo!.license})` : ""}</li>
        ))}</ul>
      </details>
    ) : null}
    </>
  );
}
export const PortraitRow = CandidatePortraitRow;
