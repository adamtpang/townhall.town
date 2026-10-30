# Civic QA fixes 7 (preview df0cb76), Oct 30, 2026

Machine-readable: `civic/qa_fixes7.json`. Repo paths are relative to the townhall repo root.

## 1. P1: voter-visible unsure notes
- 36 rendered notes rewritten (35 unsure + 1 sourced summary that renders as 'Summary:'), plus 8 non-rendered source copies cleaned so a re-run can't bring old text back.
- **Old text goes to `editorNote` in the data/civic gap-fill files. Do not render editorNote and do not copy it into data/stances.json.**
- Civic's `positions_gapfill_batch3civic.json` is already updated (copy it over); batch2/3/4 edits are listed below for Engineering.
- Allison Bush education: added as unsure with override:true (replaces -3), same standard as Kirk Becker's all-charter proposal.

| id | issue | rendered | new summary | where |
|---|---|---|---|---|
| sarah-eckhardt | taxes | yes | Names no tax level, and the same source notes she has also lowered property taxes, so the direction is unclear. | data/civic/positions_gapfill_batch4.json ["sarah-eckhardt"]["unsure"][0]<br>data/stances.json stances["sarah-eckhardt"]["taxes"].summary |
| ted-brown | infrastructure | yes | Calls for cuts across the whole federal budget; says nothing specific about infrastructure spending. | data/civic/positions_gapfill_batch4.json ["ted-brown"]["unsure"][0]<br>data/stances.json stances["ted-brown"]["infrastructure"].summary |
| ted-brown | wages | yes | States a general free-market view; takes no position on wage levels or the minimum wage. | data/civic/positions_gapfill_batch4.json ["ted-brown"]["unsure"][1]<br>data/stances.json stances["ted-brown"]["wages"].summary |
| don-huffines | wages | yes | Campaign text opposes regulation in general; takes no position on wage levels or the minimum wage. | data/civic/positions_gapfill_batch4.json ["don-huffines"]["unsure"][0]<br>data/stances.json stances["don-huffines"]["wages"].summary |
| tom-oxford | healthcare | yes | Refers to the state staying out of personal health decisions, not to the government's role in paying for care. | data/civic/positions_gapfill_batch2.json ["tom-oxford"]["unsure"][0]<br>data/stances.json stances["tom-oxford"]["healthcare"].summary |
| austin-r-kelly | energy | yes | Campaign site lists a heading on data centers with no position text under it, so the direction on energy is unclear. | data/civic/positions_gapfill_batch3civic.json ["austin-r-kelly"]["unsure"][0]<br>data/stances.json stances["austin-r-kelly"]["energy"].summary |
| jessica-martinez | education | yes | Campaign site focuses on academic excellence, workforce programs and parents' rights; no position on public money for private schools. | data/civic/positions_gapfill_batch2.json ["jessica-martinez"]["unsure"][0]<br>data/stances.json stances["jessica-martinez"]["education"].summary |
| allison-bush | wages | yes | Supports higher teacher pay. That is public-employee pay, not a position on wage policy for other employers. | data/civic/positions_gapfill_batch3civic.json ["allison-bush"]["unsure"][0]<br>data/stances.json stances["allison-bush"]["wages"].summary |
| allison-bush | education | yes | Opposes unlimited charter-school expansion; charter schools are public schools, so this isn't scored on the private-school-funding question. | data/stances.json stances["allison-bush"]["education"].summary<br>(new override item in batch3civic) |
| mica-arellano | taxes | yes | Wants every tax dollar focused on students rather than bureaucracy; no position on tax levels. | data/civic/positions_gapfill_batch3civic.json ["mica-arellano"]["unsure"][0]<br>data/stances.json stances["mica-arellano"]["taxes"].summary |
| katie-kam | infrastructure | yes | Would cancel Project Connect light rail and consider a monorail, and opposes highway expansions; mixed on overall spending. | data/civic/positions_gapfill_batch2.json ["katie-kam"]["unsure"][0]<br>data/stances.json stances["katie-kam"]["infrastructure"].summary |
| zohaib-zo-qadri | energy | yes | Opposes new data centers that use large amounts of water and power, framed around resources and residents' bills rather than environment vs. development. | data/civic/positions_gapfill_batch2.json ["zohaib-zo-qadri"]["unsure"][0]<br>data/stances.json stances["zohaib-zo-qadri"]["energy"].summary |
| dave-thadani | taxes | yes | Criticizes "irresponsible city spending" but takes no position on tax levels. | data/civic/positions_gapfill_batch2.json ["dave-thadani"]["unsure"][1]<br>data/stances.json stances["dave-thadani"]["taxes"].summary |
| dave-thadani | safety | yes | Campaign site supports "a proactive police presence"; a League of Women Voters guide answer says "rework police presence". The direction is unclear. | data/civic/positions_gapfill_batch2.json ["dave-thadani"]["unsure"][0]<br>data/stances.json stances["dave-thadani"]["safety"].summary |
| kai-huang | infrastructure | yes | Wants a cost review and budget cap for light rail, but also "better buses, signals and sidewalks now"; mixed on spending. | data/civic/positions_gapfill_batch2.json ["kai-huang"]["unsure"][0]<br>data/stances.json stances["kai-huang"]["infrastructure"].summary |
| kirk-becker | education | yes | Proposes moving all AISD students to charter schools; charter schools are public schools, so this isn't scored on the private-school-funding question. | data/civic/positions_gapfill_batch2.json ["kirk-becker"]["unsure"][0]<br>data/civic/positions_gapfill_batch3civic.json ["kirk-becker"]["unsure"][0]<br>data/stances.json stances["kirk-becker"]["education"].summary |
| dana-walker | wages | yes | Wants college workforce partnerships that lead to living-wage local jobs; not a position on government wage policy. | data/civic/positions_gapfill_batch3civic.json ["dana-walker"]["unsure"][1]<br>data/stances.json stances["dana-walker"]["wages"].summary |
| dana-walker | taxes | yes | Wants free tuition expanded once finances are stable, and notes college money comes from students and taxpayers; no position on tax levels. | data/civic/positions_gapfill_batch3civic.json ["dana-walker"]["unsure"][0]<br>data/stances.json stances["dana-walker"]["taxes"].summary |
| trevor-hale | taxes | yes | Likes the idea of free tuition but doubts it works; no position on tax levels. | data/civic/positions_gapfill_batch3civic.json ["trevor-hale"]["unsure"][0]<br>data/stances.json stances["trevor-hale"]["taxes"].summary |
| nan-mcraven | taxes | yes | Says the state should earmark money for community colleges; no position on local tax levels. | data/civic/positions_gapfill_batch3civic.json ["nan-mcraven"]["unsure"][0]<br>data/stances.json stances["nan-mcraven"]["taxes"].summary |
| yvonne-munoz | taxes | yes | Speaks generally about using taxpayer resources responsibly; no position on tax levels. | data/civic/positions_gapfill_batch3civic.json ["yvonne-munoz"]["unsure"][0]<br>data/stances.json stances["yvonne-munoz"]["taxes"].summary |
| sonja-shaw | safety | yes | About student discipline in schools, pairing accountability with support at home; not a position on public-safety policy. | data/civic/positions_gapfill_batch4.json ["sonja-shaw"]["unsure"][0]<br>data/stances.json stances["sonja-shaw"]["safety"].summary |
| joaquin-torres | taxes | yes | "Every property owner should pay their fair share" is about collecting what is already owed, not about tax levels. | data/civic/positions_gapfill_batch3civic.json ["joaquin-torres"]["unsure"][0]<br>data/stances.json stances["joaquin-torres"]["taxes"].summary |
| ellsworth-ell-m-jennison-jr | housing | yes | A KQED voter-guide paraphrase includes the words "not housing" without clear context; the direction is unclear. | data/civic/positions_gapfill_batch3.json ["ellsworth-ell-m-jennison-jr"]["unsure"][1]<br>data/stances.json stances["ellsworth-ell-m-jennison-jr"]["housing"].summary |
| ellsworth-ell-m-jennison-jr | wages | yes | A KQED voter-guide paraphrase says he favors higher teacher wages; these are not his own words. | data/civic/positions_gapfill_batch3.json ["ellsworth-ell-m-jennison-jr"]["unsure"][0]<br>data/stances.json stances["ellsworth-ell-m-jennison-jr"]["wages"].summary |
| jamo-muhammad | safety | yes | Stresses community-led violence reduction and criticizes police taking credit; no position on police funding vs. prevention. | data/civic/positions_gapfill_batch2.json ["jamo-muhammad"]["unsure"][0]<br>data/stances.json stances["jamo-muhammad"]["safety"].summary |
| autumn-brown-garibay | education | yes | Wants families to "choose public school on purpose"; no position on public money for private schools. | data/civic/positions_gapfill_batch3civic.json ["autumn-brown-garibay"]["unsure"][0]<br>data/stances.json stances["autumn-brown-garibay"]["education"].summary |
| phil-kim | safety | yes | Supports more training and coordination for school security staff; not a position on public-safety policy. | data/civic/positions_gapfill_batch3civic.json ["phil-kim"]["unsure"][0]<br>data/stances.json stances["phil-kim"]["safety"].summary |
| rome-moses-jones | wages | yes | Supports livable wages for the college's own child-care staff and educators. That is public-employee pay, not a position on wage policy for other employers. | data/civic/positions_gapfill_batch4.json ["rome-moses-jones"]["unsure"][0]<br>data/stances.json stances["rome-moses-jones"]["wages"].summary |
| leah-lacroix | taxes | yes | Supports Free City and the grant program and opposes cuts; does not name a tax or tax level. | data/civic/positions_gapfill_batch4.json ["leah-lacroix"]["unsure"][0]<br>data/stances.json stances["leah-lacroix"]["taxes"].summary |
| bunny-mcfadden | taxes | yes | Proposes funding through enrollment, partnerships and grants; does not name a tax or tax level. | data/civic/positions_gapfill_batch4.json ["bunny-mcfadden"]["unsure"][0]<br>data/stances.json stances["bunny-mcfadden"]["taxes"].summary |
| erwin-tam | infrastructure | yes | Opposes selling the college's Downtown Center; about keeping a property, not spending levels. | data/civic/positions_gapfill_batch3civic.json ["erwin-tam"]["unsure"][0]<br>data/stances.json stances["erwin-tam"]["infrastructure"].summary |
| lauren-b-pena | immigration | yes | Supports lawful pathways, faster case processing and keeping families together while "protecting American sovereignty"; mixed direction. | data/civic/positions_gapfill_batch2.json ["lauren-b-pena"]["unsure"][0]<br>data/stances.json stances["lauren-b-pena"]["immigration"].summary |
| gabriel-padilla | safety | yes | Focuses on trust and transparency between law enforcement and residents; no position on prevention vs. enforcement. | data/civic/positions_gapfill_batch3civic.json ["gabriel-padilla"]["unsure"][0]<br>data/stances.json stances["gabriel-padilla"]["safety"].summary |
| brian-pena | taxes | yes | Promises responsible stewardship of tax dollars and accurate commercial appraisals; no position on tax levels. | data/civic/positions_gapfill_batch3civic.json ["brian-pena"]["unsure"][0]<br>data/stances.json stances["brian-pena"]["taxes"].summary |
| lauren-b-pena | healthcare | yes | Favors market approaches: selling insurance across state lines, more health savings accounts and fewer regulations, while protecting patients with preexisting conditions. | data/civic/positions_gapfill_batch2.json ["lauren-b-pena"]["stances"][2]<br>data/stances.json stances["lauren-b-pena"]["healthcare"].summary |
| dana-walker | taxes | no | Backs expanding free tuition while saying the college must "scrutinize operations and spending"; no position on tax levels. | data/civic/positions_gapfill_batch2.json ["dana-walker"]["unsure"][0] |
| trevor-hale | taxes | no | Calls raising property taxes "abhorrent" but adds "If we want good things, we need to pay for them." The direction is unclear. | data/civic/positions_gapfill_batch2.json ["trevor-hale"]["unsure"][0] |
| dana-walker | taxes | no | Talks about protecting taxpayers' money; no position on tax levels. | data/civic/positions_gapfill_batch3.json ["dana-walker"]["unsure"][0] |
| gloria-gonzales-dholakia | taxes | no | "Ensure responsible stewardship of precious taxpayer investments": no position on tax levels. | data/civic/positions_gapfill_batch3civic.json ["gloria-gonzales-dholakia"]["unsure"][0] |
| monroe-lace | taxes | no | Says the board must prepare for the parcel tax expiring in 2032; does not say whether to renew or raise it. | data/civic/positions_gapfill_batch3civic.json ["monroe-lace"]["unsure"][0] |
| george-morales-iii | taxes | no | Official vote: recorded FOR the FY2027 county tax rate of $0.386210, above the no-new-revenue rate and equal to the voter-approval rate (a property tax increase). | data/civic/positions_gapfill_batch2.json ["george-morales-iii"]["stances"][0] |
| dana-walker | wages | no | Cites raising wages for the college's own employees. That is public-employee pay, not a position on wage policy for other employers. | data/civic/positions_gapfill_batch4.json ["dana-walker"]["unsure"][0] |
| andy-brown | taxes | no | Official vote: recorded FOR the proposed FY2027 county tax rate of $0.386210, above the no-new-revenue rate and equal to the voter-approval rate (a property tax increase). | data/civic/positions_gapfill_batch3.json ["andy-brown"]["stances"][0] |

