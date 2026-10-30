# Townhall data layer

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
- **Incumbent flags** come from Ballotpedia's bold-name convention (Comptroller Don Huffines flagged — verify).
- **FEC matches** are name+district string matches (86/87); verify the ID before showing finance.
- **Positions** are verbatim Ballotpedia excerpts, sometimes including survey boilerplate; many candidates have none. The app must not paraphrase into new claims; "problem ↔ position" links should quote and mark "unsure" when the match is inferred.
- **Market odds** are trader prices, not forecasts or endorsements; thin markets swing. Snapshot is from Oct 29, 2026 ~2:50 PM CT; refresh live.
- **Census** 5-year estimates have margins of error (kept in raw file); small ZCTAs (78701) are noisy.
- Scraped Oct 29, 2026; candidates can withdraw. Not affiliated with any source.

## Next steps
1. **World elections expansion:** same schema (race → office explainer → candidates → sources → market odds) for other countries; Polymarket/Kalshi already list many non-US elections. Start with upcoming national elections that have markets, plus Wikipedia/official electoral-commission candidate lists.
2. **Promise tracking after Nov 3:** freeze each winner's stated positions (the verbatim excerpts here, timestamped) and track votes/bills/actions against them (Congress.gov API, Texas Legislature Online, CA leginfo), with each item linked to the record — "said → did" with no editorializing.
3. Address-level district lookup (Google Civic Divisions API → OCD-ID, or Census geocoder), down-ballot local races, TEC/FEC finance summaries, Spanish translation.
