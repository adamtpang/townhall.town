import { generateText, tool, stepCountIs, type LanguageModel } from "ai";
import { createXai } from "@ai-sdk/xai";
import { z } from "zod";
import { getDistricts, getRaces, getCandidates, getMarketOdds, getLocalProblems, ballotFor } from "../../../lib/tools";
import { civicTools } from "../../../lib/civicTools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Model ladder: Vercel AI Gateway model strings (auth via OIDC on Vercel or AI_GATEWAY_API_KEY),
// then direct xAI if XAI_API_KEY is configured. Override the gateway list with AGENT_MODELS.
const GATEWAY_MODELS = (process.env.AGENT_MODELS || "google/gemini-2.5-flash-lite,openai/gpt-4.1-mini,openai/gpt-5-nano").split(",").map((m) => m.trim()).filter(Boolean);
function modelLadder(): { label: string; model: LanguageModel }[] {
  const out: { label: string; model: LanguageModel }[] = GATEWAY_MODELS.map((m) => ({ label: m + " (AI Gateway)", model: m }));
  if (process.env.XAI_API_KEY) {
    const xai = createXai({ apiKey: process.env.XAI_API_KEY });
    out.unshift({ label: "grok-4-fast-non-reasoning (xAI)", model: xai("grok-4-fast-non-reasoning") });
  }
  return out;
}

const STEP_LABEL: Record<string, string> = {
  getDistricts: "Finding your districts",
  getRaces: "Pulling your races",
  getCandidates: "Looking up candidates",
  getMarketOdds: "Fetching market odds",
  getLocalProblems: "Pulling local problems",
};

type Emit = (e: Record<string, unknown>) => void;

function summarize(name: string, r: any): string {
  switch (name) {
    case "getDistricts":
      return r.found ? `${r.place}: ${r.districts.map((d: any) => d.label).join(", ")}` : r.message;
    case "getRaces":
      return `${r.races.length} races, ${r.measures.length} statewide measures on Nov 3, 2026`;
    case "getCandidates":
      return `${r.races.reduce((n: number, x: any) => n + x.candidates.length, 0)} candidates across ${r.races.length} races`;
    case "getMarketOdds": {
      const v = Object.values(r) as any[];
      return `${v.filter((x) => x.quotes.length).length} of ${v.length} contests have a market (${v.filter((x) => x.status === "live").length} live)`;
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
    }),
    getCandidates: tool({
      description: "Get general-election candidates (name, party, incumbent) for the races. Pass race ids from getRaces, or none for all.",
      inputSchema: z.object({ zip: z.string(), raceIds: z.array(z.string()).optional() }),
      execute: async () => wrap("getCandidates", { zip }, () => getCandidates(zip)),
    }),
    getMarketOdds: tool({
      description: "Fetch live prediction-market odds (Polymarket, Kalshi) for race ids / measure ids. Returns 'no market found' when none exists.",
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

const SYSTEM = `You are townhall.town, a strictly nonpartisan ballot agent.
In your FIRST step, call all five tools in parallel, each exactly once: getDistricts, getRaces, getCandidates, getMarketOdds, getLocalProblems.
Then write a 2-3 sentence neutral summary of what is on this voter's ballot and the top local problems.
Never recommend a candidate or say who is "best". Never state facts about candidates that are not in tool results. Market odds are market prices, not predictions of truth.`;

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
        system: SYSTEM,
        prompt: `Explain the Nov 3, 2026 ballot for ZIP ${zip}.`,
        tools: { ...makeTools(zip, emit, results), ...civicTools },
        stopWhen: stepCountIs(3),
        abortSignal: AbortSignal.timeout(25000),
      });
      narration = res.text;
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
    if (mode === "live") emit({ type: "status", message: `Model skipped ${missing.join(", ")}; running them deterministically.` });
    else emit({ type: "status", message: "Running the same tools deterministically: fallback mode (no model)." });
    const tools = makeTools(zip, emit, results) as any;
    for (const n of missing) await tools[n].execute({ zip }, { toolCallId: n, messages: [] });
  }
  emit({
    type: "result",
    mode,
    model,
    modelError: mode === "fallback" ? error : null,
    toolsRunByModel: mode === "live" ? order.filter((n) => !missing.includes(n)) : [],
    narration,
    ballot: ballotFor(zip),
    markets: results.getMarketOdds ?? {},
    generatedAt: new Date().toISOString(),
  });
}

async function handle(zip: string) {
  zip = (zip || "").replace(/\D/g, "").slice(0, 5);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = (e) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        if (!ballotFor(zip)) {
          emit({ type: "step", tool: "getDistricts", label: STEP_LABEL.getDistricts, status: "done", summary: "Not cached" });
          emit({ type: "unsupported", zip, message: `ZIP ${zip || "(blank)"} isn't covered yet. Austin, SF and NYC for now.` });
        } else await run(zip, emit);
      } catch (e: any) {
        emit({ type: "error", message: String(e?.message || e) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(req: Request) {
  return handle(new URL(req.url).searchParams.get("zip") || "");
}
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return handle(String(body.zip || ""));
}
