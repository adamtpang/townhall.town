"use client";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleDashed, ExternalLink, LocateFixed, Loader2, MapPin, AlertTriangle, Info } from "lucide-react";
import type { Politician, Race } from "../lib/types";
import type { Ballot, MarketQuote } from "../lib/tools";
import type { TurnoutDetail } from "../lib/turnout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Checkbox } from "../components/ui/checkbox";
import { Progress } from "../components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Tip, TooltipProvider } from "../components/ui/tooltip";
import IssueMatch from "./IssueMatch";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import RaceTiers from "./RaceTiers";
import { planRows, type PlanRow } from "../lib/logistics";

const NYC_READY = true;
const DEMO = [
  { zip: "78701", label: "Austin", ready: true },
  { zip: "94103", label: "San Francisco", ready: true },
  { zip: "10001", label: NYC_READY ? "New York" : "New York, coming soon", ready: NYC_READY },
];
// Advertised: Austin, SF, NYC. 78130 and 90012 stay working but are not advertised.
const SUPPORTED = new Set(["78701", "94103", "78130", "90012", ...(NYC_READY ? ["10001"] : [])]);
const TOOLS = ["getDistricts", "getRaces", "getCandidates", "getMarketOdds", "getLocalProblems"];
const TOOL_LABEL: Record<string, string> = {
  getDistricts: "Finding your districts",
  getRaces: "Listing every race and measure",
  getCandidates: "Looking up candidates",
  getMarketOdds: "Checking prediction markets",
  getLocalProblems: "Pulling local Census data",
};
const TOPIC_LABEL: Record<string, string> = { housing: "Housing costs", healthcare: "Health coverage", jobs: "Jobs" };

type Step = { tool: string; status: "running" | "done"; summary?: string; ms?: number };
type Markets = Record<string, { quotes: MarketQuote[]; status: string }>;
type Result = { mode: "live" | "fallback"; model: string | null; modelError: string | null; toolsRunByModel: string[]; narration: string; ballot: Ballot; markets: Markets; generatedAt: string };
type Pol = Politician & { campaignSite?: string | null; incumbentNote?: string; incumbentSource?: string; hasThemes?: boolean; positions?: (NonNullable<Politician["positions"]>[number] & { match?: string })[] };
type R = Race & { officeSource?: string };
type Problem = { id: string; label: string; value: string; year: string; topic?: string; stateValue?: number; source: { label: string; url: string } };

const ct = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " CT";
const initials = (n: string) => n.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).slice(0, 2).join("");
const pct = (x: number) => `${Math.round(x * 100)}%`;

