// Page copy shared by the HTML pages and their Markdown twins (Accept: text/markdown).
// Inline links use Markdown syntax [text](url); components/Prose.tsx renders them as <a>.
// Copy rules: nonpartisan, no endorsements, no em dashes.
import { AGENT_POLICY, LOCATE_POLICY, RESEARCH_POLICY, INTERVIEW_POLICY } from "./rateLimit";
import { COVERAGE, SITE, type PagePath } from "./site";

/** `id` becomes the section element id, for links like /developers#versioning. */
export type Section = { heading: string; id?: string; paragraphs?: string[]; items?: string[]; code?: string[] };
export type PageContent = { path: PagePath; title: string; description: string; lead: string; sections: Section[] };

const coverageLine = COVERAGE.map((c) => `${c.zip} (${c.place})`).join(", ");

export const HOME_SECTIONS: Section[] = [
  {
    heading: "Sources",
    paragraphs: ["When a fact cannot be confirmed, it is marked unsure or not shown."],
    items: [
      "Candidates and positions: election offices, [Ballotpedia](https://ballotpedia.org), campaign sites, news reports",
      "Campaign finance: [FEC](https://www.fec.gov), [Texas Ethics Commission](https://www.ethics.state.tx.us), [Cal-Access](https://cal-access.sos.ca.gov)",
      "Dates, ID rules and polling places: [Travis County Clerk](https://votetravis.gov), [SF Department of Elections](https://www.sf.gov/november-3-2026-consolidated-general-election), [VoteTexas.gov](https://www.votetexas.gov), [California Secretary of State](https://www.sos.ca.gov/elections), [NYC Board of Elections](https://vote.nyc)",
      "Local data: [U.S. Census Bureau](https://www.census.gov) American Community Survey 2024 5-year",
      "Market prices: [Polymarket](https://polymarket.com). Not forecasts.",
    ],
  },
];

export const HOME: PageContent = {
  path: "/",
  title: SITE.title,
  description: SITE.description,
  lead: `townhall.town explains your ${SITE.electionLabel} ballot in plain language. Nonpartisan, with a source for every fact. Not a government site; confirm details with your state or county election office.`,
  sections: HOME_SECTIONS,
};

export const ABOUT: PageContent = {
  path: "/about",
  title: "About townhall.town",
  description: "What townhall.town is, how it stays nonpartisan, and who builds it.",
  lead: `A free ballot guide for the ${SITE.electionLabel} U.S. general election.`,
  sections: [
    {
      heading: "Nonpartisan by design",
      paragraphs: [
        "townhall.town does not endorse candidates, parties or ballot positions, and it does not rank candidates.",
        "The AI summary is instructed to stay neutral, to use only facts returned by the data tools, and to never recommend a candidate.",
      ],
    },
    {
      heading: "Every claim is sourced or marked unsure",
      paragraphs: [
        "Each fact links the record it came from. When a fact cannot be confirmed, the page says unsure.",
        "If you find an error, please [open an issue](" + SITE.issues + ") with the source that shows the correct fact.",
      ],
    },
    {
      heading: "Coverage",
      paragraphs: [`Covered ZIPs today: ${coverageLine}.`],
    },
    {
      heading: "Open source",
      paragraphs: [
        `The code and ballot data are public on [GitHub](${SITE.github}) under the MIT license.`,
      ],
    },
    {
      heading: "Who builds it",
      paragraphs: [
        `townhall.town is built by ${SITE.author}.`,
      ],
    },
  ],
};

