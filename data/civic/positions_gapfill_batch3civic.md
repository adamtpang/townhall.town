# Positions gap-fill batch 3 (civic) (as of Oct 30, 2026)

Baseline is feat2 @df0cb76 data/stances.json. "Sourced" = numeric, nonzero value (lib/overlapCore.mjs, MIN_ISSUES=2). Judicial races skipped. Not to be confused with Engineering's data/civic/positions_gapfill_batch3.json ("QA fixes 4"); nothing here duplicates it.

| ZIP | Race | Candidate (id) | Before | After | Reaches 2? | New issues | Unsure (not scored) |
|---|---|---|---|---|---|---|---|
| 78701 | Attorney General of Texas | Tom Oxford (`tom-oxford`) | 1 | 1 | **no** | - | - |
| 78701 | Texas Comptroller of Public Accounts | V. Alonzo Echavarria-Garza (`v-alonzo-echavarria-garza`) | 0 | 0 | **no** | - | - |
| 78701 | Texas Commissioner of Agriculture | Austin R. Kelly (`austin-r-kelly`) | 1 | 1 | **no** | - | energy |
| 78701 | State Board of Education District 5 | Allison Bush (`allison-bush`) | 1 | 1 | **no** | - | wages |
| 78701 | State Board of Education District 5 | Mica Arellano (`mica-arellano`) | 0 | 0 | **no** | - | taxes |
| 78701 | County Clerk | Dyana Limon-Mercado (`dyana-limon-mercado`) | 0 | 0 | **no** | - | - |
| 78701 | District Clerk | Velva L. Price (`velva-l-price`) | 0 | 0 | **no** | - | - |
| 78701 | County Treasurer | Dolores Ortega Carter (`dolores-ortega-carter`) | 0 | 0 | **no** | - | - |
| 78701 | Travis County Commissioner, Precinct 4 | George Morales III (`george-morales-iii`) | 1 | 5 | yes | healthcare +3, housing +3, infrastructure +3, safety -2 | - |
| 78701 | County Constable, Precinct 4 - Unexpired Term | Gabriel Padilla (`gabriel-padilla`) | 0 | 0 | **no** | - | safety |
| 78701 | Travis Central Appraisal District Board of Directors, Place 1 | Skyler A. Korgel (`skyler-a-korgel`) | 0 | 3 | yes | housing +2, infrastructure +2, taxes +3 | - |
| 78701 | Travis Central Appraisal District Board of Directors, Place 2 | Brian Peña (`brian-pena`) | 0 | 0 | **no** | - | taxes |
| 78701 | Travis Central Appraisal District Board of Directors, Place 3 | Yvonne Muñoz (`yvonne-munoz`) | 0 | 0 | **no** | - | taxes |
| 78701 | Travis Central Appraisal District Board of Directors, Place 3 | Phil Gorman (`phil-gorman`) | 0 | 1 | **no** | taxes -3 | - |
| 78701 | Austin ISD Board of Trustees, At-Large Position 9 | Kirk Becker (`kirk-becker`) | 1 | 1 | **no** | - | education |
| 78701 | Austin Community College Board of Trustees, Place 1 | Dana Walker (`dana-walker`) | 0 | 0 | **no** | - | taxes, wages |
| 78701 | Austin Community College Board of Trustees, Place 1 | Gloria Gonzales-Dholakia (`gloria-gonzales-dholakia`) | 1 | 1 | **no** | - | taxes |
| 78701 | Austin Community College Board of Trustees, Place 2 | Gigi Edwards Bryant (`gigi-edwards-bryant`) | 0 | 0 | **no** | - | - |
| 78701 | Austin Community College Board of Trustees, Place 3 | Trevor Hale (`trevor-hale`) | 0 | 0 | **no** | - | taxes |
| 78701 | Austin Community College Board of Trustees, Place 3 | Nan McRaven (`nan-mcraven`) | 0 | 0 | **no** | - | taxes |
| 94103 | State Assembly Member District 17 | Manuel Noris-Barrera (`manuel-noris-barrera`) | 1 | 1 | **no** | - | - |
| 94103 | Assessor-Recorder | Joaquin Torres (`joaquin-torres`) | 1 | 1 | **no** | - | taxes |
| 94103 | Board of Supervisors, District 10 | Ellsworth "Ell" M. Jennison, Jr. (`ellsworth-ell-m-jennison-jr`) | 1 | 1 | **no** | - | - |
| 94103 | Board of Supervisors, District 10 | Jamo Muhammad (`jamo-muhammad`) | 1 | 1 | **no** | - | - |
| 94103 | Board of Education (choose up to 3) | Autumn Brown Garibay (`autumn-brown-garibay`) | 0 | 0 | **no** | - | education |
| 94103 | Board of Education (choose up to 3) | Phil Kim (`phil-kim`) | 1 | 1 | **no** | - | safety |
| 94103 | Community College Board (choose up to 3) | Rome Moses Jones (`rome-moses-jones`) | 1 | 1 | **no** | - | - |
| 94103 | Community College Board (choose up to 3) | Monroe Lace (`monroe-lace`) | 1 | 1 | **no** | - | taxes |
| 94103 | Community College Board (choose up to 3) | Erwin Tam (`erwin-tam`) | 1 | 1 | **no** | - | infrastructure |
| 94103 | Community College Board (choose up to 3) | Lisa Wynn (`lisa-wynn`) | 0 | 0 | **no** | - | - |

