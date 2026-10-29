# Contributing

townhall.town is MIT licensed. See [LICENSE](LICENSE).

## Run it locally

Install dependencies, then use the scripts in `package.json`:

```bash
npm install
npm run dev
```

`npm run dev` starts Next.js (`next dev`) at http://localhost:3000.

`npm run build` runs `next build`. `npm run start` runs `next start` and serves the production build.

Copy `.env.example` to `.env.local` only if you want a model. Without `AI_GATEWAY_API_KEY`, `/api/agent` still runs in fallback mode and calls the same tools. Optional keys and what happens when they are missing are listed in `.env.example` and the README.

There is no test script in `package.json`.

## Add a city or a race

Read the existing files and match them. Do not invent a new schema.

Cached ZIPs live in `data/ballots.json`, keyed by ZIP (`78130`, `78701`, `94103`, `90012`). `data/ny.json` is the same kind of object for `10001`. `lib/tools.ts` loads them as `{ ...ballots, ...ny }` and returns that object when the ZIP is present.

A ZIP object has:

- `zip`, `state` (`"TX"`, `"CA"`, or `"NY"`), `place`, `county`, `counties` (Census county GEOIDs such as `05000US48453`)
- `districts`: `{ id, label, note? }[]`
- `districtSource`: `{ label, url }`
- `splitWarning` (string or null)
- `electionDate` (`"2026-11-03"`)
- `races`, `measures`, `measuresNote`
- `problems`, `context`, `verify` (`{ label, url }`), `builtAt`

A race in those files has `id`, `title`, `level` (`federal`, `state`, `county`, `local`, or `measure`), `office`, `officeSource`, `candidates`, and `source` (a URL string). The shared contract is `Race` in `lib/types.ts`. `officeSource` is on the JSON records even though it is not on that type.

A candidate has `name`, `party` (string or null, as listed on the ballot), `incumbent` (`true`, `false`, or `"unsure"`), `incumbentSource`, `ballotpedia`, `officialSite`, `campaignSite`, `x`, `photo`, `finance`, `positions`, `causes`, and `hasThemes`. `photo` is `{ url, credit, license?, page? }` or null. `finance` and each position's `source` are `{ label, url }`. `positions` are `{ issue, text, source }`. `causes` are `{ id, label, mentions, quote, match?, source }`.

`problems` on a ZIP are `{ year, id, topic, label, value, unit, table, source, stateValue, numeric }`. `source` is `{ label, url }`.

Measures on a ZIP (see `data/ny.json`) are `{ id, title, summary, type, source }` where `source` is a URL string. The separate math file is below.

`data/tx.json` covers other Texas ZIPs. It has `statewide` (array of races), `house` (district number to one race), `zipToCd` (ZIP to district number, 1,988 ZIPs), and `zipSource` (`{ label, url }`). If a ZIP is not in `data/ballots.json` or `data/ny.json`, `baseBallot()` in `lib/tools.ts` builds a ballot from `zipToCd`, that House race, and `statewide`. The place line is `Texas ZIP {zip}` and the county is `"unsure"`. A full city page is a `data/ballots.json` entry, which wins over that fallback.

To show a new ZIP as a button, add it to `DEMO` and `SUPPORTED` in `app/BallotAgent.tsx`. `NYC_READY` already gates `10001`.

Stances for the overlap panel are `data/stances.json`: `{ asOf, method, stances }`. `stances` is keyed by a slug of the candidate name (`lib/issues.ts` `candidateId`). Each record has `name` plus issue keys (`housing`, `healthcare`, and the other ids in `ISSUES`). An issue value is `{ value, quote, sourceUrl }` with `value` on the -5..+5 scale. Missing issues are omitted. Unknown candidates return no stances.

## Sourcing

Every new fact needs a source URL. Do not add a claim about a real politician, office, measure, or number without one.

Which field depends on the file:

- `data/stances.json` and `data/measures.json` use `sourceUrl`.
- A race's `source` is a URL string. A ZIP measure's `source` is a URL string.
- Candidates, problems, `districtSource`, and `verify` use `{ label, url }`.

If you cannot find a source, write `unsure` or `no record found`. That is what `lib/turnout.ts` and `lib/dataTools.ts` already return when a record is missing. Do not guess party, incumbency, quotes, vote totals, or biography.

`data/measures.json` is `{ builtAt, note, measures }`. Each measure has `id`, `title`, `zips`, `jurisdiction`, `cost` (`{ value, sourceUrl }`), `whoPays` (`{ text, sourceUrl }`), `whatChanges` (`{ text, sourceUrl }`), and optional `notes`. The file note says `unsure` where the official text gives no figure. Keep that. Austin propositions still say the per-home tax impact is `unsure`.

## Nonpartisan

Do not call a candidate the best. Do not tell the reader who to vote for.

`app/RaceTiers.tsx` ranks races, not candidates, with plain labels: Most at stake, High, Moderate, Lower. The score is office impact times competitiveness. No market means competitiveness 1 and the line "no market, so no competitiveness boost". Do not invent odds.

`app/IssueMatch.tsx` compares slider answers to sourced stances. The label is overlap ("Lines up on N of M compared issues"), not a recommendation. Candidates get no grade or tier. With fewer than 2 sourced stances on the answered issues, only the count of sourced positions is shown. No answers, no overlap.

Portraits come from `data/photos.json` (`{ asOf, method, photos }`). `photos` is keyed by ballot name. Each value is `{ url, credit, license, page }`. `lib/photos.ts` applies them. `components/Portrait.tsx` falls back to initials. Do not add generated candidate photos. A missing licensed image stays initials.

## Privacy

Issue answers stay in the browser. `app/IssueMatch.tsx` reads and writes `localStorage` key `townhall.issueAnswers.v2`. Those answers are not posted to the server.

The ZIP is sent to `POST /api/agent`. Do not add other personal fields to that request.

## Pull requests

1. Fork the repository.
2. Create a branch.
3. Open a pull request to `main`.
4. Put a source link in the data and in the pull request description for every new fact.

Do not commit `.env`, `.env.local`, `node_modules`, or `.next`. `.gitignore` already excludes them. `.env.example` may only contain placeholders.
