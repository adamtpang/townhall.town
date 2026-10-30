// @ts-ignore plain ESM helper
import { cleanNarration } from "../narration.mjs";
// Ballot agent API, shared by /api/v1/agent (canonical) and /api/agent (alias). Same code, same behavior.
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { getDistricts, getRaces, getCandidates, getMarketOdds, getLocalProblems, ballotFor } from "../tools";
import { civicTools } from "../civicTools";
import { dataTools, getCampaignFinance, getCountyUnemployment } from "../dataTools";
import { API_VERSION_HEADERS, apiError, isZip, methodNotAllowed, withHeaders } from "../apiError";
import { AGENT_POLICY, take, tooManyRequests } from "../rateLimit";
import { GATEWAY_FALLBACKS, modelLadder } from "../models";
import { getElectionDates, longDateIn } from "../logistics";
import { townyPrompt } from "../townyPrompt";
import { townyTools } from "../townyTools";
import { UNSUPPORTED_MESSAGE } from "../site";
import { measuresFor } from "../measures";
import { SHOW_AGENT_SUMMARY } from "../flags";


const STEP_LABEL: Record<string, string> = {
  getDistricts: "Finding your districts",
  getRaces: "Pulling your races",
  getCandidates: "Looking up candidates",
  getMarketOdds: "Fetching Polymarket prices",
  getLocalProblems: "Pulling local problems",
  getCampaignFinance: "Checking OpenFEC campaign finance",
  getCountyUnemployment: "Checking BLS county unemployment",
};

type Emit = (e: Record<string, unknown>) => void;
const CORE_TOOLS = ["getDistricts", "getRaces", "getCandidates", "getMarketOdds", "getLocalProblems", "getCampaignFinance", "getCountyUnemployment"] as const;

// Live public-API results are kept for 10 minutes per server instance, so a busy demo table does not exhaust the
// OpenFEC key. A reused result says so in its summary, with its age; nothing else is cached or faked.
const LIVE_TTL_MS = 10 * 60 * 1000;
const liveCache = new Map<string, { at: number; value: any }>();
async function live<T>(key: string, fn: () => Promise<T>): Promise<{ value: T; ageMin: number | null }> {
  const hit = liveCache.get(key);
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) return { value: hit.value, ageMin: Math.round((Date.now() - hit.at) / 60000) };
  const value = await fn();
  if ((value as any)?.status !== "unavailable") liveCache.set(key, { at: Date.now(), value });
  return { value, ageMin: null };
}
/** The first U.S. House race on this ZIP's ballot (the voter's main district) and up to two of its candidates. */
const houseRace = (zip: string) => ballotFor(zip)?.races.find((r) => /^U\.S\. (House|Representative)/.test(r.title));

