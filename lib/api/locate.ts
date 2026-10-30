// Location API, shared by /api/v1/locate (canonical) and /api/locate (alias). Same code, same behavior.
// Browser geolocation -> ZIP (ZCTA) via the public U.S. Census Geocoder. Coordinates are not stored.
// POST only, with coordinates in the JSON body, so they never appear in a URL or in request-path logs.
import { API_VERSION_HEADERS, apiError, methodNotAllowed, withHeaders } from "../apiError";
import { LOCATE_POLICY, take, tooManyRequests } from "../rateLimit";

const INVALID = 'Send a JSON body {"lat": <number>, "lon": <number>} in decimal degrees (lat -90..90, lon -180..180).';

/** A JSON number, or a strict decimal string; anything else is NaN. */
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN);

async function locate(req: Request, h: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "invalid", INVALID, h);
  }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const lat = num(b.lat);
  const lon = num(b.lon);
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return apiError(400, "invalid", INVALID, h);
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=2&format=json`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const d = await r.json();
    const z = d?.result?.geographies?.["2020 Census ZIP Code Tabulation Areas"]?.[0]?.ZCTA5;
    if (!z) return apiError(404, "not_found", "No ZIP found for this location", h);
    return Response.json({ zip: z, source: "U.S. Census Geocoder (ZCTA)" }, { headers: { "Cache-Control": "no-store", ...h } });
  } catch {
    return apiError(502, "upstream_unavailable", "Census geocoder unavailable", h);
  }
}

/** POST handler: rate limited, API-Version on every response, JSON 500 on an unexpected throw. */
export async function locatePOST(req: Request): Promise<Response> {
  const d = take(req, LOCATE_POLICY);
  const h = { ...API_VERSION_HEADERS, ...d.headers };
  if (!d.allowed) return tooManyRequests(LOCATE_POLICY, d, API_VERSION_HEADERS);
  try {
    return await locate(req, h);
  } catch {
    return apiError(500, "internal", "Unexpected server error.", h);
  }
}

export const locateNotAllowed = withHeaders(methodNotAllowed(["POST"]), API_VERSION_HEADERS);
