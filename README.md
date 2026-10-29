# townhall.town

**Your ballot, explained in seconds.** A nonpartisan ballot agent built for AITX (Oct 29, 2026). Scope: **Austin (78701), San Francisco (94103), New York (10001)**; 78130 and 90012 also work, other ZIPs get "Austin, San Francisco, and New York 10001 for now." Enter a ZIP and an AI agent calls sourced data tools to explain every race in plain words, show who is running, what each candidate has said about the problems you care about, what prediction markets say, and how to vote.

Live: https://townhall.town

It never picks a "best" candidate. Every claim links to a source; anything unsourced shows **unsure**.

## Quick start
```bash
npm install
cp .env.example .env.local   # optional: without a key the app runs in fallback mode
npm run dev                  # http://localhost:3000
npm run build
```
Try the demo ZIPs: 78701 (Austin), 94103 (San Francisco), and 10001 (New York); 78130 (New Braunfels) and 90012 (Los Angeles) also work.
API: `GET /api/agent?zip=78701` streams NDJSON (`status`, `step`, `result`). `GET /api/locate?lat=..&lon=..` maps coordinates to a ZIP via the Census geocoder.

## Open source: contribute

MIT licensed. See [LICENSE](LICENSE). How to run the app, how to add a city, and the sourcing rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Stack
Next.js 15 (App Router), React 19, TypeScript, Tailwind, Radix/shadcn-style components, Public Sans. Vercel AI SDK v5 tool loop over the Vercel AI Gateway (OIDC on Vercel). Deployed on Vercel.

## How it works
```mermaid
flowchart LR
  U[ZIP or geolocation] --> A[/api/agent/]
  A -->|AI SDK generateText + tools| M{Model via AI Gateway}
  M --> T1[getDistricts] & T2[getRaces] & T3[getCandidates] & T4[getMarketOdds] & T5[getLocalProblems]
  M -.optional.-> T6[getTurnout] & T7[getAccountability]
  A -->|model unavailable| F[Deterministic fallback: same tools, no model]
  T1 & T2 & T3 --> D[(data/ballots.json, data/tx.json)]
  T4 --> P[Polymarket / Kalshi live, cached snapshot fallback]
  T5 --> C[(ACS 2024 5-yr)]
  A --> UI[Ballot UI: elections, candidates, problems, alignment, markets, turnout, game plan]
```
One model serves every ZIP: `google/gemini-2.5-flash-lite` via the Vercel AI Gateway (the rest of the ladder is only a failover). The UI shows plain steps ("Finding your districts", ...) and a **Live AI agent** or **fallback mode (no model)** label, without model or tool names.

### How the agent works
One request, one bounded tool loop, streamed back to the browser as NDJSON (`app/api/agent/route.ts`).

**Tools the model can call**

| Tool | Returns | Source |
| --- | --- | --- |
| `getDistricts` | U.S. House district(s), state, county for the ZIP | Census 2024 ZCTA centroids in PLANC2333 (TX) |
| `getRaces` | Every race and statewide measure on the Nov 3, 2026 ballot, with what each office controls | `data/ballots.json`, `data/tx.json` |
| `getCandidates` | General-election candidates: name, party, incumbent | Ballotpedia, FEC |
| `getMarketOdds` | Live Polymarket / Kalshi prices per contest, or "no market found" | Polymarket, Kalshi (cached snapshot fallback) |
| `getLocalProblems` | 3 local problems: rent burden, uninsured rate, unemployment | Census ACS 2024 5-year |
| `getTurnout` | County turnout, eligible non-voters, what one ballot counts for (demo ZIPs) | Texas and California Secretary of State, Census Reporter |
| `getAccountability` | Track record: said-vs-did pairs marked consistent, inconsistent or mixed/unclear; a score only with 3+ checkable pairs | Civic accountability.json; official records only (method at /methodology/accountability) |

**Loop steps**
1. The ZIP is normalized to 5 digits. If it isn't covered, the stream returns `unsupported` and stops.
2. The model gets a strict nonpartisan system prompt and is told to call the five core tools in parallel in its first step.
3. `generateText` runs with `stopWhen: stepCountIs(3)` and a 25-second timeout. Each tool call streams a `step` event (running, then done with a one-line summary), which is the live "Agent steps" panel.
4. The model writes a 2 to 3 sentence neutral summary from tool results only. It may not recommend a candidate.
5. If a model fails, the next one in the ladder is tried (`AGENT_MODELS`, default `google/gemini-2.5-flash-lite`, `openai/gpt-4.1-mini`, `openai/gpt-5-nano`, with direct xAI first when `XAI_API_KEY` is set).
6. Any core tool the model skipped is run deterministically, so the ballot is always complete. With no model at all, every tool runs this way and the badge says fallback.
7. A final `result` event carries the mode, model, which tools the model chose to call, the narration, the full ballot and market odds. The UI renders from that.

