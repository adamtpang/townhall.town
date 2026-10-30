// Towny self-check (item 3 of "Towny is a 10/10 agent"). Civic rules: civic/towny21/towny_verification_rules.md (Oct 30, 1:30 PM CT).
//
// verifyClaims() is a PURE function: claims + sources in, verified claims + a report out. No network, no clock, no logging.
// - Every factual sentence maps to curated data, or to a source fetched in THIS run that passes the per-field table
//   and actually states the claim (same subject AND the exact value). Same topic is not enough.
// - Curated data beats live data. If a live source states a different value for the same key: keep the curated value and
//   add "Sources differ; verify with <office>."
// - A failed check is rewritten as unsure (or dropped when the claim says so). It is never filled from model memory.
//
// Hook for lib/api/agent.ts (feat/agent-timeline): see lib/towny/agentHook.ts and notes in docs at the bottom of this file.

export const UNSURE_NOTE = "Unsure: we couldn't confirm this in a cited source.";
export const UNSURE_SUFFIX = " (unsure)";
export const NO_RECORD = "No record found.";
export const NO_POSITION = "No public position found yet.";
export const NO_VOTE = "No voting record found.";
export const searchedLine = (names: string[]) => `Searched: ${[...new Set(names)].join(", ")}.`;
export const differsLine = (office: string) => `Sources differ; verify with ${office}.`;
export const fallbackLine = (what: string) => `Couldn't reach ${what}, used curated data`;

/** Fields in Civic's "Valid source per field" table. */
export type Field = "race" | "logistics" | "stance" | "vote" | "money" | "measure" | "bio" | "metric";

export type SourceRef = { label: string; url: string };

/** One factual sentence Towny wants to say. `value` is the atomic fact the source must state (quote, number, date, name). */
export type Claim = {
  id: string;
  text: string;
  field: Field;
  /** Who or what the claim is about (candidate name, measure title). The source must name it unless it is that subject's own record. */
  subject?: string;
  /** The exact fact. null/"" means the lookup found nothing: the claim becomes a "no record" line. */
  value?: string | null;
  /** Key for conflict checks, e.g. "austin-prop-a.cost" or "Jane Doe.housing". */
  key?: string;
  /** What to do when the check fails: rewrite as unsure (default) or drop the sentence. */
  onFail?: "unsure" | "drop";
  /** Names of the places searched, for "Searched: ..." when nothing is found. */
  searched?: string[];
  /** Office (and link) to name in "Sources differ; verify with <office>." */
  office?: string;
};

export type Source = {
  url: string;
  label: string;
  /** "curated" = ballots.json / ny.json / stances / main points / finance / accountability / logistics. "live" = fetched in this run. */
  origin: "curated" | "live";
  /** The text the source states (curated record text, or the fetched page's text). */
  text: string;
  /** Structured values the source states, by claim key, for conflict checks. */
  values?: Record<string, string>;
  /** Live sources: true only when fetched in this run. A live source not fetched in this run is ignored. */
  fetchedInRun?: boolean;
  /** Who the source is about (curated records): a candidate's own record counts as naming them. */
  subject?: string;
};

export type ToolRun = { tool: string; ok: boolean; attempts: number; fallback?: string | null };

export type Status = "confirmed" | "unsure" | "no_record" | "differs" | "dropped";

export type VerifiedClaim = {
  id: string;
  field: Field;
  status: Status;
  /** Exactly what the voter sees for this sentence. */
  display: string;
  /** The extra line(s) under it: the unsure note, "Searched: ...", "Sources differ; ...". */
  note?: string;
  /** Present only when confirmed (or differs: the curated source). Unsure claims never get a source chip. */
  source?: SourceRef & { origin: "curated" | "live" };
  /** Why (for the run log): which check passed or failed. Never contains the voter's ZIP or answers. */
  reason: string;
};

export type VerifyReport = {
  checked: number;
  confirmed: number;
  unsure: number;
  noRecord: number;
  differs: number;
  dropped: number;
  /** "Checked 14 claims, 2 marked unsure" */
  summary: string;
  /** Visible lines for claims that couldn't be verified. */
  unverified: { id: string; text: string; status: Status; note?: string }[];
  /** Visible tool fallbacks, e.g. "Couldn't reach votetravis.gov, used curated data". */
  fallbacks: string[];
};

export type VerifyInput = { claims: Claim[]; sources: Source[]; toolRuns?: ToolRun[] };
export type VerifyOutput = { claims: VerifiedClaim[]; report: VerifyReport };

// ---------------------------------------------------------------------------------------------------------------------
// Per-field source table (Civic). Applies to LIVE sources; curated data was already checked by Civic.

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const is = (h: string, ...ds: string[]) => ds.some((d) => h === d || h.endsWith("." + d));

