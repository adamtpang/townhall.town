// Per-IP, fixed-window, in-memory rate limit for the public API. Best effort: each serverless instance keeps its
// own counters, so the effective limit across instances can be higher. Headers follow
// draft-ietf-httpapi-ratelimit-headers (RateLimit-Policy and RateLimit, Structured Field lists), plus the widely
// read RateLimit-Limit / RateLimit-Remaining / RateLimit-Reset forms. A 429 adds Retry-After (delay-seconds).
import { apiError } from "./apiError";

export type Policy = { name: string; limit: number; windowSec: number };

/** Ballot agent: each call runs an AI model, so it is the tight one. One ballot lookup in the browser is one call. */
export const AGENT_POLICY: Policy = { name: "agent", limit: 10, windowSec: 60 };
/** Coordinates to ZIP: one call per "use my location" click. */
export const LOCATE_POLICY: Policy = { name: "locate", limit: 30, windowSec: 60 };

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

/** Client IP from the proxy headers Vercel sets. The first x-forwarded-for entry is the client. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip")?.trim() || "unknown";
}

export type Decision = { allowed: boolean; remaining: number; resetSec: number; headers: Record<string, string> };

export function rateLimitHeaders(p: Policy, remaining: number, resetSec: number): Record<string, string> {
  return {
    "RateLimit-Policy": `"${p.name}";q=${p.limit};w=${p.windowSec}`,
    RateLimit: `"${p.name}";r=${remaining};t=${resetSec}`,
    "RateLimit-Limit": String(p.limit),
    "RateLimit-Remaining": String(remaining),
    "RateLimit-Reset": String(resetSec),
  };
}

/** Count one request against `p` for this client and return the decision plus the headers to send. */
export function take(req: Request, p: Policy, now = Date.now()): Decision {
  const key = `${p.name}:${clientIp(req)}`;
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    if (buckets.size >= MAX_KEYS) buckets.clear();
    b = { count: 0, resetAt: now + p.windowSec * 1000 };
    buckets.set(key, b);
  }
  b.count++;
  const allowed = b.count <= p.limit;
  const remaining = Math.max(0, p.limit - b.count);
  const resetSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
  return { allowed, remaining, resetSec, headers: rateLimitHeaders(p, remaining, resetSec) };
}

/** 429 in the API's JSON error model, with Retry-After equal to the end of the window. */
export function tooManyRequests(p: Policy, d: Decision, extra: Record<string, string> = {}): Response {
  return apiError(429, "rate_limited", `Too many requests: the limit is ${p.limit} per ${p.windowSec} seconds per client. Retry after ${d.resetSec} seconds.`, {
    ...d.headers,
    "Retry-After": String(d.resetSec),
    ...extra,
  });
}

/** Test helper: forget every counter. */
export function resetRateLimits() {
  buckets.clear();
}

/** Research and interview: each call runs an AI model and web reads, so 10 per minute per client, like the agent. */
export const RESEARCH_POLICY: Policy = { name: "research", limit: 10, windowSec: 60 };
export const INTERVIEW_POLICY: Policy = { name: "interview", limit: 10, windowSec: 60 };
/** Returns a 429 Response in the API's JSON error model when over the limit, else null. */
export function limited(req: Request, p: Policy = RESEARCH_POLICY): Response | null {
  const d = take(req, p);
  return d.allowed ? null : tooManyRequests(p, d);
}
