// Page copy shared by the HTML pages and their Markdown twins (Accept: text/markdown).
// Inline links use Markdown syntax [text](url); components/Prose.tsx renders them as <a>.
// Copy rules: nonpartisan, no endorsements, no em dashes.
import { COVERAGE, SITE, type PagePath } from "./site";

export type Section = { heading: string; paragraphs?: string[]; items?: string[]; code?: string[] };
export type PageContent = { path: PagePath; title: string; description: string; lead: string; sections: Section[] };

const coverageLine = COVERAGE.map((c) => `${c.zip} (${c.place})`).join(", ");

export const HOME_SECTIONS: Section[] = [
  {
    heading: "How it works",
    paragraphs: [
      `Enter a 5-digit ZIP, or share your location. townhall.town finds your U.S. House district, then lists every race and statewide measure on your ${SITE.electionLabel} ballot and what each office controls.`,
      "For each candidate you see party, incumbency, the issues they raise in their own campaign themes, and campaign money from public filings. Every fact links its source. When a fact cannot be confirmed, it is marked unsure.",
      "An AI model writes a short neutral summary from those sourced records only. It does not recommend candidates or positions. Your issue answers stay in your browser, and there is no account.",
      `Covered ZIPs today: ${coverageLine}.`,
    ],
  },
  {
    heading: "Sources",
    items: [
      "Candidates and campaign themes: [Ballotpedia](https://ballotpedia.org)",
      "Campaign money: [FEC](https://www.fec.gov), [Texas Ethics Commission](https://www.ethics.state.tx.us), [Cal-Access](https://cal-access.sos.ca.gov)",
      "Dates, ID rules and polling places: [VoteTexas.gov](https://www.votetexas.gov), [California Secretary of State](https://www.sos.ca.gov/elections), [NYC Board of Elections](https://vote.nyc)",
      "Local data and ZIP geography: [U.S. Census Bureau](https://www.census.gov) American Community Survey 2024 5-year",
      "Market odds: [Polymarket](https://polymarket.com) and [Kalshi](https://kalshi.com) prices, shown as market prices, not forecasts",
    ],
  },
];

export const HOME: PageContent = {
  path: "/",
  title: "townhall.town: nonpartisan ballot guide",
  description: SITE.description,
  lead: `townhall.town explains your ${SITE.electionLabel} ballot in plain language. Nonpartisan, with a source for every fact. Not a government site; confirm details with your state or county election office.`,
  sections: HOME_SECTIONS,
};

