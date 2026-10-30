# Ballot order check: 78701, 94103, 10001

Generated 2026-10-30. The JSON has one row per race: `ballot_order_check.json`. Official order was taken from pdftotext (-layout / -bbox) of the PDFs listed.

| ZIP | Races | MATCH | MISMATCH | Single-name (trivial) | UNCONFIRMED |
|---|---|---|---|---|---|
| 78701 | 58 | 48 | 10 | 0 | 0 |
| 94103 | 32 | 0 | 0 | 13 | 19 |
| 10001 | 13 | 5 | 1 | 0 | 7 |

## Sources

- **78701:** Travis County sample (bedsheet) ballot, https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Corrected-Final2.pdf (pp. 1–3, 7).
- **94103:** SF Voter Information Pamphlet, https://media.api.sf.gov/documents/N26_EN_VIP.pdf. It has **no sample-ballot candidate list**. On PDF p.24 it says "For a complete list of candidates for each contest, please refer to your Sample Ballot". The ballot worksheet (pp.248–249) lists only contest names and the justices' retention questions.
- **10001:** an official NYC BOE ballot PDF for New York County AD71 (styles 0315/0879, stamped 2026-09-21), https://img1.wsimg.com/isteam/ip/eb67ae7b-312c-407d-a59a-c4b41353c238/71AD_SampleBallot_Nov2026.pdf. **Caveat:** it is hosted on a third-party site, not vote.nyc. I used it only for contests that are the same on every New York County ballot: Governor, Comptroller, AG, Surrogate, 1st JD Supreme Court, and Civil Court–County. I could not get an AD75 ballot. vote.nyc sample ballots are only available through the findmypollsite.vote.nyc address lookup, which is JS-only, and its address API answered "You are not authorized to perform this request". I did not try to get around that.

## Mismatches

- **78701 `tx-10`** (p.1): official = Chris Gober (REP), Caitlin Rourk (DEM); data = Caitlin Rourk, Chris Gober
- **78701 `tx-37`** (p.1): official = Lauren B. Peña (REP), Greg Casar (DEM); data = Greg Casar, Lauren B. Peña
- **78701 `us-senate-tx`** (p.1): official = Ken Paxton (REP), James Talarico (DEM), Ted Brown (LIB); data = James Talarico, Ken Paxton, Ted Brown
- **78701 `tx-ltgov`** (p.1): official = Dan Patrick (REP), Vikki Goodwin (DEM), Anthony Cristo (LIB), Kevin McCormick (GRN); data = Dan Patrick, Vikki Goodwin, Kevin McCormick, Anthony Cristo
- **78701 `tx-ag`** (p.1): official = Mayes Middleton (REP), Nathan Johnson (DEM), Tom Oxford (LIB); data = Nathan Johnson, Mayes Middleton, Tom Oxford
- **78701 `tx-comptroller`** (p.1): official = Don Huffines (REP), Sarah Eckhardt (DEM), V. Alonzo Echavarria-Garza (LIB), Shehla Faizi (GRN); data = Don Huffines, Sarah Eckhardt, Shehla Faizi, V. Alonzo Echavarria-Garza
- **78701 `tx-agcomm`** (p.1): official = Nate Sheets (REP), Clayton Tucker (DEM), Austin R. Kelly (LIB); data = Clayton Tucker, Nate Sheets, Austin R. Kelly
- **78701 `tx-rrc`** (p.1): official = Bo French (REP), Jon Rosenthal (DEM), Arthur DiBianca (LIB); data = Jon Rosenthal, Bo French, Arthur DiBianca
- **78701 `tx-court-of-criminal-appeals-place-3`** (p.1): official = Thomas Smith (REP), Okey Anyiam (DEM), Mark Ash (LIB); data = Okey Anyiam, Thomas Smith, Mark Ash
- **78701 `tx-court-of-criminal-appeals-place-9`** (p.1): official = John Messinger (REP), Holly Taylor (DEM); data = Holly Taylor, John Messinger
- **10001 `ny-supreme-1jd`** (p.3): official = Shlomo S. Hagler (A Dem), Manuel J. Mendez (A Dem), Saliann Scarpulla (A Dem), Hasa A. Kingo (A Dem), Kathleen Waterman-Marshall (A Dem), Christopher Chin (A Dem), Amy S. Taylor (D WFP), Joshua E. Goldfein (D WFP), Sienna M. Fontaine (D WFP), Bob Cohen (D WFP), Jeffrey W. Rizzo (D WFP); data = Saliann Scarpulla, Kathleen Waterman-Marshall, Shlomo S. Hagler, Manuel J. Mendez, Hasa A. Kingo, Christopher Chin, Amy S. Taylor, Joshua E. Goldfein, Sienna M. Fontaine, Bob Cohen, Jeffrey W. Rizzo

Pattern in Texas: in 8 of the 10 Texas mismatches, the data lists the Democrat before the Republican. Texas orders parties by the last gubernatorial vote: REP, DEM, LIB, GRN. In the other two (tx-ltgov and tx-comptroller), the data puts GRN before LIB. In NY, the 1st JD Supreme Court race has the Democratic column in a different order.

