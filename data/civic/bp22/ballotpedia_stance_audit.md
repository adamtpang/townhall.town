# Ballotpedia stance audit: 78701 / 94103 / 10001 (Civic, 2026-10-30)

Scope: 91 scored stances (value not null) in data/stances.json whose sourceUrl is on ballotpedia.org, for candidates in the 78701 and 94103 races. **10001 (NY) has no Ballotpedia-sourced stances.** All 37 Ballotpedia pages were fetched one at a time with 2s delays; every record was located in the page DOM. Data: `ballotpedia_stance_audit.json`.

## Counts per class

| Class | Records |
|---|---|
| CC | 55 |
| CAMPAIGN | 36 |
| BP_VOICE | 0 |
| NOT_FOUND | 0 |

All 91 quotes were found on the Ballotpedia page: 89 match exactly and 2 (both Caitlin Rourk) match only after normalizing punctuation and whitespace. One parser miss was fixed by hand: Jon Rosenthal's education quote is a **2018 legacy Ballotpedia candidate survey** answer ("participated in Ballotpedia's candidate survey on March 27, 2018"), so it is CC, not BP_VOICE.

## Counts per party

| Party | CC | CAMPAIGN | BP_VOICE | NOT_FOUND | Counted by Engineering gate today |
|---|---|---|---|---|---|
| Democratic | 31 | 14 | 0 | 0 | 1 / 45 |
| Green | 2 | 2 | 0 | 0 | 0 / 4 |
| Libertarian | 8 | 2 | 0 | 0 | 0 / 10 |
| Nonpartisan | 5 | 0 | 0 | 0 | 4 / 5 |
| Republican | 9 | 18 | 0 | 0 | 2 / 27 |

**Key finding:** `lib/towny/ballotpediaKinds.gen.json` counts only **7 of 91** records (Fiona Ma energy, Gloria Romero housing, Richard Barrera wages, Skyler Korgel ×3, Steve Hilton immigration). The audit supports keeping **91 of 91** as either Candidate Connection or verbatim campaign-site text. The build script's regexes only match notes that literally say "Candidate Connection" or "copied from campaign website", so most records were mislabeled "Ballotpedia voice" because their notes are worded differently.

## Requested candidates

