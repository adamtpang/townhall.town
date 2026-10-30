// OpenAPI 3.1 description of the public API. Documents only the routes that exist: /api/v1/agent (GET, POST) and
// /api/v1/locate (POST), plus their unversioned aliases /api/agent and /api/locate. Served at /openapi.json.
import { COVERAGE, SITE } from "./site";
import { AGENT_POLICY, LOCATE_POLICY, RESEARCH_POLICY, INTERVIEW_POLICY } from "./rateLimit";

const zips = COVERAGE.map((c) => c.zip);

// Response headers, defined once in components.headers.
const H = (name: string) => ({ $ref: `#/components/headers/${name}` });
const rlHeaders = {
  "API-Version": H("API-Version"),
  "RateLimit-Policy": H("RateLimit-Policy"),
  RateLimit: H("RateLimit"),
  "RateLimit-Limit": H("RateLimit-Limit"),
  "RateLimit-Remaining": H("RateLimit-Remaining"),
  "RateLimit-Reset": H("RateLimit-Reset"),
};
const errContent = (example: { code: string; message: string }) => ({
  "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { error: example } },
});
const err = (description: string, example: { code: string; message: string }, headers: Record<string, unknown> = rlHeaders) => ({
  description,
  headers,
  content: errContent(example),
});
const invalidZip = err("The zip is not exactly 5 digits, or the body is not JSON. Nothing is trimmed or sliced.", { code: "invalid", message: "zip must be exactly 5 digits, for example 78701." });
const tooMany = (policy: { limit: number; windowSec: number }) => ({
  description: `Rate limited: more than ${policy.limit} requests in ${policy.windowSec} seconds from this client. Wait Retry-After seconds.`,
  headers: { ...rlHeaders, "Retry-After": H("Retry-After") },
  content: errContent({ code: "rate_limited", message: `Too many requests: the limit is ${policy.limit} per ${policy.windowSec} seconds per client. Retry after 42 seconds.` }),
});
const internal = err("Unexpected server error, or (JSON mode only) the agent run failed.", { code: "internal", message: "Unexpected server error." });
const notAllowed = (allow: string) => ({
  ...err(
    "Method not allowed. The Allow header lists the supported methods.",
    { code: "method_not_allowed", message: `Method not allowed. Use ${allow.replace(", ", " or ")}.` },
    { "API-Version": H("API-Version"), Allow: { description: "Supported methods.", schema: { type: "string", example: allow } } }
  ),
});
const ballotOk = {
  description:
    "The ballot run. Default (Accept: */* or application/x-ndjson): a stream of newline-delimited JSON, one AgentEvent per line. Step and status events arrive while tools run; the stream ends with one `result` event, or one `unsupported` event for a 5-digit ZIP that is not covered, or one `error` event if the run fails after the stream started. With `Accept: application/json` (preferred over NDJSON) the server waits for the run and returns only the final event as one JSON object (ResultEvent or UnsupportedEvent; a failed run is a 500 Error).",
  headers: { ...rlHeaders, Vary: { description: "Always Accept: the media type depends on it.", schema: { type: "string", const: "Accept" } } },
  content: {
    "application/x-ndjson": {
      schema: { $ref: "#/components/schemas/AgentEvent" },
      "x-ndjson-item-schema": { $ref: "#/components/schemas/AgentEvent" },
      example: { type: "unsupported", zip: "90210", message: "Austin, SF and NYC for now." },
    },
    "application/json": {
      schema: { $ref: "#/components/schemas/AgentFinalEvent" },
      example: { type: "unsupported", zip: "90210", message: "Austin, SF and NYC for now." },
    },
  },
};
const source = { $ref: "#/components/schemas/Source" };
const acceptParam = {
  name: "Accept",
  in: "header",
  required: false,
  description: "Omit (or send application/x-ndjson) for the live stream. Send application/json for one buffered JSON object with the final event.",
  schema: { type: "string", examples: ["application/x-ndjson", "application/json"] },
};

