// OpenAPI 3.1 description of the public API. Documents only the routes that exist:
// app/api/agent/route.ts (GET, POST) and app/api/locate/route.ts (POST). Served at /openapi.json.
import { COVERAGE, SITE } from "./site";

const zips = COVERAGE.map((c) => c.zip);
const err = (description: string, example: { code: string; message: string }) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { error: example } } },
});
const invalidZip = err("The zip is not exactly 5 digits. Nothing is trimmed or sliced.", { code: "invalid", message: "zip must be exactly 5 digits, for example 78701." });
const ndjson = {
  description:
    "A stream of newline-delimited JSON events. Step and status events arrive while tools run. The stream ends with one `result` event, or one `unsupported` event for a 5-digit ZIP that is not covered, or one `error` event if the run fails after the stream started.",
  content: {
    "application/x-ndjson": {
      schema: { $ref: "#/components/schemas/AgentEvent" },
      example: { type: "unsupported", zip: "90210", message: "We only cover 78701 (Austin), 94103 (San Francisco) and 10001 (New York) for now." },
    },
  },
};
const notAllowed = (allow: string) => ({
  ...err("Method not allowed. The Allow header lists the supported methods.", { code: "method_not_allowed", message: `Method not allowed. Use ${allow.replace(", ", " or ")}.` }),
  headers: { Allow: { schema: { type: "string", example: allow } } },
});
const source = { $ref: "#/components/schemas/Source" };

