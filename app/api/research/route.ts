import { validZip } from "../../../lib/zip.mjs";
import { ballotFor } from "../../../lib/tools";
import { rateLimited, RESEARCH_POLICY } from "../../../lib/rateLimit";
import { apiError, methodNotAllowed, withHeaders, API_VERSION_HEADERS } from "../../../lib/apiError";
import { findQuotes, findOwnWords, ownIssueLinks, quoteFits, sameSite, textOf } from "../../../lib/research";
import { ISSUES } from "../../../lib/issues";
import { generateText } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const SEARCH_MODEL = process.env.RESEARCH_MODEL || "perplexity/sonar"; // AI Gateway (OIDC on Vercel)

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const cache = new Map<string, { at: number; text: string | null; status: string; links?: string[] }>();
const TTL = 6 * 3600_000;
// Whole research runs, per race and issue set, replayed on repeat visits (same instance) with no new searches or fetches.
const runs = new Map<string, { at: number; events: Record<string, unknown>[] }>();
const searches = new Map<string, { at: number; urls: string[]; status: string }>();
const MAX_URLS = 6; // per candidate: listed pages first, then search results
/** One key per page: no scheme, no www., no trailing slash, no hash or tracking params. */
const urlKey = (u: string) => { try { const x = new URL(u); x.hash = ""; for (const k of [...x.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/.test(k)) x.searchParams.delete(k); return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + (x.search || "")).toLowerCase(); } catch { return u; } };
const asOf = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });

async function read(url: string): Promise<{ text: string | null; status: string; links?: string[] }> {
  const c = cache.get(url); if (c && Date.now() - c.at < TTL) return c;
  let r: { text: string | null; status: string; links?: string[] };
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(5000), headers: { "user-agent": "townhall.town research (nonpartisan ballot guide)", accept: "text/html" } });
    if (!res.ok) r = { text: null, status: `HTTP ${res.status}` };
    else if (!/html/i.test(res.headers.get("content-type") || "")) r = { text: null, status: "not a web page" };
    else { const html = (await res.text()).slice(0, 1_500_000); r = { text: textOf(html), status: "read", links: ownIssueLinks(html, res.url || url) }; }
  } catch (e: any) { r = { text: null, status: /timeout|abort/i.test(String(e?.name || e)) ? "timed out" : "could not be reached" }; }
  cache.set(url, { at: Date.now(), ...r });
  return r;
}

