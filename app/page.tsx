import BallotAgent from "./BallotAgent";
import { SectionBlock } from "../components/Prose";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { HOME_SECTIONS } from "../lib/content";
import { homeJsonLd, jsonLdString } from "../lib/jsonld";

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(homeJsonLd()) }} />
      <SiteHeader />
      <main className="mx-auto max-w-site px-6">
        <section className="pb-10 pt-12 sm:pt-40">
          <p className="mb-6 text-sm font-[530] text-black/60">Nov 3, 2026 · Austin · San Francisco · New York</p>
          <h1 className="font-serif text-[clamp(48px,7vw,120px)] leading-[0.98] tracking-[-0.02em] text-black [text-wrap:balance]">
            <span className="block">Don&rsquo;t know who to vote for?</span>
            <span className="block">Towny tells you who, when and where.</span>
          </h1>
          <p className="mt-6 max-w-[40ch] text-xl font-[450] text-black/60">Your ballot, explained in 2 minutes. Sourced and nonpartisan.</p>
        </section>
        <BallotAgent />
        <div className="mt-32">
          {HOME_SECTIONS.map((s) => (
            <SectionBlock key={s.heading} s={s} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
