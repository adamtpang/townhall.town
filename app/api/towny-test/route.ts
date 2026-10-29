// PREVIEW-ONLY test harness for Civic's Towny prompt tests (towny_prompt.md). Not a shipped feature:
// returns the standard 404 JSON on production. One voter message in, one Towny reply out. Nothing is stored or logged.
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { apiError, isZip, methodNotAllowed } from "../../../lib/apiError";
import { GATEWAY_FALLBACKS, modelLadder } from "../../../lib/models";
import { getElectionDates, longDateIn } from "../../../lib/logistics";
import { townyPrompt } from "../../../lib/townyPrompt";
import { townyTools } from "../../../lib/townyTools";
import { FIXED_REPLY, deleteMyData, keywordOf, outputFlags, redact } from "../../../lib/townyControls";
import { getCandidates, getDistricts, getMarketOdds, getRaces } from "../../../lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const enabled = () => process.env.VERCEL_ENV !== "production";
const notFound = () => apiError(404, "not_found", "No API route at this path. See /openapi.json.");

const coreTools = {
  getDistricts: tool({ description: "Districts, state and county for a covered ZIP.", inputSchema: z.object({ zip: z.string() }), execute: async ({ zip }) => getDistricts(zip) }),
  getRaces: tool({ description: "Every race and measure on the Nov 3, 2026 ballot for a covered ZIP, with what each office does and a source URL.", inputSchema: z.object({ zip: z.string() }), execute: async ({ zip }) => getRaces(zip) }),
  getCandidates: tool({
    description: "Candidates (name, party, incumbent) for each race, in ballot order. Pass race ids from getRaces, or none for all.",
    inputSchema: z.object({ zip: z.string(), raceIds: z.array(z.string()).optional() }),
    execute: async ({ zip, raceIds }) => getCandidates(zip, raceIds),
  }),
  getMarketOdds: tool({ description: "Prediction-market prices for race ids. Only on a direct request for odds; a market price, not a prediction.", inputSchema: z.object({ raceIds: z.array(z.string()) }), execute: async ({ raceIds }) => getMarketOdds(raceIds) }),
};

export async function POST(req: Request) {
  if (!enabled()) return notFound();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "invalid", 'Send JSON {"message": "...", "zip": "78701"} (zip optional).');
  }
  const message = typeof body?.message === "string" ? body.message.slice(0, 2000) : "";
  const zip = body?.zip;
  if (!message.trim() || (zip !== undefined && !isZip(zip))) return apiError(400, "invalid", 'Send JSON {"message": "...", "zip": "78701"} (zip optional, exactly 5 digits).');

  const kw = keywordOf(message);
  if (kw === "delete") return Response.json({ handledBy: "code", keyword: kw, reply: deleteMyData().message, tool: deleteMyData() }, { headers: { "Cache-Control": "no-store" } });
  if (kw) return Response.json({ handledBy: "code", keyword: kw, reply: FIXED_REPLY[kw] }, { headers: { "Cache-Control": "no-store" } });

  const clean = redact(message);
  const tz = (zip && getElectionDates(zip)?.timezone) || "America/Chicago";
  const prompt = (zip ? `Voter's ZIP: ${zip}\n\n` : "") + clean.text;
  const calls: { name: string; input: unknown }[] = [];
  let lastError: string | null = null;
  for (const { label, model } of modelLadder()) {
    try {
      const res = await generateText({
        model,
        maxRetries: 0,
        providerOptions: GATEWAY_FALLBACKS,
        system: townyPrompt(longDateIn(tz)),
        prompt,
        tools: { ...coreTools, ...townyTools },
        stopWhen: stepCountIs(6),
        abortSignal: AbortSignal.timeout(40000),
        onStepFinish: (s) => s.toolCalls.forEach((c) => calls.push({ name: c.toolName, input: c.input })),
      });
      return Response.json(
        { handledBy: "model", model: label, redacted: clean.redacted, modelSaw: prompt, toolCalls: calls, reply: res.text, flags: outputFlags(res.text) },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch {
      lastError = `model ${label} unavailable`;
    }
  }
  return apiError(502, "upstream_unavailable", lastError ?? "No model available.");
}

const notAllowed = () => (enabled() ? methodNotAllowed(["POST"])() : notFound());
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
