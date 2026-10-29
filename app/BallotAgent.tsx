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

const NYC_READY = false;
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
    if (!SUPPORTED.has(z)) { setZip(z); return setNotice("Austin, SF and NYC for now. Try 78701 (Austin) or 94103 (San Francisco)."); }
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
          <p className="text-sm text-black/50">
            {b.place} · {elapsed ? `${elapsed.toFixed(1)}s` : ""} · {result?.mode === "live" ? "Live agent" : "Fallback mode (no model)"}
            {b.splitWarning && b.districts.length > 1 && <> · Your ZIP spans two House districts. <a href={b.state === "TX" ? "https://www.votetexas.gov/voting/where.html" : "https://www.sos.ca.gov/elections"} target="_blank" rel="noreferrer">Check which is yours</a></>}
            {" "}· Local races not shown yet.
          </p>
          <RaceTiers races={races} market={(id) => marketFor(markets, id)} />
          <IssueMatch state={b.state} races={b.races} />
          <section id="plan" className="border-t border-black py-24">
            <p className="text-sm text-black/50">03</p>
            <h2 className="mt-3 font-serif text-6xl leading-none tracking-tight sm:text-7xl">Your plan</h2>
            <Plan state={b.state} />
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
          <p><Src href="https://www.sos.ca.gov/elections">Polling place lookup (sos.ca.gov)</Src></p>
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


function Plan({ state }: { state: "TX" | "CA" }) {
  const rows =
    state === "TX"
      ? [
          { k: "Oct 30", v: "Last day of early voting", src: "https://www.votetexas.gov/voting/when.html", s: "VoteTexas.gov" },
          { k: "Nov 3", v: "Election Day, 7 a.m. to 7 p.m.", src: "https://www.votetexas.gov/voting/when.html", s: "VoteTexas.gov" },
          { k: "Where", v: "Your county sets locations", src: "https://www.votetexas.gov/voting/where.html", s: "Find your polling place" },
          { k: "Bring", v: "One approved photo ID", src: "https://www.votetexas.gov/voting/need-id.html", s: "Accepted IDs" },
        ]
      : [
          { k: "Nov 3", v: "Election Day. Mail ballots postmarked by today", src: "https://www.sos.ca.gov/elections", s: "sos.ca.gov" },
          { k: "Where", v: "Vote centers and drop boxes", src: "https://caearlyvoting.sos.ca.gov/", s: "caearlyvoting.sos.ca.gov" },
          { k: "Bring", v: "Usually no ID needed", src: "https://voterstatus.sos.ca.gov/", s: "Check your voter status" },
        ];
  return (
    <dl className="mt-16">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-1 gap-2 border-t border-black/15 py-8 sm:grid-cols-12">
          <dt className="font-serif text-5xl leading-none sm:col-span-4 sm:text-6xl">{r.k}</dt>
          <dd className="sm:col-span-8">
            <p className="text-xl">{r.v}</p>
            <a className="mt-1 inline-block text-sm" href={r.src} target="_blank" rel="noreferrer">{r.s} ↗</a>
          </dd>
        </div>
      ))}
    </dl>
  );
}