function summarize(name: string, r: any): string {
  switch (name) {
    case "getDistricts":
      return r.found ? `${r.place}: ${r.districts.map((d: any) => d.label).join(", ")}` : r.message;
    case "getRaces":
      return `${r.races.length} races, ${r.measures.length} ballot measures on Nov 3, 2026`;
    case "getCandidates":
      return `${r.races.reduce((n: number, x: any) => n + x.candidates.length, 0)} candidates across ${r.races.length} races`;
    case "getMarketOdds": {
      const v = Object.values(r) as any[];
      return `${v.filter((x) => x.quotes.length).length} of ${v.length} contests have a live Polymarket price`;
    }
    case "getLocalProblems":
      return r.problems.map((p: any) => `${p.label}: ${String(p.value).endsWith(p.unit) ? p.value : `${p.value}${p.unit}`}`).join(" · ");
    case "getCampaignFinance": {
      const ok = (r.candidates ?? []).filter((c: any) => c.receipts != null);
      const age = r.ageMin != null ? ` (reused from a live call ${r.ageMin} min ago)` : "";
      if (!ok.length) return `${r.race ?? "House race"}: no FEC totals returned${r.reason ? ` (${/429/.test(r.reason) ? "OpenFEC rate limit reached; try again later" : r.reason})` : ""}${age}`;
      const usd = (n: number) => `$${n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}K`}`;
      return `${r.race}: ${ok.map((c: any) => `${c.name} raised ${usd(c.receipts)}`).join(", ")} (2026 cycle, through ${ok[0].coverageEnd?.slice(0, 10) ?? "latest filing"})${age}`;
    }
    case "getCountyUnemployment": {
      const age = r.ageMin != null ? ` (reused from a live call ${r.ageMin} min ago)` : "";
      return r.rate != null ? `County unemployment ${r.rate}% in ${r.period}${r.preliminary ? " (preliminary)" : ""}${age}` : `No BLS figure returned${r.reason ? ` (${r.reason})` : ""}${age}`;
    }
  }
  return "done";
}

/** What each step checked, and the record it found, so every step in the trace links to its own source. */
function checked(name: string, zip: string): string {
  switch (name) {
    case "getDistricts": return `ZIP ${zip} against the state's district maps`;
    case "getRaces": return `The Nov 3, 2026 ballot for ZIP ${zip}`;
    case "getCandidates": return "General-election candidates for each race";
    case "getMarketOdds": return "Polymarket's live API for every race and measure";
    case "getLocalProblems": return `Census ACS tables for ZIP ${zip}`;
    case "getCampaignFinance": return `api.open.fec.gov for the ${houseRace(zip)?.title ?? "U.S. House"} candidates`;
    case "getCountyUnemployment": return "api.bls.gov LAUS series for your county";
  }
  return "";
}
function sourceOf(name: string, r: any, zip: string): { label: string; url: string } | null {
  const b = ballotFor(zip);
  const host = (u: unknown) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return "source"; } };
  const link = (label: string, url: unknown) => (typeof url === "string" && /^https?:/.test(url) ? { label, url } : null);
  switch (name) {
    case "getDistricts": return link(host(r?.source?.url), r?.source?.url);
    case "getRaces": return b?.verify ? link(host(b.verify.url), b.verify.url) : null;
    case "getCandidates": return link("Ballotpedia", b?.races?.[0]?.source);
    case "getMarketOdds": {
      const q = (Object.values(r ?? {}) as any[]).find((v) => v?.status === "live" && v.quotes?.[0]?.url)?.quotes[0];
      return q ? link("Polymarket market", q.url) : null;
    }
    case "getCampaignFinance": { const c = (r?.candidates ?? []).find((x: any) => x?.source); return c ? link(`FEC: ${c.name}`, c.source) : null; }
    case "getCountyUnemployment": return link("BLS LAUS series", r?.source);
    case "getLocalProblems": { const p = r?.problems?.find((x: any) => x?.source?.url); return p ? { label: p.source.label, url: p.source.url } : null; }
  }
  return null;
}

