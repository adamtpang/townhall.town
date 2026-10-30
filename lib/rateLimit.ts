// Best-effort per-IP limit (per server instance): 10 requests per minute, then 429 JSON. No IPs are stored beyond the window.
const hits = new Map<string, number[]>();
export function limited(req: Request, max = 10, windowMs = 60_000): Response | null {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(ip, arr);
    return new Response(JSON.stringify({ type: "error", error: "rate_limited", message: "Too many requests. Try again in a minute." }), { status: 429, headers: { "content-type": "application/json", "retry-after": String(Math.ceil((windowMs - (now - arr[0])) / 1000)), "cache-control": "no-store" } });
  }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return null;
}