// Every sentence here is checked against the code (feat/agentic) and Vercel's docs, per Civic's towny_privacy.md.
// Open gaps, stated plainly on the page rather than promised: no zero-data-retention or no-training routing is
// turned on; Vercel runtime-log retention for this project is not confirmed; no private contact channel; the
// Towny messaging service (SMS, WhatsApp, email, STOP/HELP/DELETE) is not built.
export const PRIVACY: PageContent = {
  path: "/privacy",
  title: "Privacy",
  description: "What townhall.town stores, what it sends, and what it does not collect.",
  lead: "townhall.town has no accounts and keeps as little as possible. This page lists exactly what the site stores and sends, and what we have not yet been able to promise.",
  sections: [
    {
      heading: "The short version",
      paragraphs: [
        "We don't sell or share your information. There are no ads, no data brokers, and nothing goes to campaigns or parties. The site only needs your ZIP code. Your issue answers stay on your device.",
      ],
    },
    {
      heading: "No account",
      paragraphs: [
        "There is no sign-up, no login and no OAuth. townhall.town does not ask for your name, email, phone number or street address.",
      ],
    },
    {
      heading: "Your answers stay on your device",
      paragraphs: [
        "When you answer the issue questions, your answers are saved in your browser's localStorage under the key th-answers-v1 so they are still there next visit. They are not sent to the server. Clearing site data in your browser removes them.",
      ],
    },
    {
      heading: "The ballot agent and AI services",
      paragraphs: [
        "When you ask for a ballot, your browser sends only the 5-digit ZIP, in the body of a request to the site's /api/agent route. The server looks up the races for that ZIP. It then sends a short prompt containing the ZIP and our ballot data (not your answers) to an AI model that writes a summary. The model is reached through Vercel AI Gateway (today Google or OpenAI models). If a direct xAI key is configured, the prompt goes to xAI first. The server does not save the ZIP or the prompt.",
        "Vercel says AI Gateway itself does not keep prompts or responses after a request completes. It keeps request metadata such as the model, provider, token counts, cost and timing. We have not turned on the gateway's zero-data-retention or no-training routing, so the AI provider's own data policy applies to the prompt.",
      ],
    },
    {
      heading: "Location",
      paragraphs: [
        "If you choose to use your location, your browser asks for permission first. The coordinates are sent in the body of a request to the site's /api/locate route, never in the web address. The server passes them to the public U.S. Census Geocoder to find the matching ZIP. townhall.town does not store the coordinates.",
      ],
    },
    {
      heading: "Analytics, cookies and server logs",
      paragraphs: [
        "townhall.town does not include analytics, ad pixels or tracking scripts, and it does not set cookies. The site is hosted on Vercel, which keeps standard request logs such as IP address, user agent and page path for operating the service, as described in Vercel's privacy policy. The site's own pages send your ZIP and coordinates in request bodies, not in the page path. We have not yet confirmed how many days Vercel keeps these logs for this project.",
      ],
    },
    {
      heading: "Other sites",
      paragraphs: [
        "Candidate photos are served from townhall.town itself, with credit to their source. Source links open other sites with their own policies.",
        "The server also fetches public data while building a ballot. It sends candidate names or IDs to the FEC and Congress.gov, the county code for your ZIP to the Bureau of Labor Statistics, and market IDs for races to Polymarket. These requests come from our server, so they don't include your IP address, and they never include your answers.",
        "If you use \"Or tell Towny in your own words\", what you type is sent to an AI model through Vercel AI Gateway only to fill in your answers, and is not saved. Towny research sends the candidate's name and office to a web search model and reads public pages. Please leave out names and addresses.",
      ],
    },
    {
      heading: "Messages",
      paragraphs: [
        "townhall.town does not run a texting, WhatsApp or email service yet, so it holds no phone numbers, email addresses or messages.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        `Questions about privacy: [open an issue on GitHub](${SITE.issues}). GitHub issues are public. We don't have a private contact address yet.`,
      ],
    },
  ],
};

export const CONTACT: PageContent = {
  path: "/contact",
  title: "Contact",
  description: "How to report an error, request a ZIP, or ask a question about townhall.town.",
  lead: `Open a GitHub issue at [github.com/adamtpang/townhall.town/issues](${SITE.issues}). Issues are public, so do not include personal details.`,
  sections: [
    {
      heading: "Report a factual error",
      paragraphs: [
        "Include the ZIP, the race or candidate, the fact that looks wrong, and a source that shows the correct fact.",
      ],
    },
    {
      heading: "Request a ZIP or report a bug",
      paragraphs: [
        "To ask for a new place, open an issue with the ZIP and city. To report a bug, describe what you did and what happened.",
      ],
    },
    {
      heading: "Security",
      paragraphs: [
        "Open an issue asking for a private channel; leave the details out of the public issue.",
      ],
    },
    {
      heading: "Election questions",
      paragraphs: [
        "For registration, polling places and official ballots, contact your election office: [VoteTexas.gov](https://www.votetexas.gov), the [California Secretary of State](https://www.sos.ca.gov/elections), or the [NYC Board of Elections](https://vote.nyc).",
      ],
    },
  ],
};

