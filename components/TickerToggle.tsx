"use client";
// WCAG 2.2.2 pause control for the Polymarket ticker (Design 3:43 PM). Icon only; state lives on the strip as
// data-strip-paused so CSS pauses the track. Hidden under prefers-reduced-motion (globals.css), where nothing moves.
import { useState } from "react";

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
  return (
    <button
      type="button"
      data-strip-toggle
      {...tickerToggleProps(paused)}
      onClick={(e) => { const next = !paused; applyPaused(e.currentTarget, next); setPaused(next); }}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
    >
      {paused ? (
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>
      ) : (
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /></svg>
      )}
    </button>
  );
}
