import BallotAgent from "./BallotAgent";
import { H1, H3 } from "../lib/typeScale";
import { SectionBody } from "../components/Prose";
import MediaBand from "../components/media/MediaBand";
import CityCards from "../components/media/CityCards";
import { NumberedSection } from "../components/media/SectionHeader";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { HOME_SECTIONS } from "../lib/content";
import { homeJsonLd, jsonLdString } from "../lib/jsonld";
import { LangProvider, LangToggle, T } from "../lib/i18n";
import PolyStrip from "../components/PolyStrip";

// Polymarket strip prices are fetched on the server and revalidated every 5 minutes.
export const revalidate = 300;

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
      <PolyStrip />
      <main>
        <div className="mx-auto max-w-[1280px] px-5 md:px-10">
        <section className="pb-6 pt-6 lg:pb-8 lg:pt-16" data-hero>
          <h1 className={`${H1} [text-wrap:balance]`}>
            <T>Know your ballot in 2 minutes.</T>
          </h1>
          <p className="mt-4 max-w-[32ch] text-xl leading-7 font-[530] text-black md:text-2xl md:leading-8" data-tagline>
            <span>Get your person in office. </span>
            <span className="max-sm:block"><T>Your vote matters.</T></span>
          </p>
          <div id="hero-stat" />
        </section>
        <BallotAgent />
        {/* Adam 2:56 PM CT (Oct 30): hero → ZIP → city cards → band → How it works → Sources. The city row sits right
            under the ZIP box (ends above y=700 at 390 and y=800 at 1440). */}
        <section id="your-city" aria-labelledby="your-city-label" className="mt-6" data-city-row>
          <h2 id="your-city-label" className="sr-only flex gap-3 text-sm leading-5 font-[530] tracking-normal text-ink">
            <span className="tabular-nums text-brand-700">01</span>
            <span>Your city</span>
          </h2>
          <CityCards />
        </section>
        </div>
        <MediaBand />
        <div className="mx-auto max-w-[1280px] px-5 md:px-10">
        <NumberedSection n="02" label="How it works" id="how-it-works">
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
          <NumberedSection key={s.heading} n="03" label={s.heading} id={s.heading.toLowerCase()}>
            <SectionBody s={s} />
          </NumberedSection>
        ))}
        <div className="h-16 lg:h-24" />
      </div>
      </main>
      <SiteFooter />
    </LangProvider>
  );
}
