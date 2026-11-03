// Exa live election results (Exa, Nov 3 2026: "live elections data for the US midterms"). Exa keeps one page per
// contest at exa.ai/library/election/contest/<id>, refreshed on election night. We search those pages only, fetch them
// fresh (maxAgeHours: 0), and pass the counts through as Exa published them: nothing here calls a race or projects a
// winner. The page names no upstream source, so every reply labels the numbers unofficial and links the official office.
const API = "https://api.exa.ai/search";
const CONTEST = /^https:\/\/exa\.ai\/library\/election\/contest\//;
const TIMEOUT_MS = 9000;

export type LiveCandidate = { name: string; party: string | null; incumbent: boolean; votes: number | null; share: string | null };
export type LiveContest = { title: string; url: string; candidates: LiveCandidate[]; status: string | null; updated: string | null };

const num = (s: string) => (/\d/.test(s) ? Number(s.replace(/[^\d]/g, "")) : null);

/** One Exa contest page (markdown) to candidates, counts and the status line, exactly as published. */
export function parseContest(url: string, text: string): LiveContest | null {
  const title = /^#\s+(.+?)\s*$/m.exec(text)?.[1]?.replace(/\s+results$/i, "") ?? null;
  const rows = text.split("\n").filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l) && !/^\|\s*Candidate\s*\|/i.test(l));
  const candidates = rows
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()))
    .filter((c) => c.length >= 4)
    .map(([who, party, votes, share]) => ({
      name: who.replace(/\[([^\]]+)\]\([^)]*\)/, "$1").replace(/\s*\(incumbent\)\s*/i, "").trim(),
      party: party && party !== "—" ? party : null,
      incumbent: /\(incumbent\)/i.test(who),
      votes: num(votes),
      share: /\d/.test(share) ? share : null,
    }));
  if (!title || !candidates.length) return null;
  const tail = text.slice(text.lastIndexOf("|") + 1).split("\n").map((l) => l.trim()).filter(Boolean);
  const statusLine = tail.find((l) => /updated|reporting|counted|closed|precincts|expected/i.test(l)) ?? null;
  const updated = statusLine ? /Updated\s+(.+?)\.?$/i.exec(statusLine)?.[1] ?? null : null;
  return { title, url, candidates, status: statusLine, updated };
}

/** Exa search over its contest pages for one race, fetched fresh. Returns unavailable (never throws) without a key. */
export async function getLiveResults(race: string, state: string) {
  const key = process.env.EXA_API_KEY;
  const source = "https://exa.ai/library/election";
  if (!key) return { status: "unavailable" as const, reason: "Live results are not configured (no EXA_API_KEY).", source };
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify({
        query: `2026 ${state} ${race} general election results`,
        type: "auto",
        numResults: 5,
        includeDomains: ["exa.ai"],
        contents: { text: { maxCharacters: 4000 }, maxAgeHours: 0 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { status: "unavailable" as const, reason: `Exa: HTTP ${res.status}`, source };
    const results = ((await res.json())?.results ?? []) as { url: string; text?: string }[];
    const contests = results.filter((r) => CONTEST.test(r.url) && r.text).map((r) => parseContest(r.url, r.text!)).filter((c): c is LiveContest => !!c);
    if (!contests.length) return { status: "no record found" as const, source };
    return { status: "found" as const, contests: contests.slice(0, 2), note: "Unofficial counts as published by Exa. Results are not final until certified; check the official election office.", source: contests[0].url };
  } catch (e: unknown) {
    return { status: "unavailable" as const, reason: `Exa: ${(e as Error)?.message || e}`, source };
  }
}
