import BallotAgent from "./BallotAgent";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:py-16">
      <header className="flex items-center justify-between text-sm text-stone-500">
        <span className="font-semibold tracking-tight text-stone-800">townhall.town</span>
        <span>Nonpartisan · Nov 3, 2026 general election</span>
      </header>
      <section className="mt-12 sm:mt-20">
        <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">Your ballot, explained in 60 seconds</h1>
        <p className="mt-5 max-w-2xl text-xl text-stone-600">
          Type your ZIP. An AI agent finds your districts, pulls every race, looks up candidates, checks prediction markets and
          local data, and shows its sources for every fact.
        </p>
      </section>
      <BallotAgent />
      <footer className="mt-20 border-t border-stone-200 pt-6 text-sm text-stone-500">
        townhall.town is nonpartisan and does not endorse candidates or measures. Market odds are trading prices, not forecasts
        we endorse. Data may be incomplete: always verify with your county elections office (
        <a href="https://www.votetexas.gov/">VoteTexas.gov</a>, <a href="https://www.sos.ca.gov/elections">sos.ca.gov</a>,{" "}
        <a href="https://caearlyvoting.sos.ca.gov/">caearlyvoting.sos.ca.gov</a>).
      </footer>
    </main>
  );
}
