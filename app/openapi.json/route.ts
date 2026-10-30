import { openApiSpec } from "../../lib/openapi";

export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(openApiSpec(), null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
  });
}
