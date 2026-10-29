// Browser geolocation -> ZIP (ZCTA) via the public U.S. Census Geocoder. Coordinates are not stored.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lon = Number(u.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return Response.json({ error: "lat and lon required" }, { status: 400 });
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=2&format=json`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const d = await r.json();
    const z = d?.result?.geographies?.["2020 Census ZIP Code Tabulation Areas"]?.[0]?.ZCTA5;
    if (!z) return Response.json({ error: "No ZIP found for this location" }, { status: 404 });
    return Response.json({ zip: z, source: "U.S. Census Geocoder (ZCTA)" });
  } catch {
    return Response.json({ error: "Census geocoder unavailable" }, { status: 502 });
  }
}
