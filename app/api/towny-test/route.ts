// PREVIEW-ONLY test harness for Civic's Towny prompt tests (towny_prompt.md). Not a shipped feature:
// returns the standard 404 JSON on production. One voter message in, one Towny reply out. Nothing is stored or logged.
import { TOWNY_BRIEF } from "../../../lib/towny/brief";
import { tool } from "ai";
import { z } from "zod";
import { apiError, isZip, methodNotAllowed } from "../../../lib/apiError";
import { runTowny } from "../../../lib/townyRun";
import { getElectionDates, longDateIn } from "../../../lib/logistics";
import { townyPrompt } from "../../../lib/townyPrompt";
import { townyTools } from "../../../lib/townyTools";
import { FIXED_REPLY, deleteMyData, keywordOf, outputFlags, redact } from "../../../lib/townyControls";
import { getCandidates, getDistricts, getMarketOdds, getRaces } from "../../../lib/tools";
import { asksOrder, ballotOrder, curated } from "../../../lib/towny/answer";
import { guardReply } from "../../../lib/towny/orderGuard";
import { ASKS_EARLY, ASKS_HOURS } from "../../../lib/townyFacts";
import { nameBareCertHost } from "../../../lib/sourceName";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const enabled = () => process.env.VERCEL_ENV !== "production";
const notFound = () => apiError(404, "not_found", "No API route at this path. See /openapi.json.");

const coreTools = {
  getDistricts: tool({ description: "Districts, state and county for a covered ZIP.", inputSchema: z.object({ zip: z.string() }), execute: async ({ zip }) => getDistricts(zip) }),
  getRaces: tool({ description: "Every race and measure on the Nov 3, 2026 ballot for a covered ZIP, with what each office does and a source URL.", inputSchema: z.object({ zip: z.string() }), execute: async ({ zip }) => getRaces(zip) }),
  getCandidates: tool({
    description: "Candidates (name, party, incumbent) for each race. Pass race ids from getRaces, or none for all.",
    inputSchema: z.object({ zip: z.string(), raceIds: z.array(z.string()).optional() }),
    execute: async ({ zip, raceIds }) => getCandidates(zip, raceIds),
  }),
  getMarketOdds: tool({ description: "Live Polymarket prices for race ids (Polymarket only; no market means no price). Only on a direct request; a market price, not a prediction.", inputSchema: z.object({ raceIds: z.array(z.string()) }), execute: async ({ raceIds }) => getMarketOdds(raceIds) }),
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
  // Civic towny_order_check NO-GO (Adam, Oct 30 3:24 PM CT): ballot-order questions get the deterministic, sourced answer before
  // the model (same as /api/interview); so do hours questions (Election Day row included). Sources are in the reply text too.
  if (zip && (asksOrder(clean.text) || ASKS_HOURS.test(clean.text) || ASKS_EARLY.test(clean.text))) {
    const c = asksOrder(clean.text) ? ballotOrder(zip, clean.text) : curated(zip, clean.text);
    if (c) {
      const reply = `${c.reply}\n\nSources: ${c.links.map((l) => `${l.label}: ${l.url}`).join("; ")}`;
      return Response.json({ handledBy: "code", intent: c.intent, reply, links: c.links, flags: outputFlags(reply) }, { headers: { "Cache-Control": "no-store" } });
    }
  }
  const tz = (zip && getElectionDates(zip)?.timezone) || "America/Chicago";
  const prompt = (zip ? `Voter's ZIP: ${zip}\n\n` : "") + clean.text;
  const turn = await runTowny({ system: `${townyPrompt(longDateIn(tz))}\n\n${TOWNY_BRIEF}`, prompt, tools: { ...coreTools, ...townyTools } });
  if (turn.ok) {
    const g = guardReply(zip, turn.reply);
    // Civic P2 (Oct 30, 3:47 PM CT): the CA certified list is named, never shown as its bare hostname.
    { const named = nameBareCertHost(g.reply); if (named !== g.reply) { g.reply = named; g.changed.push("named the CA certified list"); } }
    return Response.json(
      { handledBy: "model", model: turn.model, redacted: clean.redacted, modelSaw: prompt, toolCalls: turn.toolCalls, reply: g.reply, guard: g.changed, flags: outputFlags(g.reply), failedAttempts: turn.attempts },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  return apiError(502, "upstream_unavailable", turn.attempts.map((a) => `${a.model}: ${a.error}`).join(" | ") || "No model available.");
}

const notAllowed = () => (enabled() ? methodNotAllowed(["POST"])() : notFound());
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
