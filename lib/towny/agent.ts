// Towny free-text agent (Adam 3:30 PM CT Oct 30: "a real tool-using LLM agent"). A question that no curated safety intent
// answers (lib/towny/answer.ts) goes to one bounded tool loop over the same sourced data the page uses, plus live public
// APIs. Every tool call is streamed as a step with its real latency and source. The reply cites only tool results.
// Safety rules stay in code: who-to-vote, out-of-scope, ballot order, dates and hours never reach this loop.
import { generateText, stepCountIs, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { ballotFor, getCandidates, getMarketOdds, getRaces } from "../tools";
import { getCampaignFinance, getCountyUnemployment, getSponsoredBills } from "../dataTools";
import { getCandidatePositions, townyTools } from "../townyTools";
import { getElectionDates, getPollingLocations, longDateIn } from "../logistics";
import { COVERED_ZIPS } from "../site";
import { townyPrompt } from "../townyPrompt";
import { TOWNY_BRIEF } from "./brief";
import { FAQS } from "./faq";
import { liveUrl } from "../links";
import { redact, outputFlags } from "../townyControls";
import { GATEWAY_FALLBACKS } from "../models";

export type Step = { tool: string; label: string; status: "running" | "done"; ms?: number; summary?: string; source?: { label: string; url: string } | null };
export type Emit = (e: Record<string, unknown>) => void;
export type AgentReply = { reply: string; links: { label: string; url: string }[]; model: string; steps: Step[] };

// gpt-4.1-mini first: it is the most reliable multi-step tool caller on the gateway; the rest are failover.
const MODELS = (process.env.TOWNY_MODELS || "openai/gpt-4.1-mini,google/gemini-2.5-flash,openai/gpt-5-nano").split(",").map((m) => m.trim()).filter(Boolean);
const REPO = "https://github.com/adamtpang/townhall.town";
const TIMEOUT_MS = 8000;

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
const src = (url: unknown, label?: string) => (typeof url === "string" && /^https:\/\//.test(url) ? { label: label ?? host(url), url } : null);

/** Every candidate on the three covered ballots whose name contains the query (case and accent insensitive). */
export function findPeople(query: string) {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(query).replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const out: { name: string; party: string | null; incumbent: boolean; race: string; raceId: string; zip: string; officialSite: string | null; ballotpedia: string | null; raceSource: string | null }[] = [];
  const seen = new Set<string>();
  for (const zip of COVERED_ZIPS) for (const r of ballotFor(zip)?.races ?? []) for (const c of r.candidates) {
    const n = norm(c.name);
    if (!q.length || !q.every((w) => n.includes(w))) continue;
    const key = `${c.name}|${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: c.name, party: c.party ?? null, incumbent: !!c.incumbent, race: r.title, raceId: r.id, zip, officialSite: liveUrl(c.officialSite), ballotpedia: liveUrl((c as { ballotpedia?: string | null }).ballotpedia), raceSource: typeof r.source === "string" ? r.source : null });
  }
  return out.slice(0, 8);
}

/** Project docs: the Towny brief, the FAQ and how races are ranked, each with a link. */
export function projectDocs(topic: string) {
  const ranking = {
    title: "How races are ranked",
    text: "Races are ranked by office and how close the race is, never by candidate. Competitive: Cook Political Report, Sabato's Crystal Ball or Inside Elections call it a toss-up or tilt; a Polymarket top outcome between 35% and 65% also counts as Competitive. Market prices are not forecasts or recommendations.",
    url: "https://townhall.town/#tiers",
  };
  const agent = {
    title: "How the agent works",
    text: "An AI model (Vercel AI Gateway) plans tool calls over sourced data: districts, races, candidates, Polymarket prices, Census ACS local data, OpenFEC campaign finance and BLS county unemployment. Every step is shown with its latency and source; code fills any lookup the model skips. Facts are never written by the model without a tool result.",
    url: `${REPO}#readme`,
  };
  const brief = TOWNY_BRIEF.split("\n").slice(1).map((l) => l.replace(/^- /, ""));
  const faqs = FAQS.filter((f) => f.id !== "who").map((f) => ({ title: f.q, text: f.a, url: f.links[0]?.url ?? REPO }));
  const all = [ranking, agent, ...faqs, ...brief.map((t, i) => ({ title: `Project brief ${i + 1}`, text: t, url: `${REPO}#readme` }))];
  const words = topic.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const scored = all.map((d) => ({ d, s: words.filter((w) => (d.title + " " + d.text).toLowerCase().includes(w)).length })).sort((a, b) => b.s - a.s);
  return { docs: (scored[0]?.s ? scored.filter((x) => x.s).slice(0, 4) : scored.slice(0, 4)).map((x) => x.d), repo: REPO };
}

/** Census Geocoder: one address to congressional and state legislative districts (current Census layers). */
export async function geocodeAddress(address: string) {
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json`;
  const page = "https://geocoding.geo.census.gov/geocoder/geographies/address";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { status: "unavailable", reason: `Census Geocoder: HTTP ${res.status}`, source: page };
    const m = (await res.json())?.result?.addressMatches?.[0];
    if (!m) return { status: "no match", source: page };
    const g = m.geographies ?? {};
    const pick = (re: RegExp) => Object.entries(g).filter(([k]) => re.test(k)).flatMap(([k, v]) => (v as any[]).map((x) => ({ layer: k, name: x.NAME ?? x.BASENAME })));
    return {
      status: "matched",
      congressional: pick(/Congressional Districts/),
      stateUpper: pick(/State Legislative Districts - Upper/),
      stateLower: pick(/State Legislative Districts - Lower/),
      county: pick(/^Counties$/).map((x) => x.name),
      note: "Census current layers. Confirm your districts with your official election office before you vote.",
      source: page,
    };
  } catch (e: any) {
    return { status: "unavailable", reason: `Census Geocoder: ${e?.message || e}`, source: page };
  }
}

const STEP_LABEL: Record<string, string> = {
  getBallot: "Read the ballot for your ZIP",
  findPerson: "Looked up a person on the ballot",
  getCandidates: "Listed candidates",
  getCandidatePositions: "Read published positions",
  getCampaignFinance: "Checked OpenFEC campaign finance",
  getSponsoredBills: "Checked Congress.gov sponsored bills",
  getCountyUnemployment: "Checked BLS county unemployment",
  getMarketOdds: "Checked live Polymarket prices",
  getElectionDates: "Read official election dates",
  getPollingLocations: "Read official voting places",
  getProjectDocs: "Read project docs",
  geocodeAddress: "Matched your address to districts (Census Geocoder)",
};

function summarize(name: string, r: any): { summary: string; source: { label: string; url: string } | null } {
  const unavailable = r?.status === "unavailable" ? `Unavailable (${r.reason ?? "no response"})` : null;
  switch (name) {
    case "getBallot": return { summary: `${r.races?.length ?? 0} races, ${r.measures?.length ?? 0} measures`, source: src(ballotFor(r.zip)?.verify?.url) };
    case "findPerson": return { summary: r.length ? r.map((p: any) => `${p.name}: ${p.race}`).join("; ") : "No one by that name on a covered ballot", source: src(r[0]?.ballotpedia ?? r[0]?.raceSource) };
    case "getCandidates": return { summary: `${(r.races ?? []).reduce((n: number, x: any) => n + x.candidates.length, 0)} candidates in ${(r.races ?? []).length} races`, source: null };
    case "getCandidatePositions": return { summary: r.status === "published" ? `${r.positions.length} sourced positions for ${r.name}` : `${r.name}: ${r.status}`, source: src(r.positions?.[0]?.sourceUrl) };
    case "getCampaignFinance": return { summary: unavailable ?? (r.receipts != null ? `${r.name}: $${Math.round(r.receipts).toLocaleString("en-US")} raised, 2026 cycle` : `${r.status ?? "no record found"}`), source: src(r.source, "FEC record") };
    case "getSponsoredBills": return { summary: unavailable ?? (r.member ? `${r.member}: ${r.bills?.length ?? 0} recent bills` : "no record found"), source: src(r.source, "Congress.gov") };
    case "getCountyUnemployment": return { summary: unavailable ?? (r.rate != null ? `${r.rate}% in ${r.period}` : "no record found"), source: src(r.source, "BLS series") };
    case "getMarketOdds": { const v = Object.values(r ?? {}) as any[]; const q = v.find((x) => x?.status === "live")?.quotes?.[0]; return { summary: `${v.filter((x) => x?.status === "live").length} of ${v.length} contests have a live price`, source: src(q?.url, "Polymarket market") }; }
    case "getElectionDates": return { summary: "Official dates and rules", source: null };
    case "getPollingLocations": return { summary: "Official voting places", source: src(r?.lookupUrl) };
    case "getProjectDocs": return { summary: (r.docs ?? []).map((d: any) => d.title).join("; "), source: src(r.docs?.[0]?.url) };
    case "geocodeAddress": return { summary: unavailable ?? (r.status === "matched" ? (r.congressional ?? []).map((c: any) => c.name).join(", ") || "matched" : "No match for that address"), source: src(r.source, "Census Geocoder") };
  }
  return { summary: "done", source: null };
}

function makeTools(zip: string, emit: Emit, steps: Step[], cites: Map<string, string>) {
  const wrap = async <T,>(name: string, fn: () => Promise<T> | T): Promise<T> => {
    const label = STEP_LABEL[name] ?? name;
    emit({ type: "step", tool: name, label, status: "running" });
    const t0 = Date.now();
    const r = await fn();
    const { summary, source } = summarize(name, r);
    const step: Step = { tool: name, label, status: "done", ms: Date.now() - t0, summary, source };
    steps.push(step);
    if (source) cites.set(source.url, source.label);
    emit({ type: "step", ...step });
    return r;
  };
  const z0 = z.object({});
  return {
    getBallot: tool({ description: "Every race and measure on the voter's Nov 3, 2026 ballot (title, office, source URL).", inputSchema: z0, execute: () => wrap("getBallot", () => getRaces(zip)) }),
    findPerson: tool({ description: "Find a person by name on the Austin, San Francisco or New York ballots: race, party, incumbent, official site and Ballotpedia link. Use for any 'who is X' question.", inputSchema: z.object({ name: z.string() }), execute: ({ name }) => wrap("findPerson", () => findPeople(name)) }),
    getCandidates: tool({ description: "Candidates (name, party, incumbent) for race ids from getBallot, or all races when none are given.", inputSchema: z.object({ raceIds: z.array(z.string()).optional() }), execute: ({ raceIds }) => wrap("getCandidates", () => getCandidates(zip, raceIds)) }),
    getCandidatePositions: tool({ description: "One candidate's published positions: exact quote plus source URL, optionally for one issue. Returns 'no public statement found' when there is none.", inputSchema: z.object({ name: z.string(), issue: z.string().optional() }), execute: ({ name, issue }) => wrap("getCandidatePositions", () => getCandidatePositions(name, issue)) }),
    getCampaignFinance: tool({ description: "Live OpenFEC: 2026 receipts, spending and cash on hand for one federal candidate (U.S. House or Senate), with the fec.gov record link. Pass the name and 2-letter state.", inputSchema: z.object({ name: z.string(), state: z.string().length(2) }), execute: ({ name, state }) => wrap("getCampaignFinance", () => getCampaignFinance({ name, state })) }),
    getSponsoredBills: tool({ description: "Live Congress.gov: the current U.S. House member for a state and district number, and their most recent sponsored bills.", inputSchema: z.object({ state: z.string().length(2), district: z.number().int() }), execute: ({ state, district }) => wrap("getSponsoredBills", () => getSponsoredBills({ state, district })) }),
    getCountyUnemployment: tool({ description: "Live BLS LAUS: the latest monthly unemployment rate for the voter's county.", inputSchema: z0, execute: () => wrap("getCountyUnemployment", () => getCountyUnemployment({ zip })) }),
    getMarketOdds: tool({ description: "Live Polymarket prices for race or measure ids from getBallot. A market price, not a prediction or a poll. Only when asked about markets or odds.", inputSchema: z.object({ raceIds: z.array(z.string()).max(10) }), execute: ({ raceIds }) => wrap("getMarketOdds", () => getMarketOdds(raceIds)) }),
    getElectionDates: tool({ description: townyTools.getElectionDates.description!, inputSchema: z0, execute: () => wrap("getElectionDates", () => getElectionDates(zip)) }),
    getPollingLocations: tool({ description: townyTools.getPollingLocations.description!, inputSchema: z0, execute: () => wrap("getPollingLocations", () => getPollingLocations(zip)) }),
    getProjectDocs: tool({ description: "townhall.town's own docs: how the agent works, how races are ranked, sources policy, privacy, coverage, the FAQ and the GitHub repo. Use for any question about the project itself.", inputSchema: z.object({ topic: z.string() }), execute: ({ topic }) => wrap("getProjectDocs", () => projectDocs(topic)) }),
  };
}

const RULES = `TOWNY CHAT RULES (this turn)
- Answer the voter's question in 1 to 4 short sentences, in plain words, using ONLY facts from tool results in this turn. Call tools first; never answer a factual question from memory.
- If the tools don't have it, say exactly "Unsure: I couldn't find that in a cited source." and name what you checked.
- Never recommend, rank, grade or endorse a candidate or a position. Never say "vote for", "best", "likely to win" or "match".
- Polymarket numbers are market prices, never predictions or polls. Census figures are estimates; say so.
- Do not state ballot order, dates or hours unless a tool returned them.
- Never write URLs, website names or "more at" phrases; the sources are shown as links under your reply.`;

/** Plain sentences only: markdown, URLs, bare domains and dangling "more at ...:" tails are removed (sources show as links). */
export function plainText(s: string): string {
  // Links become a marker first, so a sentence that pointed at one is dropped whole and decimals stay intact.
  const marked = s
    .replace(/\[[^\]]*\]\([^)]*\)?/g, " \u00a7 ")
    .replace(/https?:\/\/\S+/g, " \u00a7 ")
    .replace(/\b(?:[\w-]+\.)+(?:gov|org|com|net|edu|us)\b(?:\/\S*)?/gi, " \u00a7 ")
    .replace(/[*_`#]+/g, "")
    .replace(/^\s*(?:[-\u2022]|\d+[.)])\s+/gm, "")
    .replace(/\s*\n+\s*/g, " ");
  const drop = /\u00a7|\b(more details|find more|can be found|learn more|visit|check out)\b|:\s*$/i;
  return marked
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map((x) => x.trim())
    .filter((x) => x && !drop.test(x))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Counts from the ballot data, never from the model, for any reply that tried to list the ballot. */
export function ballotPointer(zip: string): string {
  const b = ballotFor(zip);
  if (!b) return "";
  return `Your ballot has ${b.races.length} races and ${b.measures.length} measures, each listed with its source in the ballot section on this page. Ask me about any one race, person or measure.`;
}

/** Whether the latest message reads like a question to answer rather than a preference to record. */
export const isQuestion = (t: string) => /\?\s*$/.test(t) || /^\s*(who|what|when|where|why|how|which|is|are|can|could|does|do|did|will|should|tell me|explain|show me|list|give me|compare)\b/i.test(t);

const ADDRESS = /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Za-z0-9.'-]+\s+){0,4}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Pl|Place|Ct|Court|Pkwy|Parkway|Hwy|Highway)\b\.?(?:[^?]*?\b\d{5}\b)?/i;

export async function townyAgent(zip: string, messages: string[], emit: Emit = () => {}): Promise<AgentReply | null> {
  const steps: Step[] = [];
  const cites = new Map<string, string>();
  const last = messages[messages.length - 1] ?? "";
  // An address goes only to the Census Geocoder, never to the model: the model sees the districts it returned.
  let geo = "";
  const addr = last.match(ADDRESS)?.[0];
  if (addr) {
    const label = STEP_LABEL.geocodeAddress;
    emit({ type: "step", tool: "geocodeAddress", label, status: "running" });
    const t0 = Date.now();
    const g = await geocodeAddress(/\b\d{5}\b/.test(addr) ? addr : `${addr}, ${zip}`);
    const { summary, source } = summarize("geocodeAddress", g);
    const step: Step = { tool: "geocodeAddress", label, status: "done", ms: Date.now() - t0, summary, source };
    steps.push(step);
    if (source) cites.set(source.url, source.label);
    emit({ type: "step", ...step });
    geo = `\n\nCensus Geocoder result for the voter's address (address withheld): ${JSON.stringify({ ...g, source: undefined })}`;
  }
  const history = messages.slice(0, -1).map((m) => redact(m).text);
  const prompt = `Voter's ZIP: ${zip}\n${history.length ? `Earlier messages:\n${history.map((h) => `- ${h}`).join("\n")}\n` : ""}Question: ${redact(last).text}${geo}`;
  const tz = getElectionDates(zip)?.timezone ?? "America/Chicago";
  const system = `${townyPrompt(longDateIn(tz))}\n\n${TOWNY_BRIEF}\n\n${RULES}`;
  for (const m of MODELS) {
    const tools = makeTools(zip, emit, steps, cites);
    try {
      emit({ type: "status", message: `Asking ${m}` });
      const res = await generateText({
        model: m as LanguageModel,
        system,
        prompt,
        tools,
        temperature: 0,
        maxRetries: 0,
        providerOptions: GATEWAY_FALLBACKS,
        stopWhen: stepCountIs(5),
        maxOutputTokens: 400,
        abortSignal: AbortSignal.timeout(22000),
        experimental_repairToolCall: async ({ toolCall, tools: available }) => {
          const norm = (n: string) => n.split(/[.:/]/).pop()!.replace(/[^a-z0-9]/gi, "").toLowerCase();
          const fixed = Object.keys(available).find((k) => norm(k) === norm(toolCall.toolName));
          return fixed ? { ...toolCall, toolName: fixed } : null;
        },
      });
      const raw = res.text ?? "";
      // Post-check (QA): the model never lists races or candidates; a list in the reply is replaced by counts from the
      // ballot data, and the full sourced list stays in the ballot section.
      const listLines = raw.split("\n").filter((l) => /^\s*(?:[-*\u2022]|\d+[.)])\s+/.test(l)).length;
      const reply0 = listLines >= 3 ? ballotPointer(zip) : plainText(raw);
      if (!reply0) continue;
      const reply = outputFlags(reply0).length ? "Unsure: I can share sourced facts about the races and candidates, but I don't rank or recommend them. Ask me about a race, a person or a measure." : reply0;
      const links = [...cites].map(([url, label]) => ({ label, url })).slice(0, 5);
      return { reply, links, model: m, steps };
    } catch (e: any) {
      emit({ type: "status", message: `Model ${m} unavailable (${String(e?.message || e).slice(0, 80)})` });
    }
  }
  return null;
}
