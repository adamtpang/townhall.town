import BallotAgent from "./BallotAgent";
import { H1 } from "../lib/typeScale";
import { SectionBlock } from "../components/Prose";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { HOME_SECTIONS } from "../lib/content";
import { homeJsonLd, jsonLdString } from "../lib/jsonld";
import { LangProvider, LangToggle, T } from "../lib/i18n";

export default function Home() {
  return (
    // Spanish toggle is visible by default (Adam, Oct 29 2026); NEXT_PUBLIC_SPANISH=0 hides it. Untranslated strings: notes/spanish-untranslated.md.
    <LangProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(homeJsonLd()) }} />
      <SiteHeader extra={<LangToggle />} />
      <main className="mx-auto max-w-site px-6 lg:px-10">
        {/* P1-3 (purple spec): 160px hero top at >=1024 wide, only on viewports >=800px tall (keeps QA 4c21a5c: no band at 300% zoom). */}
        <section className="pb-10 pt-12 lg:pt-20 [@media(min-width:1024px)_and_(min-height:800px)]:pt-40" data-hero>
          <p className="mb-6 text-sm font-[530] text-black/60">Nov 3, 2026 · Austin · San Francisco · New York</p>
          <h1 className={`${H1} [text-wrap:balance]`}>
            <T>Know your ballot in 2 minutes.</T>
          </h1>
          <p className="mt-6 max-w-[32ch] text-xl leading-7 font-[530] text-black md:text-2xl md:leading-8" data-tagline>
            <span>Get your person in office. </span>
            <span className="max-sm:block"><T>Your vote matters.</T></span>
          </p>
          <p className="mt-3 max-w-[36ch] text-base leading-6 font-[450] text-black/60"><T>{"Who\u2019s running, when to vote, where to go. Sourced and nonpartisan."}</T></p>
          <div id="hero-stat" />
        </section>
        <BallotAgent />
        <div className="mt-32">
          {HOME_SECTIONS.map((s) => (
            <SectionBlock key={s.heading} s={s} level={3} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </LangProvider>
  );
}
