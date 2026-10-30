// POST /api/towny/followup: Towny follow-up questions, answered by tools and checked by lib/towny/verify.ts.
// Body: {"zip":"78701","question":"What about Prop A?","answers":{...th-answers-v1...},"races":[...],"focus":{"raceId":"tx-gov"}}
// The ZIP and answers come from the voter's localStorage on every call. This route never stores or logs them.
import { rateLimited, INTERVIEW_POLICY } from "../../../../lib/rateLimit";
import { apiError, methodNotAllowed, withHeaders, API_VERSION_HEADERS } from "../../../../lib/apiError";
import { answerFollowup, OUT_OF_SCOPE } from "../../../../lib/towny/followup";
import { isCoveredZip } from "../../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = { "cache-control": "no-store" };

async function followup(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError(400, "invalid", 'Body must be JSON like {"zip":"78701","question":"What about Prop A?"}.');
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return apiError(400, "invalid", "question is required.");
  const zip = typeof body.zip === "string" ? body.zip.trim() : "";
  if (!/^\d{5}$/.test(zip) || !isCoveredZip(zip)) return Response.json({ kind: "out_of_scope", reply: OUT_OF_SCOPE, claims: [], report: null, links: [{ label: "vote.gov", url: "https://vote.gov" }], toolCalls: [] }, { headers: NO_STORE });
  const focus = body.focus && typeof body.focus === "object" ? {
    raceId: typeof body.focus.raceId === "string" ? body.focus.raceId : undefined,
    candidate: typeof body.focus.candidate === "string" ? body.focus.candidate : undefined,
    measureId: typeof body.focus.measureId === "string" ? body.focus.measureId : undefined,
  } : undefined;
  const races = Array.isArray(body.races) ? body.races.filter((r: unknown) => typeof r === "string").slice(0, 80) : undefined;
  try {
    const out = await answerFollowup({ zip, question, answers: body.answers, races, focus });
    return Response.json(out, { headers: NO_STORE });
  } catch {
    return apiError(502, "upstream_unavailable", "Towny couldn't check that right now. Try again.");
  }
}

export const POST = withHeaders(rateLimited(INTERVIEW_POLICY, followup), API_VERSION_HEADERS);
export const GET = withHeaders(methodNotAllowed(["POST"]), API_VERSION_HEADERS);
