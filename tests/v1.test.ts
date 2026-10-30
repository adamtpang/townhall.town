// /api/v1 parity with the unversioned aliases, rate limit headers and 429, JSON mode, OpenAPI coverage,
// and the developer docs and discoverability copy.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import * as agent from "../app/api/agent/route";
import * as agentV1 from "../app/api/v1/agent/route";
import * as locate from "../app/api/locate/route";
import * as locateV1 from "../app/api/v1/locate/route";
import { GET as catalogGET } from "../app/.well-known/api-catalog/route";
import { metadata as devMetadata } from "../app/developers/page";
import { DEVELOPERS, HOME, pageMarkdown } from "../lib/content";
import { homeJsonLd, jsonLdString } from "../lib/jsonld";
import { llmsTxt } from "../lib/llms";
import { openApiSpec } from "../lib/openapi";
import { AGENT_POLICY, LOCATE_POLICY, resetRateLimits, take } from "../lib/rateLimit";
import { wantsJson } from "../lib/api/agent";
import { SITE } from "../lib/site";

const B = "https://townhall.town";
beforeEach(() => resetRateLimits());
const ip = (n: number | string) => ({ "x-forwarded-for": `203.0.113.${n}, 10.0.0.1` });
const get = (path: string, h: Record<string, string> = {}) => new Request(`${B}${path}`, { headers: h });
const post = (path: string, body: string, h: Record<string, string> = {}) =>
  new Request(`${B}${path}`, { method: "POST", headers: { "content-type": "application/json", ...h }, body });
const strip = (h: Headers) => {
  const o = Object.fromEntries(h.entries());
  for (const k of Object.keys(o)) if (k.startsWith("ratelimit")) delete o[k];
  return o;
};

describe("/api/v1 and the unversioned aliases behave the same", () => {
  const agentCases: [string, (m: typeof agent) => Promise<Response>][] = [
    ["GET bad zip", (m) => m.GET(get("/x?zip=7870"))],
    ["GET no zip", (m) => m.GET(get("/x"))],
    ["POST not json", (m) => m.POST(post("/x", "nope"))],
    ["POST bad zip", (m) => m.POST(post("/x", '{"zip":"787011"}'))],
    ["GET uncovered", (m) => m.GET(get("/x?zip=90210"))],
    ["POST uncovered", (m) => m.POST(post("/x", '{"zip":"90210"}'))],
    ["GET uncovered, JSON mode", (m) => m.GET(get("/x?zip=90210", { accept: "application/json" }))],
    ["PUT", (m) => (m as any).PUT(new Request(`${B}/x`, { method: "PUT" }))],
    ["DELETE", (m) => (m as any).DELETE(new Request(`${B}/x`, { method: "DELETE" }))],
  ];
  it.each(agentCases)("agent: %s", async (_, call) => {
    resetRateLimits();
    const a = await call(agent);
    resetRateLimits();
    const v = await call(agentV1 as typeof agent);
    expect(v.status).toBe(a.status);
    expect(strip(v.headers)).toEqual(strip(a.headers));
    expect(await v.text()).toBe(await a.text());
    expect(v.headers.get("api-version")).toBe("1");
  });
  const locateCases: [string, (m: typeof locate) => Promise<Response>][] = [
    ["POST not json", (m) => m.POST(post("/x", "nope"))],
    ["POST out of range", (m) => m.POST(post("/x", '{"lat":91,"lon":0}'))],
    ["GET", (m) => (m as any).GET(get("/x"))],
    ["PATCH", (m) => (m as any).PATCH(new Request(`${B}/x`, { method: "PATCH" }))],
  ];
  it.each(locateCases)("locate: %s", async (_, call) => {
    resetRateLimits();
    const a = await call(locate);
    resetRateLimits();
    const v = await call(locateV1 as typeof locate);
    expect(v.status).toBe(a.status);
    expect(strip(v.headers)).toEqual(strip(a.headers));
    expect(await v.text()).toBe(await a.text());
    expect(v.headers.get("api-version")).toBe("1");
  });
  it("v1 route files keep the same segment config", async () => {
    expect(agentV1.runtime).toBe(agent.runtime);
    expect(agentV1.dynamic).toBe("force-dynamic");
    expect(agentV1.maxDuration).toBe(agent.maxDuration);
    expect(locateV1.runtime).toBe(locate.runtime);
  });
});

