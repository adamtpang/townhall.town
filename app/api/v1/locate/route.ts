// Canonical v1 location endpoint. Implementation: lib/api/locate.ts.
// Browser geolocation -> ZIP (ZCTA) via the public U.S. Census Geocoder. Coordinates are not stored.
// POST only, with coordinates in the JSON body, so they never appear in a URL or in request-path logs.
import { locateNotAllowed, locatePOST } from "../../../../lib/api/locate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return locatePOST(req);
}
export { locateNotAllowed as GET, locateNotAllowed as PUT, locateNotAllowed as PATCH, locateNotAllowed as DELETE };
