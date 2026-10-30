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

type Focus = [number, number, number];
type Pic = { url: string; credit: string; author?: string; attribution?: string; license?: string; licenseUrl?: string | null; page?: string; hotlinked?: boolean; focus?: Focus };
/** mate: the running mate's photo on a ticket (Civic role "running mate"), shown in the right half of the tile. */
export type Photo = (Pic & { mate?: Pic & { name: string } }) | null | undefined;

/** Civic cropNote focus -> CSS: object-position and transform-origin on the face point, scaled in. Display only. */
export const focusStyle = (f?: Focus): React.CSSProperties | undefined =>
  f ? { objectPosition: `${f[0] * 100}% ${f[1] * 100}%`, transformOrigin: `${f[0] * 100}% ${f[1] * 100}%`, transform: `scale(${f[2]})` } : undefined;

/** The tile's image(s): one photo, or a ticket's two photos side by side (lead left, running mate right).
 *  A running mate's photo that fails to load just drops out; the lead's failure is the tile's failure. */
export function TileImage({ photo, alt, eager, onFail, imgRef }: { photo: NonNullable<Photo>; alt: string; eager?: boolean; onFail: () => void; imgRef?: React.Ref<HTMLImageElement> }) {
  const [mateOff, setMateOff] = useState(false);
  const m = photo.mate && !mateOff ? photo.mate : null;
  const cls = "h-full w-full object-cover object-[center_20%]";
  return (
    <span className="absolute inset-0 flex overflow-hidden" data-photo-img>
      <span className={cn("relative h-full overflow-hidden", m ? "w-1/2" : "w-full")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={photo.url} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={onFail} className={cls} style={focusStyle(photo.focus)} data-focus={photo.focus ? "1" : undefined} />
      </span>
      {m ? (
        <span className="relative h-full w-1/2 overflow-hidden border-l border-white" data-mate-photo>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.url} alt={m.name} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setMateOff(true)} className={cls} style={focusStyle(m.focus)} />
        </span>
      ) : null}
    </span>
  );
}

/** Design p10 credit type: 12/16, weight 450, black/60, at most 60ch. The one place 12px text is allowed. */
export const CREDIT = "max-w-[60ch] text-[12px] leading-4 font-[450] text-black/60 [word-break:break-word]";
// Design p11 #2: a larger hit area on every credit link (row credits and per-candidate 'Photo:' credits).
const CLINK = "relative underline decoration-black/20 underline-offset-2 hover:text-black after:absolute after:-inset-x-3 after:-inset-y-4 after:content-['']";
/** "{author} · {license}" with the author linked to the file page and the license to its deed (no raw URLs). */
export function CreditBody({ photo }: { photo: NonNullable<Photo> }) {
  // Adam 12:16 AM CT: "Photo: {attribution}", linked to the source page (campaign, official or Commons file page).
  const one = (p: Pic) => { const author = p.attribution ?? p.credit.replace(/^Photo:\s*/i, ""); return p.page ? <a href={p.page} target="_blank" rel="noreferrer" className={CLINK} data-photo-credit>{author}</a> : <span data-photo-credit>{author}</span>; };
  return photo.mate ? <>{one(photo)} · {one(photo.mate)}</> : one(photo);
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
          <TileImage photo={photo!} alt={name} onFail={() => { setBroken(true); onFail?.(); }} />
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