## Environment variables
See `.env.example` (placeholders only, never commit real values):
- `AI_GATEWAY_API_KEY`: local dev only; on Vercel the gateway authenticates with OIDC.
- `AGENT_MODELS`: optional comma-separated gateway model ladder.
- `XAI_API_KEY`: optional direct xAI fallback.
- `FEC_API_KEY`, `CONGRESS_API_KEY`: optional api.data.gov keys for OpenFEC and Congress.gov. Without them the tools use `DEMO_KEY` (low hourly limit).
- `OPENSTATES_API_KEY`, `GOOGLE_CIVIC_API_KEY`: optional. Without them `getStateLegislators` and `getVoterInfo` return `unavailable`.

### Live data tools (`lib/dataTools.ts`)
Optional tools the model can call, each returning a source URL, or `{ status: "unavailable", reason }` when a key is missing or the call fails:
- `getCampaignFinance`: OpenFEC receipts, spending and cash on hand for a federal candidate.
- `getSponsoredBills`: the current U.S. House member for a state and district, with recent sponsored bills (Congress.gov).
- `getCountyUnemployment`: latest monthly county unemployment rate (BLS LAUS). A county figure, so it differs from the ZIP-level ACS 5-year number.
- `getStateLegislators`: state legislators for a point (Open States).
- `getVoterInfo`: polling place and early-vote sites for an address (Google Civic voterinfo).

## Shared data contract
`lib/types.ts` is the shared contract; plug-ins only add optional fields. `lib/accountability.ts` adds `politician.accountability` ("said vs. did", every record has both source links) and `lib/turnout.ts` adds jurisdiction `turnout` (county turnout, eligible non-voters, 2026 registration, all sourced). Both are also exposed to the model as tools via `lib/civicTools.ts`.

## Data

Built Oct 29, 2026 (Central Time) for the AITX hackathon. All files under `data/`. Raw downloads and scripts in `research/` (`gen.py` parse Ballotpedia voteboxes, `cand.py` candidate pages, `build.py` assemble, `markets.py` refresh odds).

## Datasets & provenance
| File | Contents | Source |
|---|---|---|
| `texas/statewide_races.json` | 14 races: U.S. Senate, Governor, Lt Gov, AG, Comptroller, Land Commissioner, Agriculture, Railroad Commission, Supreme Court (CJ, Pl. 7, Pl. 8), Court of Criminal Appeals (Pl. 3, 4, 9). Per candidate: party, incumbent flag, Ballotpedia, campaign & official sites, FEC id (federal), TEC link (state), verbatim "Campaign themes" excerpt. Per race: what the office controls + source | Ballotpedia race & candidate pages; office pages (txcourts.gov, rrc.texas.gov, glo.texas.gov, etc.) |
| `texas/us_house_races.json` | All 38 districts on the 2025 map (PLANC2333) | Ballotpedia district pages; FEC |
| `texas/zip_to_congressional_district.json` | 1,988 TX ZIPs → district | Census 2024 ZCTA gazetteer centroids in PLANC2333 polygons (TX Legislative Council) |
| `texas/tx_congressional_districts_planc2333.geojson` | Simplified district polygons (WGS84) | PLANC2333 shapefile |
| `texas/key_dates.json` | Election Day Nov 3; early voting Oct 19–30; registration deadline Oct 5 (passed); eligibility rules | sos.state.tx.us, votetexas.gov |
| `texas/ballot_measures.json` | None statewide in 2026 | Ballotpedia Texas_elections,_2026 |
| `california/statewide_races.json` | 8 statewide races (no U.S. Senate seat in 2026) | Ballotpedia |
| `california/us_house_races_demo.json` | CA-11, CA-34 only (demo ZIPs) | Ballotpedia |
| `california/ballot_measures.json` | 14 propositions incl. **Prop 40 one-time 5% billionaire wealth tax** (verified on Ballotpedia) | Ballotpedia California_2026_ballot_propositions |
| `markets/snapshot.json` | Polymarket + Kalshi prices, each with `fetched_at_utc` | gamma-api.polymarket.com, api.elections.kalshi.com |
| `markets/endpoints.json` | How to refresh live + display rule | — |
| `metrics/zip_metrics.json` | For 78130, 78701, 94103, 90012: income, poverty, uninsured, renter cost burden, unemployment, education, rent, home value — vs county, state, US; BLS Sept 2026 county unemployment | ACS 2024 5-yr via Census Reporter; BLS LAUS |
| `demo_zips.json` | Pre-joined bundle for the 4 cached ZIPs | above |

