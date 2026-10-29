import type { PageContent } from "../lib/content";
import { Inline, SectionBlock } from "./Prose";
import { SiteFooter, SiteHeader } from "./SiteChrome";

// Shared layout for trust pages (/about, /contact, /privacy). All copy is server rendered.
export default function InfoPage({ page }: { page: PageContent }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-site px-6">
        <section className="pb-16 pt-24 sm:pt-32">
          <h1 className="max-w-5xl font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.9] tracking-[-0.02em] text-black">{page.title}</h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-black/70">
            <Inline text={page.lead} />
          </p>
        </section>
        {page.sections.map((s) => (
          <SectionBlock key={s.heading} s={s} />
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
