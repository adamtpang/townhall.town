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
import { townyFact, ASKS_EARLY } from "../townyFacts";
import { redact } from "../townyControls";
import { GATEWAY_FALLBACKS, modelLadder } from "../models";
import { isCoveredZip } from "../site";
// @ts-ignore plain ESM helper
import { overlapFor, MIN_ISSUES } from "../overlapCore.mjs";
import { verifyClaims, withRetry, UNSURE_NOTE, type Claim, type Source, type ToolRun, type VerifiedClaim, type VerifyReport } from "./verify";
import { OFFICES, type Office } from "./offices";
import { gateStance, countableStances } from "./stanceRules";
import { getElectionDates } from "../logistics";

export const WHO_LINE = "I don't pick for you. I can show where each candidate's sourced positions overlap with your answers.";
/** Civic, Oct 30 1:37 PM CT. "vote.gov" is linked to https://vote.gov in `links` (the route renders links). */
export const OUT_OF_SCOPE = "Towny covers Austin (78701), San Francisco (94103) and New York City (10001) right now. For your ballot, check vote.gov.";
export const VOTE_GOV = { label: "vote.gov", url: "https://vote.gov" };
export const OFFER_OTHERS = "Want to see the other candidates in this race?";
export const NOT_A_REC = "Issue overlap is not a recommendation, and a missing statement says nothing about a candidate.";
export const ORDER_LINE = "Towny lists candidates in ballot order and never reorders them by overlap, party or odds.";
/** Civic, Oct 30 1:37 PM CT: why a candidate is first. Cited to the office's sample ballot, never to Ballotpedia. */
export const STATE_LAW_LINE = "Candidates appear in the order printed on the official sample ballot, which is set under state election law, not by Towny.";
/** The ballot-order line until a race's order has been checked against the office's sample ballot (none has yet). */
export const ORDER_UNSURE = UNSURE_NOTE;
export const ORDER_UNCHECKED = "ballot order not yet checked against the office's sample ballot";
export const OFFER_COMPARE = "Want to compare every candidate's positions?";
export const officeSourceLine = (o: Office) => `Source: ${o.name} sample ballot [${o.label}]`;
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

type Cand = { name: string; party: string | null; raceId: string; raceTitle: string; index: number; campaignSite: string | null };
function candidatesOf(b: Ballot): Cand[] {
  return b.races.flatMap((r) => r.candidates.map((c, i) => ({ name: c.name, party: c.party, raceId: r.id, raceTitle: r.title, index: i, campaignSite: (c as { campaignSite?: string | null }).campaignSite ?? null })));
}
const campaignOf = (b: Ballot, name: string) => candidatesOf(b).find((c) => candidateId(c.name) === candidateId(name))?.campaignSite ?? null;
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
  [/\bsenat(e|or)\b/i, /U\.S\. Senat(e|or)\b/i], [/\bmayor\b/i, /Mayor/i], [/attorney general/i, /^Attorney General/i],
  [/\bcomptroller\b/i, /Comptroller/i], [/\bcongress|\bhouse\b|representative\b/i, /^U\.S\. (House|Representative)/i],
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
const curated = (url: string | null | undefined, text: string, subject?: string, label?: string): Source | null =>
  url ? { url, label: label ?? hostLabel(url), origin: "curated", text, subject } : null;

