// JSON error bodies for every API route: {"error":{"code","message"}} with application/json.
export type ApiErrorCode = "invalid" | "not_found" | "method_not_allowed" | "upstream_unavailable" | "rate_limited" | "internal";

export function apiError(status: number, code: ApiErrorCode, message: string, headers: Record<string, string> = {}): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** 405 handler for methods a route does not support. `allow` lists the supported methods. */
export function methodNotAllowed(allow: string[]) {
  return () => apiError(405, "method_not_allowed", `Method not allowed. Use ${allow.join(" or ")}.`, { Allow: allow.join(", ") });
}

/** Exactly five ASCII digits. No trimming, slicing or digit extraction. */
export const ZIP_RE = /^\d{5}$/;
export const isZip = (v: unknown): v is string => typeof v === "string" && ZIP_RE.test(v);

/** Current API major version, sent as API-Version on every /api/v1 and alias response. See /developers#versioning. */
export const API_VERSION = "1";
export const API_VERSION_HEADERS: Record<string, string> = { "API-Version": API_VERSION };

/** Same handler, with extra response headers added. */
export function withHeaders(fn: (req: Request) => Response | Promise<Response>, extra: Record<string, string>) {
  return async (req: Request) => {
    const res = await fn(req);
    for (const [k, v] of Object.entries(extra)) res.headers.set(k, v);
    return res;
  };
}