function makeTools(zip: string, emit: Emit, results: Record<string, unknown>) {
  const wrap = async <T,>(name: string, input: unknown, fn: () => Promise<T> | T) => {
    emit({ type: "step", tool: name, label: STEP_LABEL[name], status: "running", input, checked: checked(name, zip) });
    const t0 = Date.now();
    const r = await fn();
    results[name] = r;
    emit({ type: "step", tool: name, label: STEP_LABEL[name], status: "done", ms: Date.now() - t0, summary: summarize(name, r), checked: checked(name, zip), source: sourceOf(name, r, zip) });
    return r;
  };
  const allRaceIds = () => {
    const b = ballotFor(zip);
    return b ? [...b.races.map((r) => r.id), ...b.measures.map((m) => m.id)] : [];
  };
  return {
    getDistricts: tool({
      description: "Find the U.S. House district(s), state and county for a ZIP code. Always call first.",
      inputSchema: z.object({ zip: z.string().describe("5-digit ZIP") }),
      execute: async () => wrap("getDistricts", { zip }, () => getDistricts(zip)),
    }),
    getRaces: tool({
      description: "List every race and statewide measure on the Nov 3, 2026 ballot for the ZIP, with what each office controls.",
      inputSchema: z.object({ zip: z.string() }),
      execute: async () => wrap("getRaces", { zip }, () => getRaces(zip)),
      // The model only needs ids and titles; the full sourced records go to the client in `result.ballot`.
      toModelOutput: (r: any) => ({ type: "json", value: { zip: r.zip, electionDate: r.electionDate, raceCount: r.races.length, measureCount: r.measures.length, races: r.races.map((x: any) => ({ id: x.id, title: x.title })), measures: r.measures.map((x: any) => ({ id: x.id, title: x.title })) } }),
    }),
    getCandidates: tool({
      description: "Get general-election candidates (name, party, incumbent) for the races. Pass race ids from getRaces, or none for all.",
      inputSchema: z.object({ zip: z.string(), raceIds: z.array(z.string()).optional() }),
      execute: async () => wrap("getCandidates", { zip }, () => getCandidates(zip)),
      toModelOutput: (r: any) => ({ type: "json", value: { zip: r.zip, races: r.races.map((x: any) => ({ id: x.id, title: x.title, candidates: x.candidates.map((c: any) => ({ name: c.name, party: c.party ?? null, incumbent: !!c.incumbent })) })) } }),
    }),
    getMarketOdds: tool({
      description: "Fetch live Polymarket prices for race ids / measure ids. Returns 'no market found' when Polymarket has no market on that contest, and 'unavailable' (no numbers) when the live fetch fails.",
      inputSchema: z.object({ raceIds: z.array(z.string()).optional() }),
      execute: async () => wrap("getMarketOdds", { raceIds: "all" }, () => getMarketOdds(allRaceIds())),
    }),
    getCampaignFinance: tool({
      description: "Live OpenFEC call: 2026 campaign finance totals (receipts, spending, cash on hand) for the candidates in this ZIP's U.S. House race. Facts only.",
      inputSchema: z.object({ zip: z.string() }),
      execute: async () =>
        wrap("getCampaignFinance", { zip }, async () => {
          const race = houseRace(zip);
          if (!race) return { race: null, candidates: [], reason: "no U.S. House race for this ZIP", ageMin: null };
          const st = ballotFor(zip)!.state;
          const { value, ageMin } = await live(`fec:${race.id}`, async () => {
            const rows = await Promise.all(race.candidates.slice(0, 2).map((c) => getCampaignFinance({ name: c.name, state: st }).then((x: any) => ({ ...x, fecName: x.name ?? null, name: c.name }))));
            const bad = rows.find((x: any) => x.status === "unavailable");
            return bad && rows.every((x: any) => x.receipts == null) ? { status: "unavailable", reason: bad.reason, rows } : { rows };
          });
          return { race: race.title, candidates: (value as any).rows ?? [], reason: (value as any).reason ?? null, ageMin };
        }),
      toModelOutput: (r: any) => ({ type: "json", value: { race: r.race, candidates: (r.candidates ?? []).map((c: any) => ({ name: c.name, receipts: c.receipts ?? null, cashOnHand: c.cashOnHand ?? null, source: c.source ?? null })) } }),
    }),
    getCountyUnemployment: tool({
      description: "Live BLS LAUS call: the latest monthly unemployment rate for this ZIP's county, with its source series.",
      inputSchema: z.object({ zip: z.string() }),
      execute: async () =>
        wrap("getCountyUnemployment", { zip }, async () => {
          const { value, ageMin } = await live(`bls:${zip}`, () => getCountyUnemployment({ zip }));
          return { ...(value as any), ageMin };
        }),
    }),
    getLocalProblems: tool({
      description: "Get 3 sourced local problems for the ZIP from Census ACS (rent burden, uninsured rate, unemployment).",
      inputSchema: z.object({ zip: z.string() }),
      execute: async () => wrap("getLocalProblems", { zip }, () => getLocalProblems(zip)),
    }),
  };
}

// System prompt: Civic's Towny prompt, verbatim (lib/townyPrompt.ts), with {{TODAY}} in the ZIP's time zone.
const systemFor = (zip: string) => townyPrompt(longDateIn(getElectionDates(zip)?.timezone ?? "America/Chicago"));

const NARRATION_TOKENS = 320;
/** Cut a length-capped narration back to its last complete line or sentence and say where the rest is. */
export function trimNarration(t: string): string {
  const s = String(t ?? "");
  const cut = Math.max(s.lastIndexOf("\n"), s.search(/[.!?](?=[^.!?]*$)/) + 1);
  const head = (cut > 0 ? s.slice(0, cut) : s).trim();
  return head ? `${head}\n\nThe full list of races and measures, with sources, is in the ballot data.` : "";
}

