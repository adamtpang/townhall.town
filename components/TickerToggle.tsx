"use client";
// WCAG 2.2.2 pause control for the Polymarket ticker (Design 3:43 PM). Icon only; state lives on the strip as
// data-strip-paused so CSS pauses the track. Hidden under prefers-reduced-motion (globals.css), where nothing moves.
import { useEffect, useRef, useState } from "react";

/** QA P2 (3:46 PM): a measured ~50px/s. One loop moves the track by one set's width, so duration = width / 50. */
export const TICKER_PX_PER_S = 50;
export const tickerDuration = (setWidth: number) => Math.max(10, setWidth / TICKER_PX_PER_S);

export const tickerToggleProps = (paused: boolean) => ({
  "aria-label": paused ? "Play prices" : "Pause prices",
  "aria-pressed": paused,
});

export function applyPaused(el: Element | null, paused: boolean) {
  const strip = el?.closest("[data-poly-strip]");
  if (!strip) return;
  if (paused) strip.setAttribute("data-strip-paused", "");
  else strip.removeAttribute("data-strip-paused");
}

export default function TickerToggle() {
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const strip = ref.current?.closest("[data-poly-strip]");
    const track = strip?.querySelector<HTMLElement>("[data-strip-track]");
    const set = strip?.querySelector<HTMLElement>("[data-strip-set]");
    if (!track || !set) return;
    const fit = () => { const w = set.getBoundingClientRect().width; if (w > 0) track.style.setProperty("--ticker-dur", `${tickerDuration(w).toFixed(2)}s`); };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(set);
    return () => ro.disconnect();
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      data-strip-toggle
      {...tickerToggleProps(paused)}
      onClick={(e) => { const next = !paused; applyPaused(e.currentTarget, next); setPaused(next); }}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {paused ? (
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>
      ) : (
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /></svg>
      )}
    </button>
  );
}