export const ABOUT: PageContent = {
  path: "/about",
  title: "About townhall.town",
  description: "What townhall.town is, how it stays nonpartisan, and who builds it.",
  lead: `townhall.town is a free ballot guide for the ${SITE.electionLabel} U.S. general election. Enter a ZIP and it lists every race and statewide measure on that ballot, the candidates, and what each office controls.`,
  sections: [
    {
      heading: "Nonpartisan by design",
      paragraphs: [
        "townhall.town does not endorse candidates, parties or ballot positions, and it does not rank candidates. Candidates in a race are shown with the same fields in the same layout.",
        "The AI summary is instructed to stay neutral, to use only facts returned by the data tools, and to never recommend a candidate. Prediction market odds are labeled as market prices, not forecasts.",
      ],
    },
    {
      heading: "Every claim is sourced or marked unsure",
      paragraphs: [
        "Each fact links the record it came from, such as Ballotpedia, the FEC, state ethics filings, Secretary of State pages or Census data. When a fact cannot be confirmed from a source, the page says unsure instead of guessing.",
        "If you find an error, please [open an issue](" + SITE.issues + ") with the source that shows the correct fact.",
      ],
    },
    {
      heading: "Coverage",
      paragraphs: [`Covered ZIPs today: ${coverageLine}. More places are added as their ballots are researched and sourced.`],
    },
    {
      heading: "Open source",
      paragraphs: [
        `The code and ballot data are public on [GitHub](${SITE.github}) under the MIT license. Anyone can read how the data is built, check a claim, or suggest a fix.`,
      ],
    },
    {
      heading: "Who builds it",
      paragraphs: [
        `townhall.town is built by ${SITE.author}. It is an independent project, not a government site and not affiliated with any campaign or party. Always confirm dates, ID rules and polling places with your state or county election office.`,
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
        "We don't sell or share your information. There are no ads, no data brokers, and nothing goes to campaigns or parties. The site only needs your ZIP code. Your issue answers stay on your device. We show what candidates said, with a link to where they said it, and we never recommend a candidate.",
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
        "When you answer the issue questions, your answers are saved in your browser's localStorage under the key townhall.issueAnswers.v2 so they are still there next visit. They are not sent to the server. Clearing site data in your browser removes them.",
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
        "Candidate photos load from Wikimedia, so your browser contacts Wikimedia when a photo is shown. Source links open other sites with their own policies.",
        "The server also fetches public data while building a ballot. It sends candidate names or IDs to the FEC and Congress.gov, the county code for your ZIP to the Bureau of Labor Statistics, and market IDs for races to Polymarket and Kalshi. These requests come from our server, so they don't include your IP address, and they never include your answers.",
      ],
    },
    {
      heading: "Messages",
      paragraphs: [
        "townhall.town does not run a texting, WhatsApp or email service yet, so it holds no phone numbers, email addresses or messages. This page will be updated before any messaging starts.",
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
  lead: `The way to reach townhall.town is a GitHub issue at [github.com/adamtpang/townhall.town/issues](${SITE.issues}). Issues are public, so please do not include personal details.`,
  sections: [
    {
      heading: "Report a factual error",
      paragraphs: [
        "Include the ZIP, the race or candidate, the fact that looks wrong, and a link to a source that shows the correct fact. Corrections are checked against the source, then fixed or marked unsure.",
      ],
    },
    {
      heading: "Request a ZIP or report a bug",
      paragraphs: [
        "To ask for a new place, open an issue with the ZIP and city. To report a bug, describe what you did, what you expected, and what happened, with your browser and device if you can.",
      ],
    },
    {
      heading: "Security",
      paragraphs: [
        "If you find a security problem, open an issue asking for a private channel and leave the details out of the public issue.",
      ],
    },
    {
      heading: "Election questions",
      paragraphs: [
        "townhall.town is not a government site. For registration, polling places and official ballots, contact your election office: [VoteTexas.gov](https://www.votetexas.gov), the [California Secretary of State](https://www.sos.ca.gov/elections), or the [NYC Board of Elections](https://vote.nyc).",
      ],
    },
  ],
};

export const DEVELOPERS: PageContent = {
  path: "/developers",
  title: "Developers",
  description: "The townhall.town API: ballot data and ZIP lookup, free, no key. OpenAPI 3.1 spec and curl examples.",
  lead: `townhall.town has a small public API. It is free, needs no key or account, and returns the same sourced ballot data the site shows. The full description is the [OpenAPI 3.1 spec](${SITE.url}/openapi.json).`,
  sections: [
    {
      heading: "Endpoints",
      items: [
        "GET /api/agent?zip=78701 or POST /api/agent with JSON {\"zip\":\"78701\"}: the ballot for a ZIP, streamed as newline-delimited JSON (application/x-ndjson).",
        "POST /api/locate with JSON {\"lat\":30.2672,\"lon\":-97.7431}: the ZIP for a point, from the U.S. Census Geocoder. Coordinates go in the body, not the URL.",
        `[openapi.json](${SITE.url}/openapi.json): OpenAPI 3.1 description of both endpoints, with every parameter and response.`,
      ],
    },
    {
      heading: "Get a ballot",
      paragraphs: [
        `Covered ZIPs: ${coverageLine}. Each line of the response is one JSON event. Step and status lines arrive while the data tools run. The last line has "type":"result" with the full ballot: districts, races, candidates, measures, market prices and local Census data, each with its source. A 5-digit ZIP that is not covered ends with one "type":"unsupported" line instead.`,
      ],
      code: [
        `curl -N "${SITE.url}/api/agent?zip=78701"`,
        `curl -N -X POST "${SITE.url}/api/agent" -H "content-type: application/json" -d '{"zip":"94103"}'`,
        `curl -s "${SITE.url}/api/agent?zip=10001" | tail -n 1 | jq '.ballot.races[].title'`,
      ],
    },
    {
      heading: "Find a ZIP",
      paragraphs: ['Returns {"zip":"78701","source":"U.S. Census Geocoder (ZCTA)"}. Coordinates are not stored.'],
      code: [`curl -X POST "${SITE.url}/api/locate" -H "content-type: application/json" -d '{"lat":30.2672,"lon":-97.7431}'`],
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
        "502 upstream_unavailable: the Census Geocoder did not answer.",
      ],
      code: [`curl -i "${SITE.url}/api/agent?zip=7870"`, '{"error":{"code":"invalid","message":"zip must be exactly 5 digits, for example 78701."}}'],
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
      `- Programmatic: \`GET ${SITE.url}/api/agent?zip=78701\` (or \`POST\` with JSON \`{"zip":"78701"}\`) returns newline-delimited JSON. The last line has \`"type":"result"\` with the full ballot.`,
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