Manual fixes: the auto parser missed the wider-spaced blocks for us-senate-tx and tx-gov, so I read those orders from the p.1 bbox y-coordinates. us-senate-tx is Paxton y315, Talarico y347, Brown y379.5, so it is a MISMATCH. tx-gov is Abbott, Hinojosa, Dixon, so it is a MATCH.

## Unconfirmed (unsure)

- 94103 `ca-11`: Connie Chan, Scott Wiener
- 94103 `ca-ag`: Rob Bonta, Michael E. Gates
- 94103 `ca-controller`: Malia M. Cohen, Herb W Morgan
- 94103 `ca-insurance`: Ben Allen, Jane Kim
- 94103 `ca-sos`: Shirley N. Weber, Donald P. (Don) Wagner
- 94103 `ca-spi`: Richard Barrera, Sonja Shaw
- 94103 `ca-treasurer`: Eleni Kounalakis, Jennifer Hawks
- 94103 `ca-gov`: Xavier Becerra, Steve Hilton
- 94103 `ca-ltgov`: Fiona Ma, Gloria Romero
- 94103 `ca-ad-17`: Matt Haney, Manuel Noris-Barrera
- 94103 `ca-boe-2`: Sally J. Lieber, John Pimentel
- 94103 `sf-assessor-recorder`: Joaquin Torres
- 94103 `sf-public-defender`: Manohar Raju
- 94103 `sf-supervisor-6`: Alex Behrend, Matt Dorsey
- 94103 `sf-supervisor-8`: Gary McCoy, Michael T. Nguyen, Darshini Patel, Emanuel "Manny" Yekutiel
- 94103 `sf-supervisor-10`: Pearci "PJ" Bastiany III, Dionjay (DJ) Brookter, Deandra Bryant, Theo Ellington, J.R. Eppler, Ellsworth "Ell" M. Jennison, Jr., Mike Trouble Lin, Jamo Muhammad, Jessica Pessecow, Shawn M. Richard
- 94103 `sf-board-of-education`: Autumn Brown Garibay, Virginia Cheung, Alida Fisher, Ryan Hazelton, Phil Kim, Laurance Lee, Reina Tello, Tim Tung
- 94103 `sf-community-college-board`: Elijah Ball, Rome Moses Jones, Monroe Lace, Leah LaCroix, Jeremy Lee, Bunny McFadden, Erwin Tam, Lisa Wynn
- 94103 `sf-community-college-board-partial`: Ruth Ferguson
- 10001 `ny-12`: Micah C. Lasher, Caroline Shinkle, Wilneida Negron, Karen Ortiz
- 10001 `ny-sd-47`: Erik D. Bottcher, Charlotte Friedman
- 10001 `ny-sd-28`: Liz Krueger, Alina Bonsell
- 10001 `ny-ad-75`: Tony Simone, Cristina Fontanelli
- 10001 `ny-civil-3md-ny`: Steven Benathen
- 10001 `ny-civil-9md-ny`: Jennifer Frankola-Crawford, Brian J. Krist
- 10001 `nyc-council-3`: Carl Wilson, Haris Bhatti

SF reasons: there is no public sample ballot. The VIP refers voters to their mailed sample ballot or the personal Voter Portal, which I did not try. A secondary fallback would be the CA SOS randomized alphabet plus AD17 rotation. That would be a derivation, not the sample ballot, so I did not apply it.

## Single-name contests (trivially in order)

The 13 CA Supreme Court and Court of Appeal retention contests in 94103 each name one justice. The name appears in the VIP ballot worksheet (PDF pp.248–249).

## Matches

`tx-gov`, `tx-land`, `tx-supreme-court-place-1-chief-justice`, `tx-supreme-court-place-2`, `tx-supreme-court-place-7`, `tx-supreme-court-place-8`, `tx-court-of-criminal-appeals-place-4`, `tx-15th-coa-chief-justice`, `tx-15th-coa-place-2`, `tx-15th-coa-place-3`, `tx-3rd-coa-chief-justice`, `tx-sboe-5`, `tx-hd-49`, `tx-house-51`, `travis-district-judge-147th`, `travis-district-judge-201st`, `travis-district-judge-250th`, `travis-district-judge-261st`, `travis-district-judge-299th`, `travis-district-judge-331st`, `travis-district-judge-403rd`, `travis-district-judge-419th`, `travis-district-judge-455th`, `travis-district-judge-459th`, `travis-county-judge`, `travis-ccl-1`, `travis-ccl-2`, `travis-ccl-3`, `travis-ccl-4`, `travis-ccl-5`, `travis-ccl-6`, `travis-ccl-7`, `travis-probate-1`, `travis-district-clerk`, `travis-county-clerk`, `travis-county-treasurer`, `travis-commissioner-4`, `travis-jp-5`, `travis-jp-4`, `travis-constable-4-unexpired`, `travis-cad-place-1`, `travis-cad-place-2`, `travis-cad-place-3`, `austin-council-9`, `aisd-at-large-9`, `acc-trustee-place-1`, `acc-trustee-place-2`, `acc-trustee-place-3`, `ny-governor`, `ny-attorney-general`, `ny-comptroller`, `ny-surrogate-ny`, `ny-civil-county-ny`
