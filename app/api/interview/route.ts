import { generateObject } from "ai";
import { z } from "zod";
import { validZip } from "../../../lib/zip.mjs";
import { rateLimited, INTERVIEW_POLICY } from "../../../lib/rateLimit";
import { apiError, methodNotAllowed, withHeaders, API_VERSION_HEADERS } from "../../../lib/apiError";
import { issuesFor } from "../../../lib/issueOrder";
import { ballotFor } from "../../../lib/tools";
import { townyFact } from "../../../lib/townyFacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// AI Gateway only (OIDC on Vercel). Nothing the voter types is stored or logged by this route.
const MODELS = (process.env.INTERVIEW_MODELS || "openai/gpt-4.1-mini,google/gemini-2.5-flash-lite,openai/gpt-5-nano").split(",").map((m) => m.trim()).filter(Boolean);

const Out = z.object({
  answers: z.array(z.object({
    issue: z.string(),
    choice: z.enum(["yes", "neutral", "no"]),
    words: z.string().describe("the voter's own words that support this, copied exactly, under 100 characters"),
  })),
});

async function interview(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError(400, "invalid", 'Body must be JSON like {"zip":"78701","messages":[{"text":"..."}]}.');
  const zip = validZip(body.zip);
  const b = zip ? ballotFor(zip) : null;
  if (!zip || !b) return apiError(400, "invalid", "zip must be one of the covered 5-digit ZIPs: 78701, 94103 or 10001.");
  const msgs = (Array.isArray(body.messages) ? body.messages : []).filter((m: any) => typeof m?.text === "string").slice(-6).map((m: any) => String(m.text).slice(0, 600));
  if (!msgs.length) return Response.json({ answers: [] });
  // QA 94cf301 #4: "What's on my ballot?" / "When does early voting end?" answered from shipped data only, no model.
  const fact = townyFact(zip, msgs[msgs.length - 1]);
  if (fact) return Response.json({ answers: [], ...fact }, { headers: { "cache-control": "no-store" } });
  const issues = issuesFor(zip, b.state);
  const list = issues.map((i) => `- ${i.id} (${(i as { label?: string }).label ?? i.id}): "${i.question}"`).join("\n");
  const said = msgs.join("\n");
  for (const model of MODELS) {
    try {
      const { object } = await generateObject({
        model, schema: Out, maxRetries: 0, abortSignal: AbortSignal.timeout(9000),
        system: `You turn what a voter wrote into answers to fixed Yes/Neutral/No questions. You are strictly nonpartisan.
Only answer a question when the voter's words clearly say how they feel about that exact question. "yes" means they agree with the question as asked, "no" means they disagree, "neutral" means they said they are unsure or see both sides. One sentence can answer several questions: answer every question the voter's words address, each as its own entry (the same words may support more than one entry). If they call themselves neutral, unsure, undecided or say "no opinion" or "either way" on a topic, answer that question "neutral" instead of leaving it out; a bare "neutral" or "I'm neutral" applies to every topic named in the same message. If they did not address a question, leave it out. Never guess from party, place or identity. Never mention candidates or parties.
Questions:
${list}`,
        prompt: `The voter wrote:\n"""${said}"""`,
      });
      const valid = new Set(issues.map((i) => i.id));
      const seen = new Set<string>();
      const answers = object.answers.filter((a) => valid.has(a.issue) && !seen.has(a.issue) && seen.add(a.issue) && said.toLowerCase().includes(a.words.trim().toLowerCase().slice(0, 40)));
      return Response.json({ answers }, { headers: { "cache-control": "no-store" } });
    } catch { /* next model */ }
  }
  return apiError(502, "upstream_unavailable", "The answer model did not respond. Try again.");
}

export const POST = withHeaders(rateLimited(INTERVIEW_POLICY, interview), API_VERSION_HEADERS);
export const GET = withHeaders(methodNotAllowed(["POST"]), API_VERSION_HEADERS);