- **Ted Brown / immigration**: CC. Campaign themes > 2024 > Ballotpedia survey responses > Q: "Please list below 3 key messages of your campaign. What are the main points you want voters to remember about your goals for your time in office?" (https://ballotpedia.org/Ted_Brown_(Texas)#Campaign_themes). Campaign URL: None. Live-site check: None.
- **Ted Brown / housing**: CC. Campaign themes > 2022 > Ballotpedia survey responses > Q: "Please list below 3 key messages of your campaign. What are the main points you want voters to remember about your goals for your time in office?" (https://ballotpedia.org/Ted_Brown_(Texas)#Campaign_themes). Campaign URL: None. Live-site check: None.
- **Ted Brown / taxes**: CAMPAIGN. Campaign themes > 2024 > Campaign website — "Brown’s campaign website stated the following:" (https://ballotpedia.org/Ted_Brown_(Texas)#Campaign_themes). Campaign URL: https://tedbrown.org/platform. Live-site check: PARTIAL: 32/44 4-grams found on https://tedbrown.org/website/ (tedbrown.org/platform now 404); wording appears revised, unsure.
- **Ted Brown / healthcare**: CAMPAIGN. Campaign themes > 2024 > Campaign website — "Brown’s campaign website stated the following:" (https://ballotpedia.org/Ted_Brown_(Texas)#Campaign_themes). Campaign URL: https://tedbrown.org/platform. Live-site check: CONFIRMED on https://tedbrown.org/website/ (tedbrown.org/platform now 404).
- **Connie Chan / healthcare**: CAMPAIGN. Campaign themes > 2026 > Campaign websites — "Chan's campaign website stated the following:" (https://ballotpedia.org/Connie_Chan#Campaign_themes). Campaign URL: https://www.conniechansf.com/issues. Live-site check: NOT_ON_CURRENT_PAGE (page now "Connie Chan's Working People's Plan" intro; quoted text absent).
- **Connie Chan / wages**: CAMPAIGN. Campaign themes > 2026 > Campaign websites — "Chan's campaign website stated the following:" (https://ballotpedia.org/Connie_Chan#Campaign_themes). Campaign URL: https://www.conniechansf.com/issues. Live-site check: NOT_ON_CURRENT_PAGE (page now "Connie Chan's Working People's Plan" intro; quoted text absent).
- **Connie Chan / immigration**: CAMPAIGN. Campaign themes > 2026 > Campaign websites — "Chan's campaign website stated the following:" (https://ballotpedia.org/Connie_Chan#Campaign_themes). Campaign URL: https://www.conniechansf.com/issues. Live-site check: NOT_ON_CURRENT_PAGE (page now "Connie Chan's Working People's Plan" intro; quoted text absent).
- **Bo French / energy**: CAMPAIGN. Campaign themes > 2026 > Campaign websites — "French's campaign website stated the following:" (https://ballotpedia.org/Bo_French#Campaign_themes). Campaign URL: https://bofrench.com/issues/. Live-site check: CONFIRMED on live site.
- **Bo French "unnamed survey quote"**: the only scored Bo French Ballotpedia record is the energy quote above, which is campaign-site text, not a survey. A second, unscored record (education, status unsure) is labeled "Ballotpedia: Bo French (candidate survey)" in data/civic/positions_gapfill_batch5civic.json. On https://ballotpedia.org/Bo_French#Campaign_themes it sits under **2016**: "French's campaign website highlighted the following issues:". The footnote cites http://bofrench.com/issues/, accessed Feb 23, 2016. So it is **2016 Texas House campaign-site text, not a survey answer**. See `ballotpedia_stance_audit_extra_unscored.json`.

## Checking campaign quotes on the live sites (36 CAMPAIGN records)

- NOT_ON_CURRENT_PAGE: 10
- CONFIRMED on live site: 14
- UNREACHABLE: 10
- PARTIAL: 1
- CONFIRMED on https: 1

Confirmed live: Nathan Johnson, Chris Gober ×2, Mayes Middleton ×3, Ken Paxton ×3, Ted Brown healthcare, Bo French, Clayton Tucker healthcare and Scott Wiener ×3. The quotes are not on the current page for Connie Chan ×3, Gina Hinojosa ×2, Kevin McCormick ×2, Vikki Goodwin, Clayton Tucker infrastructure and Nate Sheets: those sites were rewritten after Ballotpedia's dated capture, so the live-site check is unsure, but the Ballotpedia attribution and capture date still stand. Steve Hilton is unreachable (JS-only page). The 2014/2016 sites for Casar, Buckingham and Wagner are dead, and archive.org was unreachable from the box. Ted Brown taxes is partial: 32 of 44 four-word sequences are on tedbrown.org/website/, so the wording looks revised.

## Lopsided races

**If BP_VOICE/NOT_FOUND records are dropped, no race becomes lopsided**, because no records fall in those classes after the audit. The lopsidedness is in the **current Engineering gate**, which keeps only 7 records:

| Race | Candidate (party): Engineering gate today / audit keep / audit keep, 2026 text only |
|---|---|
| us-senate-tx | James Talarico (D): 0/5/4; Ken Paxton (R): 0/3/3; Ted Brown (L): 0/4/0 |
| tx-ltgov | Vikki Goodwin (D): 0/3/3; Kevin McCormick (G): 0/3/3; Anthony Cristo (L): 0/3/3 |
| tx-10 | Caitlin Rourk (D): 0/6/6; Chris Gober (R): 0/5/5 |
| ca-treasurer | Eleni Kounalakis (D): 0/2/0; Jennifer Hawks (R): 0/1/1 |
| ca-spi | Richard Barrera (N): 1/2/2 |
| tx-ag | Nathan Johnson (D): 0/3/3; Mayes Middleton (R): 0/3/3 |
| tx-37 | Greg Casar (D): 0/2/0 |
| ca-insurance | Jane Kim (D): 0/2/2; Ben Allen (D): 0/1/1 |
| ca-gov | Steve Hilton (R): 1/5/5 |
| tx-comptroller | Sarah Eckhardt (D): 0/4/1; Don Huffines (R): 0/2/2; Shehla Faizi (G): 0/1/1 |
| tx-land | Dawn Buckingham (R): 0/1/0; Benjamin Flores (D): 0/2/2 |
| tx-rrc | Bo French (R): 0/1/1; Jon Rosenthal (D): 0/3/2; Arthur DiBianca (L): 0/1/1 |
| tx-gov | Gina Hinojosa (D): 0/2/2; Pat Dixon (L): 0/1/1 |
| tx-agcomm | Clayton Tucker (D): 0/2/2; Nate Sheets (R): 0/2/2; Austin R. Kelly (L): 0/1/1 |
| ca-11 | Connie Chan (D): 0/3/3; Scott Wiener (D): 0/3/3 |
| ca-ltgov | Fiona Ma (D): 1/2/2; Gloria J. Romero (R): 1/1/1 |
| ca-ag | Michael Gates (R): 0/1/1 |
| ca-sos | Donald P. Wagner (R): 0/2/0 |
| travis-cad-place-1 | Skyler A. Korgel (N): 3/3/3 |

Today's gate is one-sided in several races. In **ca-gov**, Hilton (R) gets 1 Ballotpedia stance and no Democrat does from this source. In **ca-ltgov**, Ma (D) and Romero (R) each get 1. In tx-* races, everyone gets 0 except Korgel in travis-cad. With the audit labels, every candidate in these races keeps all of their Ballotpedia records.

**Judgment call (stale years):** 16 kept records quote an earlier race, not 2026. They are Talarico wages (2022 CC), Eckhardt ×3 (2022 CC), Kounalakis ×2 (2018 CC), Rosenthal education (2018 CC), Ted Brown ×4 (2022 CC housing; 2024 CC immigration; 2024 site taxes/healthcare), Casar ×2 (2014 site), Buckingham (2016 site) and Wagner ×2 (2014 site). I kept them because the provenance is real, but the chip should show the year. If the rule became "2026 text only", these races would turn lopsided: **ca-treasurer** (Kounalakis D 0 vs Hawks R 1), **tx-land** (Buckingham R 0 vs Flores D 2), **tx-comptroller** (Eckhardt D 1 vs Huffines R 2 and Faizi G 1), **us-senate-tx** (Brown L 0 vs Talarico D 4 and Paxton R 3), and tx-37 / ca-sos, which would have zero Ballotpedia stances.

## Chip and citation rule used
- CC → "Ballotpedia Candidate Connection survey (YEAR)", citing the Ballotpedia page #Campaign_themes.
- CAMPAIGN → "Campaign website (host, YEAR; quoted by Ballotpedia)", citing the campaign URL Ballotpedia attributes (the dead 2014/2016 URLs and the 404 tedbrown.org/platform are flagged in notes; the Ballotpedia page is the fallback citation).
