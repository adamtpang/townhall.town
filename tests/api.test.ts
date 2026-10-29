import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as agent from "../app/api/agent/route";
import * as locate from "../app/api/locate/route";
import * as catchAll from "../app/api/[...slug]/route";
import { GET as openapiGET } from "../app/openapi.json/route";
import { GET as catalogGET } from "../app/.well-known/api-catalog/route";
import { openApiSpec } from "../lib/openapi";
import { tierFor, TIER_LABELS } from "../app/RaceTiers";

const B = "https://townhall.town";
async function expectError(res: Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  const body = await res.json();
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe("string");
  return res;
}
const post = (body: string) => new Request(`${B}/api/agent`, { method: "POST", headers: { "content-type": "application/json" }, body });

describe("/api/agent ZIP validation (exactly 5 digits, no trimming or slicing)", () => {
  it.each(["787011", "7870", "", " 78701", "78701 ", "78701-1234", "7870a", "abcde", "٧٨٧٠١"])("GET zip=%j is 400 invalid", async (z) => {
    await expectError(await agent.GET(new Request(`${B}/api/agent?zip=${encodeURIComponent(z)}`)), 400, "invalid");
  });
  it("GET without zip is 400 invalid", async () => expectError(await agent.GET(new Request(`${B}/api/agent`)), 400, "invalid"));
  it.each(['{"zip":"787011"}', '{"zip":78701}', '{"zip":"7870"}', "{}", "null", "[]", "not json", ""])("POST %s is 400 invalid", async (b) => {
    await expectError(await agent.POST(post(b)), 400, "invalid");
  });
  it("a valid uncovered ZIP still streams NDJSON with the refusal copy", async () => {
    const res = await agent.GET(new Request(`${B}/api/agent?zip=90210`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    const last = JSON.parse((await res.text()).trim().split("\n").pop()!);
    expect(last).toEqual({ type: "unsupported", zip: "90210", message: "We only cover 78701 (Austin), 94103 (San Francisco) and 10001 (New York) for now." });
  });
  it.each(["PUT", "PATCH", "DELETE"] as const)("%s is 405 with Allow", async (m) => {
    const res = await expectError(await (agent as any)[m](new Request(`${B}/api/agent`, { method: m })), 405, "method_not_allowed");
    expect(res.headers.get("allow")).toBe("GET, POST");
  });
});

describe("/api/locate errors", () => {
  const post = (body: string) => locate.POST(new Request(`${B}/api/locate`, { method: "POST", headers: { "content-type": "application/json" }, body }));
  it.each(["", "{", "null", "[]", "{}", '{"lat":30}', '{"lon":-97}', '{"lat":"abc","lon":-97}', '{"lat":"","lon":""}', '{"lat":91,"lon":0}', '{"lat":0,"lon":181}', '{"lat":"1e3","lon":0}', '{"lat":null,"lon":null}'])("POST %s is 400 invalid", async (body) => {
    await expectError(await post(body), 400, "invalid");
  });
  it.each(["GET", "PUT", "PATCH", "DELETE"] as const)("%s is 405 with Allow: POST", async (m) => {
    const res = await expectError(await (locate as any)[m](new Request(`${B}/api/locate?lat=30.2672&lon=-97.7431`, { method: m })), 405, "method_not_allowed");
    expect(res.headers.get("allow")).toBe("POST");
  });
});

describe("unknown /api routes", () => {
  it.each(["GET", "POST", "PUT", "PATCH", "DELETE"] as const)("%s /api/nope is 404 JSON", async (m) => {
    await expectError(await (catchAll as any)[m](new Request(`${B}/api/nope`, { method: m })), 404, "not_found");
  });
});

// Route files under app/api, as OpenAPI paths. The catch-all is excluded: it only serves 404s.
// Preview-only test harness, 404 on production and deliberately not in the public spec (see tests/towny.test.ts).
const PREVIEW_ONLY = new Set(["/api/towny-test"]);
function apiRoutes(dir = "app/api", prefix = "/api"): string[] {
  return allRoutes(dir, prefix).filter((r) => !PREVIEW_ONLY.has(r));
}
function allRoutes(dir: string, prefix: string): string[] {
  return readdirSync(dir).flatMap((d) => {
    const p = join(dir, d);
    if (!statSync(p).isDirectory() || d.startsWith("[")) return [];
    const here = readdirSync(p).includes("route.ts") ? [`${prefix}/${d}`] : [];
    return [...here, ...allRoutes(p, `${prefix}/${d}`)];
  });
}
const methodsOf = (path: string) =>
  ["GET", "POST"].filter((m) => new RegExp(`export async function ${m}\\b`).test(readFileSync(`app${path}/route.ts`, "utf8"))).map((m) => m.toLowerCase());

describe("OpenAPI spec", () => {
  const spec = openApiSpec();
  it("is OpenAPI 3.1 served as JSON", async () => {
    const res = openapiGET();
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect((await res.json()).openapi).toBe("3.1.0");
  });
  it("documents exactly the routes and methods that exist", () => {
    const routes = apiRoutes().sort();
    expect(Object.keys(spec.paths).sort()).toEqual(routes);
    for (const r of routes) expect(Object.keys((spec.paths as any)[r]).sort()).toEqual(methodsOf(r).sort());
  });
  it("every $ref resolves", () => {
    const refs = [...JSON.stringify(spec).matchAll(/"#\/components\/schemas\/(\w+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(5);
    for (const r of refs) expect(spec.components.schemas).toHaveProperty(r);
  });
  it("API catalog links the spec", async () => {
    const res = catalogGET();
    expect(res.headers.get("content-type")).toMatch(/^application\/linkset\+json/);
    expect(JSON.stringify(await res.json())).toContain("/openapi.json");
  });
});

describe("race labels", () => {
  const race = (title: string, level = "federal") => ({ id: title, title, level });
  it("uses plain words, never letters", () => {
    expect(TIER_LABELS).toEqual(["Most at stake", "High", "Moderate", "Lower"]);
    expect(tierFor(race("U.S. Senate"), { avg: [{ name: "x", prob: 0.5 }], quotes: [] }).tier).toBe("Most at stake");
    expect(tierFor(race("U.S. Senate"), null).tier).toBe("High");
    expect(tierFor(race("U.S. House District 35"), null).tier).toBe("Moderate");
    expect(tierFor(race("City Council", "local"), null).tier).toBe("Lower");
  });
  it("no 'Not tiered' or candidate tier copy remains", () => {
    for (const f of ["app/IssueMatch.tsx", "app/RaceTiers.tsx", "app/BallotAgent.tsx", "README.md", "CONTRIBUTING.md"]) {
      const t = readFileSync(f, "utf8");
      expect(t).not.toMatch(/not tiered/i);
      expect(t).not.toMatch(/candidate tiers?/i);
    }
  });
});
