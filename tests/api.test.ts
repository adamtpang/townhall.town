import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as agent from "../app/api/agent/route";
import * as locate from "../app/api/locate/route";
import * as catchAll from "../app/api/[...slug]/route";
import { GET as openapiGET } from "../app/openapi.json/route";
import { GET as catalogGET } from "../app/.well-known/api-catalog/route";
import { openApiSpec } from "../lib/openapi";
import { tierFor, TIER_LABELS } from "../app/RaceTiers";
import { resetRateLimits } from "../lib/rateLimit";

// These tests call the agent far more than 10 times a minute from one (unknown) client; start each with fresh counters.
beforeEach(() => resetRateLimits());

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
// Not part of the public API: towny-test is preview-only; research and interview are the homepage's own UI calls.
const PREVIEW_ONLY = new Set(["/api/towny-test", "/api/research", "/api/interview"]);
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
    expect(TIER_LABELS).toEqual(["Most at stake", "High stakes", "Moderate stakes", "Lower stakes"]);
    expect(tierFor({ ...race("U.S. Senate"), meta: { closeness: "Competitive" } } as never).tier).toBe("most");
    expect(tierFor(race("U.S. Senate") as never).tier).toBe("high");
    expect(tierFor(race("U.S. House District 35") as never).tier).toBe("moderate");
    expect(tierFor(race("City Council", "local") as never).tier).toBe("lower");
  });
  it("no 'Not tiered' or candidate tier copy remains", () => {
    for (const f of ["app/IssueMatch.tsx", "app/RaceTiers.tsx", "app/BallotAgent.tsx", "README.md", "CONTRIBUTING.md"]) {
      const t = readFileSync(f, "utf8");
      expect(t).not.toMatch(/not tiered/i);
      expect(t).not.toMatch(/candidate tiers?/i);
    }
  });
});

describe("Only 78701, 94103 and 10001 are served (cache and live paths)", () => {
  const MSG = "We only cover 78701 (Austin), 94103 (San Francisco) and 10001 (New York) for now.";
  // 78130 and 90012 have cached ballots in data/ballots.json; 78702 and 75201 hit the statewide Texas ZIP path; 00000 and 90210 have nothing.
  it.each(["78130", "90012", "78702", "75201", "00000", "90210"])("GET and POST zip=%s end with the unsupported line and no ballot", async (z) => {
    for (const res of [await agent.GET(new Request(`${B}/api/agent?zip=${z}`)), await agent.POST(post(JSON.stringify({ zip: z })))]) {
      expect(res.status).toBe(200);
      const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
      expect(lines.at(-1)).toEqual({ type: "unsupported", zip: z, message: MSG });
      expect(lines.some((l) => l.type === "result" || "ballot" in l || l.cached !== undefined)).toBe(false);
      expect(JSON.stringify(lines)).not.toMatch(/Not cached/);
      const step = lines.find((l) => l.type === "step");
      expect(step?.summary).toBe(MSG);
    }
  });
  it("ballotFor and the data tools serve the three ZIPs and nothing else", async () => {
    const { ballotFor, DEMO_ZIPS, getDistricts, getRaces } = await import("../lib/tools");
    const { COVERED_ZIPS } = await import("../lib/site");
    expect([...COVERED_ZIPS].sort()).toEqual(["10001", "78701", "94103"]);
    expect([...DEMO_ZIPS].sort()).toEqual(["10001", "78701", "94103"]);
    for (const z of COVERED_ZIPS) expect(ballotFor(z)?.zip).toBe(z);
    for (const z of ["78130", "90012", "78702", "75201"]) {
      expect(ballotFor(z)).toBeNull();
      expect(getDistricts(z)).toEqual({ zip: z, found: false, message: MSG });
      expect(getRaces(z).races).toEqual([]);
    }
  });
});