function Section({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 py-12">
      <div className="mb-6 flex items-baseline gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-navy text-sm font-semibold text-navy">{n}</span>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-navy">{title}</h2>
          {sub && <p className="mt-1 text-slate-600">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Src({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm">
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function marketFor(markets: Markets, id: string) {
  const m = markets[id];
  if (!m || !m.quotes.length) return null;
  // Average each outcome's price across sources that list it.
  const acc: Record<string, number[]> = {};
  m.quotes.forEach((q) => q.outcomes.forEach((o) => (acc[o.name] ||= []).push(o.prob)));
  const avg = Object.entries(acc).map(([name, v]) => ({ name, prob: v.reduce((a, b) => a + b, 0) / v.length })).sort((a, b) => b.prob - a.prob);
  return { ...m, avg };
}
function oddsForCandidate(avg: { name: string; prob: number }[] | undefined, name: string) {
  if (!avg) return null;
  const last = name.split(" ").slice(-1)[0].toLowerCase();
  return avg.find((o) => o.name.toLowerCase().includes(last)) ?? null;
}

const usd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;
const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Llc|Inc|Pac|Usa|Llp|Ut)\b/g, (m) => m.toUpperCase());

function Share({ label, value }: { label: string; value: number | null }) {
  if (value == null) return <p className="text-xs text-slate-400">{label}: unsure</p>;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600"><span>{label}</span><span className="font-semibold tabular-nums text-navy">{pct(value)}</span></div>
      <Progress value={Math.round(value * 100)} className="mt-1 h-1.5" aria-label={`${label}: ${pct(value)}`} />
    </div>
  );
}

function MoneyBlock({ m }: { m: NonNullable<Politician["money"]> }) {
  const through = m.coverageThrough ? new Date(m.coverageThrough + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "unsure";
  const donors = (m.topEmployers?.length || 0) + (m.topCommittees?.length || 0);
  return (
    <div className="rounded-md border border-slate-200 p-3 text-sm">
      <p className="eyebrow mb-2">Campaign money</p>
      <dl className="grid grid-cols-3 gap-2">
        {[["Raised", m.raised], ["Spent", m.spent], ["Cash on hand", m.cashOnHand]].map(([k, v]) => (
          <div key={k as string}>
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="text-lg font-bold tabular-nums text-navy">{usd(v as number)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 space-y-2">
        <Share label="From small donors (under $200)" value={m.smallDonorPct} />
        <Share label="From in-state donors (itemized)" value={m.inStatePct} />
      </div>
      {donors > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-navy">Top donors</summary>
          {m.topEmployers?.length ? (
            <div className="mt-2">
              <p className="text-xs text-slate-500">Employers of individual donors</p>
              <ul className="mt-1 space-y-0.5">
                {m.topEmployers.map((e) => (
                  <li key={e.name} className="flex justify-between gap-2"><span className="truncate">{titleCase(e.name)}</span><span className="tabular-nums text-slate-600">{usd(e.total)}</span></li>
                ))}
              </ul>
            </div>
          ) : null}
          {m.topCommittees?.length ? (
            <div className="mt-2">
              <p className="text-xs text-slate-500">PACs, party and joint fundraising committees</p>
              <ul className="mt-1 space-y-0.5">
                {m.topCommittees.map((e) => (
                  <li key={e.name} className="flex justify-between gap-2"><span className="truncate">{titleCase(e.name)} <span className="text-xs text-slate-400">({e.kind})</span></span><span className="tabular-nums text-slate-600">{usd(e.total)}</span></li>
                ))}
              </ul>
            </div>
          ) : null}
          {m.donorsSource && <p className="mt-2"><Src href={m.donorsSource.url}>All receipts on FEC</Src></p>}
        </details>
      )}
      <p className="mt-2 text-[11px] text-slate-500">
        {m.lastReport ? `${titleCase(m.lastReport)} report, ` : ""}through {through}. <a className="text-slate-500" href={m.source.url} target="_blank" rel="noreferrer">FEC</a>. Individual donors are not named.
      </p>
    </div>
  );
}

function CandidateCard({ c, odds }: { c: Pol; odds: { prob: number } | null }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start gap-4">
        <Avatar>
          {c.photo?.url && <AvatarImage src={c.photo.url} alt={`Photo of ${c.name}`} />}
          <AvatarFallback>{initials(c.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{c.name}</CardTitle>
          <p className="text-sm text-slate-600">{c.party || "Party: unsure"}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {c.incumbent === true && (
              <Tip label={c.incumbentNote || c.incumbentSource || "Listed as incumbent on Ballotpedia"}>
                <span><Badge variant="muted">Incumbent</Badge></span>
              </Tip>
            )}
            {c.incumbent === "unsure" && <Badge variant="warn">Incumbent: unsure</Badge>}
          </div>
        </div>
        {odds && (
          <Tip label="Market odds: average trading price on Polymarket/Kalshi. Not a forecast or endorsement.">
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums text-navy">{pct(odds.prob)}</div>
              <div className="text-xs uppercase tracking-wide text-slate-500">market odds</div>
            </div>
          </Tip>
        )}
      </CardHeader>
      <CardContent className="mt-auto space-y-2">
        <div>
          <p className="eyebrow mb-1.5">Talks about</p>
          {c.causes?.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label={`Issues ${c.name} talks about`}>
              {c.causes.map((k) => (
                <li key={k.id}>
                  <Tip label={`“${k.quote}” (${k.mentions} mention${k.mentions === 1 ? "" : "s"}; keyword match in ${k.source.label}, verify)`}>
                    <a href={k.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border border-[#bfd9ea] bg-[#e7f2f8] px-2.5 py-0.5 text-xs font-medium text-flagblue no-underline hover:bg-[#d4e8f3]">
                      {k.label}
                    </a>
                  </Tip>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-slate-400">Causes: unsure (no campaign themes on file)</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {c.officialSite ? <Src href={c.officialSite}>Official site</Src> : <span className="text-sm text-slate-400">Official site: unsure</span>}
          <Src href={c.campaignSite}>Campaign</Src>
          {c.x ? <Src href={c.x}>X</Src> : <span className="text-sm text-slate-400">X: unsure</span>}
          <Src href={c.ballotpedia}>Ballotpedia</Src>
          <Src href={c.finance?.url}>{c.finance?.label?.startsWith("FEC") ? "FEC" : c.finance?.label?.includes("Ethics") ? "TEC" : "Finance"}</Src>
        </div>
        {c.photo && <p className="text-xs text-slate-400">{c.photo.page ? <a className="text-slate-400" href={c.photo.page} target="_blank" rel="noreferrer">{c.photo.credit}</a> : c.photo.credit}</p>}
        {c.money && <MoneyBlock m={c.money} />}
      </CardContent>
    </Card>
  );
}

export default function BallotAgent() {
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [steps, setSteps] = useState<Record<string, Step>>({});
  const [status, setStatus] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [care, setCare] = useState<Record<string, boolean>>({});
  const t0 = useRef(0);
  const [elapsed, setElapsed] = useState<number | null>(null);

  async function run(z: string) {
    z = z.replace(/\D/g, "").slice(0, 5);
    setResult(null);
    setSteps({});
    setStatus([]);
    if (z.length !== 5) return setNotice("Enter a 5-digit ZIP code.");
    if (!SUPPORTED.has(z)) { setZip(z); return setNotice("We only cover 78701 (Austin), 94103 (San Francisco) and 10001 (New York) for now."); }
    setZip(z);
    setBusy(true);
    setSteps({});
    setStatus([]);
    setResult(null);
    setNotice(null);
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
          else if (e.type === "status") { console.debug("[agent]", e.message); setStatus((s) => [...s, "Looking up your ballot…"]); }
          else if (e.type === "unsupported") setNotice("We only cover 78701 (Austin), 94103 (San Francisco) and 10001 (New York) for now.");
          else if (e.type === "error") { console.error("[agent]", e.message); setNotice("Couldn't load your ballot right now. Please try again."); }
          else if (e.type === "result") {
            setResult(e);
            setCare(Object.fromEntries(((e.ballot?.problems || []) as Problem[]).map((p) => [p.topic || p.id, true])));
            setElapsed((Date.now() - t0.current) / 1000);
          }
        }
      }
    } catch (err) {
      console.error("[agent]", err);
      setNotice("Something went wrong talking to the agent. Please try again.");
    }
    setBusy(false);
    setTimeout(() => document.getElementById("ballot")?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function locate() {
    if (!navigator.geolocation) return setNotice("Location isn't available in this browser. Type your ZIP instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const r = await fetch("/api/locate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lat: p.coords.latitude, lon: p.coords.longitude }) });
          const d = await r.json();
          if (d.zip) run(d.zip);
          else setNotice((typeof d.error === "string" ? d.error : d.error?.message) || "Couldn't find a ZIP for your location.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setNotice("Location permission denied. Type your ZIP instead.");
      },
      { timeout: 10000 }
    );
  }

  const b = result?.ballot;
  const races = (b?.races || []) as R[];
  const problems = (b?.problems || []) as Problem[];
  const markets = result?.markets || {};
  const doneCount = TOOLS.filter((t) => steps[t]?.status === "done").length;
  const picked = problems.filter((p) => care[p.topic || p.id]);
  const marketRaces = useMemo(() => races.filter((r) => marketFor(markets, r.id)), [races, markets]);

  return (
    <TooltipProvider>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(zip);
        }}
        className="flex max-w-2xl items-end gap-4"
      >
        <Input
          inputMode="numeric"
          autoComplete="postal-code"
          aria-label="ZIP code"
          placeholder="Enter your ZIP"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          className="h-16 text-3xl sm:text-4xl"
        />
        <Button type="submit" size="lg" disabled={busy}>{busy ? "Reading…" : "Go"}</Button>
      </form>
      <div className="mt-6 flex flex-wrap gap-2">
        {DEMO.map((d) => (
          <Button key={d.zip} type="button" variant="outline" size="sm" disabled={!d.ready || busy} onClick={() => run(d.zip)}>
            {d.label}
          </Button>
        ))}
      </div>
      {notice && <p className="mt-6 text-base text-black">{notice}</p>}
      {(busy || (result && !b)) && (
        <div className="mt-10 max-w-2xl">
          <Progress value={busy ? Math.max(8, (doneCount / TOOLS.length) * 100) : 100} className="h-px" />
          <p className="mt-2 text-sm text-black/50">{busy ? (TOOLS.map((t) => steps[t]).filter((s) => s?.status !== "done").length ? TOOL_LABEL[TOOLS.find((t) => steps[t]?.status !== "done") || TOOLS[0]] : "Writing your ballot") + "…" : ""}</p>
        </div>
      )}

      {b && (
        <div id="ballot" className="mt-32">
          <p className="text-sm text-black/60">
            {b.place}{b.state === "NY" && b.verify && <> · <a href={b.verify.url} target="_blank" rel="noreferrer">{b.verify.label}</a></>}{b.splitWarning && b.districts.length > 1 && <> · Your ZIP spans two House districts. <a href={b.state === "TX" ? "https://wrm.capitol.texas.gov/" : b.state === "NY" ? (b.verify?.url ?? "https://findmypollsite.vote.nyc/") : "https://www.sos.ca.gov/elections"} target="_blank" rel="noreferrer">Check which is yours</a></>}{problems.length === 0 ? " · No local problem data for this ZIP yet." : null}
          </p>
          <RaceTiers races={races} market={(id) => marketFor(markets, id)} />
          <IssueMatch state={b.state} races={b.races} />
          <section id="plan" className="border-t border-black py-24">
            <p className="text-sm text-black/50">03</p>
            <h2 className="mt-3 font-serif text-6xl leading-none tracking-tight sm:text-7xl">Your plan</h2>
            <Plan zip={b.zip} state={b.state} />
          </section>
        </div>
      )}

    </TooltipProvider>
  );
}

function MarketBlock({ mk }: { mk: { quotes: MarketQuote[]; status: string; avg: { name: string; prob: number }[] } }) {
  return (
    <div className="mt-3 space-y-3">
      {mk.avg.slice(0, 4).map((o) => (
        <div key={o.name}>
          <div className="flex justify-between text-sm"><span>{o.name}</span><span className="font-semibold tabular-nums text-navy">{pct(o.prob)}</span></div>
          <Progress value={o.prob * 100} className="mt-1" />
        </div>
      ))}
      <div className="space-y-1 text-xs text-slate-500">
        {mk.quotes.map((q) => (
          <p key={q.source}>
            <a href={q.url}>{q.source}</a>: “{q.title}” · {q.cached ? "cached" : "fetched"} {ct(q.fetchedAt)}
            {q.matchedByTitle && " · matched by title"}
          </p>
        ))}
      </div>
    </div>
  );
}

function TurnoutSection({ t }: { t: TurnoutDetail }) {
  const fmt = (v?: number | null) => (v == null ? "No record found" : v.toLocaleString("en-US"));
  const stats = [
    { label: `Turnout, ${t.pastElection}`, value: t.turnoutPct != null ? `${t.turnoutPct.toFixed(1)}%` : "No record found", hint: t.previous?.turnoutPct != null ? `${t.previous.election}: ${t.previous.turnoutPct.toFixed(1)}%` : undefined },
    { label: "Ballots cast", value: fmt(t.ballotsCast), hint: `of ${fmt(t.registered)} registered` },
    { label: "Eligible but didn't vote", value: fmt(t.eligibleNonVoters), hint: t.nonVoterBasis },
    { label: "Registered for 2026", value: fmt(t.registered2026?.value), hint: t.registered2026?.asOf ? `as of ${t.registered2026.asOf}` : undefined },
  ];
  return (
    <Section n={7} title={`Who votes in ${t.county}`} sub="Official county and state turnout, each number linked to its source.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <span className="eyebrow">{s.label}</span>
              <div className="mt-1 text-3xl font-bold tabular-nums text-navy">{s.value}</div>
              {s.hint && <CardDescription>{s.hint}</CardDescription>}
            </CardHeader>
          </Card>
        ))}
      </div>
      {t.ifEveryoneVoted && (
        <p className="mt-4 text-slate-700">If every eligible person had voted, about {t.ifEveryoneVoted.ballots.toLocaleString("en-US")} ballots would have been cast: {t.ifEveryoneVoted.multiplier}x the actual number.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {t.sources.map((s) => <Src key={s.url} href={s.url}>{s.label}</Src>)}
      </div>
    </Section>
  );
}


// Plan rows come from data/election_dates.json + data/polling_locations.json (lib/logistics.ts).
// Only the ID ("Bring") row is still hand-written: ID rules are not in Civic's data files yet.
const BRING: Record<"TX" | "CA" | "NY", PlanRow> = {
  TX: { k: "Bring", title: "One approved photo ID", src: "https://www.votetexas.gov/voting/need-id.html", s: "Accepted IDs" },
  NY: { k: "Bring", title: "ID rules depend on how you registered", src: "https://elections.ny.gov/", s: "New York State Board of Elections" },
  CA: { k: "Bring", title: "Usually no ID needed", src: "https://voterstatus.sos.ca.gov/", s: "Check your voter status" },
};
// ZIPs we cover without official logistics data get links to the official source only, no dates.
const LOOKUP: Record<"TX" | "CA" | "NY", PlanRow> = {
  TX: { k: "When", title: "Dates, hours and places are set by your county", src: "https://www.votetexas.gov/voting/when.html", s: "VoteTexas.gov" },
  NY: { k: "When", title: "Dates, hours and places", src: "https://findmypollsite.vote.nyc/", s: "NYC Board of Elections" },
  CA: { k: "When", title: "Dates, hours and vote centers are set by your county", src: "https://caearlyvoting.sos.ca.gov/", s: "caearlyvoting.sos.ca.gov" },
};

function Plan({ zip, state }: { zip: string; state: "TX" | "CA" | "NY" }) {
  const official = planRows(zip);
  const rows = [...(official.length ? official : [LOOKUP[state]]), BRING[state]];
  return (
    <dl className="mt-16">
      {rows.map((r) => (
        <div key={r.k + r.title} className={`grid grid-cols-1 gap-2 border-t border-black/15 py-8 sm:grid-cols-12${r.past ? " opacity-50" : ""}`}>
          <dt className="font-serif text-5xl leading-none sm:col-span-4 sm:text-6xl">{r.k}</dt>
          <dd className="sm:col-span-8">
            <p className="text-xl">{r.title}</p>
            {r.detail?.map((d) => <p key={d} className="mt-2 text-base text-black/70">{d}</p>)}
            {r.sites?.map((g) => (
              <div key={g.label} className="mt-4">
                <p className="text-sm text-black/50">{g.label}</p>
                <ul className="mt-1 space-y-2">
                  {g.list.map((x) => (
                    <li key={x.name + x.address} className="text-base">
                      <span className="font-medium">{x.name}</span>{x.room ? `, ${x.room}` : ""}
                      <span className="block text-sm text-black/60">{x.address}{x.dates ? ` · ${x.dates}` : ""}{x.hours ? ` · ${x.hours}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <a className="mt-2 inline-block text-sm" href={r.src} target="_blank" rel="noreferrer">{r.s} ↗</a>
          </dd>
        </div>
      ))}
    </dl>
  );
}