## Limitations
- **ZIP ≠ district.** ZIP→district uses the ZIP's center point; ZIPs on a boundary may be wrong. Always say "verify by address" and link VoteTexas / CA voter status. CA ZIP→district (94103→CA-11, 90012→CA-34) is **unverified** under the Prop 50 map.
- **Federal + statewide only.** No state legislature, State Board of Education, county, city, school board, or local measures yet.
- **Incumbent flags** come from Ballotpedia's bold-name convention (Comptroller Donald Huffines flagged — verify).
- **FEC matches** are name+district string matches (86/87); verify the ID before showing finance.
- **Positions** are verbatim Ballotpedia excerpts, sometimes including survey boilerplate; many candidates have none. The app must not paraphrase into new claims; "problem ↔ position" links should quote and mark "unsure" when the match is inferred.
- **Market odds** are trader prices, not forecasts or endorsements; thin markets swing. Snapshot is from Oct 29, 2026 ~2:50 PM CT; refresh live.
- **Census** 5-year estimates have margins of error (kept in raw file); small ZCTAs (78701) are noisy.
- Scraped Oct 29, 2026; candidates can withdraw. Not affiliated with any source.

## Next steps
1. **World elections expansion:** same schema (race → office explainer → candidates → sources → market odds) for other countries; Polymarket/Kalshi already list many non-US elections. Start with upcoming national elections that have markets, plus Wikipedia/official electoral-commission candidate lists.
2. **Promise tracking after Nov 3:** freeze each winner's stated positions (the verbatim excerpts here, timestamped) and track votes/bills/actions against them (Congress.gov API, Texas Legislature Online, CA leginfo), with each item linked to the record — "said → did" with no editorializing.
3. Address-level district lookup (Google Civic Divisions API → OCD-ID, or Census geocoder), down-ballot local races, TEC/FEC finance summaries, Spanish translation.

- Accountability records cover 7 politicians only; turnout covers the 4 demo counties only.
- **Comptroller:** Donald Huffines is shown as the incumbent. Gov. Abbott appointed him after Kelly Hancock resigned; Hancock had lost the March 3 GOP primary to Huffines (Ballotpedia Texas_Comptroller_election,_2026; comptroller.texas.gov lists Huffines).

## Disclaimer
Independent and nonpartisan; not a government website. Always confirm your ballot with official sources: [VoteTexas.gov](https://www.votetexas.gov/), [California Secretary of State](https://www.sos.ca.gov/elections), [CA early voting](https://caearlyvoting.sos.ca.gov/).

## Race tiers (S/A/B/C)


"What matters on your ballot" ranks races, never candidates. Score = office impact × competitiveness.

- Office impact: 3 = President, U.S. Senate, Governor; 2 = ballot measure, U.S. House, other statewide executive office; 1.5 = state legislature; 1 = judicial and local.
- Competitiveness: 1 + (1 − |p_leader − 0.5| × 2), where p_leader is the leading prediction-market probability for the race; 1 when no market exists.
- Tiers: S ≥ 4.5, A ≥ 3, B ≥ 2, otherwise C. Each race shows a one-line reason plus its race source and market link.

Candidate overlap ("Who lines up with you") uses only your slider answers (−5..+5, stored in localStorage) and verbatim sourced stances in data/stances.json. Overlap = (cosine + 1) / 2 on shared issues; hidden below 2 sourced stances ("Not enough record"). It is issue overlap, not a recommendation.

### Questionnaire and candidate tiers
- 10 issues (CA adds Prop 40), each a -5..+5 integer slider, one per row with neutral policy-direction labels at both ends; every issue can be skipped.
- Candidate tier within a race, "based on your answers and sourced records": S ≥ 85% overlap, A ≥ 70%, B ≥ 50%, otherwise C. Requires at least 2 sourced stances on your issues, else "Not enough record to tier". No answers, no tiers. Ballot order is kept; nothing is labeled "best".
- **Answers stay on your device** (localStorage key `townhall.issueAnswers.v2`). No sign-in, nothing is sent to a server.
