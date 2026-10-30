import BallotAgent from "./BallotAgent";
import { H1 } from "../lib/typeScale";
import { SectionBlock } from "../components/Prose";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { HOME_SECTIONS } from "../lib/content";
import { homeJsonLd, jsonLdString } from "../lib/jsonld";
import { LangProvider, LangToggle } from "../lib/i18n";

export default function Home() {
  return (
    // Spanish is wired but hidden: LangToggle renders nothing unless NEXT_PUBLIC_SPANISH=1 (Civic: hidden until native review).
    <LangProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(homeJsonLd()) }} />
      <SiteHeader extra={<LangToggle />} />
      <main className="mx-auto max-w-site px-6">
        <section className="pb-10 pt-12 [@media(min-width:640px)_and_(min-height:640px)]:pt-40" data-hero>
          <p className="mb-6 text-sm font-[530] text-black/60">Nov 3, 2026 · Austin · San Francisco · New York</p>
          <h1 className={`${H1} [text-wrap:balance]`}>
            Know your ballot in 2 minutes.
          </h1>
          <p className="mt-6 max-w-[32ch] text-xl leading-7 font-[530] text-black md:text-2xl md:leading-8" data-tagline>
            <span>Get your person in office. </span>
            <span className="max-sm:block">Your vote matters.</span>
          </p>
          <p className="mt-3 max-w-[36ch] text-base leading-6 font-[450] text-black/60">Who&rsquo;s running, when to vote, where to go. Sourced and nonpartisan.</p>
          <div id="hero-stat" />
        </section>
        <BallotAgent />
        <div className="mt-32">
          {HOME_SECTIONS.map((s) => (
            <SectionBlock key={s.heading} s={s} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </LangProvider>
  );
}
