import { generateObject } from "ai";
import { z } from "zod";
import { validZip } from "../../../lib/zip.mjs";
import { rateLimited, INTERVIEW_POLICY } from "../../../lib/rateLimit";
import { apiError, methodNotAllowed, withHeaders, API_VERSION_HEADERS } from "../../../lib/apiError";
import { issuesFor } from "../../../lib/issueOrder";
import { ballotFor } from "../../../lib/tools";
import { curated, helpful } from "../../../lib/towny/answer";

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
  // QA judge-path P1-1 (Oct 30, 1:25 PM CT): who-to-vote, who is running, when/where, FAQ and ballot questions are answered
  // from curated data in code (lib/towny/answer.ts), never by the model.
  const c = curated(zip, msgs[msgs.length - 1]);
  if (c) return Response.json({ answers: [], reply: c.reply, links: c.links, chips: c.chips ?? [], intent: c.intent }, { headers: { "cache-control": "no-store" } });
  const help = () => { const h = helpful(zip); return Response.json({ answers: [], reply: h.reply, links: [], chips: h.chips, intent: h.intent }, { headers: { "cache-control": "no-store" } }); };
  const issues = issuesFor(zip, b.state);
  const list = issues.map((i) => `- ${i.id} (${(i as { label?: string }).label ?? i.id}): "${i.question}"`).join("\n");
  const said = msgs.join("\n");
  // QA P1-2: try the model once, retry once, then answer from curated data (never an error the voter can't act on).
  for (const model of [MODELS[0], MODELS[1] ?? MODELS[0]]) {
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
      if (!answers.length) return help();
      return Response.json({ answers }, { headers: { "cache-control": "no-store" } });
    } catch { /* retry */ }
  }
  return help();
}

// Curated replies (lib/towny/answer.ts) read only shipped data and never call the model, so they are answered before the
// per-client limit; the limit still guards every request that reaches the model. QA townyfab run (Oct 30, 1:45 PM CT): a
// judge asking 10+ quick questions hit the 429 on "Who is running for Governor?".
async function curatedFirst(req: Request): Promise<Response | null> {
  const body = await req.clone().json().catch(() => null);
  const zip = body && typeof body === "object" ? validZip(body.zip) : null;
  const msgs = zip && Array.isArray(body.messages) ? body.messages.filter((m: any) => typeof m?.text === "string") : [];
  if (!zip || !ballotFor(zip) || !msgs.length) return null;
  const c = curated(zip, String(msgs[msgs.length - 1].text).slice(0, 600));
  return c ? Response.json({ answers: [], reply: c.reply, links: c.links, chips: c.chips ?? [], intent: c.intent }, { headers: { "cache-control": "no-store" } }) : null;
}
const limited = rateLimited(INTERVIEW_POLICY, interview);
export const POST = withHeaders(async (req: Request) => (await curatedFirst(req)) ?? limited(req), API_VERSION_HEADERS);
export const GET = withHeaders(methodNotAllowed(["POST"]), API_VERSION_HEADERS);
