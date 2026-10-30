"use client";
import { initials } from "../components/PortraitRow";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { voteMatters } from "../lib/voteMatters.mjs";
import { CheckCircle2, CircleDashed, ExternalLink, LocateFixed, Loader2, MapPin, AlertTriangle, Info } from "lucide-react";
import type { Politician, Race } from "../lib/types";
import type { Ballot, MarketQuote } from "../lib/tools";
import type { PolyQuote } from "../lib/marketLine";
import { useT } from "../lib/i18n";
import AgentTrace from "./AgentTrace";
import type { TurnoutDetail } from "../lib/turnout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Checkbox } from "../components/ui/checkbox";
import { Progress } from "../components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Tip, TooltipProvider } from "../components/ui/tooltip";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { COVERED_ZIPS, UNSUPPORTED_MESSAGE as UNSUPPORTED } from "../lib/site";
import { SHOW_NEWS } from "../lib/flags";
import { measuresFor } from "../lib/measures";
import dynamic from "next/dynamic";

// QA P2 bundle trim: everything below the ZIP box (tiers + office text, issues, Towny chat, research, plan)
// only renders after a ballot loads, so it is fetched then, not on first paint.
const RaceTiers = dynamic(() => import("./RaceTiers"), { ssr: false, loading: () => <p className="py-12 text-base text-black/60 lg:py-16">Loading races…</p> });
const IssueMatch = dynamic(() => import("./IssueMatch"), { ssr: false });
const LocalNews = dynamic(() => import("./LocalNews"), { ssr: false });

const NYC_READY = true;
const DEMO = [
  { zip: "78701", label: "Austin", ready: true },
  { zip: "94103", label: "San Francisco", ready: true },
  { zip: "10001", label: NYC_READY ? "New York" : "New York, coming soon", ready: NYC_READY },
];
// Advertised: Austin, SF, NYC. 78130 and 90012 stay working but are not advertised.
// Served: Austin, SF, NYC only (lib/site.ts COVERED_ZIPS); the API returns "unsupported" for every other ZIP.
// 77002 (Houston) stays cached in data/ballots.json but is hidden until after the Oct 30 Hack Fair (Adam; main #31).
const SUPPORTED = new Set<string>(COVERED_ZIPS);
const TOOLS = ["getDistricts", "getRaces", "getCandidates", "getMarketOdds", "getLocalProblems"];
const TOOL_LABEL: Record<string, string> = {
  getDistricts: "Finding your districts",
  getRaces: "Listing every race and measure",
  getCandidates: "Looking up candidates",
  getMarketOdds: "Checking Polymarket prices",
  getLocalProblems: "Pulling local Census data",
};
const TOPIC_LABEL: Record<string, string> = { housing: "Housing costs", healthcare: "Health coverage", jobs: "Jobs" };

type Step = { tool: string; status: "running" | "done"; summary?: string; ms?: number };
type Markets = Record<string, { quotes: MarketQuote[]; status: string }>;
type Result = { mode: "live" | "fallback"; model: string | null; modelError: string | null; toolsRunByModel: string[]; narration: string; summaryBullets?: import("./AgentTrace").SummaryBullet[]; ballot: Ballot; markets: Markets; generatedAt: string };
type Pol = Politician & { campaignSite?: string | null; incumbentNote?: string; incumbentSource?: string; hasThemes?: boolean; positions?: (NonNullable<Politician["positions"]>[number] & { match?: string })[] };
type R = Race & { officeSource?: string };
type Problem = { id: string; label: string; value: string; year: string; topic?: string; stateValue?: number; source: { label: string; url: string } };

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Section({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-neutral-200 py-12">
      <div className="mb-6 flex items-baseline gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-navy text-sm font-semibold text-navy">{n}</span>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-navy">{title}</h2>
          {sub && <p className="mt-1 text-neutral-600">{sub}</p>}
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

/** The single live Polymarket quote for a contest, or null. No averaging, no estimates (Adam, Oct 29 2026). */
function marketFor(markets: Markets, id: string): PolyQuote | null {
  const q = markets[id]?.status === "live" ? markets[id].quotes[0] : undefined;
  return q && q.source === "Polymarket" ? (q as PolyQuote) : null;
}

const usd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;
const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Llc|Inc|Pac|Usa|Llp|Ut)\b/g, (m) => m.toUpperCase());

function Share({ label, value }: { label: string; value: number | null }) {
  if (value == null) return <p className="text-sm text-neutral-400">{label}: unsure</p>;
  return (
    <div>
      <div className="flex justify-between text-sm text-neutral-600"><span>{label}</span><span className="font-semibold tabular-nums text-navy">{pct(value)}</span></div>
      <Progress value={Math.round(value * 100)} className="mt-1 h-1.5" aria-label={`${label}: ${pct(value)}`} />
    </div>
  );
}

