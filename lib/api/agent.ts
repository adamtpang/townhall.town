// @ts-ignore plain ESM helper
import { cleanNarration } from "../narration.mjs";
// Ballot agent API, shared by /api/v1/agent (canonical) and /api/agent (alias). Same code, same behavior.
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { getDistricts, getRaces, getCandidates, getMarketOdds, getLocalProblems, ballotFor } from "../tools";
import { civicTools } from "../civicTools";
import { dataTools } from "../dataTools";
import { API_VERSION_HEADERS, apiError, isZip, methodNotAllowed, withHeaders } from "../apiError";
import { AGENT_POLICY, take, tooManyRequests } from "../rateLimit";
import { GATEWAY_FALLBACKS, modelLadder } from "../models";
import { getElectionDates, longDateIn } from "../logistics";
import { townyPrompt } from "../townyPrompt";
import { townyTools } from "../townyTools";
import { UNSUPPORTED_MESSAGE } from "../site";
import { measuresFor } from "../measures";


const STEP_LABEL: Record<string, string> = {
  getDistricts: "Finding your districts",
  getRaces: "Pulling your races",
  getCandidates: "Looking up candidates",
  getMarketOdds: "Fetching Polymarket prices",
  getLocalProblems: "Pulling local problems",
};

type Emit = (e: Record<string, unknown>) => void;
const CORE_TOOLS = ["getDistricts", "getRaces", "getCandidates", "getMarketOdds", "getLocalProblems"] as const;

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
  }
  return "done";
}

