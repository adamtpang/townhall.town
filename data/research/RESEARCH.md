# Townhall — source research (checked Oct 29, 2026, Central Time)

What each major election-data source offers, and whether a hackathon app can use it for free. "Verified" = checked live this session; "unverified" = from prior knowledge, not re-checked.

| Source | What it offers | Free API? | How we use it |
|---|---|---|---|
| **Ballotpedia** (ballotpedia.org) | Candidate lists per race, incumbent marking, candidate pages with campaign/official site links, "Campaign themes" (verbatim from campaign sites or its Candidate Connection survey), ballot measures, sample-ballot lookup | **No free API** (paid data/API products). Pages are public HTML; generic fetchers got a 403, a plain curl with browser UA worked (verified) | Primary source for every race/candidate in `data/`. Every record links back to its page. Respect rate limits; cache. |
| **Vote411** (League of Women Voters) | Personalized ballot + candidate questionnaire answers, polling place lookup | No public API (unverified) | Link out as "see your full ballot" |
| **BallotReady / CivicEngine** | Address → full down-ballot (local races), candidate stances, endorsements | Paid/commercial API (unverified); Google names it as a Representatives-API replacement (verified, see below) | Not used; best path to local races later |
| **X election pages** | X has run race/election hubs pairing candidates' official accounts with posts (unverified for 2026) | X API (paid tiers) | Idea to borrow: link each candidate's official X account; show their own posts as primary-source statements |
| **Polymarket** | Prediction-market prices per candidate/measure, volume, price history | **Yes, free, no key** (verified): `gamma-api.polymarket.com/public-search`, `/events?slug=`, `clob.polymarket.com/prices-history` | `data/markets/snapshot.json`, `endpoints.json` |
| **Kalshi** | CFTC-regulated event contracts, election series (TX Senate/Gov/Lt Gov/AG, TX-35, CA Gov, CA Prop 40, CA voter ID, CA Insurance Comm.) | **Yes, free, no key for market data** (verified): `api.elections.kalshi.com/trade-api/v2/events?series_ticker=` + candlesticks | same |
| **FEC** (api.open.fec.gov) | Federal candidates, committees, receipts/spending | **Yes, free** (`DEMO_KEY` works with low limits; free key at api.data.gov) (verified) | `fec.candidate_id` + link on each U.S. Senate/House candidate (86/87 matched by name+district — verify) |
| **Texas Ethics Commission** | State-level campaign finance reports (Gov, Lt Gov, AG, etc.) | No API; web search + bulk CSV export (https://www.ethics.state.tx.us/search/cf/) (unverified that bulk export is current) | `state_finance` link on state candidates |
| **Texas SOS / VoteTexas.gov** | Dates, eligibility, "Am I registered", polling places, official candidate list | No API | `data/texas/key_dates.json` (early voting Oct 19–30, registration deadline Oct 5, verified) |
| **California SOS** | Qualified ballot measures, candidate list, voter status, Cal-Access/Power Search finance | No API (Cal-Access bulk download exists, unverified) | Links in `data/california/` |
| **Google Civic Information API** | Elections + Divisions (address → OCD-IDs) still exist | **Representatives endpoints shut down April 30, 2025** (verified: Google Groups notice "The Representatives API has been turned down," May 1, 2025 — https://groups.google.com/g/google-civicinfo-api/c/9fwFn-dhktA) | Not used. Divisions API (needs Google key) could replace our ZIP-centroid district guess with address-level OCD-IDs |
| **OpenSecrets** | Money in politics | **API discontinued April 15, 2025** (verified: https://www.opensecrets.org/api); bulk data for educational use only | Not used |
| **U.S. Census (api.census.gov)** | ACS demographics | Now requires a key (redirected to missing_key page, verified) | Used **Census Reporter** (no key, same ACS 2024 5-year) |
| **BLS LAUS** | Monthly county unemployment | Yes, v1 no key (25 queries/day) (verified) | `data/metrics/zip_metrics.json` |
| **TX Legislative Council redistricting** | PLANC2333 congressional shapefile (2025 map used in 2026) | Download | `data/texas/tx_congressional_districts_planc2333.geojson` + ZIP→district |
| **538 / Decision Desk HQ** | Polling averages, results | DDHQ paid; 538 archived (unverified) | Not used |

## Key takeaways for the build
1. **No single free API covers "my ballot".** Ballotpedia HTML + FEC + markets + Census is a workable free stack for federal + statewide races; local races need BallotReady/Vote411 (paid/no API).
2. **Markets are the easiest live data.** Both Polymarket and Kalshi are open, keyless, JSON. Must be labeled *market odds* with timestamp.
3. **District lookup is the weak link.** Google Representatives is gone; we use ZCTA centroid → 2025 map polygons. Always show "verify by address" with VoteTexas link.
4. **Positions** come only from verbatim Ballotpedia "Campaign themes" excerpts (candidate's own words). Many candidates have not answered the survey; show "no stated position found" rather than infer.
