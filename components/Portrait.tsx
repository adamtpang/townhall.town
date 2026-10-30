"use client";
import { initials as initialsOf } from "./PortraitRow";
import { useState } from "react";
import { cn } from "../lib/utils";

export type Photo = { url: string; credit: string; license?: string; page?: string } | null | undefined;

/** Licensed or Ballotpedia portrait with its credit. Falls back to initials; never a generated image. */
export function Portrait({ name, photo, className, boxClassName, credit = true, forceInitials = false, onFail }: { name: string; photo: Photo; className?: string; boxClassName?: string; credit?: boolean; forceInitials?: boolean; onFail?: () => void }) {
  const [broken, setBroken] = useState(false);
  const initials = initialsOf(name);
  const show = photo?.url && !broken && !forceInitials;
  return (
    <figure className={cn("m-0", className)}>
      <div className={cn("relative aspect-[4/5] w-full overflow-hidden bg-[#e4e4e4]", boxClassName)}>
        {show ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo!.url} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => { setBroken(true); onFail?.(); }} className="h-full w-full object-cover object-top" />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center font-sans text-5xl text-black/40">{initials}</span>
        )}
      </div>
      {credit && show ? (
        <figcaption className="mt-1 truncate text-sm text-black/60">
          {photo!.page ? <a href={photo!.page} target="_blank" rel="noreferrer" className="text-black/60">{photo!.credit}</a> : photo!.credit}
        </figcaption>
      ) : null}
    </figure>
  );
}
