"use client";
import { initials as initialsOf } from "./PortraitRow";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
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
type Pic = { url: string; url112?: string; credit: string; author?: string; attribution?: string; license?: string; licenseUrl?: string | null; page?: string; hotlinked?: boolean; focus?: Focus };
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
  // Design p14: self-hosted 112/160px squares (tiles are 40-56px, so 112 covers 2x screens and 160 covers 3x), with
  // width/height set; lazy and async below the fold (eager only for the first tiers).
  const img = (p: Pic) => ({ src: p.url, ...(p.url112 ? { srcSet: `${p.url112} 112w, ${p.url} 160w`, sizes: "56px" } : {}), width: 160, height: 160, loading: (eager ? "eager" : "lazy") as "eager" | "lazy", decoding: "async" as const, referrerPolicy: "no-referrer" as const });
  return (
    <span className="absolute inset-0 flex overflow-hidden" data-photo-img>
      <span className={cn("relative h-full overflow-hidden", m ? "w-1/2" : "w-full")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} {...img(photo)} alt={alt} onError={onFail} className={cls} style={focusStyle(photo.focus)} data-focus={photo.focus ? "1" : undefined} />
      </span>
      {m ? (
        <span className="relative h-full w-1/2 overflow-hidden border-l border-white" data-mate-photo>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...img(m)} alt={m.name} onError={() => setMateOff(true)} className={cls} style={focusStyle(m.focus)} />
        </span>
      ) : null}
    </span>
  );
}

/** Design p10 credit type: 12/16, weight 450, black/60, at most 60ch. The one place 12px text is allowed. */
export const CREDIT = "max-w-[60ch] text-[12px] leading-4 font-[450] text-black/60 [word-break:break-word]";
// Design p11 #2, superseded by Design 3:34 AM CT (Oct 30): credit links reach 44px through spacing (TAP below), never a
// vertical pseudo-element. Kept identical to TAP so the per-candidate 'Photo:' credit follows the same rule.
const CLINK = "relative flex min-h-11 items-center underline decoration-black/20 underline-offset-2 hover:text-black md:inline-flex md:after:absolute md:after:inset-y-0 md:after:-inset-x-2 md:after:content-['']";
/** "{author} · {license}" with the author linked to the file page and the license to its deed (no raw URLs). */
export function CreditBody({ photo }: { photo: NonNullable<Photo> }) {
  // Adam 12:16 AM CT: "Photo: {attribution}", linked to the source page (campaign, official or Commons file page).
  const one = (p: Pic) => { const author = p.attribution ?? p.credit.replace(/^Photo:\s*/i, ""); return p.page ? <a href={p.page} target="_blank" rel="noreferrer" className={CLINK} data-photo-credit>{author}</a> : <span data-photo-credit>{author}</span>; };
  return photo.mate ? <>{one(photo)} · {one(photo.mate)}</> : one(photo);
}
/** Design p12 #1: one credit line per race, "Photos: Name · credit   Name · credit".
 *  Design 3:34 AM CT (Oct 30): every credit link is at least 44px tall through spacing, not an invisible tap area.
 *  Under 768px the credits stack one per line; each link is a 44px flex box with no after: inset, and the lines touch,
 *  so no two targets overlap. From 768px they sit inline with gap-x-6 in a 44px row; each link gets a horizontal-only
 *  tap area (after:-inset-x-2, 8px a side, under the 24px gap) and no vertical inset. A ticket's two links are 8px +
 *  the dot + 8px apart, so their tap areas don't meet either. */
const TAP = "relative flex min-h-11 items-center underline decoration-black/20 underline-offset-2 hover:text-black md:after:absolute md:after:inset-y-0 md:after:-inset-x-2 md:after:content-['']";
export function RaceCredits({ cands, label }: { cands: { name: string; photo?: Photo }[]; label: (name: string) => string }) {
  const isOff = usePhotoOff();
  const keep = cands.filter((c) => c.photo?.url && !isOff(c.name));
  if (!keep.length) return null;
  const link = (p: Pic, key: string) => { const author = p.attribution ?? p.credit.replace(/^Photo:\s*/i, ""); return p.page ? <a key={key} href={p.page} target="_blank" rel="noreferrer" className={TAP} data-photo-credit>{author}</a> : <span key={key} className="flex min-h-11 items-center" data-photo-credit>{author}</span>; };
  return <CreditRow count={keep.length}>{keep.map((c) => { const ph = c.photo!; return (
        <span key={c.name} className="flex flex-wrap items-center gap-x-1 md:gap-x-2 md:data-[overflow=true]:invisible" data-race-credit={c.name}>
          <span>{label(c.name)} ·</span>{link(ph, "a")}{ph.mate ? <><span aria-hidden>·</span>{link(ph.mate, "m")}</> : null}
        </span>
      ); })}</CreditRow>;
}
/** Design p13 #4: phones stack one credit per line; at 768px and up the row is inline (gap-x-6, no commas) and, if it
 *  would wrap past 1 line, is capped at 1 line (44px) with a "more" disclosure. Entries past the first line are made
 *  invisible while capped, so nothing clipped can take a tap or focus. */
function CreditRow({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [wraps, setWraps] = useState(false);
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const measure = () => {
      const items = [...el.querySelectorAll<HTMLElement>("[data-race-credit]")];
      const top = (el.firstElementChild as HTMLElement | null)?.offsetTop ?? 0;
      const over = mq.matches && items.some((i) => i.offsetTop > top + 4);
      setWraps(over);
      for (const i of items) i.dataset.overflow = String(over && !open && i.offsetTop > top + 4);
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el); mq.addEventListener("change", measure);
    return () => { ro.disconnect(); mq.removeEventListener("change", measure); };
  }, [open, count]);
  const capped = wraps && !open;
  return (
    <div className="md:flex md:items-start md:gap-x-6" data-credit-row data-capped={capped ? "true" : "false"}>
      <p ref={ref} className={`flex min-w-0 flex-col md:min-h-11 md:flex-1 md:flex-row md:flex-wrap md:items-center md:gap-x-6 ${capped ? "md:max-h-11 md:overflow-hidden" : ""} ${CREDIT}`} aria-label="Photo credits" data-photo-credits id={id}>
        <span className="pt-2 md:-mr-4 md:flex md:min-h-11 md:items-center md:pt-0">{count === 1 ? "Photo:" : "Photos:"}</span>
        {children}
      </p>
      {wraps ? (
        // Design p14 #3: a 44x44 hit area (min-h-11 min-w-11, px-2, and after:-inset-x-3 reaching 12px into the 24px gap,
        // which the last credit's 8px tap area never meets); 12/16 black/60, underlined.
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className={`relative hidden min-h-11 min-w-11 shrink-0 items-center justify-center px-2 underline decoration-black/20 underline-offset-2 hover:text-black after:absolute after:inset-y-0 after:-inset-x-3 after:content-[''] md:flex ${CREDIT}`} data-credits-more>
          {open ? "less" : "more"}
        </button>
      ) : null}
    </div>
  );
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