const zipBody = {
  required: true,
  content: {
    "application/json": {
      schema: { type: "object", required: ["zip"], properties: { zip: { type: "string", pattern: "^\\d{5}$", description: "Exactly 5 digits, as a string." } } },
      example: { zip: "78701" },
    },
  },
};
const locateBody = {
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
};

/** The agent and locate operations, for a path prefix. `alias` marks the unversioned paths. */
function agentPath(alias: boolean) {
  const sfx = alias ? "Unversioned" : "";
  const aliasNote = alias ? " Unversioned alias of /api/v1/agent with identical behavior. Prefer /api/v1/agent in new code." : "";
  return {
    get: {
      operationId: `getBallot${sfx}`,
      tags: ["ballot"],
      summary: alias ? "Explain the ballot for a ZIP (alias of /api/v1/agent)" : "Explain the ballot for a ZIP",
      description:
        "Runs the ballot agent for a ZIP: districts, races, candidates, live Polymarket prices and local Census data, plus a short neutral AI summary written only from those records. Responses are not cached (Cache-Control: no-store). Rate limited per client: see RateLimit headers." +
        aliasNote,
      parameters: [{ name: "zip", in: "query", required: true, description: "Exactly 5 digits.", schema: { type: "string", pattern: "^\\d{5}$", examples: zips } }, acceptParam],
      responses: { "200": ballotOk, "400": invalidZip, "405": notAllowed("GET, POST"), "429": tooMany(AGENT_POLICY), "500": internal },
    },
    post: {
      operationId: `postBallot${sfx}`,
      tags: ["ballot"],
      summary: alias ? "Explain the ballot for a ZIP, JSON body (alias of /api/v1/agent)" : "Explain the ballot for a ZIP (JSON body)",
      description: "Same as GET, with the ZIP in a JSON body. The townhall.town page calls the /api/agent alias this way." + aliasNote,
      parameters: [acceptParam],
      requestBody: zipBody,
      responses: { "200": ballotOk, "400": invalidZip, "405": notAllowed("GET, POST"), "429": tooMany(AGENT_POLICY), "500": internal },
    },
  };
}
// /api/research and /api/interview: the site's own helpers. Same API-Version and RateLimit headers as /api/v1.
const rlOnly = rlHeaders;
const errRl = (d: string, e: { code: string; message: string }) => err(d, e, rlOnly);
const tooManyRl = (p: { limit: number; windowSec: number }) => ({ ...tooMany(p), headers: { ...rlOnly, "Retry-After": H("Retry-After") } });
function researchPath() {
  return {
    get: {
      operationId: "researchRace",
      tags: ["research"],
      summary: "Read each candidate's pages for their own words on chosen issues",
      description:
        "For one race on a covered ZIP's ballot, reads each candidate's listed pages (campaign site, official site, Ballotpedia), issue pages linked from their own site, and web search results, the same way for every candidate. Returns only the candidate's own words, copied exactly from the page with its URL: sentences on their own campaign or official site, or words in quotation marks that a third-party page attributes to them by name. Nothing is scored. Judicial races return only a done event. Rate limited per client: see RateLimit headers.",
      parameters: [
        { name: "zip", in: "query", required: true, description: "A covered ZIP, exactly 5 digits.", schema: { type: "string", pattern: "^\\d{5}$", examples: zips } },
        { name: "race", in: "query", required: true, description: "A race id from the ballot result, e.g. ca-gov.", schema: { type: "string", examples: ["ca-gov", "tx-sboe-5"] } },
        { name: "issues", in: "query", required: false, description: "Comma-separated issue ids (housing, healthcare, wages, taxes, safety, education, energy, immigration, wealthtax, infrastructure). Default: all.", schema: { type: "string", examples: ["housing,taxes"] } },
      ],
      responses: {
        "200": {
          description: "A stream of newline-delimited JSON, one ResearchEvent per line, ending with a done event. Every response carries x-research-cache and x-research-cache-layer: hit/run when a complete earlier run on the same server instance is replayed; hit/search+pages when every web search and page for this race is already cached on this instance (no new searches or fetches); partial when some are; miss/none otherwise. Caches and rate-limit counters are per server instance, so two calls that land on different instances both read as miss and as the first call of the window.",
          headers: { ...rlOnly, "x-research-cache": { description: "hit: answered entirely from this instance's caches (a replayed run, or every search and page already cached). partial: some searches or pages cached. miss: none.", schema: { type: "string", enum: ["hit", "partial", "miss"] } }, "x-research-cache-layer": { description: "Which cache answered: run (whole earlier run replayed), search+pages (per-search and per-page caches), or none.", schema: { type: "string", enum: ["run", "search+pages", "none"] } } },
          content: { "application/x-ndjson": { schema: { $ref: "#/components/schemas/ResearchEvent" }, "x-ndjson-item-schema": { $ref: "#/components/schemas/ResearchEvent" },
            example: { type: "citation", name: "Xavier Becerra", issue: "housing", quote: "As governor, I will treat housing like the essential infrastructure it is.", url: "https://www.xavierbecerra2026.com/priorities/", ownSite: true } } },
        },
        "400": errRl("The zip is not exactly 5 digits.", { code: "invalid", message: "zip must be exactly 5 digits, for example 78701." }),
        "404": errRl("The race id is not on this ZIP's ballot.", { code: "not_found", message: "Unknown race for this ZIP." }),
        "405": notAllowed("GET"),
        "429": tooManyRl(RESEARCH_POLICY),
        "500": internal,
      },
    },
  };
}
function interviewPath() {
  return {
    post: {
      operationId: "interviewAnswers",
      tags: ["research"],
      summary: "Turn what a voter wrote into Yes/Neutral/No issue answers",
      description:
        "Maps the voter's own words to the fixed issue questions for a covered ZIP. Only questions the text clearly addresses are answered, each with the exact words that support it. Nothing the voter types is stored or logged. Rate limited per client: see RateLimit headers.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/InterviewRequest" }, example: { zip: "78701", messages: [{ text: "Rent is too high and I'm unsure about taxes." }] } } },
      },
      responses: {
        "200": { description: "The answers found (possibly none).", headers: rlOnly, content: { "application/json": { schema: { $ref: "#/components/schemas/InterviewResult" }, example: { answers: [{ issue: "housing", choice: "yes", words: "Rent is too high" }] } } } },
        "400": errRl("The body is not JSON, or the zip is not a covered 5-digit ZIP.", { code: "invalid", message: "zip must be one of the covered 5-digit ZIPs: 78701, 94103 or 10001." }),
        "405": notAllowed("POST"),
        "429": tooManyRl(INTERVIEW_POLICY),
        "500": internal,
        "502": errRl("The answer model did not respond.", { code: "upstream_unavailable", message: "The answer model did not respond. Try again." }),
      },
    },
  };
}
function locatePath(alias: boolean) {
  return {
    post: {
      operationId: alias ? "locateZipUnversioned" : "locateZip",
      tags: ["location"],
      summary: alias ? "Coordinates to ZIP (alias of /api/v1/locate)" : "Coordinates to ZIP",
      description:
        "Looks up the ZIP Code Tabulation Area for a point using the public U.S. Census Geocoder. Coordinates are not stored. Rate limited per client: see RateLimit headers." +
        (alias ? " Unversioned alias of /api/v1/locate with identical behavior. Prefer /api/v1/locate in new code." : ""),
      requestBody: locateBody,
      responses: {
        "200": {
          description: "The ZIP for the point.",
          headers: rlHeaders,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LocateResult" }, example: { zip: "78701", source: "U.S. Census Geocoder (ZCTA)" } } },
        },
        "400": err("The body is not JSON, or lat or lon is missing or out of range.", { code: "invalid", message: 'Send a JSON body {"lat": <number>, "lon": <number>} in decimal degrees (lat -90..90, lon -180..180).' }),
        "404": err("The point is not inside a U.S. ZIP Code Tabulation Area.", { code: "not_found", message: "No ZIP found for this location" }),
        "405": notAllowed("POST"),
        "429": tooMany(LOCATE_POLICY),
        "500": internal,
        "502": err("The Census Geocoder did not answer.", { code: "upstream_unavailable", message: "Census geocoder unavailable" }),
      },
    },
  };
}