Old text (now editorNote) for each row is in the JSON (`old`, `editorNote`).

**Merge conflicts:**
- dana-walker wages: the worktree shows batch3civic's item, but batch4's item has override:true and wins on a full re-run (quote 'Raised wages for ACC employees'). Each now has a summary matching its own quote. Engineering/Adam should pick one; Civic suggests batch3civic (her own campaign-site words).
- kirk-becker education: a re-run switches the quote/source to batch3civic's Community Impact quote; the summary works for both.

## 2. Weber infrastructure
- `data/stances.json` stances["shirley-n-weber"]["infrastructure"]: set to `{"value": null, "status": "No public statement found"}`
- `data/civic/positions_94103_batch1.json` stances["shirley-weber"]["infrastructure"]: set to `{"value": null, "status": "No public statement found"}`
- `data/quote_years.json` years["shirley-n-weber.infrastructure"]: delete the key
- The same SB 1 roll-call vote is already Weber's taxes entry; one vote, one issue. The API and card already hide it at runtime (QA P2-C1), so removing it changes nothing visible. Also check that data/civic/photos.json, data/accountability.json and data/sources-checked.json don't re-add it (they mention Weber but are not stance sources).

## 3. NY notes (≤200 chars, TENTATIVE + vote.nyc kept)

| race | data/ny-applies-notes.json byRace (new) | len | appliesNote in ballots_additions.json + ny.json (new) | rendered len |
|---|---|---|---|---|
| ny-surrogate-ny | Source: NYC Board of Elections contest list (vote.nyc), printed 9/11/2026 and still marked TENTATIVE. No final list as of Oct 30. Contest: Surrogate, New York County, 1 seat. | 174 | Source is the NYC BOE contest list (TENTATIVE, 9/11/2026) | 174 |
| ny-civil-county-ny | Source: NYC Board of Elections contest list (vote.nyc), printed 9/11/2026 and still marked TENTATIVE. No final list as of Oct 30. Contest: Civil Court, New York County, 3 seats. | 177 | Source is the NYC BOE contest list (TENTATIVE, 9/11/2026) | 177 |
| ny-civil-3md-ny | Source: NYC BOE list (vote.nyc), 9/11/2026, still TENTATIVE. Contest: Civil Court, 3rd Municipal Court District, 1 seat. | 120 | SPLIT: ~70.6% of 10001 (ZCTA) is in the 3rd Municipal Court District. Source: NYC BOE contest list (TENTATIVE, 9/11/2026) | 190 |
| ny-civil-9md-ny | Source: NYC BOE list (vote.nyc), 9/11/2026, still TENTATIVE. Contest: Civil Court, 9th Municipal Court District, 2 seats. | 121 | SPLIT: ~29.4% of 10001 (ZCTA) is in the 9th Municipal Court District. Source: NYC BOE contest list (TENTATIVE, 9/11/2026) | 191 |
| nyc-council-3 | Source: NYC BOE list (vote.nyc), 9/11/2026, still TENTATIVE. Contest: 1 seat; unclear if a special election. | 108 | SPLIT: ~95.1% of 10001 (ZCTA) is in Council District 3; the rest (CD4) has no 2026 race. Source: NYC BOE contest list (TENTATIVE, 9/11/2026) | 197 |

