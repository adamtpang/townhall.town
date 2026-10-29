// JSON error bodies for every API route: {"error":{"code","message"}} with application/json.
export type ApiErrorCode = "invalid" | "not_found" | "method_not_allowed" | "upstream_unavailable" | "internal";

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