/** Live check of the answer's sources (retry once, then visible fallback). HTML text counts as a live source; PDFs only prove reachability. */
async function fetchLive(urls: string[], fetcher: typeof fetch, runs: ToolRun[], calls: ToolCall[], office?: Office): Promise<Source[]> {
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
    }, () => null as string | null, office?.verifyWith);
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
    // Every line ends with a period before its chip (Civic #1).
    const text = `${label}: ${v}`.replace(/\s+$/, "");
    claims.push({ id, field: "measure", text: /[.!?]["”)]?$/.test(text) ? text : `${text}.`, value: v, subject: undefined, key: `${m.id}.${key}`, office, absentPrefix: label, searched: f?.sourceUrl ? [hostLabel(f.sourceUrl)] : ["measures.json"] });
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

type Pos = { id: string; label: string; quote: string; url: string; chip: string; vote: boolean; unsure: string | null };
/** Sourced stances, each gated by stanceRules (Ballotpedia kinds, slogans). Unsure ones are kept, flagged, never counted. */
function positionsOf(name: string, campaignSite: string | null, issueIds: string[] | null): Pos[] {
  const st = stancesFor(name);
  return Object.entries(st)
    .filter(([id, s]) => (!issueIds || issueIds.includes(id)) && s && s.value !== null && s.sourceUrl && (s.quote || s.voteRecord))
    .map(([id, s]) => {
      const g = gateStance(s, campaignSite);
      const quote = String(s.voteRecord ? `${s.voteRecord}${s.quote ? `: ${s.quote}` : ""}` : s.quote);
      return { id, label: ISSUES.find((i) => i.id === id)?.label ?? id, quote, url: g.ok ? g.url : String(s.sourceUrl), chip: g.ok ? g.label : hostLabel(String(s.sourceUrl)), vote: !!s.voteRecord, unsure: g.ok ? null : g.reason };
    });
}
const stanceClaim = (name: string, p: Pos, onFail?: "drop"): Claim => ({
  id: `${candidateId(name)}.${p.id}`, field: p.vote ? "vote" : "stance", text: `${name} ${p.vote ? "voted" : "says"} (${p.label}): "${p.quote}"`, value: p.quote, subject: name, key: `${name}.${p.id}`,
  ...(p.unsure ? { forceUnsure: p.unsure } : onFail ? { onFail } : {}),
});

function positionsTool(c: Cand, issue: string | null): Built {
  const ids = issue ? issueIdsFor(issue) : null;
  const ps = positionsOf(c.name, c.campaignSite, ids);
  const claims: Claim[] = [];
  const sources: Source[] = [];
  if (!ps.length) claims.push({ id: `${candidateId(c.name)}.none`, field: "stance", text: `${c.name}:`, value: null, subject: c.name });
  for (const p of ps) {
    claims.push(stanceClaim(c.name, p));
    if (!p.unsure) sources.push({ ...curated(p.url, p.quote, c.name, p.chip)! });
  }
  const head = `${c.name}${c.party ? ` (${c.party})` : ""}, ${c.raceTitle}.`;
  return { kind: "positions", head, claims, sources, tail: [OFFER_OTHERS], links: [] };
}

function overlapOf(zip: string, b: Ballot, name: string, answers: Answers) {
  const issueIds = issuesFor(zip, b.state).map((i) => i.id);
  const campaignSite = campaignOf(b, name);
  // Unsure stances (Ballotpedia's own voice, slogans) are set to null first, so they are never counted.
  const o = overlapFor(answers, countableStances(stancesFor(name), campaignSite), issueIds) as { n: number; agree: number; counted: string[]; enough: boolean };
  const answered = issueIds.filter((id) => typeof answers[id] === "number");
  const ps = positionsOf(name, campaignSite, answered);
  return { o, ps };
}
const overlapSentence = (name: string, o: { n: number; agree: number; enough: boolean }) =>
  o.n >= MIN_ISSUES ? `${name}: issue overlap with your answers: ${o.agree} of ${o.n} issues.` : `${name}: fewer than ${MIN_ISSUES} issues where you answered and ${name} has a sourced position, so no overlap count.`;

/** Claims for every stance that went into an overlap count (so the count rests only on verified, sourced positions),
 *  plus the voter's answered issues whose stance is unsure: shown as unsure, not counted. */
function overlapClaims(name: string, ps: Pos[], counted: string[]) {
  const claims: Claim[] = [];
  const sources: Source[] = [];
  for (const p of ps) {
    if (!p.unsure && !counted.includes(p.id)) continue;
    claims.push(stanceClaim(name, p, "drop"));
    if (!p.unsure) { const src = curated(p.url, p.quote, name, p.chip); if (src) sources.push(src); }
  }
  return { claims, sources };
}

/** The ballot-order block (Civic fixes 2 and 4): unsure until checked against the office's sample ballot, the state-law
 *  line, the office source. Never Ballotpedia, never "Sources differ". */
function orderBlock(zip: string, r: Ballot["races"][number]): { claim: Claim; tail: string[]; links: { label: string; url: string }[] } {
  const o = OFFICES[zip];
  const listed = r.candidates.map((c, i) => `${i + 1}. ${c.name}`).join(" ");
  return {
    claim: { id: `${r.id}.order`, field: "race", text: `${r.title}: ${r.candidates.map((c) => c.name).join(", ")}, in ballot order.`, value: `Ballot order: ${listed}`, forceUnsure: ORDER_UNCHECKED, unsureAs: "note" },
    tail: [STATE_LAW_LINE, officeSourceLine(o)],
    links: [{ label: o.label, url: o.sampleBallot }],
  };
}

/** "Why is X first?" Neutral on purpose (Civic P1): no stances and no overlap for any single candidate. */
function orderTool(zip: string, b: Ballot, raceId: string): Built {
  const r = b.races.find((x) => x.id === raceId)!;
  const ob = orderBlock(zip, r);
  return { kind: "order", claims: [ob.claim], sources: [], tail: [...ob.tail, OFFER_COMPARE], links: ob.links };
}

function overlapTool(zip: string, b: Ballot, raceId: string, answers: Answers): Built {
  const r = b.races.find((x) => x.id === raceId)!;
  const claims: Claim[] = [];
  const sources: Source[] = [];
  const lines: string[] = [];
  if (r.judicial) return { kind: "overlap", claims: [], sources: [], tail: [`${r.title}: court races are not compared.`], links: [] };
  for (const c of r.candidates) {
    const { o, ps } = overlapOf(zip, b, c.name, answers);
    const oc = overlapClaims(c.name, ps, o.counted);
    claims.push(...oc.claims); sources.push(...oc.sources);
    lines.push(overlapSentence(c.name, o));
  }
  return { kind: "overlap", head: `${r.title}:`, claims, sources, tail: [...lines, NOT_A_REC], links: [] };
}

function candidatesTool(zip: string, b: Ballot, raceId: string): Built {
  const r = b.races.find((x) => x.id === raceId)!;
  const names = r.candidates.map((c) => `${c.name}${c.party ? ` (${c.party})` : ""}`);
  const ob = orderBlock(zip, r);
  // Who is running comes from the race record; the order itself is cited only to the office (orderBlock).
  const src = curated(r.source, `${r.title}. Candidates: ${names.join("; ")}`);
  const claims: Claim[] = names.map((n, i) => ({ id: `${r.id}.${i}`, field: "race", text: n, value: n, office: OFFICE[zip] }));
  return { kind: "candidates", head: `${r.title}:`, claims: [...claims, ob.claim], sources: src ? [src] : [], tail: [...ob.tail, "Ask about any candidate's sourced positions."], links: ob.links };
}

/** SF early voting (Civic #12): built from data/election_dates.json (the SF Department of Elections' dates, stated on
 *  sf.gov), cited to sfelections.org. Returns null unless the data has exactly the shape the sentence needs. */
const shortDay = (iso: string, weekday = false) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...(weekday ? { weekday: "short" } : {}), month: "short", day: "numeric" });
export function sfEarlyVoting(): { text: string; source: Source } | null {
  const j = getElectionDates("94103");
  const rows = j?.earlyVoting?.dailyHours ?? [];
  const wk = rows.find((x) => /^City Hall Voting Center\b/.test(x.appliesTo ?? "") && /^(\d{4}-\d\d-\d\d) to (\d{4}-\d\d-\d\d)/.test(String(x.dates ?? "")));
  const ed = j?.electionDay;
  const edRow = rows.find((x) => x.dates === ed?.date && /^City Hall Voting Center and all \d+ polling places$/.test(x.appliesTo ?? ""));
  if (!j || !wk || !ed || !edRow || ed.hours !== edRow.hours || j.timezone !== "America/Los_Angeles") return null;
  const [, start, end] = /^(\S+) to (\S+)/.exec(String(wk.dates))!;
  const text = `Early voting at City Hall runs ${shortDay(start)} to ${shortDay(end)}. Election Day is ${shortDay(ed.date, true)}, ${ed.hours} PT at City Hall and all polling places.`;
  const o = OFFICES["94103"];
  // Curated record text: the same data fields, in the same words.
  return { text, source: { url: o.home, label: o.label, origin: "curated", text } };
}

function logisticsTool(zip: string, question: string): Built | null {
  if (zip === "94103" && ASKS_EARLY.test(question)) {
    const sf = sfEarlyVoting();
    if (sf) return { kind: "logistics", claims: [{ id: "logistics", field: "logistics", text: sf.text, value: sf.text, office: OFFICE[zip] }], sources: [sf.source], tail: [], links: [] };
  }
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
  if (!isCoveredZip(zip) || zs.some((x) => !isCoveredZip(x)) || OTHER_PLACE.test(q)) return fixed("out_of_scope", OUT_OF_SCOPE, [VOTE_GOV]);
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
        void who; // the reply is the same for every candidate in the race: no single candidate is singled out
        built = call("getBallotOrder", { raceId }, () => orderTool(zip, b, raceId), () => `${r.candidates.length} candidates; order cited to ${OFFICES[zip].label}`);
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
  const liveSrc = live ? await fetchLive(built.sources.map((s) => s.url), fetcher, runs, calls, OFFICES[zip]) : [];
  const t0 = Date.now();
  const v = verifyClaims({ claims: built.claims, sources: [...built.sources, ...liveSrc], toolRuns: runs });
  calls.push({ tool: "verifyClaims", input: { claims: built.claims.length }, ok: true, ms: Date.now() - t0, summary: v.report.summary });

  const body = v.claims.filter((c) => c.status !== "dropped").map((c) => {
    const src = c.source && c.status !== "unsure" ? ` [${c.source.label}]` : "";
    return c.note ? `${c.display}${src} ${c.note}` : `${c.display}${src}`;
  });
  // Visible fallback: "Couldn't reach X; showing saved data. Verify with <office>." goes in the answer itself, not only the run log.
  const fallbacks = v.report.fallbacks.map((f) => (f.endsWith(".") ? f : `${f}.`));
  const reply = [built.head, ...body, ...built.tail, ...fallbacks].filter(Boolean).join("\n");
  const links = [...built.links, ...v.claims.flatMap((c) => (c.source && c.status !== "unsure" ? [{ label: c.source.label, url: c.source.url }] : []))]
    .filter((l, i, a) => a.findIndex((x) => x.url === l.url) === i);
  return { kind: built.kind, reply, claims: v.claims, report: v.report, links, toolCalls: calls, routedBy, model };
}