## Notes per candidate

- **Tom Oxford** (Libertarian): No new axis. Still 1 sourced issue (immigration). Sources checked: 7.
- **V. Alonzo Echavarria-Garza** (Libertarian): No public record of policy positions found as of Oct 30, 2026. Stays at 0. Sources checked: 6.
- **Austin R. Kelly** (Libertarian): No new axis; still 1 (taxes). Data-center section body could not be read. Sources checked: 5.
- **Allison Bush** (Democratic): No new axis; still 1 (education). Sources checked: 2.
- **Mica Arellano** (Republican): Campaign site found this pass but has no scorable axis statement. Stays at 0. Sources checked: 4.
- **Dyana Limon-Mercado** (Democratic): Unopposed. No tracked-axis statement found. Sources checked: 2.
- **Velva L. Price** (Democratic): Unopposed. No tracked-axis statement found. Sources checked: 3.
- **Dolores Ortega Carter** (Democratic): Unopposed. No campaign site or statements found. Sources checked: 2.
- **George Morales III** (Democratic): 1 -> 5. Taxes remains the existing voteRecord. Campaign-site text is written in third person by the campaign; counted as the candidate's own site per verification_rule.md. Unopposed in November, so no grade effect. Sources checked: 2.
- **Gabriel Padilla** (Democratic): Unopposed. Stays at 0. Sources checked: 1.
- **Skyler A. Korgel** (Nonpartisan): 0 -> 3. Unopposed, so no grade effect. Sources checked: 3.
- **Brian Peña** (Nonpartisan): Unopposed. Stays at 0. Sources checked: 3.
- **Yvonne Muñoz** (Nonpartisan): Stays at 0. Sources checked: 3.
- **Phil Gorman** (Nonpartisan): 0 -> 1. Bulldog (Aug 24, 2026) reports none of the four TCAD candidates had a campaign website at that time. Sources checked: 3.
- **Kirk Becker** (Nonpartisan): Still 1 (taxes). See education asymmetry note. Sources checked: 3.
- **Dana Walker** (Nonpartisan): Stays at 0. Sources checked: 5.
- **Gloria Gonzales-Dholakia** (Nonpartisan): Still 1 (taxes). Sources checked: 4.
- **Gigi Edwards Bryant** (Nonpartisan): Unopposed. Stays at 0. Sources checked: 2.
- **Trevor Hale** (Nonpartisan): Stays at 0. Sources checked: 3.
- **Nan McRaven** (Nonpartisan): Stays at 0. Sources checked: 3.
- **Manuel Noris-Barrera** (Republican): No new axis. Still 1 (taxes). Sources checked: 3.
- **Joaquin Torres** (Nonpartisan): Still 1 (housing). Sources checked: 4.
- **Ellsworth "Ell" M. Jennison, Jr.** (Nonpartisan): Still 1 (energy). No campaign site exists per earlier passes. Sources checked: 1.
- **Jamo Muhammad** (Nonpartisan): Still 1 (energy). Sources checked: 1.
- **Autumn Brown Garibay** (Nonpartisan): Stays at 0. Sources checked: 1.
- **Phil Kim** (Nonpartisan): Still 1 (housing). Sources checked: 3.
- **Rome Moses Jones** (Nonpartisan): Still 1 (housing). Sources checked: 1.
- **Monroe Lace** (Nonpartisan): Still 1 (taxes). Sources checked: 3.
- **Erwin Tam** (Nonpartisan): Still 1 (taxes). Sources checked: 2.
- **Lisa Wynn** (Nonpartisan): Stays at 0. Earlier Guardsman interview has no axis-mappable quote. Sources checked: 1.

## Party balance

- The same source types were tried for every candidate: Ballotpedia page/survey, campaign site, local news Q&As/interviews, voter guides (LWV, GrowSF, Community Impact, KUT), party/slate pages.
- New scored stances: Korgel (D-slate, 3), Morales (D, 4), Gorman (filed as the Republican per the Austin Bulldog, 1). All three come from the candidates' own surveys/sites or a direct interview.
- Libertarian and Republican statewide/SBOE candidates (Oxford, Echavarria-Garza, Kelly, Arellano) and Noris-Barrera (R, SF AD17) have thin public records: no surveys, questionnaires unanswered, sites with no axis statements. Their gaps reflect missing public material, not less search effort; each has its checks listed.
- Possible scoring asymmetry (not changed here): Allison Bush (D, SBOE) is scored education -3 for opposing charter expansion, while Kirk Becker's (AISD) plan to convert all schools to charters was left unscored in batch2 because Texas charters are public schools. Editorial decision needed so both sides of the charter question are treated alike.

