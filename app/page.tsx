import BallotAgent from "./BallotAgent";

export default function Home() {
  return (
    <>
      <div className="bg-black text-[11px] text-white/70">
        <div className="mx-auto max-w-site px-6 py-1.5">An independent, nonpartisan civic tool. Not a government website. Not affiliated with any campaign or party.</div>
      </div>
      <header className="bg-black text-white">
        <div className="mx-auto flex max-w-site items-center justify-between px-6 py-6">
          <span className="flex items-center gap-3 text-base font-medium tracking-tight">
            <span aria-hidden className="inline-block h-4 w-4 bg-[#3760f2]" />
            townhall.town
          </span>
          <span className="text-sm text-white/70">General election · Tue, Nov 3, 2026</span>
        </div>
      </header>
      <main className="mx-auto max-w-site px-6">
        <section className="pb-12 pt-20 sm:pt-32">
          <p className="nds-caption-upper text-black/60">Austin · San Francisco · New York</p>
          <h1 className="mt-6 max-w-5xl text-[clamp(3rem,8vw,7.5rem)] font-medium leading-[0.95] tracking-[-0.04em] text-black">Your ballot, explained in&nbsp;seconds.</h1>
          <p className="mt-8 max-w-xl text-xl leading-snug text-black/60">Enter your ZIP. An agent reads every race and links a source for every fact. You decide.</p>
        </section>
        <BallotAgent />
      </main>
      <footer className="mt-32 bg-black text-white/70 [&_a]:text-white">
        <div className="mx-auto max-w-site space-y-3 px-6 py-16 text-sm leading-relaxed">
          <p className="font-medium text-white">Disclaimer</p>
          <p>
            townhall.town is nonpartisan and does not endorse candidates, parties or measures. Market odds are trading prices on Polymarket and
            Kalshi, not forecasts we endorse. Candidate statements are quoted from sources and linked; anything we could not source is marked
            &ldquo;unsure&rdquo;. Data may be incomplete or out of date.
          </p>
          <p>
            Always verify with official sources:{" "}
            <a href="https://www.votetexas.gov/">VoteTexas.gov</a> · <a href="https://www.sos.ca.gov/elections">sos.ca.gov</a> ·{" "}
            <a href="https://caearlyvoting.sos.ca.gov/">caearlyvoting.sos.ca.gov</a>
          </p>
        </div>
      </footer>
    </>
  );
}
