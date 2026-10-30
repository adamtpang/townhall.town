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
    if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
    if (timer !== undefined) clearTimeout(timer);
  };
  w.addEventListener("scroll", fire, { passive: true, once: true });
  if (typeof w.requestIdleCallback === "function") idleId = w.requestIdleCallback(fire);
  else timer = setTimeout(fire, IDLE_FALLBACK_MS);
  return () => { done = true; cleanup(); };
}

export default function MediaBand() {
  const v = useRef<HTMLVideoElement>(null);
  const [playable, setPlayable] = useState(false);
  const [paused, setPaused] = useState(false);
  const userPaused = useRef(false);
  // The <video> poster matches the <picture> (phone or desktop, same cached file), set on mount so SSR never picks one.
  const [poster, setPoster] = useState<string | undefined>(undefined);

  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const reduceMq = window.matchMedia(REDUCE);
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!motionAllowed(reduceMq.matches, saveData)) return; // poster only: never attach or load the video
    const mobile = window.matchMedia(MOBILE).matches;
    setPoster(mobile ? "/media/band-mobile-poster.jpg" : "/media/band-desktop-poster.jpg");
    let attached = false;
    // Skills audit P0 (Oct 30): nothing loads until the band is within 200px of the viewport (it sits below the fold).
    // Then the sources attach and it plays; it pauses whenever it leaves view.
    const attach = () => {
      if (attached || reduceMq.matches) return;
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
    };
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) { if (attached) el.pause(); return; }
      attach();
      if (attached && !userPaused.current) el.play().catch(() => {});
    }, { rootMargin: "200px" });
    io.observe(el);
    const onReduce = () => { if (reduceMq.matches && attached) { el.pause(); setPaused(true); userPaused.current = true; } };
    reduceMq.addEventListener?.("change", onReduce);
    return () => { io.disconnect(); reduceMq.removeEventListener?.("change", onReduce); };
  }, []);

  function toggle() {
    const el = v.current;
    if (!el) return;
    if (el.paused) { userPaused.current = false; el.play().catch(() => {}); setPaused(false); }
    else { userPaused.current = true; el.pause(); setPaused(true); }
  }

  return (
    <figure className="ml-[calc(50%-50vw)] w-screen" data-media-band>
      <div className="duo aspect-[4/5] md:aspect-[12/5]">
        <picture>
          <source media="(min-width: 768px)" srcSet="/media/band-desktop-poster.jpg" width={1280} height={720} />
          <img src="/media/band-mobile-poster.jpg" alt="" width={576} height={324} loading="lazy" decoding="async" data-band-poster />
        </picture>
        <video ref={v} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} poster={poster} />
      </div>
      <figcaption className="mx-auto mt-3 flex max-w-[1280px] items-start gap-3 px-5 text-sm leading-5 text-ink/60 md:px-10">
        <span className="flex flex-1 flex-col md:flex-row md:justify-between md:gap-5">
          <span><b className="font-[530] text-ink">Early voting.</b> Berkeley County, S.C., Oct 2016</span>
          <span>Voice of America · Public domain</span>
        </span>
        {/* Spec §6: recommended 44×44 pause control in the caption row (the clip loops past 5s; WCAG 2.2.2). Only shown once video can play. */}
        {playable && (
          <button type="button" onClick={toggle} aria-label={paused ? "Play background video" : "Pause background video"} className="-mt-3 flex h-11 w-11 shrink-0 items-center justify-center text-ink hover:text-brand-700" data-band-toggle>
            {paused ? (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor" /></svg>
            )}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
