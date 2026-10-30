import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-site scroll-mt-16 px-6 lg:px-10">
        <section className="pb-16 pt-24 sm:pt-32">
          <p className="text-sm text-ink/60">404</p>
          <h1 className="mt-3 max-w-5xl font-sans text-[clamp(3rem,8vw,7rem)] leading-[0.9] tracking-[-0.02em] text-black">Page not found.</h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-black/70">
            There is no page at this address. Start from the <a href="/">homepage</a>, or see every page in the <a href="/sitemap.xml">sitemap</a>. Agents can read <a href="/llms.txt">llms.txt</a>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
