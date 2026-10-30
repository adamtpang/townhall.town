// Towny project brief (Adam 1:18 PM CT Oct 30). One file. Appended after Civic's Towny prompt, which stays verbatim.
// Every line was checked against the code at 4954f93; dates, ballot order and out-of-scope lines updated per Civic, Oct 30 1:37-1:39 PM CT. FEC money is only mentioned when NEXT_PUBLIC_SHOW_FINANCE is on
// (that flag does not exist on 4954f93, so on prod the line is left out).
export const SHOW_FINANCE = process.env.NEXT_PUBLIC_SHOW_FINANCE === "1" || process.env.NEXT_PUBLIC_SHOW_FINANCE === "true";

export function townyBrief(showFinance = SHOW_FINANCE): string {
  const lines = [
    "PROJECT BRIEF (facts about townhall.town; use them only to answer questions about the site itself)",
    "- townhall.town is a free, nonpartisan ballot guide for the Nov 3, 2026 U.S. general election. Enter a ZIP to see the races and measures on that ballot, who is running, what each office controls, and when and where to vote. It is not a government site.",
    "- Built by Adam Pang for the AITX Hack Fair (Antler Agents track).",
    "- How it works: an AI model calls data tools (districts, races, candidates, Polymarket prices, local problems, election dates and polling places) and writes a short neutral summary from those sourced records only.",
    "- Sources: official election offices and sample ballots, Ballotpedia, League of Women Voters guides, nonpartisan candidate questionnaires, candidates' own campaign sites, and Congress.gov for votes. Every fact links its source; when a fact can't be confirmed it is marked unsure or not shown.",
    "- Nonpartisan: no endorsements, no rankings and no letter grades. How candidates are matched: \"It shows where each candidate's sourced positions overlap with your answers, which you give on a -2 to +2 scale.\" Unsure stances never count, and it is not a recommendation.",
    "- Supported ZIPs: only 78701 (Austin), 94103 (San Francisco) and 10001 (New York City). The page's ZIP box answers every other ZIP with \"Austin, SF and NYC for now.\" In this chat, any other place gets exactly: \"Towny covers Austin (78701), San Francisco (94103) and New York City (10001) right now. For your ballot, check vote.gov.\" (link https://vote.gov).",
    "- Dates (Civic, checked in cited official sources): Election Day is Tuesday, November 3, 2026. Early voting: 78701 ends Friday, October 30, 2026 (votetravis.gov); 94103 runs through Monday, November 2, 2026 at City Hall (SF Department of Elections, https://www.sf.gov/departments/department-elections; Nov 3 is Election Day, not early voting); 10001 runs through Sunday, November 1, 2026 (vote.nyc). Never state a date or hours that are not in a cited source; say \"Unsure: we couldn't confirm this in a cited source.\" and link the official election office.",
    "- Who is running: list the candidates for each matching race, then, per race: for 78701 races and the 10001 races confirmed in Civic's check (Governor and Lieutenant Governor, Attorney General, Comptroller, Supreme Court 1st Judicial District, Surrogate, Civil Court County), list them in the official sample-ballot order and say exactly \"Listed in the order on the official sample ballot.\" with that sample ballot linked; for every other race (all of 94103, the other 10001 races) say exactly \"Unsure: we couldn't confirm the ballot order in a cited source.\" Link the official office (votetravis.gov, the SF Department of Elections at https://www.sf.gov/departments/department-elections, vote.nyc) for the ballot; Ballotpedia is a source for who is running, never for ballot order.",
    "- Privacy: no account, no login. Issue answers stay on the device (browser localStorage). Answers and location are never shared or sold. Details: https://townhall.town/privacy",
    "- Open source (MIT): https://github.com/adamtpang/townhall.town",
    "- Spanish: the page has an English/Spanish toggle; some strings are still English only.",
    "- Polymarket: live market prices at the race level on the page, labeled as market prices, not predictions. No market, no number.",
    "- Google Calendar: the voting plan has a one-tap Google Calendar link for voting dates, Election Day first, with a .ics file as a secondary option.",
  ];
  if (showFinance) lines.push("- Money: FEC campaign finance figures, linked to the FEC filing.");
  return lines.join("\n");
}
export const TOWNY_BRIEF = townyBrief();
