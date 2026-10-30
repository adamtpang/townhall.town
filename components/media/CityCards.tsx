"use client";

// ndstudio-structure spec §3.4 / §6 <CityCard>: 4:5 duotone photo cards. The whole card is one link that does what the
// city chip does (loads that ZIP); without JS it is a real /?zip= link. Credits per spec §8 (CC BY gets a license link
// and "modified (duotone)"). Self-hosted under public/media, plain <img> (no Vercel Image Optimization).
import { useCallback, useEffect, useRef, useState } from "react";

export type City = { zip: string; name: string; county: string; img: string; alt: string; author: string; license: string; licenseUrl?: string };

export const CITIES: City[] = [
  { zip: "78701", name: "Austin", county: "Travis County", img: "austin-capitol", alt: "Texas State Capitol, Austin", author: "Daderot", license: "CC0" },
  { zip: "94103", name: "San Francisco", county: "San Francisco", img: "sf-city-hall", alt: "San Francisco City Hall", author: "Bernard Spragg. NZ", license: "CC0" },
  { zip: "10001", name: "New York", county: "Manhattan", img: "nyc-msg-early-voting", alt: "Early voting line under Madison Square Garden", author: "Jim Henderson", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" },
];

export const ZIP_EVENT = "townhall:zip";

function open(e: React.MouseEvent<HTMLAnchorElement>, zip: string) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  window.dispatchEvent(new CustomEvent(ZIP_EVENT, { detail: zip }));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

/** Design 2:56 PM CT (Oct 30): right-edge fade only while the strip can still scroll right; gone at the end. */
export const canScrollRight = (el: { scrollLeft: number; clientWidth: number; scrollWidth: number }) => el.scrollLeft + el.clientWidth < el.scrollWidth - 1;

export default function CityCards() {
  const ref = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState(true);
  const check = useCallback(() => { const el = ref.current; if (el) setMore(canScrollRight(el)); }, []);
  useEffect(() => { check(); window.addEventListener("resize", check); return () => window.removeEventListener("resize", check); }, [check]);
  return (
    <ul
      ref={ref}
      onScroll={check}
      data-more={more ? "true" : "false"}
      className="-mr-6 flex snap-x snap-mandatory scroll-pl-5 gap-3 overflow-x-auto pr-6 data-[more=true]:[mask-image:linear-gradient(to_right,black_85%,transparent)] md:mr-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:pr-0 md:data-[more=true]:[mask-image:none]"
      data-city-cards
    >
      {CITIES.map((c) => (
        <li key={c.zip} className="th-card relative w-[72%] shrink-0 snap-start md:w-auto md:shrink">
          <div className="duo aspect-[4/5] bg-brand-50">
            <img
              src={`/media/${c.img}-600.webp`}
              srcSet={`/media/${c.img}-600.webp 600w, /media/${c.img}-960.webp 960w`}
              sizes="(min-width: 768px) 22vw, 72vw"
              alt={c.alt}
              loading="lazy"
              decoding="async"
              width={600}
              height={750}
            />
          </div>
          <a
            href={`/?zip=${c.zip}`}
            onClick={(e) => open(e, c.zip)}
            className="mt-3 flex min-h-11 items-center gap-2 text-xl leading-[26px] font-[530] text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-ink md:text-2xl md:leading-[30px]"
            data-city-zip={c.zip}
          >
            {c.name}
            <span className="text-brand-700" aria-hidden="true">↗</span>
          </a>
          <p className="text-sm leading-5 text-ink/60">{c.zip} · {c.county}</p>
          <p className="text-sm leading-5 text-ink/60 [overflow-wrap:anywhere]" data-city-credit>
            Photo: {c.author},{" "}
            {c.licenseUrl ? (
              <>
                <a href={c.licenseUrl} target="_blank" rel="noreferrer" className="th-link relative z-[1]">{c.license}<span className="sr-only"> (opens in a new tab)</span></a>, modified (duotone)
              </>
            ) : (
              c.license
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