/** Any market number in model text is labelled as a Polymarket price, so it never reads as a vote share. */
export function labelMarketPrices(text: string, results: Record<string, any>): string {
  const live = Object.entries((results.getMarketOdds ?? {}) as Record<string, any>).filter(([, v]) => v?.status === "live" && v.quotes?.[0]?.outcomes?.length);
  if (!live.length || !text) return text;
  const probs = new Set<number>();
  const names: string[] = [];
  const titles = new Map(((results.getRaces?.races ?? []) as any[]).concat(results.getRaces?.measures ?? []).map((r: any) => [r.id, String(r.title ?? "")]));
  for (const [id, v] of live) {
    for (const q of v.quotes) for (const o of q.outcomes ?? []) { probs.add(Math.round(o.prob * 100)); if (o.name) names.push(String(o.name)); }
    const t = titles.get(id); if (t) names.push(t);
  }
  const marketish = (line: string) => /polymarket|market|odds|competitive|lopsided|close/i.test(line) || names.some((n) => n && line.includes(n));
  return text.split("\n").map((line) => !marketish(line) ? line : line.replace(/(Polymarket price(?: of)?\s*)?\b(\d{1,3})(\.\d+)?\s?%/gi, (m, pre, n, dec, off, whole) => {
    // Already labelled, either "Polymarket price N%" or #41's "a N% Polymarket market price".
    if (pre || /^\s*(Polymarket\s+)?market price/i.test(String(whole).slice(off + m.length))) return m;
    const v = Math.round(Number(n + (dec ?? "")));
    return probs.has(v) ? `Polymarket price ${n}${dec ?? ""}%` : m;
  })).join("\n");
}

/** "ACS 2024 5-year (2020-2024)" -> "ACS 5-year estimates, 2020-2024": no nested parentheses inside the Census line. */
export function acsYearLabel(year: unknown): string {
  const y = String(year ?? "").trim();
  const m = y.match(/(\d{4})\s*[-\u2013]\s*(\d{4})/);
  return m ? `ACS 5-year estimates, ${m[1]}-${m[2]}` : y.replace(/[()]/g, "") || "ACS 5-year estimates";
}

type Outcome = { name: string; pct: number };
type MarketContest = { contest: string; leader: string; polymarketPricePct: number; competitive: boolean; outcomes?: Outcome[]; url?: string; fetchedAt?: string };
/** One summary bullet and the source it comes from (Civic summary23 P0 #4: every bullet carries a source). */
export type SummaryBullet = { kind: "market" | "measure" | "census"; text: string; sourceUrl: string | null; whatChanges?: string | null; whatChangesSourceUrl?: string | null };

export const MARKET_LABEL = "market price, not a poll or forecast";
/** Every listed outcome with its price, e.g. "Greg Casar 98%, Lauren Pe\u00f1a 2%". Never the leader alone. */
export const priceList = (c: { outcomes?: Outcome[]; leader: string; polymarketPricePct: number }) =>
  (c.outcomes?.length ? c.outcomes : [{ name: c.leader, pct: c.polymarketPricePct }]).map((o) => `${o.name} ${o.pct}%`).join(", ");

/** The market bullet, written in code from the odds data (Civic summary23 P0 #1, report lines 183/186). */
export function marketBullet(contests: MarketContest[]): SummaryBullet | null {
  const listed = contests.filter((c) => (c.outcomes?.length ?? 0) > 0);
  if (!listed.length) return null;
  // Selection rule, stated in the text: the contest whose top price is nearest 50%; else the widest price gap.
  const close = listed.filter((c) => c.competitive).sort((a, b) => Math.abs(a.polymarketPricePct - 50) - Math.abs(b.polymarketPricePct - 50))[0];
  if (close) return { kind: "market", sourceUrl: close.url ?? null, text: `- Closest contest on Polymarket (top price nearest 50%): ${close.contest}. Polymarket prices (${MARKET_LABEL}): ${priceList(close)}. Source: ${close.url}` };
  const top = [...listed].sort((a, b) => b.polymarketPricePct - a.polymarketPricePct)[0];
  return { kind: "market", sourceUrl: top.url ?? null, text: `- No contest has a top Polymarket price between 35% and 65%. Widest price gap: ${top.contest}. Polymarket prices (${MARKET_LABEL}): ${priceList(top)}. Source: ${top.url}` };
}
/** Text-only form of marketBullet (kept for callers and tests of the earlier API). */
export const marketLine = (contests: MarketContest[]) => marketBullet(contests)?.text ?? "";

const STATE_NAME: Record<string, string> = { TX: "Texas", CA: "California", NY: "New York" };
const stripEnd = (t: string) => String(t ?? "").trim().replace(/[.\s]+$/, "");

