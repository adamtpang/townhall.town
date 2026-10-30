// Towny follow-ups (item 4 of "Towny is a 10/10 agent"). Civic rules: civic/towny21/towny_verification_rules.md.
// A follow-up ("what about Prop A?", "why is she ranked first?") goes back to the tools: measure / race lookup,
// candidate positions, sources and the overlap computation. Every factual sentence then goes through verifyClaims.
// The model (lib/models.ts ladder, AI Gateway) only routes a question to a tool when the rules below can't; it never writes facts.
//
// Privacy: the voter's ballot context (ZIP, races) and answers come from the client's localStorage on every call.
// Nothing here stores, logs or echoes them. The run log (toolCalls) never carries the ZIP or the answers.
import { generateObject } from "ai";
import { z } from "zod";
import { ballotFor, type Ballot } from "../tools";
import { measuresFor, type MeasureMath } from "../measures";
import { stancesFor, ISSUES, candidateId } from "../issues";
import { issuesFor } from "../issueOrder";
import { issueIdsFor } from "../townyTools";
import { getPollingLocations } from "../logistics";
import { townyFact } from "../townyFacts";
import { redact } from "../townyControls";
import { GATEWAY_FALLBACKS, modelLadder } from "../models";
import { isCoveredZip, UNSUPPORTED_MESSAGE } from "../site";
// @ts-ignore plain ESM helper
import { overlapFor, MIN_ISSUES } from "../overlapCore.mjs";
import { verifyClaims, withRetry, type Claim, type Source, type ToolRun, type VerifiedClaim, type VerifyReport } from "./verify";

export const WHO_LINE = "I don't pick for you. I can show where each candidate's sourced positions overlap with your answers.";
export const OUT_OF_SCOPE = UNSUPPORTED_MESSAGE; // "Austin, SF and NYC for now."
export const OFFER_OTHERS = "Want to see the other candidates in this race?";
export const NOT_A_REC = "Issue overlap is not a recommendation, and a missing statement says nothing about a candidate.";
export const ORDER_LINE = "Towny lists candidates in ballot order and never reorders them by overlap, party or odds.";
export const MEASURE_LINE = "Towny doesn't say which way to vote on a measure.";
export const ASK_WHICH = "Which race or measure do you mean? Name the office, the candidate or the measure (for example, Prop A).";
export const NO_ROUTE = "I can answer follow-ups about a race, a candidate's sourced positions, a ballot measure, or where and when to vote.";

/** Official office per ZIP, for "Sources differ; verify with <office>." */
export const OFFICE: Record<string, string> = {
  "78701": "Travis County Elections (votetravis.gov)",
  "94103": "the San Francisco Department of Elections (sfelections.org)",
  "10001": "the NYC Board of Elections (vote.nyc)",
};

export type Answers = Record<string, number | null>;
export type FollowupInput = {
  zip: string;
  /** Race ids the voter has on screen (optional; the server re-derives the ballot from the ZIP). */
  races?: string[];
  /** What the voter is looking at, so "she" / "it" can be resolved without guessing anyone's gender. */
  focus?: { raceId?: string; candidate?: string; measureId?: string };
  answers?: Answers;
  question: string;
};
export type ToolCall = { tool: string; input: Record<string, unknown>; ok: boolean; ms: number; summary: string };
export type FollowupResult = {
  kind: "out_of_scope" | "who" | "measure" | "order" | "positions" | "overlap" | "candidates" | "logistics" | "clarify" | "none";
  reply: string;
  claims: VerifiedClaim[];
  report: VerifyReport | null;
  links: { label: string; url: string }[];
  toolCalls: ToolCall[];
  routedBy: "rules" | "model" | "fixed";
  model: string | null;
};

