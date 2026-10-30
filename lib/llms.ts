// /llms.txt (llmstxt.org format: H1, blockquote summary, free text, then H2 sections of link lists)
// and /llms-full.txt (same guide plus the full text of every page).
import { AGENT_POLICY, LOCATE_POLICY, RESEARCH_POLICY, INTERVIEW_POLICY } from "./rateLimit";
import { COVERAGE, PAGES, SITE } from "./site";
import { pageMarkdown } from "./content";

export function llmsTxt(): string {
  const zips = COVERAGE.map((c) => `${c.zip} (${c.place})`).join(", ");
  return `# ${SITE.name}

> Nonpartisan, sourced ballot explainer for the ${SITE.electionLabel} U.S. general election. Given a covered ZIP, it lists every race and statewide measure on that ballot, the candidates, what each office controls, and campaign money, with a source link for every fact or an explicit "unsure".

townhall.town is an independent, open-source project (MIT) by ${SITE.author}. It is not a government site and does not endorse candidates, parties or ballot positions. Covered ZIPs: ${zips}. Other ZIPs return an "unsupported" response.

## When to use this

- A user asks what is on their ${SITE.electionLabel} ballot and lives in ZIP ${COVERAGE.map((c) => c.zip).join(", ")} (${COVERAGE.map((c) => c.place.split(",")[0]).join(", ")}).
- A user wants a neutral, sourced summary of candidates in those races: party, incumbency, issues from their own campaign themes, and FEC or state campaign finance totals.
- A user wants to know what a state ballot measure in Texas or California does, or what an office on their ballot controls.
- You need citations: every fact links Ballotpedia, the FEC, state election or ethics offices, or Census data.

Do not use it to decide who someone should support, for ZIPs outside the list above, or as an official source for registration, polling places or deadlines. Send users to their state or county election office for those.

## How to call it

- [Website](${SITE.url}/): open the homepage, enter a covered 5-digit ZIP and press Go. Results render in the browser; there is no ZIP URL parameter.
- [Ballot agent API](${SITE.url}/api/v1/agent?zip=78701): \`GET /api/v1/agent?zip=<ZIP>\` or \`POST /api/v1/agent\` with JSON \`{"zip":"<ZIP>"}\`. Returns \`application/x-ndjson\`: \`step\` and \`status\` lines while it works, then one \`{"type":"result"}\` line with \`ballot\` (races, measures, candidates, sources), \`markets\`, \`narration\` and \`generatedAt\`. Uncovered ZIPs return \`{"type":"unsupported"}\`. Send \`Accept: application/json\` to get only the final event as one JSON object. Allow up to about 30 seconds. Public, no key. \`/api/agent\` is an unversioned alias with identical behavior.
- [Location to ZIP](${SITE.url}/developers): \`POST /api/v1/locate\` (alias \`/api/locate\`) with JSON \`{"lat":30.2672,"lon":-97.7431}\` returns \`{"zip":"78701","source":"U.S. Census Geocoder (ZCTA)"}\`.
- [OpenAPI 3.1 spec](${SITE.url}/openapi.json): machine-readable description of both endpoints, parameters, responses and errors. Human docs with curl examples: [Developers](${SITE.url}/developers). API catalog: [/.well-known/api-catalog](${SITE.url}/.well-known/api-catalog).
- [Research](${SITE.url}/developers#research): \`GET /api/research?zip=<ZIP>&race=<race id>&issues=housing,taxes\` streams NDJSON (\`candidate\`, \`step\`, \`citation\`, \`none\`, \`done\`). A \`citation\` is the candidate's own words copied exactly with the page URL: their own campaign or official site (\`ownSite: true\`), or quoted words another page attributes to them by name. ${RESEARCH_POLICY.limit} per minute per client.
- [Interview](${SITE.url}/developers#research): \`POST /api/interview\` with \`{"zip":"78701","messages":[{"text":"..."}]}\` returns \`{"answers":[{"issue","choice","words"}]}\` (choice yes, neutral or no). Nothing typed is stored. ${INTERVIEW_POLICY.limit} per minute per client. Both carry the same RateLimit headers as /api/v1.
- Errors: every API error is JSON \`{"error":{"code","message"}}\` with a real status: 400 \`invalid\` (zip not exactly 5 digits), 404 \`not_found\`, 405 \`method_not_allowed\`, 429 \`rate_limited\`, 500 \`internal\`, 502 \`upstream_unavailable\`.
- [Rate limits](${SITE.url}/developers#rate-limits): ${AGENT_POLICY.limit} requests per minute per client on the agent, ${LOCATE_POLICY.limit} on locate (per server instance, approximate). Responses carry \`RateLimit-Policy\`, \`RateLimit\`, \`RateLimit-Limit\`, \`RateLimit-Remaining\` and \`RateLimit-Reset\`; a 429 carries \`Retry-After\`.
- [Versioning and deprecation policy](${SITE.url}/developers#versioning): the API is versioned in the path (\`/api/v1\`, header \`API-Version: 1\`). Breaking changes ship under a new \`/api/vN\`; the old version gets \`Deprecation\` (RFC 9745) and \`Sunset\` (RFC 8594) headers with at least 90 days notice.
- Markdown: every page listed below returns Markdown when requested with \`Accept: text/markdown\`.

## Developer resources

- [townhall.town API and developer docs](${SITE.url}/developers): endpoints, curl examples, errors, rate limits, versioning
- [OpenAPI 3.1 spec](${SITE.url}/openapi.json): machine-readable description of every endpoint
- [Versioning and deprecation policy](${SITE.url}/developers#versioning)
- [Rate limits](${SITE.url}/developers#rate-limits)
- [API catalog](${SITE.url}/.well-known/api-catalog): RFC 9727 linkset
- [Example client](${SITE.url}/developers#example-client): a small Node script, not an official package

## Pages

${PAGES.map((p) => `- [${p === "/" ? "Home" : p.slice(1)[0].toUpperCase() + p.slice(2)}](${SITE.url}${p})`).join("\n")}
- [Full text for agents](${SITE.url}/llms-full.txt): this guide plus every page in Markdown

## Optional

- [Source code and data](${SITE.github}): MIT licensed
- [Report an error](${SITE.issues}): GitHub issues, the project's contact channel
- [Sitemap](${SITE.url}/sitemap.xml)
`;
}

export function llmsFullTxt(): string {
  return [llmsTxt(), ...PAGES.map((p) => `---\n\nSource: ${SITE.url}${p}\n\n${pageMarkdown(p)}`)].join("\n");
}
