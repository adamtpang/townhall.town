import Link from "next/link";
import { SITE } from "../lib/site";

export function SiteHeader({ extra }: { extra?: React.ReactNode } = {}) {
  return (
    <header className="mx-auto flex h-14 items-center justify-between lg:h-16 max-w-[1280px] px-5 md:px-10" data-site-header>
      <Link href="/" className="inline-flex min-h-11 items-center gap-3 text-base font-[530] tracking-tight text-[#010101] no-underline">
        <span aria-hidden className="inline-block h-3 w-3 bg-brand-600" />
        townhall.town
      </Link>
      <span className="flex items-center gap-6">
        {extra}
        <span className="text-sm font-[450] text-ink/60">{SITE.electionLabel}</span>
      </span>
    </header>
  );
}

const NAV = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/developers", label: "API" },
  { href: "/openapi.json", label: "OpenAPI" },
  { href: SITE.github, label: "GitHub" },
];

// P1-1 (design purple spec, Oct 30 2026): one full-bleed ink band that ends on townhall's own wordmark, set in the
// site's Inter Tight (font-sans). Never the NDS logotype. Footer text is white/60+ on ink (>= 7:1).
export function SiteFooter() {
  return (
    <footer className="mt-40 bg-ink text-sm text-white/60" data-site-footer>
      <div className="mx-auto max-w-[1280px] px-5 md:px-10 pb-10 pt-16">
        <span aria-hidden className="mb-6 block h-3 w-3 bg-brand-500" />
        <p>Nonpartisan. Not a government site. No endorsements. Every fact links its source; confirm with your state.</p>
        <p className="mt-2" data-photo-notice>Candidate photos: public campaign or official pages. <a href="/contact" className="inline-flex min-h-11 items-center text-white/80 underline decoration-white/40 underline-offset-2 hover:text-brand-300 hover:decoration-current">Contact us</a> to remove.</p>
        <nav aria-label="Site" className="mt-4 flex flex-wrap gap-x-4 gap-y-3 sm:gap-x-5">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="inline-flex min-h-11 items-center text-white/80 no-underline hover:text-brand-300">
              {n.label}
            </a>
          ))}
        </nav>
        <a href={SITE.github} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm text-white/80 no-underline transition-colors duration-300 ease-out motion-reduce:transition-none hover:text-brand-300">
          Add your city on GitHub
        </a>
        {/* Design 2:56 PM CT (Oct 30): a fitted SVG at w-full, so the wordmark always sits inside the 40px (1440) and 20-24px (390) margins. */}
        <div aria-hidden className="mt-24 border-t border-white/15 pt-8" data-wordmark>
          <svg viewBox="0 0 1000 118" className="block h-auto w-full overflow-visible" role="presentation" focusable="false">
            <text x="0" y="112" textLength="1000" lengthAdjust="spacingAndGlyphs" className="fill-white font-sans font-[530]" style={{ fontSize: 150, letterSpacing: "-0.045em" }}>townhall.town</text>
          </svg>
        </div>
      </div>
    </footer>
  );
}
