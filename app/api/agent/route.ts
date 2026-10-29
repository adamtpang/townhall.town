import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { getDistricts, getRaces, getCandidates, getMarketOdds, getLocalProblems, ballotFor } from "../../../lib/tools";
import { civicTools } from "../../../lib/civicTools";
import { dataTools } from "../../../lib/dataTools";
import { apiError, isZip, methodNotAllowed } from "../../../lib/apiError";
import { GATEWAY_FALLBACKS, modelLadder } from "../../../lib/models";
import { getElectionDates, longDateIn } from "../../../lib/logistics";
import { townyPrompt } from "../../../lib/townyPrompt";
import { townyTools } from "../../../lib/townyTools";
import { UNSUPPORTED_MESSAGE } from "../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      return `${r.races.length} races, ${r.measures.length} ballot measures on Nov 3, 2026`;
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

// System prompt: Civic's Towny prompt, verbatim (lib/townyPrompt.ts), with {{TODAY}} in the ZIP's time zone.
const systemFor = (zip: string) => townyPrompt(longDateIn(getElectionDates(zip)?.timezone ?? "America/Chicago"));

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
        prompt: `Explain the Nov 3, 2026 ballot for ZIP ${zip}.`,
        tools: { ...makeTools(zip, emit, results), ...civicTools, ...dataTools, ...townyTools },
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

const INVALID_ZIP = "zip must be exactly 5 digits, for example 78701.";

function handle(zip: string) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = (e) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        if (!ballotFor(zip)) {
          emit({ type: "step", tool: "getDistricts", label: STEP_LABEL.getDistricts, status: "done", summary: UNSUPPORTED_MESSAGE });
          emit({ type: "unsupported", zip, message: UNSUPPORTED_MESSAGE });
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
  const zip = new URL(req.url).searchParams.get("zip");
  return isZip(zip) ? handle(zip) : apiError(400, "invalid", INVALID_ZIP);
}
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "invalid", 'Body must be JSON like {"zip":"78701"}.');
  }
  const zip = body && typeof body === "object" ? (body as { zip?: unknown }).zip : undefined;
  return isZip(zip) ? handle(zip) : apiError(400, "invalid", INVALID_ZIP);
}

const notAllowed = methodNotAllowed(["GET", "POST"]);
export { notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
