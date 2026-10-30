"use client";
import { initials as initialsOf } from "./PortraitRow";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { PHOTO_GATE } from "../lib/photoGate";
import { cn } from "../lib/utils";

/** QA 7391b20 P2: a photo that fails to load (onError) reverts the whole race to initials in race mode, and only that
 *  candidate in candidate mode. Wrap each race's rows in <PhotoGroup>; tiles, portraits and credits all read it. */
const Group = createContext<{ failed: Set<string>; fail: (n: string) => void } | null>(null);
export function PhotoGroup({ children }: { children: ReactNode }) {
  const [failed, set] = useState<Set<string>>(() => new Set());
  const fail = useCallback((n: string) => set((s) => (s.has(n) ? s : new Set(s).add(n))), []);
  return <Group.Provider value={{ failed, fail }}>{children}</Group.Provider>;
}
/** [off, fail]: off = this name must show initials because of a load failure (its own, or any in the race in race mode). */
export function usePhotoFallback(name: string): [boolean, () => void] {
  const g = useContext(Group);
  const [own, setOwn] = useState(false);
  const off = own || (!!g && (PHOTO_GATE === "race" ? g.failed.size > 0 : g.failed.has(name)));
  return [off, () => { setOwn(true); g?.fail(name); }];
}

/** For lists (credit lines): is this name reverted to initials by a load failure in its group? */
export function usePhotoOff() {
  const g = useContext(Group);
  return (name: string) => !!g && (PHOTO_GATE === "race" ? g.failed.size > 0 : g.failed.has(name));
}

export type Photo = { url: string; credit: string; author?: string; license?: string; licenseUrl?: string | null; page?: string; hotlinked?: boolean } | null | undefined;

/** Design p10 credit type: 12/16, weight 450, black/60, at most 60ch. The one place 12px text is allowed. */
export const CREDIT = "max-w-[60ch] text-[12px] leading-4 font-[450] text-black/60 [word-break:break-word]";
const CLINK = "underline decoration-black/20 underline-offset-2 hover:text-black";
/** "{author} · {license}" with the author linked to the file page and the license to its deed (no raw URLs). */
export function CreditBody({ photo }: { photo: NonNullable<Photo> }) {
  // Adam 12:16 AM CT: "Photo: {attribution}", linked to the source page (campaign, official or Commons file page).
  const author = photo.author ?? photo.credit.replace(/^Photo:\s*/i, "");
  return photo.page ? <a href={photo.page} target="_blank" rel="noreferrer" className={CLINK} data-photo-credit>{author}</a> : <span data-photo-credit>{author}</span>;
}
export function PhotoCredit({ photo, name }: { photo: NonNullable<Photo>; name: string }) {
  const [off] = usePhotoFallback(name);
  if (off) return null;
  return <p className={`mt-1 ${CREDIT}`} data-credit-line>Photo: <CreditBody photo={photo} /></p>;
}

/** Licensed or Ballotpedia portrait with its credit. Falls back to initials; never a generated image. */
export function Portrait({ name, photo, className, boxClassName, credit = true, forceInitials = false, onFail }: { name: string; photo: Photo; className?: string; boxClassName?: string; credit?: boolean; forceInitials?: boolean; onFail?: () => void }) {
  const [broken, fail] = usePhotoFallback(name);
  const setBroken = (_: boolean) => fail();
  const initials = initialsOf(name);
  const show = photo?.url && !broken && !forceInitials;
  return (
    <figure className={cn("m-0", className)}>
      <div className={cn("relative aspect-square w-full overflow-hidden bg-[#e4e4e4]", boxClassName)}>
        {show ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo!.url} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => { setBroken(true); onFail?.(); }} className="h-full w-full object-cover object-[center_20%]" />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center font-sans text-5xl text-black/40">{initials}</span>
        )}
      </div>
      {credit && show ? (
        <figcaption className={`mt-1 ${CREDIT}`}>Photo: <CreditBody photo={photo!} /></figcaption>
      ) : null}
    </figure>
  );
}
