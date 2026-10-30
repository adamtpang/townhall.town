// Towny's view of the shared stance-eligibility rule (lib/stanceEligibility.ts). The rule itself lives there and is applied
// in lib/issues.stancesFor, so the main site and Towny count the same stances (Civic, Oct 30 1:54 PM CT).
import type { Stance } from "../issues";
import { stanceEligibility, type StanceGate, type GateCtx } from "../stanceEligibility";

export { qkey, CANDIDATE_CONNECTION, SLOGAN, isSlogan, isBallotpedia, type StanceGate, type GateCtx } from "../stanceEligibility";

/** Whether Towny may state (and count) this stance, and which source to cite. */
export function gateStance(s: Pick<Stance, "quote" | "sourceUrl" | "voteRecord">, campaignSite?: string | null, ctx: GateCtx = {}): StanceGate {
  return stanceEligibility(s, campaignSite, ctx);
}
