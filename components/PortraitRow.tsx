"use client";
import { useEffect, useRef, useState } from "react";
import type { Photo } from "./Portrait";

type C = { name: string; party?: string | null; photo?: Photo };

const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const surname = (n: string) => n.replace(/\b(Jr\.?|Sr\.?|II|III|IV)$/i, "").trim().split(/\s+/).pop() || n;

function Tile({ c, eager }: { c: C; eager?: boolean }) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // onError can fire before hydration attaches the handler; re-check once mounted.
  useEffect(() => { const i = ref.current; if (i && i.complete && i.naturalWidth === 0) setBroken(true); }, []);
  const show = !!c.photo?.url && !broken;
  const sn = surname(c.name);
  return (
    <li className="min-w-[28px]" style={{ flex: "0 1 var(--p)", width: "var(--p)" }} data-photo-tile data-photo-state={show ? "img" : "initials"}>
      <div className="relative aspect-square w-full overflow-hidden bg-black/5">
        {/* Initials always sit underneath, so a slow, lazy or failed image never leaves a blank tile. */}
        <span role={show ? undefined : "img"} aria-hidden={show ? true : undefined} aria-label={show ? undefined : `Photo not available: ${c.name}`}
          className="absolute inset-0 flex items-center justify-center font-sans text-sm font-[530] leading-none text-black/60 lg:text-base">{initials(c.name)}</span>
        {show ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={ref} src={c.photo!.url} alt="" loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : null}
      </div>
      <p className="mt-1 truncate text-xs font-[530] leading-4" title={c.name} aria-label={c.name}>{sn}</p>
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
      {cands.map((c) => <Tile key={c.name} c={c} eager={eager} />)}
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