/** The Census bullet (Civic summary23 P1 #6): ZCTA wording, named state, single parenthesis, selection rule, source. */
export function censusBullet(local: any, zip: string, state: string | undefined): SummaryBullet | null {
  if (!local) return null;
  const valueText = String(local.value).endsWith(local.unit ?? "") ? local.value : `${local.value}${local.unit ?? ""}`;
  const st = STATE_NAME[String(state ?? "")] ?? "the state";
  const url = local.source?.url ?? local.sourceUrl ?? null;
  const years = acsYearLabel(local.year).replace(/^ACS 5-year estimates, /, "");
  return { kind: "census", sourceUrl: url, text: `- ${local.label}: ${valueText} in ZIP code area (Census ZCTA) ${zip}, vs ${local.stateValue}${local.unit ?? ""} in ${st} (Census ACS 2024 5-year, ${years}${local.table ? `, table ${local.table}` : ""}; the local metric farthest from the state figure). Source: ${url}` };
}

/** The measure bullet (Civic summary23 P0 #4 and P1 #8/#10): official cost text, what it does, and its source. */
export function measureBullet(m: { measure: string; cost: string; sourceUrl?: string | null; whatChanges?: string | null; whatChangesSourceUrl?: string | null } | undefined): SummaryBullet | null {
  if (!m) return null;
  return { kind: "measure", sourceUrl: m.sourceUrl ?? null, whatChanges: m.whatChanges ?? null, whatChangesSourceUrl: m.whatChangesSourceUrl ?? null,
    text: `- First measure on your ballot with an official cost figure: ${m.measure}. Official cost text: ${stripEnd(m.cost)}. What it does: ${stripEnd(m.whatChanges ?? "")}. Source: ${m.sourceUrl}` };
}

/** Analysis step: the summary bullets, always written in code from the sourced facts (Civic summary23 P0 #2: no model-written bullets). */
async function analyze(zip: string, results: Record<string, any>, emit: Emit): Promise<{ text: string; bullets: SummaryBullet[]; model: string } | null> {
  const odds = Object.entries((results.getMarketOdds ?? {}) as Record<string, any>)
    .filter(([, v]) => v?.status === "live" && v.quotes?.[0]?.outcomes?.length)
    .map(([id, v]) => ({ id, url: v.quotes[0].url, fetchedAt: v.quotes[0].fetchedAt, outcomes: v.quotes[0].outcomes.map((o: any) => ({ name: o.name, pct: Math.round(o.prob * 100) })), leader: v.quotes[0].outcomes[0].name, prob: Math.round(v.quotes[0].outcomes[0].prob * 100) }))
    .sort((a, b) => Math.abs(a.prob - 50) - Math.abs(b.prob - 50));
  const titles = new Map(((results.getRaces?.races ?? []) as any[]).concat(results.getRaces?.measures ?? []).map((r: any) => [r.id, r.title]));
  const local = ((results.getLocalProblems?.problems ?? []) as any[])
    .filter((p) => p.stateValue != null && Number.isFinite(Number(p.numeric ?? parseFloat(p.value))))
    .map((p) => ({ p, gap: Math.abs(Number(p.numeric ?? parseFloat(p.value)) - Number(p.stateValue)) }))
    .sort((a, b) => b.gap - a.gap)[0]?.p;
  const facts = {
    contestsByMarket: odds.map((o) => ({ contest: titles.get(o.id) ?? o.id, leader: o.leader, polymarketPricePct: o.prob, competitive: o.prob >= 35 && o.prob <= 65, outcomes: o.outcomes, url: o.url, fetchedAt: o.fetchedAt })),
    measuresWithCost: measuresFor(zip).filter((m) => m.cost?.value && !/^unsure/i.test(m.cost.value)).slice(0, 6).map((m) => ({ measure: m.title, cost: m.cost.value, sourceUrl: m.cost.sourceUrl ?? null, whoPays: m.whoPays?.text, whatChanges: m.whatChanges?.text ?? null, whatChangesSourceUrl: m.whatChanges?.sourceUrl ?? null })),
  };
  emit({ type: "step", tool: "analyze", label: "Analyzing what matters", status: "running", input: { zip } });
  const t0 = Date.now();
  const bullets = factBullets(facts, censusBullet(local, zip, results.getDistricts?.state));
  const text = bullets.map((b) => b.text).join("\n");
  emit({ type: "step", tool: "analyze", label: "Analyzing what matters", status: "done", ms: Date.now() - t0, summary: bullets.length ? `${bullets.length} insights computed from the data, each with a source link` : "No insights for this ZIP" });
  return bullets.length ? { text, bullets, model: "computed" } : null;
}