export const DEVELOPERS: PageContent = {
  path: "/developers",
  title: "townhall.town API and developer docs",
  description: "The townhall.town API: sourced ballot data and ZIP lookup, free, no key. Versioned /api/v1 endpoints, OpenAPI 3.1 spec, rate limits and curl examples.",
  lead: `townhall.town has a small public API. It is free, needs no key or account, and returns the same sourced ballot data the site shows. The full description is the [OpenAPI 3.1 spec](${SITE.url}/openapi.json). The current version is v1.`,
  sections: [
    {
      heading: "Endpoints",
      items: [
        "GET /api/v1/agent?zip=78701 or POST /api/v1/agent with JSON {\"zip\":\"78701\"}: the ballot for a ZIP, streamed as newline-delimited JSON (application/x-ndjson). Send Accept: application/json to get only the final result as one JSON object.",
        "POST /api/v1/locate with JSON {\"lat\":30.2672,\"lon\":-97.7431}: the ZIP for a point, from the U.S. Census Geocoder. Coordinates go in the body, not the URL.",
        "/api/agent and /api/locate are unversioned aliases of the v1 endpoints, with identical behavior. They keep working; new code should use /api/v1.",
        `[openapi.json](${SITE.url}/openapi.json): OpenAPI 3.1 description of every endpoint, with every parameter, response, header and error.`,
      ],
    },
    {
      heading: "Get a ballot",
      paragraphs: [
        `Covered ZIPs: ${coverageLine}. Each line of the response is one JSON event. Step and status lines arrive while the data tools run. The last line has "type":"result" with the full ballot: districts, races, candidates, measures, live Polymarket prices and local Census data, each with its source. A 5-digit ZIP that is not covered ends with one "type":"unsupported" line instead.`,
      ],
      code: [
        `curl -N "${SITE.url}/api/v1/agent?zip=78701"`,
        `curl -N -X POST "${SITE.url}/api/v1/agent" -H "content-type: application/json" -d '{"zip":"94103"}'`,
        `curl -s "${SITE.url}/api/v1/agent?zip=10001" -H "accept: application/json" | jq '.ballot.races[].title'`,
      ],
    },
    {
      heading: "Find a ZIP",
      paragraphs: ['Returns {"zip":"78701","source":"U.S. Census Geocoder (ZCTA)"}. Coordinates are not stored.'],
      code: [`curl -X POST "${SITE.url}/api/v1/locate" -H "content-type: application/json" -d '{"lat":30.2672,"lon":-97.7431}'`],
    },
    {
      heading: "Errors",
      paragraphs: [
        'Every API error is JSON with Content-Type application/json and the shape {"error":{"code":"...","message":"..."}}. The zip must be exactly 5 digits; it is not trimmed or cut down.',
      ],
      items: [
        "400 invalid: a zip that is not exactly 5 digits, a body that is not JSON, or a missing or out of range lat or lon.",
        "404 not_found: an unknown /api/ path, or a point with no ZIP.",
        "405 method_not_allowed: a method the route does not support. The Allow header lists the supported ones.",
        "429 rate_limited: too many requests. Wait the number of seconds in Retry-After.",
        "500 internal: an unexpected server error.",
        "502 upstream_unavailable: the Census Geocoder did not answer.",
      ],
      code: [`curl -i "${SITE.url}/api/v1/agent?zip=7870"`, '{"error":{"code":"invalid","message":"zip must be exactly 5 digits, for example 78701."}}'],
    },
    {
      heading: "Research and interview",
      id: "research",
      paragraphs: [
        `GET /api/research?zip=<ZIP>&race=<race id>&issues=<ids> streams newline-delimited JSON: candidate, step, citation, none and done events. A citation is the candidate's own words copied exactly from the page, with its URL: a sentence on their own campaign or official site (ownSite true), or words in quotation marks that another page attributes to them by name. ${RESEARCH_POLICY.limit} requests per minute per client.`,
        `POST /api/interview with JSON {"zip":"78701","messages":[{"text":"..."}]} returns {"answers":[{"issue","choice","words"}]}: Yes, Neutral or No only for questions the text clearly addresses, with the words that support each. Nothing typed is stored. ${INTERVIEW_POLICY.limit} requests per minute per client.`,
        "Both carry the same RateLimit headers as /api/v1 and use the same JSON error model. Typed schemas: ResearchEvent, InterviewRequest and InterviewResult in [/openapi.json](/openapi.json).",
      ],
      code: [`curl -N "${SITE.url}/api/research?zip=94103&race=ca-gov&issues=housing"`, `curl -s -X POST ${SITE.url}/api/interview -H 'content-type: application/json' -d '{"zip":"78701","messages":[{"text":"Rent is too high"}]}'`],
    },
    {
      heading: "Rate limits",
      id: "rate-limits",
      paragraphs: [
        `Limits are per client IP in a fixed 60-second window: ${AGENT_POLICY.limit} requests per minute on /api/v1/agent and ${LOCATE_POLICY.limit} on /api/v1/locate (each alias shares its v1 counter). One ballot lookup on the site is one request. Counters live in memory on each server instance, so the limit is approximate, not a guarantee.`,
        "Every GET and POST response carries the IETF RateLimit-Policy and RateLimit headers (draft-ietf-httpapi-ratelimit-headers) and the common RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset headers. Over the limit, the API answers 429 with Retry-After in seconds and the usual JSON error body.",
      ],
      code: [
        `RateLimit-Policy: "agent";q=${AGENT_POLICY.limit};w=${AGENT_POLICY.windowSec}\nRateLimit: "agent";r=9;t=60\nRateLimit-Limit: ${AGENT_POLICY.limit}\nRateLimit-Remaining: 9\nRateLimit-Reset: 60`,
        '429 Too Many Requests\nRetry-After: 42\n{"error":{"code":"rate_limited","message":"Too many requests: the limit is 10 per 60 seconds per client. Retry after 42 seconds."}}',
      ],
    },
    {
      heading: "Versioning and deprecation",
      id: "versioning",
      paragraphs: [
        "The API is versioned in the URL path. The current version is v1 (/api/v1/...), and every response carries an API-Version: 1 header. Adding endpoints or optional fields is not a breaking change and ships in place.",
        "Breaking changes ship under a new path (/api/v2/...). The old version keeps working for at least 90 days after the new one launches. During that time its responses carry a Deprecation header (RFC 9745), a Sunset header (RFC 8594) with the shutdown date, and a Link to this policy. The unversioned /api/agent and /api/locate aliases follow the same policy.",
      ],
    },
    {
      heading: "Example client",
      id: "example-client",
      paragraphs: [
        `A tiny Node 18+ script with no dependencies, scripts/townhall-ballot.mjs in the [source code](${SITE.github}). It is an example to copy, not an official or published package.`,
      ],
      code: ["node scripts/townhall-ballot.mjs 78701            # final result as JSON\nnode scripts/townhall-ballot.mjs 94103 --stream   # every event as it arrives"],
    },
    {
      heading: "Use and limits",
      paragraphs: [
        "The data is nonpartisan and sourced, and the AI summary only restates the returned records. Please cache results on your side and keep request rates modest. Market prices are market prices, not forecasts. Confirm dates and polling places with your state or county election office.",
        `Agent guide: [llms.txt](${SITE.url}/llms.txt). Source code and issues: [GitHub](${SITE.github}).`,
      ],
    },
  ],
};

