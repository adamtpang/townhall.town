// Browser geolocation -> ZIP (ZCTA) via the public U.S. Census Geocoder. Coordinates are not stored.
import { apiError, methodNotAllowed } from "../../../lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const rawLat = u.searchParams.get("lat");
  const rawLon = u.searchParams.get("lon");
  const num = (v: string | null) => (v !== null && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN);
  const lat = num(rawLat);
  const lon = num(rawLon);
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return apiError(400, "invalid", "lat and lon are required decimal degrees (lat -90..90, lon -180..180).");
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=2&format=json`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const d = await r.json();
    const z = d?.result?.geographies?.["2020 Census ZIP Code Tabulation Areas"]?.[0]?.ZCTA5;
    if (!z) return apiError(404, "not_found", "No ZIP found for this location");
    return Response.json({ zip: z, source: "U.S. Census Geocoder (ZCTA)" });
  } catch {
    return apiError(502, "upstream_unavailable", "Census geocoder unavailable");
  }
}

const notAllowed = methodNotAllowed(["GET"]);
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
