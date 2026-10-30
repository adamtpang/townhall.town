// Standalone entry point for the agent timeline (owned by the agent-trace work; this module does not touch lib/api/agent.ts).
// verifyBallotRun(zip, opts) builds claims from the ballot the agent just showed (race titles, candidates in ballot order,
// measure facts) plus any narration sentences, checks them with verifyClaims, and returns { claims, report } for <VerifyStep/>.
// Pure and synchronous (< 5 ms on the full 78701 ballot). Never reads or returns the voter's answers.
import { ballotFor } from "../tools";
import { measuresFor } from "../measures";
import { verifyClaims, type Claim, type Source, type ToolRun, type VerifyOutput } from "./verify";
import { OFFICE } from "./followup";

export type NarrationClaim = { id: string; text: string; field: Claim["field"]; value: string | null; subject?: string };

export function verifyBallotRun(
  zip: string,
  opts: { raceIds?: string[]; measureIds?: string[]; narration?: NarrationClaim[]; liveSources?: Source[]; toolRuns?: ToolRun[] } = {},
): VerifyOutput {
  const b = ballotFor(zip);
  const claims: Claim[] = [];
  const sources: Source[] = [...(opts.liveSources ?? [])];
  if (b) {
    const races = b.races.filter((r) => !opts.raceIds || opts.raceIds.includes(r.id));
    for (const r of races) {
      const listed = r.candidates.map((c, i) => `${i + 1}. ${c.name}`).join(" ");
      if (r.source) sources.push({ url: r.source, label: hostOf(r.source), origin: "curated", text: `${r.title}. Ballot order: ${listed}` });
      claims.push({ id: `${r.id}.order`, field: "race", text: `${r.title}: ${r.candidates.map((c) => c.name).join(", ") || "no candidates listed"}, in ballot order.`, value: r.candidates.length ? `Ballot order: ${listed}` : null, office: OFFICE[zip], searched: r.source ? [hostOf(r.source)] : ["ballot data"] });
    }
    const ms = measuresFor(zip).filter((m) => !opts.measureIds || opts.measureIds.includes(m.id));
    for (const m of ms) {
      for (const [k, f] of [["whatChanges", m.whatChanges], ["ifYes", m.ifYes], ["ifNo", m.ifNo]] as const) {
        if (f?.sourceUrl) sources.push({ url: f.sourceUrl, label: hostOf(f.sourceUrl), origin: "curated", text: f.text });
        claims.push({ id: `${m.id}.${k}`, field: "measure", text: `${m.title}: ${f?.text ?? ""}`, value: f?.text ?? null, key: `${m.id}.${k}`, office: OFFICE[zip], searched: f?.sourceUrl ? [hostOf(f.sourceUrl)] : ["measure data"] });
      }
    }
  }
  for (const n of opts.narration ?? []) claims.push({ ...n, onFail: "unsure" });
  return verifyClaims({ claims, sources, toolRuns: opts.toolRuns });
}

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
