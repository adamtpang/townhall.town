"use client";
import { useState } from "react";
import { cn } from "../lib/utils";

export type Photo = { url: string; credit: string; license?: string; page?: string } | null | undefined;

/** Licensed or Ballotpedia portrait with its credit. Falls back to initials; never a generated image. */
export function Portrait({ name, photo, className, credit = true }: { name: string; photo: Photo; className?: string; credit?: boolean }) {
  const [broken, setBroken] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const show = photo?.url && !broken;
  return (
    <figure className={cn("m-0", className)}>
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#e4e4e4]">
        {show ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo!.url} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover object-top" />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center font-serif text-5xl text-black/40">{initials}</span>
        )}
      </div>
      {credit && show ? (
        <figcaption className="mt-1 truncate text-xs text-black/60">
          {photo!.page ? <a href={photo!.page} target="_blank" rel="noreferrer" className="text-black/60">{photo!.credit}</a> : photo!.credit}
        </figcaption>
      ) : null}
    </figure>
  );
}
