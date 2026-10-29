import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";

// Model ladder: Vercel AI Gateway model strings (auth via OIDC on Vercel or AI_GATEWAY_API_KEY),
// then direct xAI if XAI_API_KEY is configured. Override the gateway list with AGENT_MODELS.
const GATEWAY_MODELS = (process.env.AGENT_MODELS || "google/gemini-2.5-flash-lite,openai/gpt-4.1-mini,openai/gpt-5-nano").split(",").map((m) => m.trim()).filter(Boolean);

export function modelLadder(): { label: string; model: LanguageModel }[] {
  const out: { label: string; model: LanguageModel }[] = GATEWAY_MODELS.map((m) => ({ label: m + " (AI Gateway)", model: m }));
  if (process.env.XAI_API_KEY) {
    const xai = createXai({ apiKey: process.env.XAI_API_KEY });
    out.unshift({ label: "grok-4-fast-non-reasoning (xAI)", model: xai("grok-4-fast-non-reasoning") });
  }
  return out;
}

// Gateway-side fallbacks (ids checked against the AI Gateway model list; xai/grok-3-mini is not listed).
export const GATEWAY_FALLBACKS = { gateway: { models: ["openai/gpt-4o-mini", "openai/gpt-4.1-mini"] } };
