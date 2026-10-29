import BallotAgent from "./BallotAgent";

export default function Home() {
  return (
    <>
      <div className="bg-slate-100 text-xs text-slate-700">
        <div className="mx-auto max-w-5xl px-6 py-1.5">An independent, nonpartisan civic tool. Not a government website. Not affiliated with any campaign or party.</div>
      </div>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight text-navy">
            <span aria-hidden className="inline-block h-5 w-1.5 rounded-sm bg-flagred" />
            townhall.town
          </span>
          <span className="text-sm text-slate-600">General election · Tue, Nov 3, 2026</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6">
        <section className="pb-10 pt-16 sm:pt-24">
          <p className="eyebrow">Texas · California</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight text-navy sm:text-6xl">Your ballot, explained in 60 seconds</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Enter your ZIP. An AI agent finds your districts, lists every race, looks up the candidates, checks prediction markets and
            local Census data, and links a source for every fact. It never tells you who to vote for.
          </p>
        </section>
        <BallotAgent />
      </main>
      <footer className="mt-24 border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl space-y-3 px-6 py-10 text-sm leading-relaxed text-slate-600">
          <p className="font-semibold text-navy">Disclaimer</p>
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