// ---------------------------------------------------------------------------------------------------------------------
// Input hygiene: only known issue ids, numbers -5..5. Never stored.
export function cleanAnswers(a: unknown): Answers {
  const out: Answers = {};
  if (!a || typeof a !== "object") return out;
  const ids = new Set(ISSUES.map((i) => i.id));
  for (const [k, v] of Object.entries(a as Record<string, unknown>)) {
    if (!ids.has(k)) continue;
    out[k] = typeof v === "number" && Number.isFinite(v) ? Math.max(-5, Math.min(5, v)) : null;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Routing rules.
export const ASKS_WHO = /\bwho\b[^?]*\b(should|do|would|to)\b[^?]*\b(vote|pick|choose|support|back)\b|\bwho\b[^?]*\bvote for\b|\bshould i vote\b|\bwho('?s| is) (the )?best\b|\bwho (matches|fits)\b|\b(best|top) (candidate|choice|pick)\b|\bjust tell me\b|\bpick for me\b|\bwhich (one|candidate)\b[^?]*\b(should|best|pick|choose)\b|\btell me who\b|\bhow should i vote\b/i;
const ASKS_ORDER = /\b(rank(ed|ing)?|listed first|first on|on top|at the top|why is \S+ first|why (is|are) [^?]* first|order)\b/i;
const ASKS_OVERLAP = /\boverlap|line up with|compare (them|they|candidates)? ?(with|to) my|agree with me/i;
const ASKS_MEASURE = /\b(prop(?:osition)?\.?|proposal|measure)\s*([a-z]|\d{1,2})\b/i;
const ASKS_WHERE = /\bwhere (do|can|should) i vote\b|\bpolling (place|site|location)\b|\bpoll site\b/i;
const OTHER_PLACE = /\b(houston|dallas|san antonio|fort worth|el paso|los angeles|oakland|san diego|chicago|miami|seattle|boston|atlanta|denver|phoenix)\b/i;

const words = (s: string) => candidateId(s).split("-").filter(Boolean);

type Cand = { name: string; party: string | null; raceId: string; raceTitle: string; index: number };
function candidatesOf(b: Ballot): Cand[] {
  return b.races.flatMap((r) => r.candidates.map((c, i) => ({ name: c.name, party: c.party, raceId: r.id, raceTitle: r.title, index: i })));
}
/** Candidates named in the text: full name, or a unique last name (4+ letters). */
export function findCandidates(b: Ballot, text: string): Cand[] {
  const t = ` ${words(text).join(" ")} `;
  const all = candidatesOf(b);
  const full = all.filter((c) => t.includes(` ${words(c.name).join(" ")} `));
  if (full.length) return full;
  const last = all.filter((c) => { const w = words(c.name); const l = w[w.length - 1]; return l.length >= 4 && t.includes(` ${l} `); });
  const names = new Set(last.map((c) => candidateId(c.name)));
  return names.size === 1 ? last : [];
}
/** A measure named in the text ("Prop A", "Proposition 40", "Proposal 1"). Local measures first when letters, state when numbers. */
export function findMeasure(zip: string, text: string): MeasureMath | null {
  const m = ASKS_MEASURE.exec(text);
  if (!m) return null;
  const tag = m[2].toLowerCase();
  const list = measuresFor(zip);
  return list.find((x) => new RegExp(`(?:prop(?:osition)?|proposal)[\\s-]*${tag}\\b`, "i").test(x.id.replace(/-/g, " ") + " " + x.title)) ?? null;
}
const RACE_WORDS: [RegExp, RegExp][] = [
  [/\bgovernor\b(?!.*\blieutenant\b)/i, /^Governor/i], [/\blieutenant governor|lt\.? gov/i, /^Lieutenant Governor/i],
  [/\bsenat(e|or)\b/i, /U\.S\. Senate/i], [/\bmayor\b/i, /Mayor/i], [/attorney general/i, /^Attorney General/i],
  [/\bcomptroller\b/i, /Comptroller/i], [/\bcongress|\bhouse\b|representative\b/i, /^U\.S\. House/i],
  [/\bsupervisor/i, /Board of Supervisors/i], [/\bcity council|council\b/i, /City Council/i], [/\bassembly\b/i, /Assembly/i],
  [/\bcontroller\b/i, /Controller/i], [/\btreasurer\b/i, /Treasurer/i], [/\bsecretary of state\b/i, /Secretary of State/i],
];
export function findRace(b: Ballot, text: string) {
  for (const [q, title] of RACE_WORDS) if (q.test(text)) { const r = b.races.find((x) => title.test(x.title)); if (r) return r; }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Curated sources. Each record becomes a Source whose text is exactly what the record states.
const hostLabel = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
const curated = (url: string | null | undefined, text: string, subject?: string): Source | null =>
  url ? { url, label: hostLabel(url), origin: "curated", text, subject } : null;

/** Live check of the answer's sources (retry once, then visible fallback). HTML text counts as a live source; PDFs only prove reachability. */
async function fetchLive(urls: string[], fetcher: typeof fetch, runs: ToolRun[], calls: ToolCall[]): Promise<Source[]> {
  const uniq = [...new Set(urls.filter(Boolean))].slice(0, 4);
  const out: Source[] = [];
  await Promise.all(uniq.map(async (url) => {
    const t0 = Date.now();
    const { value, run } = await withRetry("fetchSource", hostLabel(url), async () => {
      const r = await fetcher(url, { signal: AbortSignal.timeout(3000), headers: { "user-agent": "townhall.town Towny self-check" } });
      if (!r.ok) throw new Error(String(r.status));
      const type = r.headers.get("content-type") ?? "";
      const raw = /html|text\/plain/.test(type) ? (await r.text()).slice(0, 400000) : "";
      return raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, " ");
    }, () => null as string | null);
    runs.push(run);
    calls.push({ tool: "fetchSource", input: { source: hostLabel(url) }, ok: run.ok, ms: Date.now() - t0, summary: run.ok ? `Fetched ${hostLabel(url)}${run.attempts > 1 ? " (second try)" : ""}` : run.fallback! });
    if (value !== null) out.push({ url, label: hostLabel(url), origin: "live", text: value, fetchedInRun: true });
  }));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Tools. Each returns claims (with their curated sources) and fixed, non-factual framing lines.
type Built = { kind: FollowupResult["kind"]; head?: string; claims: Claim[]; sources: Source[]; tail: string[]; links: { label: string; url: string }[] };

function measureTool(zip: string, m: MeasureMath, office: string): Built {
  const claims: Claim[] = [];
  const sources: Source[] = [];
  const add = (id: string, label: string, f: { text?: string; value?: string; sourceUrl: string | null } | undefined, key: string) => {
    const v = f ? (f.text ?? f.value ?? "") : "";
    claims.push({ id, field: "measure", text: `${label}: ${v}`, value: v, subject: undefined, key: `${m.id}.${key}`, office, searched: f?.sourceUrl ? [hostLabel(f.sourceUrl)] : ["measures.json"] });
    const s = curated(f?.sourceUrl, v); if (s) sources.push(s);
  };
  claims.push({ id: `${m.id}.title`, field: "measure", text: `${m.title} is on your ballot.`, value: m.title, key: `${m.id}.title`, office });
  { const s = curated(m.officialTitleSource ?? m.whatChanges?.sourceUrl, m.title); if (s) sources.push(s); }
  add(`${m.id}.changes`, "What it changes", m.whatChanges, "whatChanges");
  add(`${m.id}.yes`, "A yes vote", m.ifYes, "ifYes");
  add(`${m.id}.no`, "A no vote", m.ifNo, "ifNo");
  add(`${m.id}.cost`, "Cost", { value: m.cost?.value, sourceUrl: m.cost?.sourceUrl ?? null }, "cost");
  return { kind: "measure", claims, sources, tail: [MEASURE_LINE], links: [] };
}

function positionsOf(name: string, issueIds: string[] | null) {
  const st = stancesFor(name);
  return Object.entries(st)
    .filter(([id, s]) => (!issueIds || issueIds.includes(id)) && s && s.value !== null && s.sourceUrl && (s.quote || s.voteRecord))
    .map(([id, s]) => ({ id, label: ISSUES.find((i) => i.id === id)?.label ?? id, quote: String(s.voteRecord ? `${s.voteRecord}${s.quote ? `: ${s.quote}` : ""}` : s.quote), url: String(s.sourceUrl), vote: !!s.voteRecord }));
}

function positionsTool(c: Cand, issue: string | null): Built {
  const ids = issue ? issueIdsFor(issue) : null;
  const ps = positionsOf(c.name, ids);
  const claims: Claim[] = [];
  const sources: Source[] = [];
  if (!ps.length) claims.push({ id: `${candidateId(c.name)}.none`, field: "stance", text: `${c.name}:`, value: null, subject: c.name });
  for (const p of ps) {
    claims.push({ id: `${candidateId(c.name)}.${p.id}`, field: p.vote ? "vote" : "stance", text: `${c.name} ${p.vote ? "voted" : "says"} (${p.label}): "${p.quote}"`, value: p.quote, subject: c.name, key: `${c.name}.${p.id}` });
    sources.push({ ...curated(p.url, p.quote, c.name)! });
  }
  const head = `${c.name}${c.party ? ` (${c.party})` : ""}, ${c.raceTitle}.`;
  return { kind: "positions", head, claims, sources, tail: [OFFER_OTHERS], links: [] };
}

function overlapOf(zip: string, b: Ballot, name: string, answers: Answers) {
  const issueIds = issuesFor(zip, b.state).map((i) => i.id);
  const st = stancesFor(name);
  const o = overlapFor(answers, st, issueIds) as { n: number; agree: number; counted: string[]; enough: boolean };
  return { o, st };
}
const overlapSentence = (name: string, o: { n: number; agree: number; enough: boolean }) =>
  o.n >= MIN_ISSUES ? `${name}: issue overlap with your answers: ${o.agree} of ${o.n} issues.` : `${name}: fewer than ${MIN_ISSUES} issues where you answered and ${name} has a sourced position, so no overlap count.`;

/** Claims for every stance that went into an overlap count, so the count rests only on verified, sourced positions. */
function overlapClaims(name: string, st: Record<string, { quote?: string; voteRecord?: string; sourceUrl?: string | null }>, counted: string[]) {
  const claims: Claim[] = [];
  const sources: Source[] = [];
  for (const id of counted) {
    const s = st[id];
    const q = String(s.voteRecord ? `${s.voteRecord}${s.quote ? `: ${s.quote}` : ""}` : s.quote ?? "");
    const label = ISSUES.find((i) => i.id === id)?.label ?? id;
    claims.push({ id: `${candidateId(name)}.${id}`, field: s.voteRecord ? "vote" : "stance", text: `${name} ${s.voteRecord ? "voted" : "says"} (${label}): "${q}"`, value: q, subject: name, onFail: "drop" });
    const src = curated(s.sourceUrl, q, name); if (src) sources.push(src);
  }
  return { claims, sources };
}

function orderTool(zip: string, b: Ballot, raceId: string, who: string | null, answers: Answers): Built {
  const r = b.races.find((x) => x.id === raceId)!;
  const names = r.candidates.map((c) => c.name);
  const listed = names.map((n, i) => `${i + 1}. ${n}`).join(" ");
  const src = curated(r.source, `${r.title}. Ballot order: ${listed}`);
  const target = who ?? names[0];
  const pos = names.findIndex((n) => candidateId(n) === candidateId(target));
  const claims: Claim[] = [
    { id: `${r.id}.order`, field: "race", text: `${r.title}: ${names.join(", ")}, in ballot order.`, value: `Ballot order: ${listed}`, office: OFFICE[zip] },
    { id: `${r.id}.position`, field: "race", text: `${target} is listed ${pos === 0 ? "first" : `number ${pos + 1}`} because that is the order on the ballot.`, value: `${pos + 1}. ${target}`, office: OFFICE[zip] },
  ];
  const sources: Source[] = src ? [src] : [];
  const { o, st } = overlapOf(zip, b, target, answers);
  const oc = overlapClaims(target, st as never, o.counted);
  return { kind: "order", claims: [...claims, ...oc.claims], sources: [...sources, ...oc.sources], tail: [ORDER_LINE, overlapSentence(target, o), NOT_A_REC, OFFER_OTHERS], links: [] };
}

function overlapTool(zip: string, b: Ballot, raceId: string, answers: Answers): Built {
  const r = b.races.find((x) => x.id === raceId)!;
  const claims: Claim[] = [];
  const sources: Source[] = [];
  const lines: string[] = [];
  if (r.judicial) return { kind: "overlap", claims: [], sources: [], tail: [`${r.title}: court races are not compared.`], links: [] };
  for (const c of r.candidates) {
    const { o, st } = overlapOf(zip, b, c.name, answers);
    const oc = overlapClaims(c.name, st as never, o.counted);
    claims.push(...oc.claims); sources.push(...oc.sources);
    lines.push(overlapSentence(c.name, o));
  }
  return { kind: "overlap", head: `${r.title}, in ballot order:`, claims, sources, tail: [...lines, NOT_A_REC], links: [] };
}

function candidatesTool(zip: string, b: Ballot, raceId: string): Built {
  const r = b.races.find((x) => x.id === raceId)!;
  const listed = r.candidates.map((c, i) => `${i + 1}. ${c.name}${c.party ? ` (${c.party})` : ""}`).join(" ");
  const src = curated(r.source, `${r.title}. Ballot order: ${listed}`);
  const claims: Claim[] = r.candidates.map((c, i) => ({ id: `${r.id}.${i}`, field: "race", text: `${i + 1}. ${c.name}${c.party ? ` (${c.party})` : ""}`, value: `${i + 1}. ${c.name}${c.party ? ` (${c.party})` : ""}`, office: OFFICE[zip] }));
  return { kind: "candidates", head: `${r.title}, in ballot order:`, claims, sources: src ? [src] : [], tail: ["Ask about any candidate's sourced positions."], links: [] };
}

function logisticsTool(zip: string, question: string): Built | null {
  const f = townyFact(zip, question);
  if (f) {
    const src: Source = { url: f.links[0]?.url ?? "", label: f.links[0]?.label ?? "official source", origin: "curated", text: f.reply };
    return { kind: "logistics", claims: [{ id: "logistics", field: "logistics", text: f.reply, value: f.reply, office: OFFICE[zip] }], sources: src.url ? [src] : [], tail: [], links: f.links };
  }
  if (ASKS_WHERE.test(question)) {
    const p = getPollingLocations(zip);
    if (!p) return null;
    const line = p.dependsOnAddress ? `Your polling place depends on your address. Look it up on the official site.` : `${p.jurisdiction}: you can vote at any county site.`;
    return { kind: "logistics", claims: [{ id: "polling", field: "logistics", text: line, value: p.jurisdiction, office: OFFICE[zip] }], sources: [{ url: p.lookupUrl, label: hostLabel(p.lookupUrl), origin: "curated", text: `${p.jurisdiction} ${p.lookupUrl}` }], tail: [], links: [{ label: "Official polling place lookup", url: p.lookupUrl }] };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Model router: only picks a tool and an entity from closed lists. Never writes a fact.
export type Route = { intent: "measure" | "order" | "positions" | "overlap" | "candidates" | "logistics" | "who" | "other"; measureId?: string | null; raceId?: string | null; candidate?: string | null; issue?: string | null };

async function modelRoute(zip: string, b: Ballot, question: string): Promise<{ route: Route; model: string } | null> {
  const ms = measuresFor(zip);
  const cands = candidatesOf(b);
  const schema = z.object({
    intent: z.enum(["measure", "order", "positions", "overlap", "candidates", "logistics", "who", "other"]),
    measureId: z.string().nullable(), raceId: z.string().nullable(), candidate: z.string().nullable(), issue: z.string().nullable(),
  });
  const system = `You route a voter's follow-up question to one tool. You never answer it. Pick ids and names only from the lists.
Intents: measure (a ballot measure), order (why a candidate is listed or "ranked" first), positions (a candidate's positions), overlap (how candidates overlap with the voter's answers), candidates (who is running), logistics (when/where to vote), who (asks who to vote for or who is best), other.
Measures: ${ms.map((m) => `${m.id} = ${m.title}`).join("; ")}
Races: ${b.races.map((r) => `${r.id} = ${r.title}`).join("; ")}
Candidates: ${cands.map((c) => c.name).join("; ")}
Issues: ${ISSUES.map((i) => i.id).join(", ")}`;
  for (const { label, model } of modelLadder().slice(0, 2)) {
    try {
      const { object } = await generateObject({ model, schema, system, prompt: redact(question).text, temperature: 0, maxRetries: 0, providerOptions: GATEWAY_FALLBACKS, abortSignal: AbortSignal.timeout(8000) });
      const r = object as Route;
      if (r.measureId && !ms.some((m) => m.id === r.measureId)) r.measureId = null;
      if (r.raceId && !b.races.some((x) => x.id === r.raceId)) r.raceId = null;
      if (r.candidate && !cands.some((c) => candidateId(c.name) === candidateId(r.candidate!))) r.candidate = null;
      return { route: r, model: label };
    } catch { /* next model */ }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
export type FollowupDeps = { fetcher?: typeof fetch; useModel?: boolean; live?: boolean };

function fixed(kind: FollowupResult["kind"], reply: string, links: { label: string; url: string }[] = []): FollowupResult {
  return { kind, reply, claims: [], report: null, links, toolCalls: [], routedBy: "fixed", model: null };
}

/** One follow-up turn. Never throws for bad input; never stores or logs the input. */
export async function answerFollowup(input: FollowupInput, deps: FollowupDeps = {}): Promise<FollowupResult> {
  const { fetcher = fetch, useModel = true, live = true } = deps;
  const q = String(input.question ?? "").slice(0, 600);
  const zip = String(input.zip ?? "");
  const zs = q.match(/\b\d{5}\b/g) ?? [];
  if (!isCoveredZip(zip) || zs.some((x) => !isCoveredZip(x)) || OTHER_PLACE.test(q)) return fixed("out_of_scope", OUT_OF_SCOPE, [{ label: "vote.gov", url: "https://vote.gov" }]);
  if (ASKS_WHO.test(q)) return fixed("who", WHO_LINE);
  const b = ballotFor(zip)!;
  const answers = cleanAnswers(input.answers);
  const calls: ToolCall[] = [];
  const runs: ToolRun[] = [];
  const call = <T,>(tool: string, inp: Record<string, unknown>, fn: () => T, summary: (r: T) => string): T => {
    const t0 = Date.now();
    const r = fn();
    calls.push({ tool, input: inp, ok: true, ms: Date.now() - t0, summary: summary(r) });
    return r;
  };

  // 1) Rules.
  let route: Route | null = null;
  let routedBy: FollowupResult["routedBy"] = "rules";
  let model: string | null = null;
  const named = findCandidates(b, q);
  const m = findMeasure(zip, q) ?? (/\b(it|this measure|that measure)\b/i.test(q) && input.focus?.measureId ? measuresFor(zip).find((x) => x.id === input.focus!.measureId) ?? null : null);
  const focusRace = input.focus?.raceId && b.races.some((r) => r.id === input.focus!.raceId) ? input.focus.raceId : null;
  const issueWord = ISSUES.find((i) => issueIdsFor(q).includes(i.id))?.id ?? null;
  if (m) route = { intent: "measure", measureId: m.id };
  else if (ASKS_ORDER.test(q)) route = { intent: "order", candidate: named[0]?.name ?? input.focus?.candidate ?? null, raceId: named[0]?.raceId ?? focusRace ?? findRace(b, q)?.id ?? null };
  else if (ASKS_OVERLAP.test(q)) route = { intent: "overlap", raceId: named[0]?.raceId ?? findRace(b, q)?.id ?? focusRace };
  else if (named.length) route = { intent: "positions", candidate: named[0].name, issue: issueWord };
  else if (townyFact(zip, q) || ASKS_WHERE.test(q)) route = { intent: "logistics" };
  else if (findRace(b, q)) route = { intent: "candidates", raceId: findRace(b, q)!.id };

  // 2) Model router for anything the rules can't place.
  if (!route && useModel) {
    const t0 = Date.now();
    const r = await modelRoute(zip, b, q);
    calls.push({ tool: "routeQuestion", input: { question: "(voter question)" }, ok: !!r, ms: Date.now() - t0, summary: r ? `${r.model} picked ${r.route.intent}` : "Couldn't reach the model, used rules only" });
    if (r) { route = r.route; routedBy = "model"; model = r.model; }
    else runs.push({ tool: "routeQuestion", ok: false, attempts: 2, fallback: "Couldn't reach the model, used rules only" });
  }
  if (route?.intent === "who") return fixed("who", WHO_LINE);
  if (!route || route.intent === "other") return { ...fixed("none", NO_ROUTE), toolCalls: calls, routedBy, model };

  // 3) Tools.
  let built: Built | null = null;
  const raceIdFor = (name?: string | null) => (name ? candidatesOf(b).find((c) => candidateId(c.name) === candidateId(name))?.raceId : undefined);
  switch (route.intent) {
    case "measure": {
      const mm = measuresFor(zip).find((x) => x.id === route.measureId);
      if (mm) built = call("getMeasure", { measureId: mm.id }, () => measureTool(zip, mm, OFFICE[zip]), () => `Official text and analysis for ${mm.title}`);
      break;
    }
    case "order": {
      const raceId = route.raceId ?? raceIdFor(route.candidate);
      if (raceId) {
        const r = b.races.find((x) => x.id === raceId)!;
        const who = route.candidate && r.candidates.some((c) => candidateId(c.name) === candidateId(route!.candidate!)) ? route.candidate : null;
        call("getCandidates", { raceId }, () => r.candidates.length, (n) => `${n} candidates in ballot order`);
        built = call("computeOverlap", { raceId, candidate: who ?? r.candidates[0]?.name }, () => orderTool(zip, b, raceId, who, answers), () => "Overlap counted on sourced positions only");
      }
      break;
    }
    case "overlap": {
      const raceId = route.raceId ?? raceIdFor(route.candidate);
      if (raceId) {
        call("getCandidates", { raceId }, () => b.races.find((x) => x.id === raceId)!.candidates.length, (n) => `${n} candidates in ballot order`);
        built = call("computeOverlap", { raceId }, () => overlapTool(zip, b, raceId, answers), (x) => `${x.claims.length} sourced positions counted`);
      }
      break;
    }
    case "positions": {
      const c = candidatesOf(b).find((x) => candidateId(x.name) === candidateId(route!.candidate ?? ""));
      if (c) built = call("getCandidatePositions", { name: c.name, issue: route.issue ?? null }, () => positionsTool(c, route!.issue ?? null), (x) => `${x.claims.filter((k) => k.value).length} sourced positions`);
      break;
    }
    case "candidates": {
      const raceId = route.raceId;
      if (raceId && b.races.some((x) => x.id === raceId)) built = call("getCandidates", { raceId }, () => candidatesTool(zip, b, raceId), (x) => `${x.claims.length} candidates`);
      break;
    }
    case "logistics":
      built = call("getElectionDates", { official: true }, () => logisticsTool(zip, q), (x) => (x ? "Official dates and places" : "Nothing found"));
      break;
  }
  if (!built) return { ...fixed("clarify", ASK_WHICH), toolCalls: calls, routedBy, model };

  // 4) Sources fetched in this run (retry once, then visible fallback), then the self-check.
  const liveSrc = live ? await fetchLive(built.sources.map((s) => s.url), fetcher, runs, calls) : [];
  const t0 = Date.now();
  const v = verifyClaims({ claims: built.claims, sources: [...built.sources, ...liveSrc], toolRuns: runs });
  calls.push({ tool: "verifyClaims", input: { claims: built.claims.length }, ok: true, ms: Date.now() - t0, summary: v.report.summary });

  const body = v.claims.filter((c) => c.status !== "dropped").map((c) => {
    const src = c.source && c.status !== "unsure" ? ` [${c.source.label}]` : "";
    return c.note ? `${c.display}${src} ${c.note}` : `${c.display}${src}`;
  });
  // Visible fallback: "Couldn't reach X, used curated data." goes in the answer itself, not only the run log.
  const fallbacks = v.report.fallbacks.map((f) => (f.endsWith(".") ? f : `${f}.`));
  const reply = [built.head, ...body, ...built.tail, ...fallbacks].filter(Boolean).join("\n");
  const links = [...built.links, ...v.claims.flatMap((c) => (c.source && c.status !== "unsure" ? [{ label: c.source.label, url: c.source.url }] : []))]
    .filter((l, i, a) => a.findIndex((x) => x.url === l.url) === i);
  return { kind: built.kind, reply, claims: v.claims, report: v.report, links, toolCalls: calls, routedBy, model };
}
