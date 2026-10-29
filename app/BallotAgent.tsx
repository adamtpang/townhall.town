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

const DEMO = [
  { zip: "78130", label: "New Braunfels, TX" },
  { zip: "78701", label: "Austin, TX" },
  { zip: "94103", label: "San Francisco, CA" },
  { zip: "90012", label: "Los Angeles, CA" },
];
const TOOLS = ["getDistricts", "getRaces", "getCandidates", "getMarketOdds", "getLocalProblems"];
const TOOL_LABEL: Record<string, string> = {
  getDistricts: "Find your districts",
  getRaces: "List every race and measure",
  getCandidates: "Look up candidates",
  getMarketOdds: "Check prediction markets",
  getLocalProblems: "Pull local Census data",
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
              <div className="text-[11px] uppercase tracking-wide text-slate-500">market odds</div>
            </div>
          </Tip>
        )}
      </CardHeader>
      <CardContent className="mt-auto space-y-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {c.officialSite ? <Src href={c.officialSite}>Official site</Src> : <span className="text-sm text-slate-400">Official site: unsure</span>}
          <Src href={c.campaignSite}>Campaign</Src>
          {c.x ? <Src href={c.x}>X</Src> : <span className="text-sm text-slate-400">X: unsure</span>}
          <Src href={c.ballotpedia}>Ballotpedia</Src>
          <Src href={c.finance?.url}>{c.finance?.label?.startsWith("FEC") ? "FEC" : c.finance?.label?.includes("Ethics") ? "TEC" : "Finance"}</Src>
        </div>
        {c.photo && <p className="text-[11px] text-slate-400">{c.photo.page ? <a className="text-slate-400" href={c.photo.page} target="_blank" rel="noreferrer">{c.photo.credit}</a> : c.photo.credit}</p>}
        {c.money && <MoneyBlock m={c.money} />}
        {c.accountability?.length ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="eyebrow mb-2">Said vs. did</p>
            {(c.accountability as (NonNullable<Politician["accountability"]>[number] & { issue?: string; rationale?: string })[]).map((a, i) => (
              <div key={i} className="mb-3 last:mb-0">
                <p className="flex items-center justify-between gap-2 font-medium text-navy">
                  {a.issue || "Promise"} <Badge variant={a.status === "kept" ? "outline" : "muted"}>{a.status}</Badge>
                </p>
                <p className="mt-1 text-slate-700"><span className="font-semibold">Said:</span> {a.promise} <Src href={a.promiseSource.url}>{a.promiseSource.label}</Src></p>
                <p className="mt-1 text-slate-700"><span className="font-semibold">Did:</span> {a.record} {a.recordSource && <Src href={a.recordSource.url}>{a.recordSource.label}</Src>}</p>
                {a.rationale && <p className="mt-1 text-xs text-slate-500">{a.rationale}</p>}
              </div>
            ))}
          </div>
        ) : null}
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
    if (z.length !== 5) return setNotice("Enter a 5-digit ZIP code.");
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
          else if (e.type === "status") setStatus((s) => [...s, e.message]);
          else if (e.type === "unsupported" || e.type === "error") setNotice(e.message);
          else if (e.type === "result") {
            setResult(e);
            setCare(Object.fromEntries(((e.ballot?.problems || []) as Problem[]).map((p) => [p.topic || p.id, true])));
            setElapsed((Date.now() - t0.current) / 1000);
          }
        }
      }
    } catch (err) {
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
          const r = await fetch(`/api/locate?lat=${p.coords.latitude}&lon=${p.coords.longitude}`);
          const d = await r.json();
          if (d.zip) run(d.zip);
          else setNotice(d.error || "Couldn't find a ZIP for your location.");
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
      {/* 1. Location */}
      <Card className="border-navy/20 bg-navy-50/40">
        <CardContent className="p-6 sm:p-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(zip);
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <label className="sr-only" htmlFor="zip">ZIP code</label>
            <input
              id="zip"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="ZIP code"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="h-14 flex-1 rounded-md border border-slate-300 bg-white px-4 text-xl tracking-wide text-navy outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
            />
            <button disabled={busy} className="h-14 rounded-md bg-navy px-8 text-lg font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
              {busy ? "Working…" : "Explain my ballot"}
            </button>
            <button type="button" onClick={locate} disabled={busy || locating} className="flex h-14 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-navy hover:bg-slate-50">
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} Use my location
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Try:</span>
            {DEMO.map((d) => (
              <button key={d.zip} onClick={() => run(d.zip)} disabled={busy} className="rounded-full border border-slate-300 bg-white px-3 py-1 hover:border-navy hover:text-navy">
                {d.zip} · {d.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Every Texas ZIP works. California: 94103 and 90012 for now. Location is used once to find your ZIP and is not stored.</p>
        </CardContent>
      </Card>

      {notice && <p className="mt-6 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900"><Info className="mt-0.5 h-4 w-4 shrink-0" />{notice}</p>}

      {(busy || result) && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Agent steps</CardTitle>
              {result ? (
                result.mode === "live" ? (
                  <Badge variant="accent">Live AI agent · {result.model}</Badge>
                ) : (
                  <Tip label={`No model was available (${result.modelError || "unknown"}). The same tools ran in a fixed order.`}>
                    <span><Badge variant="warn">Fallback mode (no model)</Badge></span>
                  </Tip>
                )
              ) : (
                <Badge variant="muted"><Loader2 className="h-3 w-3 animate-spin" /> running</Badge>
              )}
            </div>
            <Progress value={(doneCount / TOOLS.length) * 100} className="mt-3" />
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {TOOLS.map((t) => {
                const s = steps[t];
                return (
                  <li key={t} className="flex items-start gap-3 text-sm">
                    {s?.status === "done" ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-navy" /> : s ? <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-slate-500" /> : <CircleDashed className="mt-0.5 h-4 w-4 text-slate-300" />}
                    <span>
                      <span className="font-medium text-navy">{TOOL_LABEL[t]}</span> <code className="text-xs text-slate-400">{t}</code>
                      {s?.summary && <span className="block text-slate-600">{s.summary}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            {status.length > 0 && (
              <details className="mt-3 text-xs text-slate-500">
                <summary className="cursor-pointer">Agent log ({status.length})</summary>
                {status.map((s, i) => <p key={i}>{s}</p>)}
              </details>
            )}
            {result?.narration && <p className="mt-4 border-l-2 border-navy pl-3 text-slate-700">{result.narration}</p>}
            {elapsed && <p className="mt-3 text-xs text-slate-500">Done in {elapsed.toFixed(1)}s · {ct(result!.generatedAt)}</p>}
          </CardContent>
        </Card>
      )}

      {b && (
        <div id="ballot" className="mt-6">
          {/* 2. Elections */}
          <Section n={2} title="Elections you can vote in" sub={`${b.place} · General election, Tuesday, Nov 3, 2026`}>
            <div className="mb-4 flex flex-wrap gap-2">
              {b.districts.map((d) => (
                <Badge key={d.id} variant="outline" className="text-sm"><MapPin className="h-3 w-3" />{d.label}</Badge>
              ))}
            </div>
            <div className="mb-6 space-y-2 text-sm">
              <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>Verify by address.</strong> Districts come from your ZIP's center point, not your street address.{" "}
                  {b.splitWarning && b.districts.length > 1 ? "Your ZIP may be split, so both possible House races are shown. " : ""}
                  {b.state === "CA" && "California's House districts were redrawn under Prop 50 (2025); this ZIP's district is unconfirmed. "}
                  Check your exact ballot at <a href={b.state === "TX" ? "https://www.votetexas.gov/voting/where.html" : "https://www.sos.ca.gov/elections"}>{b.state === "TX" ? "VoteTexas.gov" : "sos.ca.gov"}</a>.
                </span>
              </p>
              <p className="text-slate-500">District source: <a href={b.districtSource.url}>{b.districtSource.label}</a>. State legislative, judicial district, county and city races are not shown yet.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {races.map((r) => (
                <a key={r.id} href={`#race-${r.id}`} className="block rounded-md border border-slate-200 p-4 no-underline hover:border-navy">
                  <span className="eyebrow">{r.level === "federal" ? "Federal" : "State"}</span>
                  <span className="mt-1 block font-semibold text-navy">{r.title}</span>
                  <span className="mt-1 block text-sm text-slate-600">{r.candidates.length ? `${r.candidates.length} candidates` : "Candidates: unsure"}</span>
                </a>
              ))}
            </div>
          </Section>

          {/* 3. Candidates */}
          <Section n={3} title="Who's running" sub="Official sites and social links come from Ballotpedia. Photos are licensed Wikimedia Commons portraits where available, otherwise Ballotpedia, each credited. Missing items say “unsure”.">
            <Accordion type="multiple" defaultValue={races.slice(0, 2).map((r) => r.id)}>
              {races.map((r) => {
                const mk = marketFor(markets, r.id);
                return (
                  <AccordionItem key={r.id} value={r.id} id={`race-${r.id}`}>
                    <AccordionTrigger>
                      <span>
                        {r.title}
                        <span className="ml-2 text-sm font-normal text-slate-500">{r.candidates.length} candidates</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-4 max-w-3xl text-slate-700">
                        <span className="font-semibold text-navy">What this office does: </span>
                        {r.office} {r.officeSource && <Src href={r.officeSource}>source</Src>}
                      </p>
                      {r.candidates.length ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {(r.candidates as Pol[]).map((c) => <CandidateCard key={c.name} c={c} odds={oddsForCandidate(mk?.avg, c.name)} />)}
                        </div>
                      ) : (
                        <p className="text-slate-500">Candidates: unsure. See the source.</p>
                      )}
                      {r.turnout && (
                        <div className="mt-4 rounded border border-slate-200 p-4 text-sm">
                          <p className="eyebrow mb-2">Last time: {r.turnout.pastElection}</p>
                          {r.turnout.voteShare.map((v) => <p key={v.name}>{v.name}: {v.pct}%</p>)}
                          {r.turnout.eligibleNonVoters != null && <p className="mt-1">Eligible non-voters: {r.turnout.eligibleNonVoters.toLocaleString()}</p>}
                          <p className="mt-1">{r.turnout.sources.map((s) => <Src key={s.url} href={s.url}>{s.label}</Src>)}</p>
                        </div>
                      )}
                      <p className="mt-3"><Src href={r.source}>Race source (Ballotpedia)</Src></p>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </Section>

          {/* 4 + 5. Problems and measures */}
          <Section n={4} title="What's on the table" sub="Local problems from Census data, and the measures on your ballot. Pick the problems you care about.">
            <Tabs defaultValue="problems">
              <TabsList>
                <TabsTrigger value="problems">Area problems</TabsTrigger>
                <TabsTrigger value="measures">Ballot measures ({b.measures.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="problems">
                {problems.length ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    {problems.map((p) => {
                      const key = p.topic || p.id;
                      return (
                        <label key={p.id} className="cursor-pointer">
                          <Card className={care[key] ? "border-navy ring-1 ring-navy" : ""}>
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <span className="eyebrow">{TOPIC_LABEL[key] || key}</span>
                                <Checkbox checked={!!care[key]} onCheckedChange={(v) => setCare((s) => ({ ...s, [key]: !!v }))} aria-label={`Care about ${p.label}`} />
                              </div>
                              <div className="mt-2 text-4xl font-bold tabular-nums text-navy">{p.value}</div>
                              <CardDescription>{p.label}</CardDescription>
                            </CardHeader>
                            <CardContent className="text-xs text-slate-500">
                              {p.stateValue != null && <p>State: {p.stateValue}%</p>}
                              <p>{p.year} · <a href={p.source.url}>{p.source.label}</a></p>
                            </CardContent>
                          </Card>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-600">Local Census metrics are cached for the demo ZIPs (78130, 78701, 94103, 90012) only. Statewide data is coming next.</p>
                )}
              </TabsContent>
              <TabsContent value="measures">
                {b.measures.length ? (
                  <Accordion type="multiple">
                    {b.measures.map((m) => {
                      const mk = marketFor(markets, m.id);
                      return (
                        <AccordionItem key={m.id} value={m.id}>
                          <AccordionTrigger>
                            <span className="flex flex-wrap items-center gap-2">
                              {m.title}
                              {mk && <Badge variant="muted">market odds {pct(mk.avg[0].prob)} {mk.avg[0].name.toLowerCase().startsWith("yes") ? "yes" : mk.avg[0].name}</Badge>}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            {m.summary && <p className="max-w-3xl text-slate-700">{m.summary}</p>}
                            {m.id === "Proposition 40" && <p className="mt-2 text-sm text-slate-600">Verified on the ballot: listed under “On the ballot” on Ballotpedia's California 2026 ballot propositions page.</p>}
                            {mk && <MarketBlock mk={mk} />}
                            <p className="mt-3"><Src href={m.source}>Source</Src></p>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                ) : (
                  <p className="text-slate-600">{b.measuresNote || "No statewide measures found."}</p>
                )}
              </TabsContent>
            </Tabs>
          </Section>

          {/* 6. Alignment */}
          <Section n={5} title="Who has said something about it" sub="Quotes from each candidate's own campaign themes, matched by keyword. This is not a ranking and not advice on how to vote.">
            {picked.length === 0 ? (
              <p className="text-slate-600">{problems.length ? "Pick at least one problem above." : "Pick a demo ZIP to see local problems."}</p>
            ) : (
              <Tabs defaultValue={picked[0].topic || picked[0].id}>
                <TabsList>
                  {picked.map((p) => <TabsTrigger key={p.id} value={p.topic || p.id}>{TOPIC_LABEL[p.topic || p.id] || p.label}</TabsTrigger>)}
                </TabsList>
                {picked.map((p) => {
                  const topic = p.topic || p.id;
                  return (
                    <TabsContent key={p.id} value={topic} className="space-y-6">
                      {races.filter((r) => r.candidates.length).map((r) => (
                        <div key={r.id}>
                          <p className="mb-2 font-semibold text-navy">{r.title}</p>
                          <ul className="space-y-2">
                            {(r.candidates as Pol[]).map((c) => {
                              const pos = c.positions?.find((x) => x.issue === topic);
                              return (
                                <li key={c.name} className="grid gap-1 rounded-md border border-slate-200 p-3 text-sm sm:grid-cols-[180px_1fr]">
                                  <span className="font-medium">{c.name}</span>
                                  {pos ? (
                                    <span className="text-slate-700">
                                      “{pos.text}” <Src href={pos.source.url}>source</Src>
                                      <span className="block text-xs text-slate-400">{(pos as { match?: string }).match || "stated position"}; read the full source for context.</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">No stated position found</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </Section>

          {/* 7. Markets */}
          <Section n={6} title="What the markets say" sub="Market odds are prices traders pay on Polymarket and Kalshi. They are not forecasts we endorse, and thin markets swing.">
            <div className="grid gap-4 sm:grid-cols-2">
              {marketRaces.map((r) => {
                const mk = marketFor(markets, r.id)!;
                return (
                  <Card key={r.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{r.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MarketBlock mk={mk} />
                      <p className="mt-4 text-sm text-slate-700"><span className="font-semibold text-navy">If they win, this office controls: </span>{r.office}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <p className="mt-4 text-sm text-slate-500">No market found for: {races.filter((r) => !marketFor(markets, r.id)).map((r) => r.title).join(", ") || "none"}.</p>
          </Section>

          {b.turnout && <TurnoutSection t={b.turnout as TurnoutDetail} />}

          {/* 8. Game plan */}
          <Section n={b.turnout ? 8 : 7} title="Your game plan" sub="When, where and what to bring.">
            <GamePlan state={b.state} />
          </Section>
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

function GamePlan({ state }: { state: "TX" | "CA" }) {
  if (state === "TX")
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><span className="eyebrow">When</span><CardTitle>Early voting through Fri, Oct 30</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>Early voting runs Oct 19–30. Election Day is <strong>Tuesday, Nov 3, 2026</strong>.</p>
            <p>The registration deadline (Oct 5) has passed. <a href="https://teamrv-mvp.sos.texas.gov/MVP/mvp.do">Check if you're registered</a>.</p>
            <p className="text-xs text-slate-500">Source: <a href="https://www.sos.state.tx.us/">Texas SOS</a>, <a href="https://www.votetexas.gov/">VoteTexas.gov</a></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><span className="eyebrow">Where</span><CardTitle>Find your polling place</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>Locations and hours are set by your county. Use the official lookup:</p>
            <p><Src href="https://www.votetexas.gov/voting/where.html">VoteTexas.gov: where to vote</Src></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><span className="eyebrow">What to bring</span><CardTitle>One approved photo ID</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-700">
            <ul className="list-disc space-y-1 pl-5">
              <li>Texas Driver License (DPS)</li>
              <li>Texas Election Identification Certificate (DPS)</li>
              <li>Texas Personal ID Card (DPS)</li>
              <li>Texas Handgun License (DPS)</li>
              <li>U.S. Military ID with photo</li>
              <li>U.S. Citizenship Certificate with photo</li>
              <li>U.S. Passport (book or card)</li>
            </ul>
            <p className="mt-2 text-xs text-slate-500">Can be expired up to 4 years (any length if you're 70+). No ID and can't reasonably get one? Sign a Reasonable Impediment Declaration and bring a supporting document. <a href="https://www.votetexas.gov/voting/need-id.html">Source: VoteTexas.gov</a></p>
          </CardContent>
        </Card>
      </div>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader><span className="eyebrow">When</span><CardTitle>Election Day: Tue, Nov 3, 2026</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>Mail ballots must be postmarked by Election Day or dropped off at a drop box or vote center. Early in-person voting is available in every county.</p>
          <p className="text-xs text-slate-500">Source: <a href="https://www.sos.ca.gov/elections">sos.ca.gov</a></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><span className="eyebrow">Where</span><CardTitle>Vote centers and drop boxes</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p><Src href="https://caearlyvoting.sos.ca.gov/">caearlyvoting.sos.ca.gov</Src></p>
          <p><Src href="https://www.sos.ca.gov/elections/polling-place">Polling place lookup (sos.ca.gov)</Src></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><span className="eyebrow">What to bring</span><CardTitle>Usually no ID needed</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>Most California voters don't need ID. Some first-time voters may be asked for one. Check your status first.</p>
          <p><Src href="https://voterstatus.sos.ca.gov/">Check your voter status</Src></p>
        </CardContent>
      </Card>
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
