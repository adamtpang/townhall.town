// Accountability plug-in for the shared contract in lib/types.ts.
// Said vs did: each record pairs a public promise with the vote, bill or action
// that kept or broke it, both sourced. Nonpartisan: records, never vote advice.
import data from "../data/accountability.json";
import type { AccountabilityRecord, Politician, Source } from "./types";

type RawRecord = {
  issue: string;
  said: { text: string; date: string; source: string };
  did: { text: string; date: string; source: string } | null;
  status: "kept" | "broken" | "in_progress" | "compromise" | "unclear";
  rationale: string;
};
type RawPolitician = { name: string; office: string; party: string; promises: RawRecord[] };
const people = (data as { asOf: string; politicians: RawPolitician[] }).politicians;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const src = (url: string, date?: string): Source => ({
  label: `${new URL(url).hostname.replace(/^www\./, "")}${date ? `, ${date}` : ""}`,
  url,
});

const STATUS: Record<RawRecord["status"], AccountabilityRecord["status"]> = {
  kept: "kept",
  broken: "broken",
  in_progress: "in progress",
  compromise: "kept",
  unclear: "unclear",
};

export type AccountabilityDetail = AccountabilityRecord & { issue: string; rationale: string; compromise?: boolean };

export function getAccountability(name: string): AccountabilityDetail[] {
  const p = people.find((x) => norm(x.name) === norm(name));
  if (!p) return [];
  return p.promises.map((r) => ({
    issue: r.issue,
    promise: r.said.text,
    promiseSource: src(r.said.source, r.said.date),
    record: r.did ? r.did.text : "no record found",
    recordSource: r.did ? src(r.did.source, r.did.date) : undefined,
    status: r.did ? STATUS[r.status] : "no record found",
    compromise: r.status === "compromise" || undefined,
    rationale: r.rationale,
  }));
}

/** Kept share of decided records (kept, broken, compromise counts half). Null if nothing decided. */
export function keptRate(records: AccountabilityDetail[]): number | null {
  const decided = records.filter((r) => r.status === "kept" || r.status === "broken");
  if (!decided.length) return null;
  const score = decided.reduce((n, r) => n + (r.status === "broken" ? 0 : r.compromise ? 0.5 : 1), 0);
  return Math.round((score / decided.length) * 100);
}

/** Attach accountability to a Politician without changing anything else. */
export function withAccountability<T extends Politician>(p: T): T {
  const accountability = getAccountability(p.name);
  return accountability.length ? { ...p, accountability } : p;
}
