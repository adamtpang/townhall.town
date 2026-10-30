import BallotAgent from "./BallotAgent";
import { H1, H3 } from "../lib/typeScale";
import { SectionBody } from "../components/Prose";
import MediaBand from "../components/media/MediaBand";
import CityCards from "../components/media/CityCards";
import HomeTiles from "../components/media/HomeTiles";
import { NumberedSection } from "../components/media/SectionHeader";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { HOME_SECTIONS } from "../lib/content";
import { homeJsonLd, jsonLdString } from "../lib/jsonld";
import { LangProvider, LangToggle, T } from "../lib/i18n";

// ndstudio-structure spec §3 item 5: "02 How it works" as 3 steps (approved Oct 30, 2026). Exact copy; no other changes.
const HOW_STEPS: [string, string][] = [
  ["Enter your ZIP.", "Every race on your ballot."],
  ["Read the sources.", "Every fact links its record."],
  ["Go vote.", "When, where, what to bring."],
];

export default function Home() {
  return (
    // Spanish toggle is visible by default (Adam, Oct 29 2026); NEXT_PUBLIC_SPANISH=0 hides it. Untranslated strings: notes/spanish-untranslated.md.
    <LangProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(homeJsonLd()) }} />
      <SiteHeader extra={<LangToggle />} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1280px] scroll-mt-16 px-5 outline-none md:px-10">
        {/* Reserved slot for the Polymarket strip (built on its own branch): directly under the nav, above the H1. Empty = 0px. */}
        <div id="market-strip-slot" data-market-strip-slot />
        {/* P1-3 (purple spec): 160px hero top at >=1024 wide, only on viewports >=800px tall (keeps QA 4c21a5c: no band at 300% zoom). */}
        <section className="pb-10 pt-12 lg:pt-20 [@media(min-width:1024px)_and_(min-height:800px)]:pt-40" data-hero>
          <h1 className={`${H1} [text-wrap:balance]`}>
            <T>Know your ballot in 2 minutes.</T>
          </h1>
          <p className="mt-6 max-w-[32ch] text-xl leading-7 font-[530] text-black md:text-2xl md:leading-8" data-tagline>
            <span>Get your person in office. </span>
            <span className="max-sm:block"><T>Your vote matters.</T></span>
          </p>
          <div id="hero-stat" />
        </section>
        <BallotAgent />
        {/* Design grid spec #3 (Oct 30, 2:58 PM CT): hero, ZIP, 01 Your city, the full-bleed band, Who/What/Where tiles,
            02 How it works (copy approved Oct 30), 03 Sources. */}
        <NumberedSection n="01" label="Your city" id="your-city" wide first>
          <CityCards />
        </NumberedSection>
        <MediaBand />
        <nav aria-label="Who, what and where" className="py-16 lg:py-24" data-home-tiles-nav>
          <HomeTiles />
        </nav>
        <NumberedSection n="02" label="How it works" id="how-it-works" fold>
          <ol className="grid gap-8 md:grid-cols-3 md:gap-5" data-how-steps>
            {HOW_STEPS.map(([title, line], i) => (
              <li key={title}>
                <span className="text-sm leading-5 font-[530] tabular-nums text-brand-600" aria-hidden="true">{`0${i + 1}`}</span>
                <h3 className={`mt-2 ${H3}`}><T>{title}</T></h3>
                <p className="mt-1 text-base leading-6 text-ink/60"><T>{line}</T></p>
              </li>
            ))}
          </ol>
        </NumberedSection>
        {HOME_SECTIONS.map((s) => (
          <NumberedSection key={s.heading} n="03" label={s.heading} id={s.heading.toLowerCase()} fold>
            <SectionBody s={s} />
          </NumberedSection>
        ))}
        <div className="h-16 lg:h-24" />
      </main>
      <SiteFooter />
    </LangProvider>
  );
}
