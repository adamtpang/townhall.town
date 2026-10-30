import { validZip } from "../../../lib/zip.mjs";
import { ballotFor } from "../../../lib/tools";
import { limited } from "../../../lib/rateLimit";
import { findQuotes, textOf } from "../../../lib/research";
import { ISSUES } from "../../../lib/issues";
import { generateText } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const SEARCH_MODEL = process.env.RESEARCH_MODEL || "perplexity/sonar"; // AI Gateway (OIDC on Vercel)

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const cache = new Map<string, { at: number; text: string | null; status: string }>();

async function read(url: string): Promise<{ text: string | null; status: string }> {
  const c = cache.get(url); if (c && Date.now() - c.at < 6 * 3600_000) return c;
  let r: { text: string | null; status: string };
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(5000), headers: { "user-agent": "townhall.town research (nonpartisan ballot guide)", accept: "text/html" } });
    if (!res.ok) r = { text: null, status: `HTTP ${res.status}` };
    else if (!/html/i.test(res.headers.get("content-type") || "")) r = { text: null, status: "not a web page" };
    else r = { text: textOf((await res.text()).slice(0, 1_500_000)), status: "read" };
  } catch (e: any) { r = { text: null, status: /timeout|abort/i.test(String(e?.name || e)) ? "timed out" : "could not be reached" }; }
  cache.set(url, { at: Date.now(), ...r });
  return r;
}

/** Web search through AI Gateway. Only the returned source URLs are used; the model's own text is never shown. */
async function search(name: string, office: string, place: string): Promise<{ urls: string[]; status: string }> {
  try {
    const res = await generateText({ model: SEARCH_MODEL, maxRetries: 0, abortSignal: AbortSignal.timeout(12000),
      prompt: `Find public statements, candidate questionnaires or interviews in which ${name}, a 2026 candidate for ${office} (${place}), states positions on local issues. List sources.` });
    const urls = [...new Set((res.sources || []).map((x: any) => x.url).filter((u: unknown): u is string => typeof u === "string" && /^https:\/\//.test(u)))].slice(0, 5);
    return { urls, status: `${urls.length} source${urls.length === 1 ? "" : "s"} found` };
  } catch (e: any) { return { urls: [], status: "web search unavailable" }; }
}

export async function GET(req: Request) {
  const lim = limited(req); if (lim) return lim;
  const q = new URL(req.url).searchParams;
  const zip = validZip(q.get("zip"));
  const raceId = String(q.get("race") || "");
  const issueIds = String(q.get("issues") || "").split(",").filter((id) => ISSUES.some((i) => i.id === id)).slice(0, 10);
  const ballot = zip ? ballotFor(zip) : null;
  const race: any = ballot?.races.find((r: any) => r.id === raceId);
  if (!race) return new Response(JSON.stringify({ type: "error", message: "Unknown race for this ZIP." }), { status: 404, headers: { "content-type": "application/json" } });
  const ids = issueIds.length ? issueIds : ISSUES.filter((i) => !i.caOnly || ballot?.state === "CA").map((i) => i.id);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const emit = (e: Record<string, unknown>) => ctl.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      if (race.judicial) { emit({ type: "done", judicial: true }); ctl.close(); return; }
      // Same steps for every candidate, in ballot order.
      for (const c of race.candidates as any[]) {
        const urls = [...new Set([c.campaignSite, c.officialSite, c.ballotpedia].filter((u: unknown): u is string => typeof u === "string" && /^https:\/\//.test(u)))];
        emit({ type: "candidate", name: c.name, sources: urls.length });
        let found = 0;
        emit({ type: "step", name: c.name, url: "search:" + c.name, label: "Searching the web", status: "running" });
        const sr = await search(c.name, race.office || race.title, ballot?.place || zip || "");
        emit({ type: "step", name: c.name, url: "search:" + c.name, label: "Searching the web", status: sr.urls.length ? "done" : "failed", detail: sr.status });
        const last = String(c.name).split(/\s+/).filter((w: string) => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(w)).pop() || c.name;
        const own = new Set(urls);
        // A search result on the candidate's own campaign domain (e.g. micatx.com) counts as their own page.
        const nameBits = String(c.name).toLowerCase().split(/[^a-z]+/).filter((w: string) => w.length >= 4);
        for (const u of sr.urls) if (!own.has(u)) {
          urls.push(u);
          const h = host(u).toLowerCase();
          if (!/ballotpedia|vote411|ivoterguide|votetheperson|votetexasvalues|wikipedia|facebook|twitter|x\.com|instagram|linkedin|kut\.org|texastribune|statesman/.test(h) && nameBits.some((w: string) => h.includes(w))) own.add(u);
        }
        for (const u of urls) emit({ type: "step", name: c.name, url: u, label: `Reading ${host(u)}`, status: "running" });
        await Promise.all(urls.map(async (u) => {
          const r = await read(u);
          // On pages that are not the candidate's own, keep only sentences that name them.
          const quotes = r.text ? findQuotes(r.text, ids, 1, own.has(u) ? undefined : last) : [];
          const keep = quotes.slice(0, Math.max(0, 4 - found)); found += keep.length;
          emit({ type: "step", name: c.name, url: u, label: `Reading ${host(u)}`, status: r.text ? "done" : "failed", detail: r.text ? `${quotes.length} quote${quotes.length === 1 ? "" : "s"} found` : r.status });
          for (const x of keep) emit({ type: "citation", name: c.name, issue: x.issue, quote: x.quote, url: u });
        }));
        if (!found) emit({ type: "none", name: c.name, message: "No record found" });
      }
      emit({ type: "done" });
      ctl.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