export function openApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "townhall.town API",
      version: "1.0.0",
      summary: "Nonpartisan, sourced ballot data for the Nov 3, 2026 U.S. general election.",
      description: `Free, no key, no account. Covered ZIPs: ${COVERAGE.map((c) => `${c.zip} (${c.place})`).join(", ")}. Every fact carries a source link; facts that cannot be confirmed are marked unsure. Every API error is JSON: {"error":{"code","message"}}.`,
      license: { name: "MIT", identifier: "MIT" },
      contact: { name: "GitHub issues", url: SITE.issues },
    },
    externalDocs: { description: "Developer guide with curl examples", url: `${SITE.url}/developers` },
    servers: [{ url: SITE.url }],
    // No authentication: the API is public and keyless.
    security: [],
    tags: [
      { name: "ballot", description: "Races, candidates, measures and sources for a covered ZIP." },
      { name: "location", description: "Coordinates to ZIP via the U.S. Census Geocoder." },
    ],
    paths: {
      "/api/agent": {
        get: {
          operationId: "getBallot",
          tags: ["ballot"],
          summary: "Explain the ballot for a ZIP",
          description:
            "Runs the ballot agent for a ZIP: districts, races, candidates, market odds and local Census data, plus a short neutral AI summary written only from those records. Responses are not cached (Cache-Control: no-store).",
          parameters: [
            { name: "zip", in: "query", required: true, description: "Exactly 5 digits.", schema: { type: "string", pattern: "^\\d{5}$", examples: zips } },
          ],
          responses: { "200": ndjson, "400": invalidZip, "405": notAllowed("GET, POST") },
        },
        post: {
          operationId: "postBallot",
          tags: ["ballot"],
          summary: "Explain the ballot for a ZIP (JSON body)",
          description: "Same as GET, with the ZIP in a JSON body. This is what the townhall.town page calls.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["zip"],
                  properties: { zip: { type: "string", pattern: "^\\d{5}$", description: "Exactly 5 digits, as a string." } },
                },
                example: { zip: "78701" },
              },
            },
          },
          responses: { "200": ndjson, "400": invalidZip, "405": notAllowed("GET, POST") },
        },
      },
      "/api/locate": {
        post: {
          operationId: "locateZip",
          tags: ["location"],
          summary: "Coordinates to ZIP",
          description: "Looks up the ZIP Code Tabulation Area for a point using the public U.S. Census Geocoder. Coordinates are not stored.",
          requestBody: {
            required: true,
            description: "Coordinates go in the JSON body, not the URL, so they do not appear in request paths or logs of URLs.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["lat", "lon"],
                  properties: {
                    lat: { type: "number", minimum: -90, maximum: 90, description: "Latitude in decimal degrees." },
                    lon: { type: "number", minimum: -180, maximum: 180, description: "Longitude in decimal degrees." },
                  },
                },
                example: { lat: 30.2672, lon: -97.7431 },
              },
            },
          },
          responses: {
            "200": {
              description: "The ZIP for the point.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["zip", "source"],
                    properties: { zip: { type: "string", pattern: "^\\d{5}$" }, source: { type: "string", const: "U.S. Census Geocoder (ZCTA)" } },
                  },
                  example: { zip: "78701", source: "U.S. Census Geocoder (ZCTA)" },
                },
              },
            },
            "400": err("The body is not JSON, or lat or lon is missing or out of range.", { code: "invalid", message: 'Send a JSON body {"lat": <number>, "lon": <number>} in decimal degrees (lat -90..90, lon -180..180).' }),
            "404": err("The point is not inside a U.S. ZIP Code Tabulation Area.", { code: "not_found", message: "No ZIP found for this location" }),
            "405": notAllowed("POST"),
            "502": err("The Census Geocoder did not answer.", { code: "upstream_unavailable", message: "Census geocoder unavailable" }),
          },
        },
      },
    },
    components: {
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string", enum: ["invalid", "not_found", "method_not_allowed", "upstream_unavailable", "internal"] },
                message: { type: "string" },
              },
            },
          },
          description: "Returned by every API route on error, including 404 for an unknown /api/* path.",
        },
        Source: {
          type: "object",
          required: ["label", "url"],
          properties: { label: { type: "string" }, url: { type: "string", format: "uri" }, retrieved: { type: "string" } },
        },
        AgentEvent: {
          description: "One line of the NDJSON stream.",
          oneOf: [
            { $ref: "#/components/schemas/StepEvent" },
            { $ref: "#/components/schemas/StatusEvent" },
            { $ref: "#/components/schemas/ResultEvent" },
            { $ref: "#/components/schemas/UnsupportedEvent" },
            { $ref: "#/components/schemas/ErrorEvent" },
          ],
          discriminator: {
            propertyName: "type",
            mapping: {
              step: "#/components/schemas/StepEvent",
              status: "#/components/schemas/StatusEvent",
              result: "#/components/schemas/ResultEvent",
              unsupported: "#/components/schemas/UnsupportedEvent",
              error: "#/components/schemas/ErrorEvent",
            },
          },
        },
        StepEvent: {
          type: "object",
          required: ["type", "tool", "label", "status"],
          properties: {
            type: { const: "step" },
            tool: { type: "string", enum: ["getDistricts", "getRaces", "getCandidates", "getMarketOdds", "getLocalProblems"] },
            label: { type: "string" },
            status: { type: "string", enum: ["running", "done"] },
            input: { description: "Tool input, on running events." },
            ms: { type: "integer", description: "Tool time, on done events." },
            summary: { type: "string", description: "One-line result, on done events." },
          },
        },
        StatusEvent: { type: "object", required: ["type", "message"], properties: { type: { const: "status" }, message: { type: "string" } } },
        UnsupportedEvent: {
          type: "object",
          required: ["type", "zip", "message"],
          properties: { type: { const: "unsupported" }, zip: { type: "string" }, message: { type: "string" } },
        },
        ErrorEvent: { type: "object", required: ["type", "message"], properties: { type: { const: "error" }, message: { type: "string" } } },
        ResultEvent: {
          type: "object",
          required: ["type", "mode", "model", "modelError", "toolsRunByModel", "narration", "ballot", "markets", "generatedAt"],
          properties: {
            type: { const: "result" },
            mode: { type: "string", enum: ["live", "fallback"], description: "live: a model planned the tool calls. fallback: tools ran deterministically with no model." },
            model: { type: ["string", "null"] },
            modelError: { type: ["string", "null"] },
            toolsRunByModel: { type: "array", items: { type: "string" } },
            narration: { type: "string", description: "Neutral summary written from the tool results only. Empty in fallback mode." },
            ballot: { $ref: "#/components/schemas/Ballot" },
            markets: {
              type: "object",
              description: "Prediction market prices keyed by race id. Market prices, not forecasts.",
              additionalProperties: { type: "object", properties: { status: { type: "string" }, quotes: { type: "array", items: { type: "object" } } } },
            },
            generatedAt: { type: "string", format: "date-time" },
          },
        },
        Ballot: {
          type: "object",
          required: ["zip", "state", "place", "electionDate", "districts", "races", "measures"],
          properties: {
            zip: { type: "string" },
            state: { type: "string", enum: ["TX", "CA", "NY"] },
            place: { type: "string" },
            county: { type: "string" },
            counties: { type: "array", items: { type: "string" } },
            electionDate: { type: "string", format: "date" },
            districts: { type: "array", items: { type: "object", required: ["id", "label"], properties: { id: { type: "string" }, label: { type: "string" }, note: { type: "string" } } } },
            districtSource: source,
            splitWarning: { type: ["string", "null"] },
            races: { type: "array", items: { $ref: "#/components/schemas/Race" } },
            measures: {
              type: "array",
              items: { type: "object", required: ["id", "title", "source"], properties: { id: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, type: { type: "string" }, source: { type: "string" } } },
            },
            problems: {
              type: "array",
              description: "Local Census figures.",
              items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" }, value: { type: "string" }, year: { type: "string" }, source } },
            },
            verify: { type: "object", properties: { label: { type: "string" }, url: { type: "string" } } },
            cached: { type: "boolean" },
          },
        },
        Race: {
          type: "object",
          required: ["id", "title", "level", "office", "candidates", "source"],
          properties: {
            id: { type: "string", examples: ["tx-35", "tx-governor"] },
            title: { type: "string" },
            level: { type: "string", enum: ["federal", "state", "county", "local", "measure"] },
            office: { type: "string", description: "What the office controls, in plain words." },
            candidates: { type: "array", items: { $ref: "#/components/schemas/Candidate" } },
            source: { type: "string" },
          },
        },
        Candidate: {
          type: "object",
          required: ["name", "party", "incumbent"],
          properties: {
            name: { type: "string" },
            party: { type: ["string", "null"], description: "As listed on the ballot." },
            incumbent: { oneOf: [{ type: "boolean" }, { const: "unsure" }] },
            ballotpedia: { type: ["string", "null"] },
            officialSite: { type: ["string", "null"] },
            positions: { type: "array", items: { type: "object", properties: { issue: { type: "string" }, text: { type: "string" }, source } } },
            causes: { type: "array", description: "Issues the candidate raises in their own campaign themes.", items: { type: "object" } },
            money: { type: "object", description: "Campaign money from FEC filings (federal races)." },
          },
        },
      },
    },
  };
}
