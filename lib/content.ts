// Page copy shared by the HTML pages and their Markdown twins (Accept: text/markdown).
// Inline links use Markdown syntax [text](url); components/Prose.tsx renders them as <a>.
// Copy rules: nonpartisan, no endorsements, no em dashes.
import { COVERAGE, SITE, type PagePath } from "./site";

export type Section = { heading: string; paragraphs?: string[]; items?: string[] };
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

export const PRIVACY: PageContent = {
  path: "/privacy",
  title: "Privacy",
  description: "What townhall.town stores, what it sends, and what it does not collect.",
  lead: "townhall.town has no accounts and keeps as little as possible. This page lists exactly what the site stores and sends.",
  sections: [
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
      heading: "The ballot agent",
      paragraphs: [
        "When you ask for a ballot, your browser sends only the 5-digit ZIP to the site's /api/agent route. The server looks up the races for that ZIP, and an AI model, reached through Vercel AI Gateway, writes a short summary from those results. If the gateway is unavailable, the same request may go directly to xAI when that fallback is configured. The ZIP is the only input from you.",
      ],
    },
    {
      heading: "Location",
      paragraphs: [
        "If you choose to use your location, your browser asks for permission first. The coordinates are sent to the site's /api/locate route, which asks the public U.S. Census Geocoder for the matching ZIP. townhall.town does not store the coordinates.",
      ],
    },
    {
      heading: "Analytics and cookies",
      paragraphs: [
        "townhall.town does not include analytics, ad pixels or tracking scripts, and it does not set cookies. The site is hosted on Vercel, which keeps standard request logs such as IP address, user agent and page path for operating the service, as described in Vercel's privacy policy.",
      ],
    },
    {
      heading: "Other sites",
      paragraphs: [
        "Candidate photos load from Wikimedia, so your browser contacts Wikimedia when a photo is shown. Source links open other sites with their own policies. Server-side lookups to public data sources such as the FEC, Polymarket and Kalshi send race identifiers, not information about you.",
        `Questions about privacy: [open an issue on GitHub](${SITE.issues}).`,
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

export const CONTENT: Record<PagePath, PageContent> = { "/": HOME, "/about": ABOUT, "/contact": CONTACT, "/privacy": PRIVACY };

function sectionMd(s: Section, level = 2): string {
  const out = [`${"#".repeat(level)} ${s.heading}`, ""];
  for (const p of s.paragraphs ?? []) out.push(p, "");
  for (const i of s.items ?? []) out.push(`- ${i}`);
  if (s.items?.length) out.push("");
  return out.join("\n");
}

const NAV_MD = [
  "## More",
  "",
  `- [Home](${SITE.url}/)`,
  `- [About](${SITE.url}/about)`,
  `- [Contact](${SITE.url}/contact)`,
  `- [Privacy](${SITE.url}/privacy)`,
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
