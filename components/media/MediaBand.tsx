"use client";
import { useEffect, useRef, useState } from "react";

// ndstudio-structure spec §2/§6 (design, Oct 30 2026): one full-bleed purple-duotone b-roll band under the ZIP box.
// Design GO change (Oct 30): the poster is server-rendered (<picture>, mobile/desktop by media query) so it paints on
// first paint. Video <source>s attach and load only on requestIdleCallback (setTimeout fallback where rIC is missing)
// or the first scroll, whichever comes first, and NEVER under prefers-reduced-motion or Save-Data (poster only).
// Decorative: muted, no controls, aria-hidden.
const MOBILE = "(max-width: 767px)";
const REDUCE = "(prefers-reduced-motion: reduce)";
export const IDLE_FALLBACK_MS = 2000;

export function motionAllowed(reduce: boolean, saveData: boolean | undefined) {
  return !reduce && !saveData;
}

export function bandSources(mobile: boolean) {
  return mobile
    ? [{ src: "/media/band-mobile.webm", type: "video/webm" }, { src: "/media/band-mobile.mp4", type: "video/mp4" }]
    : [{ src: "/media/band-desktop.mp4", type: "video/mp4" }];
}

type IdleWin = Window & {
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

// Calls `run` once, on idle or first scroll, whichever comes first. Returns a cleanup.
export function onIdleOrScroll(w: IdleWin, run: () => void) {
  let done = false;
  let idleId: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fire = () => { if (done) return; done = true; cleanup(); run(); };
  const cleanup = () => {
    w.removeEventListener("scroll", fire);
    w.removeEventListener("pointerdown", fire);
    if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
    if (timer !== undefined) clearTimeout(timer);
  };
  w.addEventListener("scroll", fire, { passive: true, once: true });
  w.addEventListener("pointerdown", fire, { passive: true, once: true });
  if (typeof w.requestIdleCallback === "function") idleId = w.requestIdleCallback(fire);
  else timer = setTimeout(fire, IDLE_FALLBACK_MS);
  return () => { done = true; cleanup(); };
}

type LoadWin = IdleWin & { document: { readyState: string } };
/** Design landing spec (3:03 PM CT): first load ~0.4 MB with no scroll, so the video waits for the visitor's first
 *  scroll, pointer, touch or key after window 'load' (poster until then). Returns a cleanup. */
export const INTERACTION_EVENTS = ["scroll", "pointerdown", "touchstart", "keydown"] as const;
export function afterLoadThenInteraction(w: LoadWin, run: () => void) {
  let done = false;
  let loaded = w.document.readyState === "complete";
  const cleanup = () => { for (const n of INTERACTION_EVENTS) w.removeEventListener(n, fire); w.removeEventListener("load", onLoad); };
  const fire = () => { if (done || !loaded) return; done = true; cleanup(); run(); };
  const onLoad = () => { loaded = true; };
  for (const n of INTERACTION_EVENTS) w.addEventListener(n, fire, { passive: true });
  if (!loaded) w.addEventListener("load", onLoad, { once: true });
  return () => { done = true; cleanup(); };
}
/** Design 2:57 PM CT (Oct 30): the video is off the first load. `run` fires once window 'load' has fired AND then
 *  idle (or the first scroll/pointer) has passed. Returns a cleanup. */
export function afterLoadThenIdle(w: LoadWin, run: () => void) {
  let stop: (() => void) | undefined;
  let gone = false;
  const go = () => { if (!gone) stop = onIdleOrScroll(w, run); };
  if (w.document.readyState === "complete") go();
  else w.addEventListener("load", go, { once: true });
  return () => { gone = true; w.removeEventListener("load", go); stop?.(); };
}
/** IntersectionObserver options for "the band is within one viewport". */
export const NEAR_VIEWPORT = { rootMargin: "100% 0px" };

export default function MediaBand() {
  const v = useRef<HTMLVideoElement>(null);
  const [playable, setPlayable] = useState(false);
  const [paused, setPaused] = useState(false);
  const userPaused = useRef(false);

  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const reduceMq = window.matchMedia(REDUCE);
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!motionAllowed(reduceMq.matches, saveData)) return; // poster only: never attach or load the video
    const mobile = window.matchMedia(MOBILE).matches;
    let attached = false;
    let visible = false;
    let ready = false; // window load + first scroll/pointer/touch/key
    let near = false; // band within one viewport
    const attach = () => {
      if (attached || !ready || !near || reduceMq.matches) return;
      for (const s of bandSources(mobile)) {
        const node = document.createElement("source");
        node.src = s.src;
        node.type = s.type;
        el.appendChild(node);
      }
      el.preload = "auto";
      el.load();
      attached = true;
      setPlayable(true);
      if (visible && !userPaused.current) el.play().catch(() => {});
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (!attached) return;
      if (!visible) el.pause();
      else if (!userPaused.current) el.play().catch(() => {});
    });
    io.observe(el);
    const nearIo = new IntersectionObserver(([e]) => { if (e.isIntersecting) { near = true; nearIo.disconnect(); attach(); } }, NEAR_VIEWPORT);
    nearIo.observe(el);
    const stopIdle = afterLoadThenInteraction(window, () => { ready = true; attach(); });
    const onReduce = () => { if (reduceMq.matches && attached) { el.pause(); setPaused(true); userPaused.current = true; } };
    reduceMq.addEventListener?.("change", onReduce);
    return () => { stopIdle(); io.disconnect(); nearIo.disconnect(); reduceMq.removeEventListener?.("change", onReduce); };
  }, []);

  function toggle() {
    const el = v.current;
    if (!el) return;
    if (el.paused) { userPaused.current = false; el.play().catch(() => {}); setPaused(false); }
    else { userPaused.current = true; el.pause(); setPaused(true); }
  }

  return (
    // Design landing P0-1 (3:03 PM): full-bleed as a sibling of the 1280 container (w-full, not w-screen, so no 15px
    // scrollbar-gutter overflow). P0-2: caption on a dark glass plate, white text (>= 5:1 over the lightest frame).
    <figure className="relative mt-4 w-full" data-media-band>
      <div className="media-frame aspect-[4/5] md:aspect-[12/5]">
        <picture>
          <source media="(min-width: 768px)" srcSet="/media/band-desktop-poster.jpg" />
          <img src="/media/band-mobile-poster.jpg" alt="" aria-hidden="true" decoding="async" data-band-poster />
        </picture>
        <video ref={v} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
      </div>
      <figcaption className="absolute inset-x-0 bottom-0 bg-ink/55 text-sm leading-5 text-white backdrop-blur-xl" data-band-caption>
        <span className="mx-auto flex min-h-14 max-w-[1280px] items-center gap-3 px-5 py-2 md:px-10">
          <span className="flex flex-1 flex-col md:flex-row md:justify-between md:gap-5">
            <span><b className="font-[530] text-white">Early voting.</b> Berkeley County, S.C., Oct 2016</span>
            <span>Voice of America · Public domain</span>
          </span>
          {/* Spec §6: 44×44 pause control (the clip loops past 5s; WCAG 2.2.2). Only shown once video can play. */}
          {playable && (
            <button type="button" onClick={toggle} aria-pressed={paused} aria-label={paused ? "Play background video" : "Pause background video"} className="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center text-white focus-visible:outline-white focus-visible:-outline-offset-4" data-band-toggle>
              {paused ? (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor" /></svg>
              )}
            </button>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