export const VERSIONING = {
  current: "v1",
  strategy: "url-path",
  summary:
    "The API is versioned in the URL path (/api/v1/...). Every response carries API-Version. Non-breaking changes (new optional fields, new endpoints) ship in place. Breaking changes ship under a new /api/vN path; the previous version keeps working for at least 90 days after the new one launches, and during that time its responses carry Deprecation (RFC 9745) and Sunset (RFC 8594) headers plus a Link to this policy. The unversioned /api/agent and /api/locate paths are aliases of /api/v1 and follow the same policy.",
  minimumNoticeDays: 90,
};

export function openApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "townhall.town API",
      version: "1.0.0",
      summary: "Nonpartisan, sourced ballot data for the Nov 3, 2026 U.S. general election.",
      description: `Free, no key, no account. Covered ZIPs: ${COVERAGE.map((c) => `${c.zip} (${c.place})`).join(", ")}. Every fact carries a source link; facts that cannot be confirmed are marked unsure. Every API error is JSON: {"error":{"code","message"}}.

Versioning and deprecation: ${VERSIONING.summary} Policy: ${SITE.url}/developers#versioning

Rate limits: per client IP, fixed 60-second window: ${AGENT_POLICY.limit} requests per minute on the ballot agent, ${LOCATE_POLICY.limit} on locate, ${RESEARCH_POLICY.limit} on /api/research and ${INTERVIEW_POLICY.limit} on /api/interview. Counters are kept in memory per server instance, so the limit is approximate, not a guarantee. Every response carries RateLimit-Policy and RateLimit (draft-ietf-httpapi-ratelimit-headers) and RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset. Over the limit you get 429 with Retry-After and the usual JSON error body (code rate_limited).`,
      license: { name: "MIT", identifier: "MIT" },
      contact: { name: "GitHub issues", url: SITE.issues },
    },
    "x-api-versioning": {
      ...VERSIONING,
      header: "API-Version",
      deprecationHeaders: ["Deprecation (RFC 9745)", "Sunset (RFC 8594)", 'Link rel="deprecation"'],
      policyUrl: `${SITE.url}/developers#versioning`,
    },
    "x-rate-limits": {
      headers: ["RateLimit-Policy", "RateLimit", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "Retry-After"],
      scope: "per client IP, per server instance (approximate, not guaranteed)",
      policies: [AGENT_POLICY, LOCATE_POLICY, RESEARCH_POLICY, INTERVIEW_POLICY].map((p) => ({ name: p.name, limit: p.limit, windowSeconds: p.windowSec })),
    },
    externalDocs: { description: "townhall.town API and developer docs, with curl examples", url: `${SITE.url}/developers` },
    servers: [{ url: SITE.url }],
    // No authentication: the API is public and keyless.
    security: [],
    tags: [
      { name: "ballot", description: "Races, candidates, measures and sources for a covered ZIP." },
      { name: "location", description: "Coordinates to ZIP via the U.S. Census Geocoder." },
      { name: "research", description: "The site's live helpers: candidates' own words on chosen issues, and turning a voter's words into issue answers." },
    ],
    // Canonical /v1 paths first, then the unversioned aliases.
    paths: {
      "/api/v1/agent": agentPath(false),
      "/api/v1/locate": locatePath(false),
      "/api/agent": agentPath(true),
      "/api/locate": locatePath(true),
      "/api/research": researchPath(),
      "/api/interview": interviewPath(),
    },
    components: {
      headers: {
        "API-Version": { description: "Major version of the API that served the response.", schema: { type: "string", const: "1" } },
        "RateLimit-Policy": {
          description: 'Quota policy (draft-ietf-httpapi-ratelimit-headers): name, q = requests allowed, w = window in seconds. Example: "agent";q=10;w=60',
          schema: { type: "string", examples: ['"agent";q=10;w=60', '"locate";q=30;w=60'] },
        },
        RateLimit: {
          description: 'Current service limit (draft-ietf-httpapi-ratelimit-headers): r = requests left, t = seconds until the window resets. Example: "agent";r=9;t=60',
          schema: { type: "string", examples: ['"agent";r=9;t=60'] },
        },
        "RateLimit-Limit": { description: "Requests allowed per window.", schema: { type: "integer", examples: [10] } },
        "RateLimit-Remaining": { description: "Requests left in the current window.", schema: { type: "integer", minimum: 0, examples: [9] } },
        "RateLimit-Reset": { description: "Seconds until the current window resets.", schema: { type: "integer", minimum: 1, examples: [60] } },
        "Retry-After": { description: "Seconds to wait before retrying (RFC 9110). Sent on 429.", schema: { type: "integer", minimum: 1, examples: [42] } },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string", enum: ["invalid", "not_found", "method_not_allowed", "upstream_unavailable", "rate_limited", "internal"] },
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
        ResearchEvent: {
          description: "One line of the /api/research stream.",
          oneOf: [
            { type: "object", title: "candidate", required: ["type", "name", "sources"], properties: { type: { const: "candidate" }, name: { type: "string" }, sources: { type: "integer", minimum: 0 } } },
            { type: "object", title: "step", required: ["type", "name", "url", "label", "status"], properties: { type: { const: "step" }, name: { type: "string" }, url: { type: "string" }, label: { type: "string" }, status: { enum: ["running", "done", "failed"] }, detail: { type: "string" } } },
            { type: "object", title: "citation", required: ["type", "name", "issue", "quote", "url"], properties: { type: { const: "citation" }, name: { type: "string" }, issue: { type: "string" }, quote: { type: "string", description: "Exact substring of the page text." }, url: { type: "string", format: "uri" }, ownSite: { type: "boolean", description: "True when the page is on the candidate's own campaign or official site." } } },
            { type: "object", title: "none", required: ["type", "name", "message"], properties: { type: { const: "none" }, name: { type: "string" }, message: { type: "string", examples: ["No public statement found as of Oct 29, 2026"] } } },
            { type: "object", title: "done", required: ["type"], properties: { type: { const: "done" }, judicial: { type: "boolean" } } },
          ],
          discriminator: { propertyName: "type" },
        },
        InterviewRequest: {
          type: "object",
          required: ["zip", "messages"],
          properties: {
            zip: { type: "string", pattern: "^\\d{5}$", examples: zips },
            messages: { type: "array", maxItems: 6, description: "The voter's messages, newest last. Only the last 6 are read, each up to 600 characters.", items: { type: "object", required: ["text"], properties: { text: { type: "string", maxLength: 600 } } } },
          },
        },
        InterviewResult: {
          type: "object",
          required: ["answers"],
          properties: {
            answers: { type: "array", items: { type: "object", required: ["issue", "choice", "words"], properties: { issue: { type: "string" }, choice: { enum: ["yes", "neutral", "no"] }, words: { type: "string", description: "The voter's own words that support this answer." } } } },
          },
        },
        LocateResult: {
          type: "object",
          required: ["zip", "source"],
          properties: { zip: { type: "string", pattern: "^\\d{5}$" }, source: { type: "string", const: "U.S. Census Geocoder (ZCTA)" } },
        },
        AgentFinalEvent: {
          description: "The final event of a run, returned alone as application/json when the client sends Accept: application/json.",
          oneOf: [{ $ref: "#/components/schemas/ResultEvent" }, { $ref: "#/components/schemas/UnsupportedEvent" }],
          discriminator: { propertyName: "type", mapping: { result: "#/components/schemas/ResultEvent", unsupported: "#/components/schemas/UnsupportedEvent" } },
        },
        AgentEvent: {
          description: "One line of the NDJSON stream (application/x-ndjson): each line is one JSON object matching this schema.",
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
            tool: { type: "string", enum: ["getDistricts", "getRaces", "getCandidates", "getMarketOdds", "getLocalProblems", "getCampaignFinance", "getCountyUnemployment", "analyze"] },
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
            mode: { type: "string", enum: ["live", "fallback"], description: "live: a model planned the tool calls. fallback: the same tools ran with no model." },
            model: { type: ["string", "null"] },
            modelError: { type: ["string", "null"] },
            toolsRunByModel: { type: "array", items: { type: "string" } },
            narration: { type: "string", description: "Neutral summary written from the tool results only. Empty in fallback mode." },
            ballot: { $ref: "#/components/schemas/Ballot" },
            markets: {
              type: "object",
              description: "Live Polymarket prices keyed by race or measure id, fetched at request time from Polymarket's public Gamma API. Polymarket is the only market source. Market prices, not forecasts. No cached or estimated numbers: status 'no market found' (Polymarket has no market on that contest) or 'unavailable' (the live fetch failed) come with an empty quotes array.",
              additionalProperties: {
                type: "object",
                required: ["status", "quotes"],
                properties: {
                  status: { type: "string", enum: ["live", "unavailable", "no market found", "market does not list every ballot candidate"] },
                  quotes: {
                    type: "array",
                    maxItems: 1,
                    items: {
                      type: "object",
                      required: ["source", "title", "url", "api", "outcomes", "fetchedAt"],
                      properties: {
                        source: { const: "Polymarket" },
                        title: { type: "string" },
                        url: { type: "string", format: "uri", description: "The Polymarket event page." },
                        api: { type: "string", format: "uri" },
                        listed: { type: "array", items: { type: "string" }, description: "Every named outcome on the Polymarket event (used to check that the market lists every ballot candidate). Polymarket's unnamed placeholder slots ('Option A', 'Person B', a bare letter, 'Other') are removed." },
                        outcomes: { type: "array", maxItems: 4, items: { type: "object", required: ["name", "prob"], properties: { name: { type: "string" }, prob: { type: "number", minimum: 0, maximum: 1 } } } },
                        fetchedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
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
            judicialNote: { type: "string", description: "Present on every judicial race: judicial candidates' positions on these issues aren't public." },
            judicialNoteSource: { type: "object", description: "Present with judicialNote: the state's judicial conduct rule behind it.", properties: { url: { type: "string", format: "uri" }, label: { type: "string" } } },
            appliesNote: { type: "string", description: "Who this race applies to (district splits) plus where that comes from." },
            splitNote: { type: "string", description: "Present when the ZIP is split between districts: the split text alone." },
            sourceNote: { type: "string", description: "Present when a research note backs appliesNote: that source text alone." },
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
            positions: { type: "array", description: "Published, sourced stances only (exact text plus source). form: vote (roll-call record), quote (the candidate's own words), or summary (Ballotpedia text, not a quote). Judicial candidates have none.", items: { type: "object", properties: { issue: { type: "string" }, text: { type: "string" }, form: { enum: ["vote", "quote", "summary"] }, year: { type: ["string", "integer"] }, source } } },
            photo: { type: ["object", "null"], description: "Portrait shown on the site, or null (initials). Race mode (default) shows photos only when every candidate in the race has one. Never generated, never a news photo.", properties: {
              url: { type: "string", description: "Self-hosted /portraits/… path, or the candidate's own campaign/official image when hotlinked is true." },
              credit: { type: "string", description: "\"Photo: {attribution}\" as displayed." },
              attribution: { type: "string", description: "Full attribution text (author plus license when the source gives one)." },
              author: { type: "string", description: "Author or owner only, without license text." },
              license: { type: "string", description: "License or use basis, e.g. \"CC BY 2.0\", \"Public domain\", or a campaign's own public photo." },
              page: { type: "string", format: "uri", description: "Source page the credit links to." },
              hotlinked: { type: "boolean", description: "True when the image loads from the candidate's own site rather than ours." },
              focus: { type: "array", description: "[x, y, scale] crop focus for a square tile.", items: { type: "number" } },
              mate: { type: "object", description: "Running mate's photo on a ticket (same fields plus name)." } } },
            causes: { type: "array", description: "Issues the candidate raises in their own campaign themes.", items: { type: "object" } },
            money: { type: "object", description: "Campaign money from FEC filings (federal races)." },
          },
        },
      },
    },
  };
}
