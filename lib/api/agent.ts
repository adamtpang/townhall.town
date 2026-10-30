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

export type Insight = { text: string; sourceLabel: string; sourceUrl: string | null };

/** Analysis step: three sourced, nonpartisan insights computed in code from the tool results (no model prose, so
 *  nothing can drift or read as partisan). Market prices always show both sides and are labeled as prices. */
function analyze(zip: string, results: Record<string, any>, emit: Emit): Insight[] {
  emit({ type: "step", tool: "analyze", label: "Analyzing what matters", status: "running", input: { zip } });
  const t0 = Date.now();
  const titles = new Map(((results.getRaces?.races ?? []) as any[]).concat(results.getRaces?.measures ?? []).map((r: any) => [r.id, r.title]));
  const out: Insight[] = [];

  // 1) Closest contest by market price (or, if none is within 35 to 65%, the most lopsided), both sides shown.
  const priced = Object.entries((results.getMarketOdds ?? {}) as Record<string, any>)
    .map(([id, v]) => ({ id, q: v?.status === "live" ? v.quotes?.[0] : null }))
    .filter((x) => x.q?.outcomes?.length)
    .map((x) => {
      const o = [...x.q.outcomes].sort((a: any, b: any) => b.prob - a.prob);
      return { id: x.id, url: x.q.url as string, lead: o[0], next: o[1] ?? null, lp: Math.round(o[0].prob * 100) };
    });
  const close = priced.filter((x) => x.lp >= 35 && x.lp <= 65).sort((a, b) => Math.abs(a.lp - 50) - Math.abs(b.lp - 50))[0];
  const pick = close ?? priced.sort((a, b) => b.lp - a.lp)[0];
  if (pick) {
    const sides = pick.next ? `${pick.lead.name} ${pick.lp}% vs ${pick.next.name} ${Math.round(pick.next.prob * 100)}%` : `${pick.lead.name} ${pick.lp}%`;
    out.push({
      text: `${close ? "Closest contest by market price" : "No contest is close by market price; most lopsided"}: ${titles.get(pick.id) ?? pick.id}, ${sides}. These are Polymarket market prices (what traders pay), not polls or predictions.`,
      sourceLabel: "Polymarket",
      sourceUrl: pick.url ?? null,
    });
  }

  // 2) A measure that changes what voters pay, official cost text verbatim.
  const m = measuresFor(zip).find((x) => x.cost?.value && !/^unsure/i.test(x.cost.value));
  if (m) out.push({ text: `${m.title}: ${m.cost.value}`, sourceLabel: "Official cost source", sourceUrl: m.cost.sourceUrl ?? null });

  // 3) The local problem furthest from its state figure (gap computed here).
  const p = ((results.getLocalProblems?.problems ?? []) as any[])
    .filter((x) => x.stateValue != null)
    .map((x) => ({ x, gap: Math.abs((Number(x.numeric ?? parseFloat(x.value)) || 0) - Number(x.stateValue)) }))
    .sort((a, b) => b.gap - a.gap)[0]?.x;
  if (p) out.push({ text: `${p.label}: ${p.value} here vs ${p.stateValue}% statewide.`, sourceLabel: p.source?.label ?? "Census ACS", sourceUrl: p.source?.url ?? null });

  emit({ type: "step", tool: "analyze", label: "Analyzing what matters", status: "done", ms: Date.now() - t0, summary: out.length ? `${out.length} sourced insights computed from the tool results` : "No insights for this ZIP" });
  return out;
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
  const insights = analyze(zip, results as Record<string, any>, emit);
  if (insights.length) narration = insights.map((i) => `- ${i.text}`).join("\n");
  emit({
    type: "result",
    mode,
    model,
    modelError: mode === "fallback" ? error : null,
    toolsRunByModel: mode === "live" ? order.filter((n) => !missing.includes(n)) : [],
    insights,
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
