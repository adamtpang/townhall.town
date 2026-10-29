"use client";
import { useState, useRef } from "react";
import positions from "../data/positions.json";

const DEMOS = [
  { zip: "78130", label: "New Braunfels, TX" },
  { zip: "78701", label: "Austin, TX" },
  { zip: "94103", label: "San Francisco, CA" },
  { zip: "90012", label: "Los Angeles, CA" },
];
const ORDER = ["getDistricts", "getRaces", "getCandidates", "getMarketOdds", "getLocalProblems"];
const LABEL: Record<string, string> = {
  getDistricts: "Find your districts",
  getRaces: "Pull your races",
  getCandidates: "Look up candidates",
  getMarketOdds: "Fetch market odds",
  getLocalProblems: "Pull local problems",
};

type Step = { tool: string; status: string; summary?: string; ms?: number };
type Quote = { source: string; url: string; api: string; outcomes: { name: string; prob: number }[]; fetchedAt: string; cached?: boolean };
type Pos = { topic: string; text: string; source: string };
const POS = positions as Record<string, Pos[]>;

const pct = (p: number) => `${Math.round(p * 100)}%`;
const ct = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " CT";

function matchOdds(name: string, quotes: Quote[]) {
  const last = name.split(" ").slice(-1)[0].toLowerCase();
  return quotes
    .map((q) => ({ q, o: q.outcomes.find((o) => o.name.toLowerCase().includes(last)) }))
    .filter((x) => x.o) as { q: Quote; o: { name: string; prob: number } }[];
}