## 4. Photo credits (Commons)
- Policy: Use a real name only when the Commons file page states it; otherwise 'Photo: Wikimedia Commons user <username>'. Reason in creditBasis per entry.
- james-talarico: `Photo: Antonioaesparza` → `Photo: Wikimedia Commons user Antonioaesparza`
- vikki-goodwin: `Photo: Cole-Wilson-93` → `Photo: Wikimedia Commons user Cole-Wilson-93`
- kevin-mccormick: `Photo: WikiBunny2K1` → `Photo: Wikimedia Commons user WikiBunny2K1`
- jon-rosenthal: `Photo: Scriptrix101` → `Photo: Wikimedia Commons user Scriptrix101`
- scott-brister: `Photo: AndrewsKurth` → `Photo: Wikimedia Commons user AndrewsKurth`
- elisabeth-earle: `Photo: DustDevil22039` → `Photo: Wikimedia Commons user DustDevil22039`
- trevor-hale: `Photo: Bhkdynamo` → `Photo: Wikimedia Commons user Bhkdynamo`
- caroline-shinkle: `Photo: AidansStuff` → `Photo: Wikimedia Commons user AidansStuff`
- thomas-p-dinapoli: kept; Credit kept as "Office of NYS Comptroller": the Commons description reads "Tom DiNapoli's official headshot. Source: OSC" and the credit links osc.state.ny.us (an organization stated on the page, not a username).