const OFFICIAL_ELECTION = ["votetravis.gov", "traviscountytx.gov", "sfelections.org", "sf.gov", "vote.nyc", "vote.nyc.ny.us", "elections.ny.gov", "sos.state.tx.us", "votetexas.gov", "sos.ca.gov", "nyc.gov", "nycvotes.org", "austintexas.gov", "austintexas.gov"];
const NOT_STANCE = /(democrats?|gop|republican|libertarian|greens?|party|slate|pac|scorecard|opinion|news)\b/i;
const NEWS = ["nytimes.com", "texastribune.org/20", "kut.org", "statesman.com", "sfchronicle.com", "sfstandard.com", "missionlocal.org", "cnn.com", "foxnews.com", "politico.com", "apnews.com", "reuters.com", "axios.com", "nbcnews.com", "abc.com", "cbsnews.com", "washingtonpost.com"];

/** Civic's "Valid source per field" table, for a live source. Returns null when valid, else the reason it isn't. */
export function invalidFor(field: Field, url: string, subject?: string): string | null {
  const h = host(url);
  if (!h) return "no URL";
  const u = url.toLowerCase();
  if (NEWS.some((n) => u.includes(n))) return "news is not a valid source for this field";
  switch (field) {
    case "race":
    case "logistics":
      return is(h, ...OFFICIAL_ELECTION) ? null : "needs the official election office";
    case "stance": {
      if (is(h, "ballotpedia.org")) return /candidate_connection|#campaign_themes/i.test(url) ? null : "Ballotpedia counts only for Candidate Connection answers";
      if (is(h, "lwv.org", "lwvaustin.org", "lwvsf.org", "lwvnyc.org", "vote411.org", "growsf.org", "atpe.org", "texastribune.org")) return /questionnaire|voter-guide|candidate/i.test(u) ? null : "needs a signed questionnaire";
      if (is(h, "wikipedia.org")) return "Wikipedia is not the candidate's own words";
      if (NOT_STANCE.test(h)) return "party, slate or PAC sites are not the candidate's own words";
      return null; // campaign site, official social profile, office statement
    }
    case "vote":
      return is(h, "congress.gov", "capitol.texas.gov", "leginfo.legislature.ca.gov", "nysenate.gov", "nyassembly.gov", "openstates.org", "sfbos.org", "legistar.com", "council.nyc.gov", "austintexas.gov") ? null : "needs an official vote record";
    case "money":
      return is(h, "fec.gov", "ethics.state.tx.us", "cal-access.sos.ca.gov", "sfethics.org", "nyccfb.info", "elections.ny.gov", "publicreporting.elections.ny.gov") ? null : "needs the filing office";
    case "measure":
      return is(h, ...OFFICIAL_ELECTION, "lao.ca.gov", "voterguide.sos.ca.gov", "sfcontroller.org", "media.api.sf.gov") ? null : "needs official ballot text or analyst summary";
    case "bio":
      return is(h, "wikipedia.org") ? "Wikipedia alone is not valid" : null;
    case "metric":
      return is(h, "census.gov", "data.census.gov", "bls.gov") || /\.gov$/.test(h) ? null : "needs Census, BLS or official data";
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// "Supported" = the source states the claim: same subject, same value.

export const norm = (s: string) => String(s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').toLowerCase().replace(/[^a-z0-9$%.'"]+/g, " ").replace(/\s+/g, " ").trim();
const nums = (s: string) => (String(s).match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
const UNKNOWN = /^\s*(unsure|unknown|n\/a|tbd|null|none)\s*\.?$/i;

/** True when `src` states `claim`: the claim's value appears verbatim (normalized), every number in the value appears,
 *  and the subject is named (or the source is that subject's own record). */
export function supports(claim: Claim, src: Source): boolean {
  const v = String(claim.value ?? "");
  if (!v.trim() || UNKNOWN.test(v)) return false;
  const t = norm(src.text);
  if (!t.includes(norm(v))) return false;
  const tn = new Set(nums(src.text).map((n) => n.replace(/,/g, "")));
  if (!nums(v).every((n) => tn.has(n))) return false;
  if (claim.subject) {
    const own = src.subject && norm(src.subject) === norm(claim.subject);
    if (!own && !t.includes(norm(claim.subject))) return false;
  }
  return true;
}

function absenceLine(c: Claim): string {
  if (c.field === "stance") return NO_POSITION;
  if (c.field === "vote") return NO_VOTE;
  return NO_RECORD;
}

/** The pure check. Same input, same output. */
export function verifyClaims({ claims, sources, toolRuns = [] }: VerifyInput): VerifyOutput {
  const curated = sources.filter((s) => s.origin === "curated");
  const live = sources.filter((s) => s.origin === "live" && s.fetchedInRun === true);
  const out: VerifiedClaim[] = [];

  for (const c of claims) {
    const searched = c.searched?.length ? c.searched : [...new Set([...curated, ...live].map((s) => s.label))];
    const empty = c.value === null || c.value === undefined || !String(c.value).trim() || UNKNOWN.test(String(c.value));
    if (empty) {
      const line = absenceLine(c);
      out.push({ id: c.id, field: c.field, status: "no_record", display: line, note: line === NO_RECORD ? searchedLine(searched) : undefined, reason: "lookup returned no value" });
      continue;
    }
    const cur = curated.find((s) => supports(c, s));
    const liveOk = live.filter((s) => !invalidFor(c.field, s.url, c.subject));
    const liv = cur ? undefined : liveOk.find((s) => supports(c, s));
    const hit = cur ?? liv;
    if (hit) {
      // Curated wins; a valid live source with a different value for the same key is a disagreement.
      const other = c.key ? liveOk.find((s) => s !== hit && s.values && c.key! in s.values && norm(s.values[c.key!]) !== norm(String(c.value))) : undefined;
      if (cur && other) {
        out.push({ id: c.id, field: c.field, status: "differs", display: c.text, note: differsLine(c.office ?? "the official office"), source: { label: cur.label, url: cur.url, origin: "curated" }, reason: `curated value kept; ${other.label} differs` });
      } else {
        out.push({ id: c.id, field: c.field, status: "confirmed", display: c.text, source: { label: hit.label, url: hit.url, origin: hit.origin }, reason: cur ? "stated in curated data" : `stated in ${hit.label} (fetched this run)` });
      }
      continue;
    }
    const why = live.some((s) => supports(c, s)) ? "only an invalid source for this field states it" : "no curated record or fetched source states it";
    if (c.onFail === "drop") out.push({ id: c.id, field: c.field, status: "dropped", display: "", reason: why });
    else out.push({ id: c.id, field: c.field, status: "unsure", display: c.text.replace(/\s*$/, "") + UNSURE_SUFFIX, note: UNSURE_NOTE, reason: why });
  }

  const n = (s: Status) => out.filter((x) => x.status === s).length;
  const unsure = n("unsure");
  const checked = claims.length;
  const fallbacks = toolRuns.filter((r) => !r.ok && r.fallback).map((r) => r.fallback as string);
  return {
    claims: out,
    report: {
      checked,
      confirmed: n("confirmed") + n("differs"),
      unsure,
      noRecord: n("no_record"),
      differs: n("differs"),
      dropped: n("dropped"),
      summary: `Checked ${checked} claim${checked === 1 ? "" : "s"}, ${unsure} marked unsure`,
      unverified: out.filter((x) => x.status !== "confirmed").map((x) => ({ id: x.id, text: x.status === "dropped" ? (claims.find((c) => c.id === x.id)?.text ?? "") : x.display, status: x.status, note: x.note })),
      fallbacks,
    },
  };
}

/** Voter-facing text for a verified answer: kept sentences in order, each with its note. Dropped sentences are gone. */
export function renderVerified(vs: VerifiedClaim[]): string {
  return vs.filter((v) => v.status !== "dropped").map((v) => (v.note ? `${v.display} ${v.note}` : v.display)).join("\n");
}

// ---------------------------------------------------------------------------------------------------------------------
// Tool recovery: retry once, then fall back visibly. (Not pure: it calls the tool. verifyClaims stays pure.)

export async function withRetry<T>(tool: string, what: string, fn: () => Promise<T>, fallback: () => T | Promise<T>): Promise<{ value: T; run: ToolRun }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return { value: await fn(), run: { tool, ok: true, attempts: attempt, fallback: null } };
    } catch {
      /* retry once */
    }
  }
  return { value: await fallback(), run: { tool, ok: false, attempts: 2, fallback: fallbackLine(what) } };
}

/*
 * INTERFACE FOR THE AGENT TIMELINE (lib/api/agent.ts and AgentTimeline are owned by the agent-trace work; nothing here edits them)
 *   import { verifyBallotRun } from "../towny/verifyRun";       // standalone, pure, < 5 ms
 *   const v = verifyBallotRun(zip, { raceIds, measureIds, narration, toolRuns });
 *   // narration: each model sentence as { id, text, field, value } where value is the fact it asserts; unsourced ones come back "(unsure)".
 *   // toolRuns: wrap each tool call in withRetry(tool, host, fn, curatedFallback) and pass the runs; failures show as
 *   //            "Couldn't reach <host>, used curated data" in v.report.fallbacks.
 *   emit({ type: "verify", report: v.report, claims: v.claims });   // BallotAgent ignores unknown event types today
 *   // render as the second-to-last step: <VerifyStep report={v.report} claims={v.claims} />  (components/VerifyStep.tsx)
 */
