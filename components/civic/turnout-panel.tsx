// Turnout panel for one ZIP. Shadcn theme tokens only (bg-card, text-muted-foreground),
// so it drops into the app without extra component installs.
import type { TurnoutDetail } from "../../lib/turnout";

const fmt = (v: number | undefined | null) => (v == null ? "No record found" : v.toLocaleString("en-US"));

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function TurnoutPanel({ turnout: t }: { turnout: TurnoutDetail }) {
  return (
    <section className="space-y-4" aria-labelledby="turnout-heading">
      <div>
        <h2 id="turnout-heading" className="text-xl font-semibold">
          Who votes in {t.county}
        </h2>
        <p className="text-sm text-muted-foreground">Official county and state results, each linked to its source.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={`Turnout, ${t.pastElection}`}
          value={t.turnoutPct != null ? `${t.turnoutPct.toFixed(1)}%` : "No record found"}
          hint={t.previous?.turnoutPct != null ? `${t.previous.election}: ${t.previous.turnoutPct.toFixed(1)}%` : undefined}
        />
        <Stat label="Ballots cast" value={fmt(t.ballotsCast)} hint={`of ${fmt(t.registered)} registered`} />
        <Stat label="People who sat it out" value={fmt(t.eligibleNonVoters)} hint={t.nonVoterBasis} />
        <Stat
          label="Registered for 2026"
          value={fmt(t.registered2026?.value)}
          hint={t.registered2026?.asOf ? `as of ${t.registered2026.asOf}` : undefined}
        />
      </div>
      {t.yourBallotOneIn || t.ifEveryoneVoted ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed space-y-1">
          {t.yourBallotOneIn ? (
            <p>
              A ballot here in {t.pastElection} was 1 of {t.yourBallotOneIn.toLocaleString("en-US")}.
            </p>
          ) : null}
          {t.ifEveryoneVoted ? (
            <p>
              If everyone who sat it out had voted, {t.ifEveryoneVoted.ballots.toLocaleString("en-US")} ballots would have been
              cast, {t.ifEveryoneVoted.multiplier}x the actual turnout.
            </p>
          ) : null}
        </div>
      ) : null}
      <ul className="space-y-1 text-xs text-muted-foreground">
        {t.sources.map((s) => (
          <li key={s.url}>
            <a className="underline underline-offset-2 hover:text-foreground" href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
