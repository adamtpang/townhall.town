"use client";
// Design grid spec #2 (Oct 30, 2:58 PM CT): Who / What / Where as three image tiles. Each tile is one link (min-h-11),
// image on top (4:3, cover, the repo's own licensed city photos), the title, then one line. col-span-4 of 12 from lg,
// full width and stacked on phones. Before a ZIP is entered the targets don't exist yet, so a tap lands on the ZIP box.
import { CITIES } from "./CityCards";

const TILES = [
  { id: "who", title: "Who's on my ballot", line: "Every race on your ballot.", city: CITIES[0] },
  { id: "what", title: "What's on it", line: "Every fact links its record.", city: CITIES[1] },
  { id: "where", title: "Where and when", line: "When, where, what to bring.", city: CITIES[2] },
] as const;

function go(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  if (document.getElementById(id)) return; // results are on the page: plain hash jump
  const zip = document.querySelector<HTMLInputElement>('input[autocomplete="postal-code"]');
  if (!zip) return;
  e.preventDefault();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  zip.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  zip.focus({ preventScroll: true });
}

export default function HomeTiles() {
  return (
    <ul className="grid grid-cols-4 gap-4 lg:grid-cols-12 lg:gap-6" data-home-tiles>
      {TILES.map((t) => (
        <li key={t.id} className="col-span-4">
          <a href={`#${t.id}`} onClick={(e) => go(e, t.id)} data-home-tile={t.id}
            className="group block min-h-11 border border-ink/10 text-ink no-underline transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.97] motion-reduce:active:scale-100 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
            <img src={`/media/${t.city.img}-600.webp`} srcSet={`/media/${t.city.img}-600.webp 600w, /media/${t.city.img}-960.webp 960w`}
              sizes="(min-width: 1024px) 400px, 100vw" alt={t.city.alt} width={600} height={450} loading="lazy" decoding="async"
              className="block aspect-[4/3] w-full object-cover" />
            <span className="block p-5 lg:p-6">
              <span className="block text-xl leading-7 font-[530] lg:text-2xl lg:leading-8">{t.title} <span className="text-brand-700" aria-hidden="true">→</span></span>
              <span className="mt-1 block text-base leading-6 text-ink/60">{t.line}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