function makeTools(zip: string, emit: Emit, results: Record<string, unknown>) {
  const wrap = async <T,>(name: string, input: unknown, fn: () => Promise<T> | T) => {
    emit({ type: "step", tool: name, label: STEP_LABEL[name], status: "running", input });
    const t0 = Date.now();
    const r = await fn();
    results[name] = r;
    emit({ type: "step", tool: name, label: STEP_LABEL[name], status: "done", ms: Date.now() - t0, summary: summarize(name, r) });
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

/** Analysis step: after retrieval, the model reads the compact results and writes up to 3 neutral, sourced-data-only insights. */
async function analyze(zip: string, results: Record<string, any>, emit: Emit): Promise<{ text: string; model: string } | null> {
  const odds = Object.entries((results.getMarketOdds ?? {}) as Record<string, any>)
    .filter(([, v]) => v?.status === "live" && v.quotes?.[0]?.outcomes?.length)
    .map(([id, v]) => ({ id, leader: v.quotes[0].outcomes[0].name, prob: Math.round(v.quotes[0].outcomes[0].prob * 100) }))
    .sort((a, b) => Math.abs(a.prob - 50) - Math.abs(b.prob - 50))
    .slice(0, 4);
  const titles = new Map(((results.getRaces?.races ?? []) as any[]).concat(results.getRaces?.measures ?? []).map((r: any) => [r.id, r.title]));
  const local = ((results.getLocalProblems?.problems ?? []) as any[])
    .filter((p) => p.stateValue != null && Number.isFinite(Number(p.numeric ?? parseFloat(p.value))))
    .map((p) => ({ p, gap: Math.abs(Number(p.numeric ?? parseFloat(p.value)) - Number(p.stateValue)) }))
    .sort((a, b) => b.gap - a.gap)[0]?.p;
  // Written in code from the sourced Census row, so the wording and both numbers are always exactly the data.
  const localLine = local ? `- ${local.label}: ${String(local.value).endsWith(local.unit ?? "") ? local.value : `${local.value}${local.unit ?? ""}`} in ZIP ${zip}, vs ${local.stateValue}${local.unit ?? ""} statewide (${local.year ?? "Census ACS 5-year"}).` : "";
  const facts = {
    contestsByMarket: odds.map((o) => ({ contest: titles.get(o.id) ?? o.id, leader: o.leader, polymarketPricePct: o.prob, competitive: o.prob >= 35 && o.prob <= 65 })),
    measuresWithCost: measuresFor(zip).filter((m) => m.cost?.value && !/^unsure/i.test(m.cost.value)).slice(0, 6).map((m) => ({ measure: m.title, cost: m.cost.value, whoPays: m.whoPays?.text })),
  };
  emit({ type: "step", tool: "analyze", label: "Analyzing what matters", status: "running", input: { zip } });
  const t0 = Date.now();
  for (const { label: m, model: lm } of modelLadder().slice(0, 1)) {
    try {
      const res = await generateText({
        model: lm,
        maxRetries: 0,
        temperature: 0,
        providerOptions: GATEWAY_FALLBACKS,
        system: "You are a strictly nonpartisan ballot analyst. Use only the JSON facts given. Never recommend a candidate or a vote. Market prices are what traders pay, not predictions of truth. Every market number is a Polymarket price: always write it as \"a N% Polymarket market price\", never as a percentage of votes, a vote share, a poll or a chance of winning.",
        prompt: `Facts for ZIP ${zip} (Nov 3, 2026):
${JSON.stringify(facts)}

Write at most 2 bullets, each under 35 words, starting with "- ". Bullet 1: if any contest has competitive=true, name the closest one and its price, written as "a X% Polymarket market price"; otherwise say no contest is close and name the most lopsided leader with its price written the same way. A market price is what traders pay, not a poll and not a prediction from us. Bullet 2: one measure that changes what voters pay, quoting its cost text verbatim, including any "per $100,000 homestead" or similar qualifier. Write only these 2 bullets; never mention Census or local-problem figures. If the facts for a bullet are empty or null, leave that bullet out entirely and never say that something is missing. No preamble, no advice.`,
        maxOutputTokens: 220,
        abortSignal: AbortSignal.timeout(8000),
      });
      // The model sometimes writes a bullet saying a fact is missing; drop those instead of showing them.
      // Market numbers are labelled as Polymarket prices; the Census line is always the code-written one below.
      const modelText = labelMarketPrices(res.text.trim(), results)
        .split(/\n/)
        .filter((l) => l.trim() && !/(no|none)[^.]*(listed|provided|available|found)|not (listed|provided|available)/i.test(l))
        .filter((l) => !(local && l.includes(local.label)))
        .join("\n")
        .trim();
      if (!modelText) continue;
      const text = [modelText, localLine].filter(Boolean).join("\n");
      emit({ type: "step", tool: "analyze", label: "Analyzing what matters", status: "done", ms: Date.now() - t0, summary: `${text.split(/\n/).filter(Boolean).length} insights from ${m.replace(/ \(AI Gateway\)$/, "")}` });
      return { text, model: m };
    } catch {
      /* try the next model */
    }
  }
  const text = factBullets(facts, localLine);
  emit({ type: "step", tool: "analyze", label: "Analyzing what matters", status: "done", ms: Date.now() - t0, summary: text ? `${text.split(/\n/).length} insights computed from the data (model busy)` : "No insights for this ZIP" });
  return text ? { text, model: "computed" } : null;
}

/** The same insights, written in code from the computed facts, for when no model is available (labelled "computed from the data"). */
function factBullets(f: { contestsByMarket: any[]; measuresWithCost: any[] }, localLine: string): string {
  const out: string[] = [];
  const close = f.contestsByMarket.find((c) => c.competitive);
  if (close) out.push(`- Closest contest: ${close.contest}, with ${close.leader} at a ${close.polymarketPricePct}% Polymarket market price (what traders pay, not a poll).`);
  else if (f.contestsByMarket.length) {
    const top = [...f.contestsByMarket].sort((a, b) => b.polymarketPricePct - a.polymarketPricePct)[0];
    out.push(`- No contest is close on Polymarket; the most lopsided is ${top.contest}, with ${top.leader} at a ${top.polymarketPricePct}% Polymarket market price (what traders pay, not a poll).`);
  }
  const m = f.measuresWithCost[0];
  if (m) out.push(`- ${m.measure}: ${m.cost}`);
  if (localLine) out.push(localLine);
  return out.join("\n");
}

async function run(zip: string, emit: Emit) {
  const results: Record<string, unknown> = {};
  let mode: "live" | "fallback" = "fallback";
  let model: string | null = null;
  let narration = "";
  let error: string | null = null;

  for (const { label: m, model: lm } of modelLadder()) {
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
        prepareStep: ({ stepNumber }) => {
          const unrun = CORE_TOOLS.filter((n) => !(n in results));
          if (stepNumber < 2 && unrun.length) return { toolChoice: "required" as const, activeTools: [...unrun] as any };
          return { toolChoice: "none" as const, activeTools: [] as any };
        },
        // Stop after the two tool steps: the analysis step below writes the summary, so a third (writing) step is wasted time.
        stopWhen: stepCountIs(2),
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
      if (Object.keys(results).length) break; // partial run: finish deterministically below
    }
  }

  // Deterministic completion: run any tools the model did not call (or all, in fallback mode).
  const order = ["getDistricts", "getRaces", "getCandidates", "getMarketOdds", "getLocalProblems"] as const;
  const missing = order.filter((n) => !(n in results));
  if (missing.length) {
    if (mode === "live") emit({ type: "status", message: "Planner: running remaining lookups" });
    else emit({ type: "status", message: "Running the same tools deterministically: fallback mode (no model)." });
    const tools = makeTools(zip, emit, results) as any;
    for (const n of missing) await tools[n].execute({ zip }, { toolCallId: n, messages: [] });
  }
  const insight = await analyze(zip, results as Record<string, any>, emit);
  narration = insight ? insight.text : labelMarketPrices(narration, results as Record<string, any>);
  emit({
    type: "result",
    mode,
    model,
    modelError: mode === "fallback" ? error : null,
    toolsRunByModel: mode === "live" ? order.filter((n) => !missing.includes(n)) : [],
    narration: (() => { const b = ballotFor(zip) as any; return cleanNarration(narration, zip, b?.races?.length ?? 0, b?.measures?.length ?? 0); })(),
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