export const CONTENT: Record<PagePath, PageContent> = { "/": HOME, "/about": ABOUT, "/contact": CONTACT, "/privacy": PRIVACY, "/developers": DEVELOPERS };

function sectionMd(s: Section, level = 2): string {
  const out = [`${"#".repeat(level)} ${s.heading}`, ""];
  for (const p of s.paragraphs ?? []) out.push(p, "");
  for (const i of s.items ?? []) out.push(`- ${i}`);
  if (s.items?.length) out.push("");
  for (const c of s.code ?? []) out.push("```sh", c, "```", "");
  return out.join("\n");
}

const NAV_MD = [
  "## More",
  "",
  `- [Home](${SITE.url}/)`,
  `- [About](${SITE.url}/about)`,
  `- [Contact](${SITE.url}/contact)`,
  `- [Privacy](${SITE.url}/privacy)`,
  `- [Developers](${SITE.url}/developers)`,
  `- [OpenAPI spec](${SITE.url}/openapi.json)`,
  `- [API versioning policy](${SITE.url}/developers#versioning)`,
  `- [llms.txt](${SITE.url}/llms.txt)`,
  `- [Sitemap](${SITE.url}/sitemap.xml)`,
  `- [Source code](${SITE.github})`,
  "",
].join("\n");

export function pageMarkdown(path: PagePath): string {
  const p = CONTENT[path];
  const parts = [`# ${p.title}`, "", p.lead, ""];
  if (path === "/") {
    parts.push(
      "## Use it",
      "",
      `- Open ${SITE.url}, enter a covered ZIP, and press Go. Results render in the browser.`,
      `- Programmatic: \`GET ${SITE.url}/api/v1/agent?zip=78701\` (or \`POST\` with JSON \`{"zip":"78701"}\`) returns newline-delimited JSON. The last line has \`"type":"result"\` with the full ballot.`,
      `- API docs: ${SITE.url}/developers (OpenAPI 3.1: ${SITE.url}/openapi.json)`,
      `- Agent guide: ${SITE.url}/llms.txt`,
      ""
    );
  }
  for (const s of p.sections) parts.push(sectionMd(s));
  parts.push(NAV_MD);
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function notFoundMarkdown(pathname: string): string {
  return [
    "# 404: page not found",
    "",
    `There is no page at \`${pathname.replace(/`/g, "")}\` on townhall.town.`,
    "",
    `- Start at the [homepage](${SITE.url}/)`,
    `- Agent guide: [llms.txt](${SITE.url}/llms.txt)`,
    `- All pages: [sitemap.xml](${SITE.url}/sitemap.xml)`,
    "",
  ].join("\n");
}
