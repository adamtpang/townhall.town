"use client";
import { useState } from "react";
import type { Photo } from "./Portrait";

type C = { name: string; party?: string | null; photo?: Photo };

const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const surname = (n: string) => n.replace(/\b(Jr\.?|Sr\.?|II|III|IV)$/i, "").trim().split(/\s+/).pop() || n;

function Tile({ c }: { c: C }) {
  const [broken, setBroken] = useState(false);
  const show = c.photo?.url && !broken;
  return (
    <li className="min-w-[28px]" style={{ flex: "0 1 var(--p)", width: "var(--p)" }} data-photo-tile>
      <div className="relative aspect-square w-full overflow-hidden bg-black/5">
        {show ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photo!.url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover object-top" />
        ) : (
          <span role="img" aria-label={`Photo not available: ${c.name}`} className="absolute inset-0 flex items-center justify-center font-serif text-[length:calc(var(--p)*0.4)] font-[530] text-black/70">{initials(c.name)}</span>
        )}
      </div>
      <p className="mt-1 line-clamp-1 text-xs font-[530] leading-4" title={c.name}>
        <span className="md:hidden">{surname(c.name)}</span>
        <span className="hidden md:inline">{c.name}</span>
      </p>
    </li>
  );
}

/** Design portrait spec v2: one flex row, never wraps, never scrolls, ballot order, identical square tiles
 *  (56px at 1024+, 48px at 768-1023, 40px below). Broken or missing photos fall back to a same-size initials tile (Adam's rule). */
export function CandidatePortraitRow({ cands, size = "row" }: { cands: C[]; size?: "row" | "mini" }) {
  if (!cands.length) return null;
  const vars = size === "mini" ? "[--p:24px] md:[--p:32px]" : "[--p:40px] md:[--p:48px] lg:[--p:56px]";
  return (
    <ul role="list" aria-label="Candidates in ballot order" className={`my-3 flex flex-nowrap gap-2 overflow-hidden md:gap-3 ${vars}`} data-photo-row>
      {cands.map((c) => <Tile key={c.name} c={c} />)}
    </ul>
  );
}
export const PortraitRow = CandidatePortraitRow;
