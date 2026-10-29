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
        <section className="pb-16 pt-24 sm:pt-40">
          <h1 className="max-w-5xl font-serif text-[clamp(3.5rem,10vw,9rem)] leading-[0.9] tracking-[-0.02em] text-black">Your ballot, explained.</h1>
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
