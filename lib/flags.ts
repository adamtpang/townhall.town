// Design 10:14 AM CT Oct 30: the accountability ("Record") line sits behind ONE flag so it can be switched off in one
// change. Adam asked for it, so it is ON unless NEXT_PUBLIC_SHOW_ACCOUNTABILITY is "0" or "false" at build time.
// To switch off without env access: change DEFAULT_SHOW_ACCOUNTABILITY to false (one line) and redeploy a preview.
const DEFAULT_SHOW_ACCOUNTABILITY = true;
const raw = process.env.NEXT_PUBLIC_SHOW_ACCOUNTABILITY;
export const SHOW_ACCOUNTABILITY = raw === "0" || raw === "false" ? false : raw === "1" || raw === "true" ? true : DEFAULT_SHOW_ACCOUNTABILITY;

// PR #32 (party + FEC money under each candidate) is ON by default as of feat/finance (Oct 30): Civic's FEC sweep
// (finance_fixes18) is applied and QA's P1s are fixed, so promoting this exact commit shows it.
// Off switch: NEXT_PUBLIC_SHOW_FINANCE=0 at build time.
export const SHOW_FINANCE = process.env.NEXT_PUBLIC_SHOW_FINANCE !== "0";

// Local news strip (app/LocalNews.tsx) is OFF unless NEXT_PUBLIC_SHOW_NEWS is "1" at build time.
// Even when ON it renders nothing for a ZIP with no cached headlines (data/news.json, scripts/cache-news.mjs).
export const SHOW_NEWS = process.env.NEXT_PUBLIC_SHOW_NEWS === "1";

// Agent summary (the 3 code-written bullets under "Agent summary" in the trace panel) is OFF unless
// NEXT_PUBLIC_SHOW_AGENT_SUMMARY is "1" or "true" at build time. Off: /api/agent returns no narration and no
// summaryBullets and runs no analyze step, so the page shows no summary block and no heading. Gated server-side
// in lib/api/agent.ts. The bullets are factBullets() only (Civic summary23 P0 #2), each with its own sourceUrl.
const rawSummary = process.env.NEXT_PUBLIC_SHOW_AGENT_SUMMARY;
export const SHOW_AGENT_SUMMARY = rawSummary === "1" || rawSummary === "true";
