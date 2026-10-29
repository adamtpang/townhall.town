import BallotAgent from "./BallotAgent";

export default function Home() {
  return (
    <>
      <header className="mx-auto flex max-w-site items-center justify-between px-6 py-8">
        <span className="flex items-center gap-3 text-base font-medium tracking-tight">
          <span aria-hidden className="inline-block h-3 w-3 bg-[#3760f2]" />
          townhall.town
        </span>
        <span className="text-sm text-black/50">Nov 3, 2026</span>
      </header>
      <main className="mx-auto max-w-site px-6">
        <section className="pb-16 pt-24 sm:pt-40">
          <h1 className="max-w-5xl font-serif text-[clamp(3.5rem,10vw,9rem)] leading-[0.9] tracking-[-0.02em] text-black">Your ballot, explained.</h1>
        </section>
        <BallotAgent />
      </main>
      <footer className="mx-auto mt-40 max-w-site border-t border-black/15 px-6 py-10 text-sm text-black/50">
        <p>Nonpartisan. Not a government site. No endorsements. Every fact links its source; confirm with your state.</p>
        <a href="https://github.com/adamtpang/townhall.town" target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm text-black/50 no-underline transition-colors hover:text-[#3760f2]">
          Open source. Add your city on GitHub
        </a>
      </footer>
    </>
  );
}