function MoneyBlock({ m }: { m: NonNullable<Politician["money"]> }) {
  const through = m.coverageThrough ? new Date(m.coverageThrough + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "unsure";
  const donors = (m.topEmployers?.length || 0) + (m.topCommittees?.length || 0);
  return (
    <div className="rounded-md border border-neutral-200 p-3 text-sm">
      <p className="eyebrow mb-2">Campaign money</p>
      <dl className="grid grid-cols-3 gap-2">
        {[["Raised", m.raised], ["Spent", m.spent], ["Cash on hand", m.cashOnHand]].map(([k, v]) => (
          <div key={k as string}>
            <dt className="text-sm text-neutral-500">{k}</dt>
            <dd className="text-lg font-bold tabular-nums text-navy">{usd(v as number)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 space-y-2">
        <Share label="From small donors (under $200)" value={m.smallDonorPct ?? null} />
        <Share label="From in-state donors (itemized)" value={m.inStatePct ?? null} />
      </div>
      {donors > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-navy">Top donors</summary>
          {m.topEmployers?.length ? (
            <div className="mt-2">
              <p className="text-sm text-neutral-500">Employers of individual donors</p>
              <ul className="mt-1 space-y-0.5">
                {m.topEmployers.map((e) => (
                  <li key={e.name} className="flex justify-between gap-2"><span className="truncate">{titleCase(e.name)}</span><span className="tabular-nums text-neutral-600">{usd(e.total)}</span></li>
                ))}
              </ul>
            </div>
          ) : null}
          {m.topCommittees?.length ? (
            <div className="mt-2">
              <p className="text-sm text-neutral-500">PACs, party and joint fundraising committees</p>
              <ul className="mt-1 space-y-0.5">
                {m.topCommittees.map((e) => (
                  <li key={e.name} className="flex justify-between gap-2"><span className="truncate">{titleCase(e.name)} <span className="text-sm text-neutral-400">({e.kind})</span></span><span className="tabular-nums text-neutral-600">{usd(e.total)}</span></li>
                ))}
              </ul>
            </div>
          ) : null}
          {m.donorsSource && <p className="mt-2"><Src href={m.donorsSource.url}>All receipts on FEC</Src></p>}
        </details>
      )}
      <p className="mt-2 text-sm text-neutral-500">
        {m.lastReport ? `${titleCase(m.lastReport)} report, ` : ""}through {through}. <a className="text-neutral-500" href={m.source.url} target="_blank" rel="noreferrer">FEC</a>. Individual donors are not named.
      </p>
    </div>
  );
}


/** Design 2: one sourced sentence under the hero subline, only once a ZIP is known. */
function HeroStat({ vm }: { vm: { text: string; sources: { label: string; title?: string; url: string }[] } }) {
  return (
    <div className="mt-12 max-w-2xl border-l-2 border-black pl-4" data-vote-matters>
      <p className="text-sm font-[530] text-black/60">Your vote matters most here</p>
      <p className="mt-1 text-xl leading-7 font-[450] text-black">{vm.text}</p>
      <p className="mt-1 text-sm leading-5 font-[450]">{vm.sources.map((s, i) => <span key={s.url}>{i ? " · " : ""}<a href={s.url} title={s.title} target="_blank" rel="noreferrer" className="relative th-link after:absolute after:-inset-x-1 after:-inset-y-1 after:content-['']">{s.label} ↗<span className="sr-only"> (opens in a new tab)</span></a></span>)}</p>
    </div>
  );
}

export default function BallotAgent() {
  const t = useT();
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

  // Open the ballot named in ?zip= on first load (same checks as typing it).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("zip");
    if (q && /^\d{5}$/.test(q)) void run(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 01 Your city cards (components/media/CityCards.tsx) do what the chips do: load that city's ZIP in place.
  useEffect(() => {
    const on = (e: Event) => { const z = (e as CustomEvent<string>).detail; if (typeof z === "string") void run(z); };
    window.addEventListener("townhall:zip", on);
    return () => window.removeEventListener("townhall:zip", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(z: string) {
    const raw = z;
    z = raw;
    setResult(null);
    setSteps({});
    setStatus([]);
    if (!/^\d{5}$/.test(raw) || z === "00000") { setZip(raw); return setNotice("Enter a valid 5-digit ZIP"); }
    if (!SUPPORTED.has(z)) { setZip(z); return setNotice(UNSUPPORTED); }
    setZip(z);
    // QA P2: the address bar follows the ZIP being shown, so a reload or a shared link opens the same ballot.
    try { const u = new URL(window.location.href); if (u.searchParams.get("zip") !== z) { u.searchParams.set("zip", z); window.history.replaceState(null, "", u.toString()); } } catch {}
    setBusy(true);
    setSteps({});
    setStatus([]);
    setResult(null);
    setNotice(null);
    setElapsed(null);
    t0.current = Date.now();
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ zip: z }) });
      // API errors (400, 429, 500) are one JSON object, not a stream.
      if (!res.ok) throw new Error(res.status === 429 ? "rate_limited" : `HTTP ${res.status}`);
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
          else if (e.type === "unsupported") setNotice(UNSUPPORTED);
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
      setNotice((err as Error)?.message === "rate_limited" ? "Too many lookups in the last minute. Please wait a moment and try again." : "Something went wrong talking to the agent. Please try again.");
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
  const measureMath = useMemo(() => (b ? measuresFor(b.zip) : []), [b]);
  const problems = (b?.problems || []) as Problem[];
  const markets = result?.markets || {};
  const doneCount = TOOLS.filter((t) => steps[t]?.status === "done").length;
  const picked = problems.filter((p) => care[p.topic || p.id]);

  const [heroSlot, setHeroSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setHeroSlot(document.getElementById("hero-stat")), []);
  const vm = b ? voteMatters(b.zip) : null;

  return (
    <TooltipProvider>
      {heroSlot && vm ? createPortal(<HeroStat vm={vm} />, heroSlot) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(zip);
        }}
        className="flex max-w-2xl items-stretch gap-0"
      >
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          autoComplete="postal-code"
          aria-label={t("ZIP code")}
          placeholder={t("Enter your ZIP")}
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          className="h-16 rounded-none border border-black bg-transparent px-4 text-2xl focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        />
        <Button type="submit" size="lg" disabled={busy} className="h-16 rounded-none bg-black px-8 text-base font-[530] text-[#f2f2f2] hover:bg-black/80">{busy ? t("Reading…") : t("Go")}</Button>
      </form>
      {/* QA phone pass (Oct 30): the unsupported-ZIP notice sits right under the input so it is visible above the keyboard. */}
      <p role="status" aria-live="polite" className="mt-3 text-base text-black empty:hidden" data-zip-notice>{notice ? t(notice) : ""}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {DEMO.map((d) => (
          <Button key={d.zip} type="button" variant="outline" size="sm" disabled={!d.ready || busy} onClick={() => run(d.zip)} className="min-h-11 rounded-none border-black font-[530]">
            {d.label}
          </Button>
        ))}
      </div>
      {(busy || (result && !b)) && (
        <div className="mt-10 max-w-2xl">
          <Progress value={busy ? Math.max(8, (doneCount / TOOLS.length) * 100) : 100} className="h-px" />
          <p className="mt-2 text-sm text-black/50">{busy ? t(TOOLS.map((k) => steps[k]).filter((s) => s?.status !== "done").length ? TOOL_LABEL[TOOLS.find((k) => steps[k]?.status !== "done") || TOOLS[0]] : "Writing your ballot") + "…" : ""}</p>
          {busy && <AgentTrace tools={[...TOOLS, "analyze"]} steps={steps} byModel={[]} narration="" seconds={null} running />}
        </div>
      )}

      {b && (
        <div id="ballot" className="mt-6">
          <p className="text-sm text-black/60">
            {b.place}{b.state === "NY" && b.verify && <> · <a href={b.verify.url} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-['']">{b.verify.label}</a></>}{b.splitWarning && b.districts.length > 1 && <> · <a href={b.state === "TX" ? "https://wrm.capitol.texas.gov/" : b.state === "NY" ? (b.verify?.url ?? "https://findmypollsite.vote.nyc/") : "https://www.sos.ca.gov/elections"} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-['']">Check your exact district by address</a></>}
          </p>
          {result && <AgentTrace tools={[...TOOLS, "analyze"]} steps={steps} byModel={result.toolsRunByModel || []} narration={result.narration} bullets={result.summaryBullets} seconds={elapsed} />}
          <RaceTiers races={races} market={(id) => marketFor(markets, id)} measures={measureMath} zip={b.zip} />
          <IssueMatch zip={b.zip} state={b.state} races={b.races} market={(id) => marketFor(markets, id)} />
          {SHOW_NEWS && <LocalNews zip={b.zip} />}
        </div>
      )}

    </TooltipProvider>
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
        <p className="mt-4 text-neutral-700">If every eligible person had voted, about {t.ifEveryoneVoted.ballots.toLocaleString("en-US")} ballots would have been cast: {t.ifEveryoneVoted.multiplier}x the actual number.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {t.sources.map((s) => <Src key={s.url} href={s.url}>{s.label}</Src>)}
      </div>
    </Section>
  );
}


