// Single source of truth for public site facts used by metadata, JSON-LD, llms.txt, sitemap and trust pages.
export const SITE = {
  name: "townhall.town",
  url: "https://townhall.town",
  title: "townhall.town: nonpartisan ballot guide for Austin, San Francisco and New York",
  description:
    "A nonpartisan, sourced ballot guide for the Nov 3, 2026 election. Enter a ZIP to see every race and measure on your ballot, with a source for each fact.",
  github: "https://github.com/adamtpang/townhall.town",
  issues: "https://github.com/adamtpang/townhall.town/issues",
  author: "Adam Pang",
  electionDate: "2026-11-03",
  electionLabel: "Nov 3, 2026",
} as const;

// ZIPs advertised on the homepage. Mirrors DEMO in app/BallotAgent.tsx (NYC_READY = true).
export const COVERAGE = [
  { zip: "78701", place: "Austin, Texas" },
  { zip: "94103", place: "San Francisco, California" },
  { zip: "10001", place: "New York, New York" },
] as const;

// The only ZIPs the site and API serve. Every other 5-digit ZIP, cached data or not, gets UNSUPPORTED_MESSAGE.
export const COVERED_ZIPS: readonly string[] = COVERAGE.map((c) => c.zip);
export const isCoveredZip = (zip: string) => COVERED_ZIPS.includes(zip);
export const UNSUPPORTED_MESSAGE = "We only cover 78701 (Austin), 94103 (San Francisco) and 10001 (New York) for now.";

// Indexable pages, used by app/sitemap.ts and the Markdown negotiation middleware.
export const PAGES = ["/", "/about", "/contact", "/privacy", "/developers"] as const;
export type PagePath = (typeof PAGES)[number];

// Bump when page copy changes; used as sitemap lastmod.
export const CONTENT_UPDATED = "2026-10-29";
