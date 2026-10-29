// RFC 9727 API catalog: points agents at the OpenAPI description and the developer docs.
import { SITE } from "../../../lib/site";

export const dynamic = "force-static";

export function GET() {
  const body = {
    linkset: [
      {
        anchor: `${SITE.url}/api/agent`,
        "service-desc": [{ href: `${SITE.url}/openapi.json`, type: "application/json" }],
        "service-doc": [{ href: `${SITE.url}/developers`, type: "text/html" }],
      },
      {
        anchor: `${SITE.url}/api/locate`,
        "service-desc": [{ href: `${SITE.url}/openapi.json`, type: "application/json" }],
        "service-doc": [{ href: `${SITE.url}/developers`, type: "text/html" }],
      },
    ],
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"', "Cache-Control": "public, max-age=3600" },
  });
}
