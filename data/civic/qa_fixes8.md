# QA fixes 8 — Civic, 2026-10-30 (feat/actionable @5063785)

No repo edits. Engineering applies `civic/photos_batch.json` (with `photos_local/darlene-byrne.jpg`) and runs `scripts/merge_gapfill.py` with `civic/positions_gapfill_batch5civic.json`. Details are in `qa_fixes8.json`.

## 1. Letitia James photo
- **"Photo: WBLS" breaks the no-news rule.** WBLS is a New York radio station, so this is a media photo even though Commons lists a CC license.
- **New photo:** her campaign site. Image: `https://jamesforny.com/wp-content/uploads/2026/03/tish.png`. Page: `https://jamesforny.com/`. sourceType: campaign site. Attribution: "Photo: Letitia James campaign site". License: the standard not-licensed text.
- **Photo year:** 2026, by upload date (March 2026). The same photo became her verified X avatar on 2026-03-26.
- **Crop:** it's a cutout with a transparent background and a mic at lower left. Crop to head and shoulders and put it on a light background.
- The URL loads (200, image/png, 631x455). It isn't signed, so no local copy is needed.
- **6-year check:** passes. Both she and Komatireddy are 2026.
- **Rejected:** the ag.ny.gov portrait was taken 2019-10-31 (from the file's EXIF data). That is 7 years from 2026, so it fails the check. letitiajames.com is an opposition site, not hers.

## 2. Charter-school rule
- **Bo French goes to unsure.** His quote names charter schools and "any other system that protects parents' rights." It never mentions vouchers, ESAs, or public money for private schools.
  - Voter note: "He backs local control of schools, including charter schools. Charter schools are public schools, so this doesn't say whether public money should go to private schools."
- **All charter-only stances set to unsure** (in `positions_gapfill_batch5civic.json` as `override: true` items; each has an editorNote):

| Candidate | Race | Old score |
|---|---|---|
| bo-french | tx-rrc | +3 |
| karen-ortiz | ny-12 | −4 |
| alina-bonsell | ny-sd-28 | +4 |
| virginia-cheung | sf-board-of-education | −3 |
| alida-fisher | sf-board-of-education | −3 |
| ryan-hazelton | sf-board-of-education | −2 |
| laurance-lee | sf-board-of-education | −3 |

  - Bonsell's "more educational choices" is too vague to count.
  - I checked all four SF Greens questionnaires. Their question asks only about charter schools, and none of the pages mention vouchers or private schools.
- **Already unsure:** Allison Bush and Kirk Becker.
- **Kept:** Steve Hilton +3. His quote says "over time introducing school choice," which goes beyond charters.
- **Grade eligibility: still 19, no change.**
  - ny-12 is now 4–8 issues. That is exactly half, so it still passes.
  - ny-sd-28 is now 5–6.
  - Education wasn't a shared issue in either race.
  - tx-rrc and the SF Board of Education were already ineligible.

## 3. Darlene Byrne copyright
- **Answer: No, don't use the current image.** Her campaign-site `byrne1.jpg` is the txcourts.gov court portrait re-hosted:
  - same file name and size (2430x3441)
  - pixel-identical apart from re-encoding
  - robes and flags in the background
- **This is flagged.** No photographer is named on either page or in the files, so there's nothing to add to the attribution. The Mark Matson credit is unverified for this image.
- **Yes, she can still have a photo:** her own Facebook page, "Chief Justice Darlene Byrne", which her campaign site links to. It's a studio headshot.
  - The URL is a signed Facebook link that expires around Nov 3, so it's saved as `photos_local/darlene-byrne.jpg`.
  - Attribution: "Photo: Darlene Byrne own social profile".
  - Photo year isn't stated. Cory Liu's is 2025, so the two can't be compared.

## 4. Kai Huang and Liz Krueger
- **Kai Huang:** kai4atx.com has only candid photos and links no social profiles. No own headshot found. Keep the candid photo with its cropNote.
- **Liz Krueger:** nysenate.gov blocks scripted requests (403) and lizkrueger.com returned an error (500). Her X avatar is a 2018 press-conference photo, which is no better. Keep the 2019 Senate photo, cropped. Someone using a normal browser could try nysenate.gov.

## New rules
1. Charter-school positions aren't scored on the education axis. Neither are vague "educational choices" statements that don't mention public money for private schools.
2. A campaign or social photo that is the same image as a txcourts.gov portrait counts as the court portrait. Use another of the candidate's own headshots.
3. Radio and TV station credits count as media photos, even when the Commons license is open.

## Files changed (all under civic/)
- `photos_batch.json` and `photos_batch.md`. Backups: `*.pre_qa8.*`.
- `photos_local/darlene-byrne.jpg` (new).
- `photos_batch_work/qa8_fixes.py` (new).
- `photos_batch_work/build.py` (now calls qa8_fixes). Backup: `build.py.pre_qa8`.
- `photos_batch_work/md_notes.md`. Backup: `md_notes.pre_qa8.md`.
- `positions_gapfill_batch5civic.json` (new).
- `qa8/stances.qa8.json`: a copy of the repo's `data/stances.json` with the 7 changes. It is identical to what `merge_gapfill.py` produces.
- Work files: `qa8/elig_qa8.json`, `qa8/qa8_photo_changes.json`, `qa8/*.py`.
- `qa_fixes8.json` and `qa_fixes8.md`.