/** The summary bullets, written in code from the computed facts: market, measure, Census, each with its sourceUrl. */
export function factBullets(f: { contestsByMarket: MarketContest[]; measuresWithCost: any[] }, census: SummaryBullet | null): SummaryBullet[] {
  return [marketBullet(f.contestsByMarket), measureBullet(f.measuresWithCost[0]), census].filter((b): b is SummaryBullet => !!b);
}

async function run(zip: string, emit: Emit) {
  const results: Record<string, unknown> = {};
  let mode: "live" | "fallback" = "fallback";
  let model: string | null = null;
  let narration = "";
  let error: string | null = null;

  const ladder = modelLadder();
  // QA P1: retry the first model once before moving down the ladder (a single bad tool call is usually transient).
  const attempts = ladder.length ? [ladder[0], ...ladder] : ladder;
  for (const { label: m, model: lm } of attempts) {
    try {
      emit({ type: "status", message: `Asking ${m} to plan tool calls…` });
      const res = await generateText({
        model: lm,
        maxRetries: 0,
        temperature: 0,
        providerOptions: GATEWAY_FALLBACKS,
        system: systemFor(zip),
        // From Engineering's patch 75e762f: name the five lookups so the required tool steps cover them.
        prompt: `Explain the Nov 3, 2026 ballot for ZIP ${zip}. First look it up with your tools: districts, races, candidates, market odds and local problems for ZIP ${zip}. Call several tools at once when you can. Then write.`,
        tools: { ...makeTools(zip, emit, results), ...civicTools, ...dataTools, ...townyTools },
        experimental_repairToolCall: async ({ toolCall, tools: available }) => {
          const norm = (n: string) => n.split(/[.:/]/).pop()!.replace(/[^a-z0-9]/gi, "").toLowerCase();
          const fixed = Object.keys(available).find((k) => norm(k) === norm(toolCall.toolName));
          return fixed ? { ...toolCall, toolName: fixed } : null;
        },
        prepareStep: ({ stepNumber }) => {
          const unrun = CORE_TOOLS.filter((n) => !(n in results));
          if (stepNumber < 2 && unrun.length) return { toolChoice: "required" as const, activeTools: [...unrun] as any };
          return { toolChoice: "none" as const, activeTools: [] as any };
        },
        // One model step: the model must call tools in step 0 (toolChoice required), then we stop. A second step would send
        // step 0's tool calls back to the provider, which is where malformed tool names were rejected (94103 fell back),
        // and it costs a full model round trip. The planner runs any lookup the model skipped, in parallel.
        stopWhen: stepCountIs(1),
        // Keeps the ballot response fast on long ballots (78701 has 58 races); the full list is in result.ballot.
        maxOutputTokens: NARRATION_TOKENS,
        abortSignal: AbortSignal.timeout(25000),
      });
      narration = res.finishReason === "length" ? trimNarration(res.text) : res.text;
      model = m;
      mode = "live";
      error = null;
      break;
    } catch (e: any) {
      error = String(e?.message || e).slice(0, 200);
      emit({ type: "status", message: `Model ${m} unavailable (${error.slice(0, 80)}).` });
      if (Object.keys(results).length) {
        // Partial run: the model really called these tools, so the run stays live; the planner finishes the rest.
        mode = "live";
        model = m;
        error = null;
        break;
      }
    }
  }

  // Deterministic completion: run any tools the model did not call (or all, in fallback mode).
  const order = CORE_TOOLS;
  const missing = order.filter((n) => !(n in results));
  if (missing.length) {
    if (mode === "live") emit({ type: "status", message: "Planner: running remaining lookups" });
    else emit({ type: "status", message: "Running the same tools: fallback mode (no model)." });
    const tools = makeTools(zip, emit, results) as any;
    await Promise.all(missing.map((n) => tools[n].execute({ zip }, { toolCallId: n, messages: [] })));
  }
  // Agent summary is behind SHOW_AGENT_SUMMARY (lib/flags.ts, off by default): off means no analyze step,
  // no narration and no summaryBullets, so the trace panel shows no summary block or heading.
  const insight = SHOW_AGENT_SUMMARY ? await analyze(zip, results as Record<string, any>, emit) : null;
  narration = SHOW_AGENT_SUMMARY ? (insight ? insight.text : labelMarketPrices(narration, results as Record<string, any>)) : "";
  emit({
    type: "result",
    mode,
    model,
    modelError: mode === "fallback" ? error : null,
    toolsRunByModel: mode === "live" ? order.filter((n) => !missing.includes(n)) : [],
    narration: SHOW_AGENT_SUMMARY ? (() => { const b = ballotFor(zip) as any; return cleanNarration(narration, zip, b?.races?.length ?? 0, b?.measures?.length ?? 0); })() : "",
    summaryBullets: insight?.bullets ?? [],
    ballot: ballotFor(zip),
    markets: results.getMarketOdds ?? {},
    generatedAt: new Date().toISOString(),
  });
}

