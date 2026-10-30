"use client";

// ndstudio-structure spec §3.4 / §6 <CityCard>: 4:5 duotone photo cards. The whole card is one link that does what the
// city chip does (loads that ZIP); without JS it is a real /?zip= link. Credits per spec §8 (CC BY gets a license link
// and "modified (duotone)"). Self-hosted under public/media, plain <img> (no Vercel Image Optimization).
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

// From v3.1 (f2a5046): the credit names its city for screen readers and its license link; no "modified (duotone)"
// (photos are in color, Adam 2:56 PM CT).
function Credit({ c }: { c: City }) {
  return (
    <span className="[overflow-wrap:anywhere]">
      <span className="sr-only">{c.name}: </span>Photo: {c.author},{" "}
      {c.licenseUrl ? (
        <a href={c.licenseUrl} target="_blank" rel="noreferrer" aria-label={`${c.name} photo license: ${c.license} (opens in a new tab)`} className="th-link relative z-[1] inline-flex min-h-11 items-center">{c.license}</a>
      ) : (
        c.license
      )}
    </span>
  );
}

// Design grid spec #3 (Oct 30, 2:58 PM CT): 3 across at every width. Phones: gap-2, 4:5, name 16px. From lg: col-span-4
// of 12, 16:9, name 24px. The county and the photo credits fold away (pure hide, same words).
export default function CityCards() {
  return (
    <>
    <ul className="grid grid-cols-3 gap-2 lg:grid-cols-12 lg:gap-6" data-city-cards>
      {CITIES.map((c) => (
        <li key={c.zip} className="th-card relative min-w-0 lg:col-span-4">
          <div className="media-frame aspect-[4/5] bg-brand-50 lg:aspect-video">
            <img
              src={`/media/${c.img}-600.webp`}
              srcSet={`/media/${c.img}-600.webp 600w, /media/${c.img}-960.webp 960w`}
              sizes="(min-width: 1024px) 400px, 33vw"
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
            className="mt-2 flex min-h-11 items-center gap-1 text-base leading-5 font-[530] text-ink no-underline transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] after:absolute after:inset-0 after:content-[''] hover:text-ink active:scale-[0.97] motion-reduce:active:scale-100 lg:mt-3 lg:gap-2 lg:text-2xl lg:leading-[30px]"
            data-city-zip={c.zip}
          >
            {c.name}
          </a>
          <p className="text-sm leading-5 text-ink/60">{c.zip}<span className="max-lg:hidden"> · {c.county}</span></p>
        </li>
      ))}
    </ul>
    <details className="mt-2" data-city-credits>
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm leading-5 text-ink/60">Photo credits ({CITIES.length})</summary>
      <ul className="text-sm leading-5 text-ink/60">{CITIES.map((c) => <li key={c.zip} className="flex min-h-11 flex-wrap items-center"><Credit c={c} /></li>)}</ul>
    </details>
    </>
  );
}