describe("QA P1-6 / Civic (c): plain tier words, SBOE is a state office", () => {
  it("no score or market-leader jargon in the tier UI", () => {
    const src = readFileSync(join(process.cwd(), "app/RaceTiers.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/market leader|score \d|score ≥/i);
  });
  it("SBOE is labelled a state office", async () => {
    const { impactOf } = await import("../app/RaceTiers");
    expect(impactOf({ id: "tx-sboe-5", title: "State Board of Education, District 5", level: "state" } as never).why).toBe("state office");
  });
});

describe("QA P2: .ics early-voting text", () => {
  it("readable dates, no 'unsure', description span matches the event", async () => {
    const { whenFor } = await import("../lib/endscreen.mjs");
    for (const z of ["78701", "94103", "10001"]) {
      const e = whenFor(z, "2026-10-29").events.find((x: { kind: string }) => x.kind === "early");
      if (!e) continue;
      expect(e.details).not.toMatch(/unsure/i);
      expect(e.details).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(e.start).toBe("2026-10-29");
      expect(e.details).toContain("Thu, Oct 29");
    }
  });
});

describe("Civic qa_fixes2 + rule (a)", () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
  it("office text keyed by exact race id, sourced", () => {
    const o = JSON.parse(read("data/offices.json")).offices;
    for (const k of ["tx-sboe-5", "tx-hd-49", "travis-district-clerk", "travis-county-clerk", "travis-jp-4", "travis-jp-5", "travis-cad-place-1", "travis-cad-place-2", "travis-cad-place-3", "austin-council-9", "acc-trustee-place-1", "acc-trustee-place-2", "acc-trustee-place-3", "ca-ad-17", "sf-supervisor-6", "aisd-at-large-9"]) {
      expect(o[k]?.learn, k).toBeTruthy();
      expect(o[k].learn).not.toMatch(/^unsure/i);
      expect(o[k].sourceUrl).toMatch(/^https:\/\//);
    }
    expect(o["tcad-board"]).toBeUndefined();
  });
  it("Corrected-Final2 bedsheet, www candidate sites, Travis turnout source", () => {
    for (const f of ["data/ballots.json", "data/measures.json", "data/stances.json", "data/accountability.json", "data/turnout.json"]) {
      const s = read(f);
      expect(s, f).not.toContain("Final-FINAL");
      expect(s, f).not.toMatch(/https:\/\/(anthonycristo|votedibianca)\.com/);
      expect(s, f).not.toContain("lagovistatexas");
    }
    expect(read("data/measures.json")).toMatch(/\$1\.10 more per year on a \$100,000 homestead \(assumes a \$20,000 exemption\)/);
  });
  it("no keyword-matched tags reach the ballot payload; judicial candidates carry none", async () => {
    const { ballotFor } = await import("../lib/tools");
    for (const z of ["78701", "94103", "10001"]) for (const r of ballotFor(z)!.races) for (const c of r.candidates as { causes?: unknown; positions?: { match?: string }[] }[]) {
      expect(c.causes).toBeUndefined();
      for (const p of c.positions ?? []) expect(p.match ?? "").not.toMatch(/keyword/i);
      if ((r as { judicial?: unknown }).judicial) expect(c.positions).toBeUndefined();
    }
  });
});

describe("Civic qa_fixes3: every race on 78701/94103/10001 has sourced office text", () => {
  it("no 'not verified' office card", async () => {
    const { ballotFor } = await import("../lib/tools");
    const O = JSON.parse(readFileSync(join(process.cwd(), "data/offices.json"), "utf8")).offices;
    const bad: string[] = [];
    for (const z of ["78701", "94103", "10001"]) for (const r of ballotFor(z)!.races as { id: string; office?: string; officeSource?: string }[]) {
      const o = O[r.id];
      const ok = (o?.learn && o.sourceUrl && !/^\s*unsure/i.test(o.learn)) || (r.office && r.officeSource && !/^unsure/i.test(r.office));
      if (!ok) bad.push(`${z}:${r.id}`);
    }
    expect(bad).toEqual([]);
    expect(ballotFor("78701")!.races.some((r) => r.id === "travis-commissioner-2")).toBe(false);
  });
});
