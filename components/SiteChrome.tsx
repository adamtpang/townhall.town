import Link from "next/link";
import { SITE } from "../lib/site";

export function SiteHeader({ extra }: { extra?: React.ReactNode } = {}) {
  return (
    <header className="mx-auto flex max-w-site items-center justify-between px-6 py-8">
      <Link href="/" className="flex items-center gap-3 text-base font-[530] tracking-tight text-[#010101] no-underline">
        <span aria-hidden className="inline-block h-3 w-3 bg-[#3760f2]" />
        townhall.town
      </Link>
      <span className="flex items-center gap-6">
        {extra}
        <span className="text-sm font-[450] text-black/50">{SITE.electionLabel}</span>
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

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-40 max-w-site border-t border-black/15 px-6 py-10 text-sm text-black/50">
      <p>Nonpartisan. Not a government site. No endorsements. Every fact links its source; confirm with your state.</p>
      <nav aria-label="Site" className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {NAV.map((n) => (
          <a key={n.href} href={n.href} className="inline-flex min-h-11 items-center text-black/50 no-underline hover:text-black">
            {n.label}
          </a>
        ))}
      </nav>
      <a href={SITE.github} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm text-black/50 no-underline transition-colors hover:text-[#3760f2]">
        Open source. Add your city on GitHub
      </a>
    </footer>
  );
}