describe("rate limits", () => {
  it("sends IETF and legacy RateLimit headers that count down", async () => {
    const r1 = await agentV1.GET(get("/api/v1/agent?zip=7870", ip(1)));
    expect(r1.headers.get("ratelimit-policy")).toBe('"agent";q=10;w=60');
    expect(r1.headers.get("ratelimit")).toMatch(/^"agent";r=9;t=\d+$/);
    expect(r1.headers.get("ratelimit-limit")).toBe("10");
    expect(r1.headers.get("ratelimit-remaining")).toBe("9");
    expect(Number(r1.headers.get("ratelimit-reset"))).toBeGreaterThan(0);
    expect(Number(r1.headers.get("ratelimit-reset"))).toBeLessThanOrEqual(60);
    const r2 = await agentV1.GET(get("/api/v1/agent?zip=7870", ip(1)));
    expect(r2.headers.get("ratelimit-remaining")).toBe("8");
    expect(r2.headers.get("ratelimit")).toMatch(/^"agent";r=8;t=\d+$/);
  });
  it("the 11th request in a minute is a JSON 429 with Retry-After", async () => {
    for (let i = 0; i < AGENT_POLICY.limit; i++) expect((await agentV1.GET(get("/api/v1/agent?zip=90210", ip(2)))).status).toBe(200);
    const res = await agentV1.GET(get("/api/v1/agent?zip=90210", ip(2)));
    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("api-version")).toBe("1");
    const retry = Number(res.headers.get("retry-after"));
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(60);
    expect(res.headers.get("ratelimit-remaining")).toBe("0");
    expect(res.headers.get("ratelimit")).toBe(`"agent";r=0;t=${retry}`);
    const body = await res.json();
    expect(body.error.code).toBe("rate_limited");
    expect(typeof body.error.message).toBe("string");
  });
  it("the alias and v1 share one counter, and clients are counted separately", async () => {
    for (let i = 0; i < 5; i++) await agent.POST(post("/api/agent", '{"zip":"7870"}', ip(3)));
    for (let i = 0; i < 5; i++) await agentV1.POST(post("/api/v1/agent", '{"zip":"7870"}', ip(3)));
    expect((await agent.GET(get("/api/agent?zip=7870", ip(3)))).status).toBe(429);
    expect((await agentV1.GET(get("/api/v1/agent?zip=7870", ip(4)))).status).toBe(400);
  });
  it("one ballot lookup (one agent call plus one locate call) uses one request from each budget", async () => {
    const a = await agent.POST(post("/api/agent", '{"zip":"90210"}', ip(5)));
    const l = await locate.POST(post("/api/locate", "nope", ip(5)));
    expect(a.headers.get("ratelimit-remaining")).toBe(String(AGENT_POLICY.limit - 1));
    expect(l.headers.get("ratelimit-remaining")).toBe(String(LOCATE_POLICY.limit - 1));
    expect(l.headers.get("ratelimit-policy")).toBe('"locate";q=30;w=60');
  });
  it("the window resets", () => {
    const req = get("/x", ip(6));
    const t = 1_000_000;
    for (let i = 0; i < AGENT_POLICY.limit; i++) take(req, AGENT_POLICY, t);
    expect(take(req, AGENT_POLICY, t + 1000).allowed).toBe(false);
    const after = take(req, AGENT_POLICY, t + 60_000);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(AGENT_POLICY.limit - 1);
  });
  it("405 responses are not rate limited", async () => {
    for (let i = 0; i < 15; i++) expect((await (agentV1 as any).PUT(new Request(`${B}/x`, { method: "PUT", headers: ip(7) }))).status).toBe(405);
  });
});