const INVALID_ZIP = "zip must be exactly 5 digits, for example 78701.";

/** Runs the agent for a ZIP, calling `emit` for every event. Never throws: failures become an `error` event. */
async function produce(zip: string, emit: Emit) {
  try {
    if (!ballotFor(zip)) {
      emit({ type: "step", tool: "getDistricts", label: STEP_LABEL.getDistricts, status: "done", summary: UNSUPPORTED_MESSAGE });
      emit({ type: "unsupported", zip, message: UNSUPPORTED_MESSAGE });
    } else await run(zip, emit);
  } catch (e: any) {
    emit({ type: "error", message: String(e?.message || e) });
  }
}

function stream(zip: string, headers: Record<string, string>) {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      await produce(zip, (e) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n")));
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", Vary: "Accept", ...headers } });
}

/** Accept: application/json (preferred over NDJSON): wait for the run and answer with its final event as one JSON object. */
async function buffered(zip: string, headers: Record<string, string>) {
  let last: Record<string, unknown> | null = null;
  await produce(zip, (e) => {
    if (e.type === "result" || e.type === "unsupported" || e.type === "error") last = e;
  });
  const end = last as Record<string, unknown> | null;
  if (!end || end.type === "error") return apiError(500, "internal", "The ballot agent failed. Please try again.", { Vary: "Accept", ...headers });
  return Response.json(end, { headers: { "Cache-Control": "no-store", Vary: "Accept", ...headers } });
}

/** q-value of a media type in Accept (exact match only; wildcards do not opt in to the JSON mode). */
function q(accept: string, type: string): number {
  let best = -1;
  for (const part of accept.toLowerCase().split(",")) {
    const [t, ...params] = part.trim().split(";").map((s) => s.trim());
    if (t !== type) continue;
    const qp = params.find((p) => p.startsWith("q="));
    const v = qp ? Number(qp.slice(2)) : 1;
    if (Number.isFinite(v) && v > best) best = v;
  }
  return best;
}
/** True only when the client asks for application/json more strongly than application/x-ndjson. Default is NDJSON. */
export function wantsJson(accept: string | null | undefined): boolean {
  if (!accept) return false;
  const j = q(accept, "application/json");
  return j > 0 && j > q(accept, "application/x-ndjson");
}

function respond(req: Request, zip: string, headers: Record<string, string>) {
  return wantsJson(req.headers.get("accept")) ? buffered(zip, headers) : stream(zip, headers);
}

/** Wraps a handler: API-Version header on every response, rate limit on GET/POST, JSON 500 on an unexpected throw. */
function guarded(fn: (req: Request, rl: Record<string, string>) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const d = take(req, AGENT_POLICY);
    const h = { ...API_VERSION_HEADERS, ...d.headers };
    if (!d.allowed) return tooManyRequests(AGENT_POLICY, d, API_VERSION_HEADERS);
    try {
      return await fn(req, h);
    } catch {
      return apiError(500, "internal", "Unexpected server error.", h);
    }
  };
}

export const agentGET = guarded(async (req, h) => {
  const zip = new URL(req.url).searchParams.get("zip");
  return isZip(zip) ? respond(req, zip, h) : apiError(400, "invalid", INVALID_ZIP, h);
});

export const agentPOST = guarded(async (req, h) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "invalid", 'Body must be JSON like {"zip":"78701"}.', h);
  }
  const zip = body && typeof body === "object" ? (body as { zip?: unknown }).zip : undefined;
  return isZip(zip) ? respond(req, zip, h) : apiError(400, "invalid", INVALID_ZIP, h);
});

export const agentNotAllowed = withHeaders(methodNotAllowed(["GET", "POST"]), API_VERSION_HEADERS);
