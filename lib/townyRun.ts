// One Towny turn: Civic's prompt (verbatim, from the caller) + tools, down the model ladder.
// temperature 0 so the same question about different parties gets the same wording.
// If a model ends on a tool call with no text, ask it once more (no tools) to answer from the results.
import { generateText, stepCountIs, type ModelMessage, type ToolSet } from "ai";
import { GATEWAY_FALLBACKS, modelLadder } from "./models";

export type TownyTurn =
  | { ok: true; model: string; reply: string; toolCalls: { name: string; input: unknown }[]; attempts: { model: string; error: string }[] }
  | { ok: false; attempts: { model: string; error: string }[] };

const errText = (e: unknown) => {
  const x = e as { name?: string; message?: string; statusCode?: number };
  return `${x?.name ?? "Error"}${x?.statusCode ? ` ${x.statusCode}` : ""}: ${String(x?.message ?? e).replace(/\s+/g, " ").slice(0, 160)}`;
};

export async function runTowny({ system, prompt, tools, timeoutMs = 40000 }: { system: string; prompt: string; tools: ToolSet; timeoutMs?: number }): Promise<TownyTurn> {
  const attempts: { model: string; error: string }[] = [];
  for (const { label, model } of modelLadder()) {
    const calls: { name: string; input: unknown }[] = [];
    try {
      const signal = AbortSignal.timeout(timeoutMs);
      const res = await generateText({
        model,
        maxRetries: 1,
        temperature: 0,
        providerOptions: GATEWAY_FALLBACKS,
        system,
        prompt,
        tools,
        stopWhen: stepCountIs(8),
        abortSignal: signal,
        onStepFinish: (s) => s.toolCalls.forEach((c) => calls.push({ name: c.toolName, input: c.input })),
      });
      let reply = (res.text ?? "").trim();
      if (!reply) {
        const messages: ModelMessage[] = [{ role: "user", content: prompt }, ...res.response.messages];
        const fin = await generateText({ model, maxRetries: 1, temperature: 0, providerOptions: GATEWAY_FALLBACKS, system, messages, tools, toolChoice: "none", abortSignal: signal });
        reply = (fin.text ?? "").trim();
      }
      if (!reply) {
        attempts.push({ model: label, error: "empty reply" });
        continue;
      }
      return { ok: true, model: label, reply, toolCalls: calls, attempts };
    } catch (e) {
      attempts.push({ model: label, error: errText(e) });
    }
  }
  return { ok: false, attempts };
}