describe("JSON mode (Accept: application/json)", () => {
  it("negotiates only when JSON is preferred over NDJSON", () => {
    expect(wantsJson(null)).toBe(false);
    expect(wantsJson("*/*")).toBe(false);
    expect(wantsJson("application/x-ndjson")).toBe(false);
    expect(wantsJson("application/json")).toBe(true);
    expect(wantsJson("application/json, application/x-ndjson")).toBe(false);
    expect(wantsJson("application/x-ndjson;q=0.5, application/json")).toBe(true);
    expect(wantsJson("application/json;q=0")).toBe(false);
  });
  it("returns the final event as one JSON object", async () => {
    const res = await agentV1.GET(get("/api/v1/agent?zip=90210", { accept: "application/json" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(res.headers.get("vary")).toBe("Accept");
    expect(await res.json()).toEqual({ type: "unsupported", zip: "90210", message: "We only cover 78701 (Austin), 94103 (San Francisco) and 10001 (New York) for now." });
  });
  it("defaults to the NDJSON stream", async () => {
    const res = await agentV1.POST(post("/api/v1/agent", '{"zip":"90210"}'));
    expect(res.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    expect(res.headers.get("vary")).toBe("Accept");
  });
});

describe("OpenAPI versioning and response coverage", () => {
  const spec = openApiSpec() as any;
  const ops = Object.entries(spec.paths).flatMap(([p, item]: [string, any]) => Object.entries(item).map(([m, op]) => ({ p, m, op: op as any })));
  it("lists the /v1 paths first and sets info.version", () => {
    expect(Object.keys(spec.paths)).toEqual(["/api/v1/agent", "/api/v1/locate", "/api/agent", "/api/locate", "/api/research", "/api/interview"]);
    expect(spec.info.version).toBe("1.0.0");
    expect(spec.info.description).toContain("RFC 9745");
    expect(spec.info.description).toContain("RFC 8594");
    expect(spec["x-api-versioning"]).toMatchObject({ current: "v1", strategy: "url-path", minimumNoticeDays: 90, header: "API-Version" });
  });
  it("operationIds are unique", () => {
    const ids = ops.map((o) => o.op.operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every operation documents 200, 400, 405, 429 and 500, each with a typed schema", () => {
    for (const { p, op } of ops) {
      for (const s of ["200", "400", "405", "429", "500"]) expect(op.responses, `${p} ${s}`).toHaveProperty(s);
      for (const [status, r] of Object.entries(op.responses) as [string, any][]) {
        if (p === "/api/research" && status === "200") { expect(r.content["application/x-ndjson"].schema.$ref).toBe("#/components/schemas/ResearchEvent"); continue; }
        const json = r.content?.["application/json"];
        expect(json?.schema?.$ref, `${p} ${status} application/json`).toMatch(/^#\/components\/schemas\//);
        if (status !== "200") expect(json.schema.$ref).toBe("#/components/schemas/Error");
      }
    }
  });
  it("agent 200s document both NDJSON (one AgentEvent per line) and JSON", () => {
    for (const { p, op } of ops.filter((o) => o.p.endsWith("/agent"))) {
      const c = op.responses["200"].content;
      expect(c["application/x-ndjson"].schema.$ref, p).toBe("#/components/schemas/AgentEvent");
      expect(c["application/json"].schema.$ref, p).toBe("#/components/schemas/AgentFinalEvent");
    }
  });
  it("locate documents 404 and 502", () => {
    for (const { op } of ops.filter((o) => o.p.endsWith("/locate"))) for (const s of ["404", "502"]) expect(op.responses).toHaveProperty(s);
  });
  it("429s carry Retry-After and every GET/POST response carries the RateLimit headers", () => {
    for (const { op } of ops) {
      expect(op.responses["429"].headers).toHaveProperty("Retry-After");
      for (const s of ["200", "400", "429", "500"]) for (const h of ["RateLimit-Policy", "RateLimit", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "API-Version"]) expect(op.responses[s].headers).toHaveProperty(h);
    }
  });
  it("every header and schema $ref resolves, and the Error enum knows rate_limited", () => {
    const json = JSON.stringify(spec);
    for (const [, kind, name] of json.matchAll(/"#\/components\/(\w+)\/([\w-]+)"/g)) expect(spec.components[kind], `${kind}/${name}`).toHaveProperty(name);
    expect(spec.components.schemas.Error.properties.error.properties.code.enum).toContain("rate_limited");
  });
  it("API catalog lists the v1 endpoints first and keeps the aliases", async () => {
    const anchors = (await catalogGET().json()).linkset.map((l: any) => l.anchor);
    expect(anchors).toEqual([`${B}/api/v1/agent`, `${B}/api/v1/locate`, `${B}/api/agent`, `${B}/api/locate`]);
  });
});

describe("brand and developer discoverability", () => {
  it("developer docs title and H1 name townhall.town", () => {
    expect(DEVELOPERS.title).toContain("townhall.town");
    expect(pageMarkdown("/developers").split("\n")[0]).toBe(`# ${DEVELOPERS.title}`);
    expect(devMetadata.title).toEqual({ absolute: DEVELOPERS.title });
  });
  it("homepage title and description describe the product", () => {
    // app/layout.tsx loads next/font, which does not run under Vitest, so check its source.
    expect(readFileSync("app/layout.tsx", "utf8")).toContain("title: { default: SITE.title,");
    expect(SITE.title).toMatch(/^townhall\.town: nonpartisan ballot guide/);
    expect(HOME.title).toBe(SITE.title);
    for (const s of ["nonpartisan", "ballot", "Austin", "San Francisco", "New York"]) expect(SITE.description).toContain(s);
  });
  it("/developers publishes the versioning policy, rate limits and the example client", () => {
    const md = pageMarkdown("/developers");
    for (const s of ["## Versioning and deprecation", "/api/v1/", "API-Version: 1", "RFC 9745", "RFC 8594", "at least 90 days", "## Rate limits", "RateLimit-Policy", "Retry-After", "429", "## Example client", "not an official"]) expect(md).toContain(s);
    const ids = DEVELOPERS.sections.map((s) => s.id).filter(Boolean);
    expect(ids).toEqual(expect.arrayContaining(["versioning", "rate-limits", "example-client"]));
  });
  it("llms.txt links the developer docs, the spec and the versioning policy", () => {
    const t = llmsTxt();
    expect(t).toMatch(/^## Developer resources$/m);
    for (const u of ["/developers)", "/openapi.json)", "/developers#versioning)", "/developers#rate-limits)", "/.well-known/api-catalog)"]) expect(t).toContain(`${B}${u}`);
  });
  it("Organization keeps a contactPoint with a public URL and no address, email or phone", () => {
    const ld = JSON.parse(jsonLdString(homeJsonLd()));
    const org = ld["@graph"].find((n: any) => n["@type"] === "Organization");
    expect(org.contactPoint).toMatchObject({ contactType: "customer support", url: SITE.issues });
    const s = JSON.stringify(ld);
    expect(s).not.toMatch(/PostalAddress|streetAddress|"address"|"email"|"telephone"/);
    const api = ld["@graph"].find((n: any) => n["@type"] === "WebAPI");
    expect(api.description).toContain("/api/v1/agent");
  });
});
