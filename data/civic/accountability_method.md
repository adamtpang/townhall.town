# Track record: how we compare what candidates said with what they did

Version 1.0, written Oct 29, 2026. Applies to every candidate on townhall.town ballots for ZIPs 78701 (Austin), 94103 (San Francisco) and 10001 (New York). The same rules apply to every party and every office. Anyone can redo each step with the links in `accountability.json`.

## 1. What a "pair" is

A pair has two halves:

- **What they said.** The candidate's own words: an exact quote, a link to where it appears (campaign site, official site, voter guide statement, candidate survey, or an interview), and a date if the page shows one.
- **What the record shows.** One recorded action by that same person, from an official record:
  - U.S. Congress: roll-call votes on clerk.house.gov, senate.gov, or Congress.gov.
  - Texas Legislature: bill history and record votes on Texas Legislature Online (capitol.texas.gov) and the House and Senate Journals.
  - California Legislature: bill votes and history on leginfo.legislature.ca.gov.
  - New York Legislature: nysenate.gov and nyassembly.gov bill pages and votes.
  - New York City Council: legistar.council.nyc.gov.
  - San Francisco Board of Supervisors: sfgov.legistar.com.
  - Executives (governor, attorney general, comptroller, treasurer, land commissioner, county executive, city attorney): bills signed or vetoed (shown in the legislature's bill history), executive orders, lawsuits filed, and reports or releases published on the office's own government website.

News articles can help find a record, but the record link must be the official source.

## 2. Which pairs are checked (so nobody can pick favorites)

We do not choose quotes. The list of quotes is fixed in advance:

1. Every position already shown for the candidate on this site (the slider positions in `data/stances.json`, plus the sourced positions collected for the same sliders), and
2. Every promise already listed for the candidate in the site's said-vs-did file (`data/accountability.json`).

Each quote gets one row, and every row is published, including the ones with no match. Each quote can produce at most one pair. That keeps one issue from being counted many times.

## 3. Is the quote checkable?

A quote is checkable only if it names **a specific policy, bill, program, or claimed result**, and **a direction**: for, against, raise, cut, or "I did this."

Test: if the record held a vote on exactly this subject, would a Yes plainly agree or plainly disagree with the quote? If not, the row is marked **not checkable** and is not counted. Example: "Health care should be affordable" is not checkable. "Restore the ACA tax credits" is checkable.

## 4. Finding the matching action

For each checkable quote, look in the official record of every public office the candidate has held, in this order:

1. If the quote names a bill, program, or result, use the official record of that item: the candidate's vote on it, their authorship, their signature or veto, or the office's official report.
2. If not, search the record body's bill search with the main words of the quote. Use the candidate's vote on final passage of the **most recent** bill whose official title or digest is mainly about that subject.
3. For executives who do not vote, use the most recent official act on the subject: a bill signed or vetoed, an executive order, a lawsuit filed, or a published report.
4. A presiding officer who does not usually vote (for example a lieutenant governor) is matched to the chamber's final vote on a bill that officer publicly named as a priority on the office's official site.

If nothing matches, or the office has no power over the subject (for example, a state legislator asked about a federal tax credit), the row is marked **no matching record found** and is not counted.

## 5. The classification rule

Only the candidate's own action counts, not what other officials or courts did afterward.

- **Consistent**: the action goes the direction the quote says. A Yes vote on a bill doing what they supported, a No vote on a bill doing what they opposed, signing a bill they backed, filing the lawsuit they said they would, or an official record confirming a result they claimed.
- **Inconsistent**: the action goes the other way. A No vote on a bill doing what they supported, a Yes vote on a bill doing what they opposed, vetoing a bill they backed, or an official record contradicting a result they claimed.
- **Mixed/unclear**: any of these:
  - the bill had major parts on both sides of the quote;
  - the candidate did not vote, or voted "present";
  - the action is on the same subject but at a different level of government than the quote names (for example, a state bill when the quote is about federal policy);
  - the official record confirms part of a claimed result, or gives a different number.
  - the action works toward the same goal by a different means than the quote names (for example, a sales-tax transfer when the quote names the Rainy Day Fund).

If a quote has several parts and the action covers only one, the pair is judged on that part, and the reason says which part.

Each pair has a one-line reason that states facts only.

For quotes that claim the candidate authored, led or advocated for something, authoring or co-authoring the bill counts as the action. Not-checkable quotes and quotes with no matching record are still listed with the candidate, with the reason, but are not counted.

## 6. The score

- Score = consistent ÷ (consistent + inconsistent). Mixed/unclear pairs are listed but not counted in the score.
- The score is always shown with its count, for example "7 of 9 checked pairs consistent," plus the number of mixed/unclear pairs.
- A score is shown only when consistent + inconsistent is **3 or more**. Below that, the candidate shows **"Not enough records."**
- A candidate who has never held public office shows **"No voting record."** This is not a low score. It means there is nothing to compare.
- Judges: court rulings are not compared with campaign statements, and judicial candidates list no positions on this site, so they show "No voting record."

## 7. What this score is not

- It does not say whether a policy is good or bad.
- It does not measure results the candidate did not control, such as a veto by someone else or a court ruling.
- It covers only the quotes listed on this site. A candidate with few listed positions will have few pairs.

## 8. How to check or dispute a row

Open the two links in the pair. Confirm the quote appears on the first page and the vote or act appears on the second. Then apply section 5. If you get a different result, report the row and the link. Corrections are applied to every candidate the same way.
