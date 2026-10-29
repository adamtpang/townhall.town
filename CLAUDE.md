# CLAUDE.md - townhall.town

**AITX hackathon build, due Thursday 2026-10-29 at 5:00 PM CT.** Your ballot, explained:
enter a ZIP, see your elections, candidates with photos and links, your area's problems,
what's on the ballot, what incumbents said vs did, turnout, live Polymarket and Kalshi
odds, and a plan for where and when to vote. Nonpartisan. Never tell anyone how to vote.

## Who does what

- **Maans** (Adam's coordinator bot in the Grok Bot desktop app) routes work.
- **Engineering** (Grok Bot) owns the core app on `main`: Next.js 15, AI SDK 5, Tailwind 3,
  shadcn. It deploys production. Data contract: `lib/types.ts`. Ballots: `data/ballots.json`.
- **Claude Code** owns plug-ins on branch `claude/accountability-turnout`, PR #1:
  `lib/accountability.ts` (said vs did, 7 incumbents), `lib/turnout.ts` (4 demo ZIPs),
  `lib/civicTools.ts` (AI SDK tools), `/api/turnout`, `/api/accountability`,
  `components/civic/*`. Add only optional fields to the contract; never edit Engineering's
  files without asking Maans first.

## Rules

- Every number and claim links to a source. Missing data says "no record found".
- Demo ZIPs: 78130, 78701, 94103, 90012. Election day 2026-11-03.
- Secrets stay in env vars. Never print or commit keys.
- Production deploys come from Engineering on `main`. This folder is linked to the
  Vercel project `townhall.town` (team adamtpangs-projects); do not run `vercel --prod`
  from here unless Adam says so.

## Submission (AITX form)

Title and track (Antler plus Open), a 2 to 5 minute Loom, the public repo, the live URL
(https://townhall.town), the team roster, and a 150 to 300 word write-up. README needs a
quick start, tech stack, architecture diagram, env vars with a sample `.env`, datasets and
where they came from.

## Known data fixes (sent to Engineering in PR #1)

- Donald Huffines is not the incumbent Comptroller (Kelly Hancock was acting).
- Texas US Senate race is Paxton (R) vs Talarico (D); Cornyn lost the May runoff.