export default function BallotAgent() {
  const [zip, setZip] = useState("");
  const [steps, setSteps] = useState<Record<string, Step>>({});
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [care, setCare] = useState<Record<string, boolean>>({});
  const t0 = useRef(0);
  const [elapsed, setElapsed] = useState<number | null>(null);

  async function go(z: string) {
    z = z.replace(/\D/g, "").slice(0, 5);
    if (z.length !== 5 || busy) return;
    setZip(z);
    setBusy(true);
    setSteps({});
    setLog([]);
    setResult(null);
    setUnsupported(null);
    setElapsed(null);
    t0.current = Date.now();
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ zip: z }) });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "step") setSteps((s) => ({ ...s, [e.tool]: e }));
          else if (e.type === "status") setLog((l) => [...l, e.message]);
          else if (e.type === "unsupported") setUnsupported(e.message);
          else if (e.type === "error") setLog((l) => [...l, "Error: " + e.message]);
          else if (e.type === "result") {
            setResult(e);
            setCare(Object.fromEntries((e.ballot?.problems || []).map((p: any) => [p.id, true])));
          }
        }
      }
    } catch (err: any) {
      setLog((l) => [...l, "Network error: " + err.message]);
    }
    setElapsed((Date.now() - t0.current) / 1000);
    setBusy(false);
  }

  const b = result?.ballot;
  const markets: Record<string, { quotes: Quote[]; status: string }> = result?.markets || {};

  return (
    <div className="mt-10">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(zip);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          inputMode="numeric"
          maxLength={5}
          placeholder="Your ZIP code"
          aria-label="ZIP code"
          className="w-full rounded-2xl border-2 border-stone-300 bg-white px-6 py-4 text-3xl font-semibold tracking-widest outline-none focus:border-stone-900 sm:w-72"
        />
        <button disabled={busy} className="rounded-2xl bg-stone-900 px-8 py-4 text-2xl font-bold text-white disabled:opacity-50">
          {busy ? "Working…" : "Explain my ballot"}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="py-2 text-sm text-stone-500">Try:</span>
        {DEMOS.map((d) => (
          <button key={d.zip} onClick={() => go(d.zip)} disabled={busy} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm hover:border-stone-900">
            <b>{d.zip}</b> {d.label}
          </button>
        ))}
      </div>

      {(busy || result || unsupported) && (
        <section className="mt-10 rounded-3xl border border-stone-200 bg-white p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">Agent run</h2>
            {result && (
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${result.mode === "live" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                {result.mode === "live" ? `live LLM tool loop · ${result.model}` : "fallback mode (no model)"}
              </span>
            )}
          </div>
          <ol className="mt-4 space-y-2">
            {ORDER.map((t, i) => {
              const s = steps[t];
              return (
                <li key={t} className="flex gap-3 text-lg">
                  <span className="w-6 text-center">{!s ? "○" : s.status === "running" ? <span className="inline-block animate-spin">◌</span> : "✓"}</span>
                  <span className={s ? "text-stone-900" : "text-stone-400"}>
                    {i + 1}. {LABEL[t]}
                    {s?.summary && <span className="block text-sm text-stone-500">{s.summary}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          {log.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-stone-500">
              {log.map((l, i) => (
                <li key={i}>› {l}</li>
              ))}
            </ul>
          )}
          {elapsed !== null && <p className="mt-3 text-sm text-stone-500">Finished in {elapsed.toFixed(1)}s.</p>}
          {result?.narration && <p className="mt-4 rounded-xl bg-stone-50 p-4 text-stone-700">{result.narration}</p>}
          {unsupported && <p className="mt-4 text-lg text-stone-700">{unsupported}</p>}
        </section>
      )}

      {b && (
        <>
          <section className="mt-12">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Your ballot: {b.place} <span className="text-stone-400">{b.zip}</span>
            </h2>
            <p className="mt-2 text-stone-600">
              Election day: Tuesday, Nov 3, 2026. Districts: {b.districts.map((d: any) => d.label).join(", ")}. Source:{" "}
              <a href={b.districtSource.url}>{b.districtSource.label}</a>.
            </p>
            {b.splitWarning && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-amber-900">⚠ {b.splitWarning} Both possible House races are shown.</p>}
            <p className="mt-2 text-sm text-stone-500">
              Not shown yet: state legislative, judicial, county and local races (unsure). Check your official sample ballot via{" "}
              <a href={b.verify.url}>{b.verify.label}</a>.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-bold">What your area needs</h2>
            <p className="text-stone-600">Toggle what you care about. We show which candidates have a sourced, stated position on it.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {b.problems.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setCare((c) => ({ ...c, [p.id]: !c[p.id] }))}
                  className={`rounded-2xl border-2 p-4 text-left ${care[p.id] ? "border-stone-900 bg-white" : "border-stone-200 bg-stone-100 opacity-70"}`}
                >
                  <div className="text-4xl font-extrabold">
                    {p.value}
                    {p.unit}
                  </div>
                  <div className="font-semibold">{p.label}</div>
                  <div className="text-sm text-stone-500">
                    State: {p.stateValue}
                    {p.unit} · {p.year} ·{" "}
                    <a href={p.source} onClick={(e) => e.stopPropagation()}>
                      Census {p.table}
                    </a>
                  </div>
                  <div className="mt-2 text-xs font-semibold uppercase tracking-wide">{care[p.id] ? "✓ I care" : "tap to care"}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-12 space-y-6">
            <h2 className="text-2xl font-bold">Races</h2>
            {b.races.map((r: any) => {
              const m = markets[r.id] || { quotes: [], status: "no market found" };
              return (
                <article key={r.id} className="rounded-3xl border border-stone-200 bg-white p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-2xl font-bold">{r.title}</h3>
                    <span className="text-xs uppercase tracking-wide text-stone-500">{r.level}</span>
                  </div>
                  <p className="mt-1 text-lg text-stone-700">{r.office}</p>
                  {r.source ? (
                    <p className="text-sm text-stone-500">
                      Candidates source: <a href={r.source}>Ballotpedia</a>
                    </p>
                  ) : (
                    <p className="text-sm text-amber-800">{r.note}</p>
                  )}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {r.candidates.map((c: any) => {
                      const odds = matchOdds(c.name, m.quotes);
                      const pos = (POS[c.name] || []).filter((x) => care[x.topic] || care[b.problems.find((p: any) => p.topic === x.topic)?.id]);
                      return (
                        <div key={c.name} className="rounded-2xl border border-stone-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xl font-bold">{c.name}</div>
                              <div className="text-sm text-stone-600">
                                <span className="rounded bg-stone-100 px-1.5 py-0.5">{c.party}</span>
                                {c.incumbent && <span className="ml-2 rounded bg-stone-800 px-1.5 py-0.5 text-white">incumbent</span>}
                              </div>
                            </div>
                            {odds.length > 0 && (
                              <div className="text-right">
                                <div className="text-4xl font-extrabold">{pct(odds.reduce((s, x) => s + x.o.prob, 0) / odds.length)}</div>
                                <div className="text-[11px] uppercase tracking-wide text-stone-500">market odds</div>
                              </div>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                            {c.officialSite ? <a href={c.officialSite}>Official site</a> : <span className="text-stone-400">Official site: unsure</span>}
                            {c.ballotpedia && <a href={c.ballotpedia}>Ballotpedia</a>}
                            {c.finance && <a href={c.finance.url}>{c.finance.label}</a>}
                          </div>
                          {odds.length > 0 && (
                            <div className="mt-2 text-xs text-stone-500">
                              {odds.map(({ q, o }) => (
                                <div key={q.source}>
                                  <a href={q.url}>{q.source}</a> {pct(o.prob)} · {q.cached ? "cached" : "fetched"} {ct(q.fetchedAt)}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 border-t border-stone-100 pt-2 text-sm">
                            {b.problems
                              .filter((p: any) => care[p.id])
                              .map((p: any) => {
                                const hit = pos.find((x) => x.topic === p.topic || x.topic === p.id);
                                return (
                                  <div key={p.id} className="text-stone-600">
                                    <b className="text-stone-800">{p.topic}:</b>{" "}
                                    {hit ? (
                                      <>
                                        “{hit.text}” <a href={hit.source}>source</a>
                                      </>
                                    ) : (
                                      <span className="text-stone-400">no stated position found</span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {m.quotes.length === 0 && <p className="mt-3 text-sm text-stone-500">Market odds: no market found.</p>}
                </article>
              );
            })}
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-bold">Ballot measures</h2>
            <p className="text-stone-600">{b.measuresNote}</p>
            <div className="mt-4 space-y-3">
              {b.measures.map((ms: any) => {
                const m = markets[ms.id] || { quotes: [] };
                const yes = m.quotes.map((q: Quote) => ({ q, o: q.outcomes[0] }));
                return (
                  <div key={ms.id} className="flex items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4">
                    <div>
                      <div className="font-bold">{ms.title}</div>
                      <div className="text-stone-700">{ms.summary}</div>
                      <a href={ms.source} className="text-sm">
                        Ballotpedia
                      </a>
                      {yes.length > 0 && (
                        <div className="mt-1 text-xs text-stone-500">
                          {yes.map(({ q, o }: any) => (
                            <span key={q.source} className="mr-3">
                              <a href={q.url}>{q.source}</a> {pct(o.prob)} yes · {q.cached ? "cached" : "fetched"} {ct(q.fetchedAt)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {yes.length ? (
                        <>
                          <div className="text-3xl font-extrabold">{pct(yes.reduce((s: number, x: any) => s + x.o.prob, 0) / yes.length)}</div>
                          <div className="text-[11px] uppercase tracking-wide text-stone-500">market odds it passes</div>
                        </>
                      ) : (
                        <div className="text-xs text-stone-400">no market found</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <p className="mt-10 rounded-2xl bg-stone-100 p-4 text-sm text-stone-600">
            Nonpartisan: we never rank candidates or say who is best. Unsourced facts are shown as “unsure”. Verify everything with your county
            elections office: <a href={b.verify.url}>{b.verify.label}</a>
            {b.state === "CA" && (
              <>
                {" "}
                · <a href="https://caearlyvoting.sos.ca.gov/">caearlyvoting.sos.ca.gov</a>
              </>
            )}
            . Data snapshot built {ct(b.builtAt)}.
          </p>
        </>
      )}
    </div>
  );
}
