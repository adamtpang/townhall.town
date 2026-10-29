# ballots.json fixes — Nov 3, 2026 (78701 Austin, 94103 San Francisco)

Sources:
- Travis County bedsheet ballot: https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Final-FINAL.pdf
- SF Voter Information Pamphlet: https://media.api.sf.gov/documents/N26_EN_VIP.pdf (ballot contents at #page=6)
- SF qualified measures: https://www.sf.gov/qualified-ballot-measures

## 78701 — errors
- `measuresNote` says no local measures. Wrong: City of Austin Props A–J are on the ballot (bedsheet pp. 3–4: https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Final-FINAL.pdf#page=3). The statement that there are no TX statewide propositions is correct (https://www.lrl.texas.gov/legis/constAmends/electionDates.cfm, https://www.sos.texas.gov/elections/laws/2026-november-general-election.shtml).
- `tx-land`: "Neil Snider" should be "Neill Snider" (bedsheet p.1).
- `tx-supreme-court-place-1-chief-justice` title: the ballot reads "Chief Justice, Supreme Court" (no "Place 1").
- `tx-10` / `tx-37`: ZIP split. Confirm the district by street address.

## 78701 — missing races (bedsheet p.1 onward)
- TX Supreme Court Place 2, unexpired term: James P. Sullivan (R), Chari Kelly (D)
- 15th Court of Appeals Chief Justice: Scott Brister (R), Jerry Zimmerer (D)
- 15th Court of Appeals Place 2: Scott K. Field (R), Tom Baker (D)
- 15th Court of Appeals Place 3: April Farris (R), Marc M. Meyer (D)
- 3rd Court of Appeals Chief Justice: Cory Liu (R), Darlene Byrne (D)
- State Board of Education District 5: Mica Arellano (R), Allison Bush (D). Verify 78701 is in SBOE 5.
- State Representative District 49: Montserrat Garibay (D), Arshia Papari (G). Verify for 78701.
- Travis County: District Judges (147th, 201st, 250th, 261st, 299th, 331st, 403rd, 419th, 455th, 459th), County Courts at Law 1–7, Probate Court No. 1, County Judge, County Clerk, District Clerk, County Treasurer, County Commissioner (precinct to verify), Justice of the Peace (precinct to verify, likely Pct 5), TCAD Board Places 1–3
- City of Austin Council District 9 (other districts on the ballot: 1, 3, 5, 8)
- Austin ISD trustees: Districts 1, 4, 6, 7 and At-Large Position 9 (district for 78701 to verify)
- ACC trustees, Places 1–3
- No State Senate race for 78701: only SD21 is up, and 78701 is in SD14.

## 78701 — missing measures
- City of Austin Props A–J (bedsheet #page=3 and #page=4). Bond figures for A and B: https://services.austintexas.gov/edims/document.cfm?id=482565
  - A: $260M parks/recreation/aquatic/open space bonds ("THIS IS A TAX INCREASE")
  - B: $35M library bonds ("THIS IS A TAX INCREASE")
  - C: ICRC independence and changes; D: delete weekly Council meeting requirement; E: delete rules-by-ordinance requirement; F: define "election" and set Jan 1 campaign-limit adjustment; G: initiative and petitioned charter elections on next even-year November date; H: Council appoints and removes City Attorney; I: Independent Affordability and Efficiency Initiative; J: non-substantive corrections
- AISD has no propositions. ACC Prop A (Pflugerville ISD annexation) does not apply to 78701.

## 94103 — errors / notes
- `ca-11`: SF is split between CA-11 and CA-15 (VIP #page=6); 94103 is likely CA-11. Keep the verify note.
- `measuresNote` says local measures aren't included. 11 local measures are on the ballot (listed below).

## 94103 — missing races (VIP https://media.api.sf.gov/documents/N26_EN_VIP.pdf#page=6; office descriptions at #page=25)
- Board of Equalization District 2
- State Assembly District 17 (likely for 94103; AD19 covers other parts of SF)
- Retention: Associate Justices of the CA Supreme Court (Joshua Groban, Kelli M. Evans) and Presiding and Associate Justices of the Court of Appeal, First District
- Board of Education (3 seats)
- Community College Board (3 full-term seats plus 1 unexpired term)
- Assessor-Recorder (ranked choice)
- Public Defender (ranked choice)
- Board of Supervisors District 6 (even districts 2, 4, 6, 8, 10 are up; verify whether any 94103 addresses fall in D8)
- BART: only District 8 is up. 94103 likely has no BART contest; verify.
- No State Senate race.

## 94103 — missing measures (VIP; PDF page anchors)
- Regional Transit Measure (RTM) #page=54
- Prop A #page=66, B #page=72, C #page=80, D #page=86, E #page=96, F #page=102, G #page=110, H #page=126, I #page=134, J #page=146
