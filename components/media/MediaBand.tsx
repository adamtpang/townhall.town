"use client";
import { useEffect, useRef, useState } from "react";

// ndstudio-structure spec §2/§6 (design, Oct 30 2026): one full-bleed purple-duotone b-roll band under the ZIP box.
// Poster first, set only when the band nears the viewport; video <source>s are injected by JS on first intersect and
// never under prefers-reduced-motion or Save-Data (poster only). Decorative: muted, no controls, aria-hidden.
const MOBILE = "(max-width: 767px)";
const REDUCE = "(prefers-reduced-motion: reduce)";

export function motionAllowed(reduce: boolean, saveData: boolean | undefined) {
  return !reduce && !saveData;
}

export function bandSources(mobile: boolean) {
  return mobile
    ? [{ src: "/media/band-mobile.webm", type: "video/webm" }, { src: "/media/band-mobile.mp4", type: "video/mp4" }]
    : [{ src: "/media/band-desktop.mp4", type: "video/mp4" }];
}

export default function MediaBand() {
  const v = useRef<HTMLVideoElement>(null);
  const [playable, setPlayable] = useState(false);
  const [paused, setPaused] = useState(false);
  const userPaused = useRef(false);

  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const mobile = window.matchMedia(MOBILE).matches;
    const reduceMq = window.matchMedia(REDUCE);
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    let attached = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) {
          if (attached) el.pause();
          return;
        }
        if (!el.getAttribute("poster")) el.setAttribute("poster", mobile ? "/media/band-mobile-poster.jpg" : "/media/band-desktop-poster.jpg");
        if (!motionAllowed(reduceMq.matches, saveData)) return;
        if (!attached) {
          for (const s of bandSources(mobile)) {
            const node = document.createElement("source");
            node.src = s.src;
            node.type = s.type;
            el.appendChild(node);
          }
          el.load();
          attached = true;
          setPlayable(true);
        }
        if (!userPaused.current) el.play().catch(() => {});
      },
      { rootMargin: "200px" }
    );
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
    <figure className="ml-[calc(50%-50vw)] mt-16 w-screen lg:mt-24" data-media-band>
      <div className="duo aspect-[4/5] md:aspect-[12/5]">
        <video ref={v} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
      </div>
      <figcaption className="mx-auto mt-3 flex max-w-site items-start gap-3 px-6 text-sm leading-5 text-ink/60 lg:px-10">
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