/** Web search through AI Gateway. Only the returned source URLs are used; the model's own text is never shown. */
async function search(name: string, office: string, place: string): Promise<{ urls: string[]; status: string }> {
  const key = `${name}|${office}|${place}`; const hit = searches.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit;
  const r = await searchOnce(name, office, place);
  if (r.status !== "web search unavailable") searches.set(key, { at: Date.now(), ...r });
  return r;
}
async function searchOnce(name: string, office: string, place: string): Promise<{ urls: string[]; status: string }> {
  try {
    const res = await generateText({ model: SEARCH_MODEL, maxRetries: 0, abortSignal: AbortSignal.timeout(12000),
      prompt: `Find news articles, interviews or the campaign site where ${name}, a 2026 candidate for ${office} (${place}), is directly quoted, in quotation marks, on local issues. List sources.` });
    const urls = [...new Set((res.sources || []).map((x: any) => x.url).filter((u: unknown): u is string => typeof u === "string" && /^https:\/\//.test(u)))].slice(0, 5);
    return { urls, status: `${urls.length} source${urls.length === 1 ? "" : "s"} found` };
  } catch (e: any) { return { urls: [], status: "web search unavailable" }; }
}

async function research(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const zip = validZip(q.get("zip"));
  const raceId = String(q.get("race") || "");
  const issueIds = String(q.get("issues") || "").split(",").filter((id) => ISSUES.some((i) => i.id === id)).slice(0, 10);
  const ballot = zip ? ballotFor(zip) : null;
  const race: any = ballot?.races.find((r: any) => r.id === raceId);
  if (!zip) return apiError(400, "invalid", "zip must be exactly 5 digits, for example 78701.");
  if (!race) return apiError(404, "not_found", "Unknown race for this ZIP.");
  const ids = issueIds.length ? issueIds : ISSUES.filter((i) => !i.caOnly || ballot?.state === "CA").map((i) => i.id);
  const enc = new TextEncoder();
  const runKey = `${zip}|${raceId}|${[...ids].sort().join(",")}`;
  const prev = runs.get(runKey);
  if (prev && Date.now() - prev.at < TTL)
    return new Response(prev.events.map((e) => JSON.stringify(e) + "\n").join(""), { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-research-cache": "hit" } });
  const log: Record<string, unknown>[] = [];
  let failedAny = false;
  const stream = new ReadableStream({
    async start(ctl) {
      const emit = (e: Record<string, unknown>) => { log.push(e); ctl.enqueue(enc.encode(JSON.stringify(e) + "\n")); };
      if (race.judicial) { emit({ type: "done", judicial: true }); ctl.close(); return; }
      // Same steps for every candidate, in ballot order.
      for (const c of race.candidates as any[]) {
        const urls: string[] = []; const keys = new Set<string>();
        const add = (u: unknown) => { if (typeof u !== "string" || !/^https:\/\//.test(u) || urls.length >= MAX_URLS) return; const k = urlKey(u); if (keys.has(k)) return; keys.add(k); urls.push(u); };
        const own = [c.campaignSite, c.officialSite].filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u));
        const isOwn = (u: string) => own.some((o) => sameSite(u, o));
        [c.campaignSite, c.officialSite, c.ballotpedia].forEach(add);
        // The candidate's own issue pages (e.g. /priorities), linked from their campaign or official site. Same for everyone.
        for (const o of own) { const home = await read(o); (home.links || []).forEach(add); }
        emit({ type: "candidate", name: c.name, sources: urls.length });
        let found = 0;
        const seen = new Set<string>(); // the same article often appears under two URLs
        emit({ type: "step", name: c.name, url: "search:" + c.name, label: "Searching the web", status: "running" });
        const sr = await search(c.name, race.office || race.title, ballot?.place || zip || "");
        emit({ type: "step", name: c.name, url: "search:" + c.name, label: "Searching the web", status: sr.urls.length ? "done" : "failed", detail: sr.status });
        if (sr.status === "web search unavailable") failedAny = true;
        sr.urls.forEach(add);
        for (const u of urls) emit({ type: "step", name: c.name, url: u, label: `Reading ${host(u)}`, status: "running" });
        // Pages are read in parallel but scored in a fixed order, so the same page always yields the same quotes.
        const pages = await Promise.all(urls.map((u) => read(u)));
        urls.forEach((u, i) => {
          const r = pages[i];
          // Civic rule (b) + QA P1 #1: on the candidate's own site, their own sentences count (exact substring);
          // elsewhere only text in quotation marks with this candidate named as the speaker. Same bar for every candidate.
          const quotes = (!r.text ? [] : isOwn(u)
            ? [...findQuotes(r.text, ids, 1, String(c.name)), ...findOwnWords(r.text, ids, 1)]
            : findQuotes(r.text, ids, 1, String(c.name))).filter((x) => quoteFits(x, u));
          const fresh = quotes.filter((x) => { const k = x.quote.toLowerCase().replace(/[^a-z0-9]+/g, ""); if (seen.has(k)) return false; seen.add(k); return true; });
          const keep = fresh.slice(0, Math.max(0, 4 - found)); found += keep.length;
          const dup = quotes.length - fresh.length;
          const detail = !r.text ? r.status
            : keep.length ? `${keep.length} quote${keep.length === 1 ? "" : "s"} found`
            : dup ? "same quote as another page"
            : isOwn(u) ? "nothing on these issues" : "no quote attributed to them";
          if (!r.text) failedAny = true;
          emit({ type: "step", name: c.name, url: u, label: `Reading ${host(u)}`, status: r.text ? "done" : "failed", detail });
          for (const x of keep) emit({ type: "citation", name: c.name, issue: x.issue, quote: x.quote, url: u, ownSite: isOwn(u) });
        });
        if (!found) emit({ type: "none", name: c.name, message: `No public statement found as of ${asOf()}` });
      }
      emit({ type: "done" });
      // Cache complete runs; a run with a failed search or page is retried next time instead.
      if (runs.size > 500) runs.clear();
      if (!failedAny) runs.set(runKey, { at: Date.now(), events: log });
      ctl.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-research-cache": "miss" } });
}

export const GET = withHeaders(rateLimited(RESEARCH_POLICY, research), API_VERSION_HEADERS);
export const POST = withHeaders(methodNotAllowed(["GET"]), API_VERSION_HEADERS);
