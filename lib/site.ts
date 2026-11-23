// Single source of truth for public site facts used by metadata, JSON-LD, llms.txt, sitemap and trust pages.
export const SITE = {
  name: "townhall.town",
  url: "https://townhall.town",
  title: "townhall.town: nonpartisan ballot guide for Austin, San Francisco and New York",
  // Evergreen (Nov 23, 2026): the Nov 3 election is past, so share copy and the meta description name no date.
  description: "A nonpartisan ballot guide. Enter a ZIP to see every race and measure on your ballot, with a source for each fact. Austin, San Francisco and New York City.",
  shareTitle: "townhall.town: a nonpartisan ballot guide, every fact sourced",
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
// Adam spec (QA 10:48 AM CT Oct 30): exactly this wording.
export const UNSUPPORTED_MESSAGE = "Austin, SF and NYC for now.";

// Indexable pages, used by app/sitemap.ts and the Markdown negotiation middleware.
export const PAGES = ["/", "/about", "/contact", "/privacy", "/developers"] as const;
export type PagePath = (typeof PAGES)[number];

// Bump when page copy changes; used as sitemap lastmod.
export const CONTENT_UPDATED = "2026-10-29";
