"use client";
// Design part 1 B + motion §2.2 (Oct 30 2026): three tiles right under the ZIP summary, one tap to each section. On
// phones, once the tiles scroll away, the same three links pin to a glass bar at the bottom (h-14, safe-area padding).
import { useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { enter, reduced, stagger } from "../lib/motion";

const TILES = [
  { id: "who", label: "Who's on my ballot" },
  { id: "what", label: "What's on it" },
  { id: "where", label: "Where and when" },
] as const;
type Id = (typeof TILES)[number]["id"];

/** Open the section's folder (if it is one) and bring it under the sticky header. */
export function go(id: string, smooth = true) {
  const el = document.getElementById(id);
  if (!el) return false;
  if (el instanceof HTMLDetailsElement && !el.open) el.open = true;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: smooth && !reduce ? "smooth" : "auto", block: "start" });
  return true;
}

export default function ResultsNav() {
  const nav = useRef<HTMLElement>(null);
  const [active, setActive] = useState<Id | null>(null);
  const [pinned, setPinned] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => { // deep link: /?zip=78701#where opens and scrolls once the section exists (sections load lazily).
    const h = window.location.hash.slice(1);
    if (!TILES.some((t) => t.id === h)) return;
    let n = 0;
    const t = setInterval(() => { if ((++n > 3 && go(h, false)) || n > 40) clearInterval(t); }, 150);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { // phone bar shows only while the tiles are off screen above
    const el = nav.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setPinned(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { // active tile: the last section whose top has passed the header
    const on = () => {
      let cur: Id | null = null;
      for (const t of TILES) { const el = document.getElementById(t.id); if (el && el.getBoundingClientRect().top < 120) cur = t.id; }
      setActive(cur);
    };
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const tap = (id: Id) => (e: React.MouseEvent) => { if (go(id)) { e.preventDefault(); history.replaceState(null, "", `#${id}`); setActive(id); } };
  const v = reduce ? reduced : enter;
  return (
    <>
      <m.nav ref={nav} aria-label="Jump to section" className="mt-4 grid grid-cols-3 border-y border-black/15" data-results-nav
        initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: reduce ? {} : stagger } }}>
        {TILES.map((t) => (
          <m.a key={t.id} href={`#${t.id}`} onClick={tap(t.id)} aria-current={active === t.id ? "location" : undefined} data-nav-tile={t.id}
            variants={{ hidden: v.initial, show: { ...v.animate, transition: v.transition } }}
            className={`flex min-h-14 items-center justify-center border-b-2 px-2 text-center text-base font-[530] leading-5 text-black ${active === t.id ? "border-brand-600" : "border-transparent"} [@media(hover:hover)]:hover:bg-brand-50`}>
            {t.label}
          </m.a>
        ))}
      </m.nav>
      <nav aria-label="Jump to section, pinned bar" aria-hidden={!pinned} data-cta-bar
        className={`glass glass-bar-bottom bg-white/90 fixed inset-x-0 bottom-0 z-40 grid motion-safe:transition-[transform,opacity] motion-safe:duration-[220ms] motion-safe:ease-[cubic-bezier(.215,.61,.355,1)] grid-cols-3 pb-[env(safe-area-inset-bottom)] md:hidden ${pinned ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"}`}>
        {TILES.map((t) => (
          <a key={t.id} href={`#${t.id}`} onClick={tap(t.id)} tabIndex={pinned ? undefined : -1} data-bar-tile={t.id}
            className={`flex h-14 items-center justify-center border-b-2 px-3 text-center text-sm font-[530] leading-4 text-black ${active === t.id ? "border-brand-600" : "border-transparent"}`}>
            {t.label}
          </a>
        ))}
      </nav>
    </>
  );
}
