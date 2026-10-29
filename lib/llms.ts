// /llms.txt (llmstxt.org format: H1, blockquote summary, free text, then H2 sections of link lists)
// and /llms-full.txt (same guide plus the full text of every page).
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
- [Ballot agent API](${SITE.url}/api/agent?zip=78701): \`GET /api/agent?zip=<ZIP>\` or \`POST /api/agent\` with JSON \`{"zip":"<ZIP>"}\`. Returns \`application/x-ndjson\`: \`step\` and \`status\` lines while it works, then one \`{"type":"result"}\` line with \`ballot\` (races, measures, candidates, sources), \`markets\`, \`narration\` and \`generatedAt\`. Uncovered ZIPs return \`{"type":"unsupported"}\`. Allow up to about 30 seconds. Public, no key, please keep request rates low.
- [Location to ZIP](${SITE.url}/api/locate?lat=30.2672&lon=-97.7431): \`GET /api/locate?lat=<lat>&lon=<lon>\` returns \`{"zip":"78701","source":"U.S. Census Geocoder (ZCTA)"}\`.
- Markdown: every page listed below returns Markdown when requested with \`Accept: text/markdown\`.

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