## 5. Photo parity
Sources tried in this order: campaign site, official page, own social. Every localFile was viewed and checked against earlier photos to confirm identity. Full details are in `civic/photos_batch.md` (QA7 section) and `civic/qa7_photo_changes.json`.

- **steve-hilton** (ca-gov) `photo`: {"photoUrl": "https://stevehiltonforgovernor.com/photos/portrait-street.jpg", "localFile": "/workspace/townhall/civic/photos_local/steve-hilton.jpg", "attribution": "Photo: Steve Hilton campaign site", "photoYear": null}
- **gina-hinojosa** (tx-gov) `photo`: {"photoUrl": "https://ginafortexas.com/wp-content/uploads/2026/05/GH-Launch-AB-Meta-1200x630-3.png", "localFile": "/workspace/townhall/civic/photos_local/gina-hinojosa.jpg", "attribution": "Photo: Gina Hinojosa campaign site", "photoYear": null}
- **jane-kim** (ca-insurance) `photo`: {"photoUrl": "https://run.imgix.net/86daf947-8fea-4921-83be-74f03c8a9ad0/d1d3e93b-3b90-464f-9b0b-4aeae3a2a64e/d1d3e93b-3b90-464f-9b0b-4aeae3a2a64e.jpg?ixlib=js-3.8.0&bri=0&con=0&sat=0&high=0&shad=0&usm=0&rect=0%2C0%2C3000%2C2001&w=1500&s=ce67458ce7dd216d01060919696bd02a", "localFile": "/workspace/townhall/civic/photos_local/jane-kim.jpg", "attribution": "Photo: Jane Kim campaign site", "photoYear"
- **clayton-tucker** (tx-agcomm) `photo`: {"photoUrl": "https://assets.nationbuilder.com/cht/pages/2030/meta_images/original/default-image-3.jpg?1777483964", "localFile": "/workspace/townhall/civic/photos_local/clayton-tucker.jpg", "attribution": "Photo: Clayton Tucker campaign site", "photoYear": null}
- **michael-e-gates** (ca-ag) `photo`: {"photoUrl": "https://irp.cdn-website.com/81d43f61/dms3rep/multi/opt/bannerv2-1920w.png", "localFile": "/workspace/townhall/civic/photos_local/michael-e-gates.jpg", "attribution": "Photo: Michael E. Gates campaign site", "photoYear": null}
- **xavier-becerra** (ca-gov) `cropNote,parity`: {"cropNote": "Already a formal front-facing portrait (HHS, 2021) but framed to mid-chest; crop to head and shoulders: keep the top ~75% of the frame, centred on the face, to match Hilton's localFile.", "parity": "ca-gov: formal portrait; comparable after cropNote"}
- **greg-abbott** (tx-gov) `cropNote,parity`: {"cropNote": "Front-facing head and shoulders (NASA 2024, already cropped); a person is partly visible behind him at top right: crop to the central ~80% width to remove them.", "parity": "tx-gov: head and shoulders; comparable"}
- **pat-dixon** (tx-gov) `parity`: {"parity": "tx-gov: campaign headshot, front-facing head and shoulders; comparable as is"}
- **ben-allen** (ca-insurance) `parity`: {"parity": "ca-insurance: formal portrait; comparable with the new Jane Kim headshot"}
- **rob-bonta** (ca-ag) `parity`: {"parity": "ca-ag: official portrait; comparable with the new Gates photo"}
- **nate-sheets** (tx-agcomm) `localFile,cropNote,parity`: {"localFile": "/workspace/townhall/civic/photos_local/nate-sheets.jpg", "cropNote": "photoUrl is a waist-up photo inside a hexagon mask with white seam lines across the torso; localFile is the PNG version (Nate-Sheets-2.png, 785x796) cropped to (300,112,494,340) -> 194x228, head and shoulders above the seams (low resolution; display at <=190px)", "parity": "tx-agcomm: own campaign photo cropped to
- **austin-r-kelly** (tx-agcomm) `localFile,cropNote,parity`: {"localFile": "/workspace/townhall/civic/photos_local/austin-r-kelly-headshoulders.jpg", "cropNote": "localFile is the saved campaign image (1080x1078) cropped to (0,0,490,612): head and shoulders, campaign logo excluded. Original saved copy: photos_local/austin-r-kelly.jpg", "parity": "tx-agcomm: field selfie, front-facing; comparable after crop"}
- **kai-huang** (austin-council-9) `parity`: "UNRESOLVED (QA7): austin-council-9: kai4atx.com has only kai-hero.jpg (speaking with neighbors) and kai-gameday.jpg (two-person photo); no headshot. Keep cropNote; opponents are headshots."
- **liz-krueger** (ny-sd-28) `parity`: "UNRESOLVED (QA7): ny-sd-28: official nysenate.gov page returned 403 to scripted requests; Commons alternatives are older (2009 event) or event photos. Crop the 2019 session photo to head and shoulders."
- **kathy-c-hochul-adrienne-e-adams** (ny-governor) `parity`: "UNRESOLVED (QA7): ny-governor: the formal official portrait on Commons is from 2011 (US Congress); using it would put the race outside the 6-year photo-age rule (Blakeman 2022) and switch the race to initials. governor.ny.gov returned 403. Keep the 2026 MTA photo; crop to head and shoulders."

## 6. Texas courts
All 16 candidates in QA's 8 races have a photo in photos_batch.json:
- tx-supreme-court-place-1-chief-justice: jimmy-blacklock ✓, maggie-ellis ✓
- tx-supreme-court-place-2: james-p-sullivan ✓, chari-kelly ✓
- tx-supreme-court-place-7: kyle-hawkins ✓, kristen-hawkins ✓
- tx-supreme-court-place-8: brett-busby ✓, gisela-d-triana ✓
- tx-court-of-criminal-appeals-place-4: kevin-patrick-yeary ✓, audra-riley ✓
- tx-15th-coa-place-2: scott-k-field ✓, tom-baker ✓
- tx-15th-coa-place-3: april-farris ✓, marc-m-meyer ✓
- tx-3rd-coa-chief-justice: cory-liu ✓, darlene-byrne ✓
- Tom Baker (tx-15th-coa-place-2) is still a hotlink that returned 202 text/html (bot challenge) at ~02:31 CT; no localFile could be saved. Engineering should self-host or retry from a browser.
- Outside the 8: tx-court-of-criminal-appeals-place-3 has no photo for Mark Ash, so the all-or-none gate shows initials there.
