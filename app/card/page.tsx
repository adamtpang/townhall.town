import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { validZip } from "../../lib/zip.mjs";
import { ballotFor } from "../../lib/tools";
import { issuesFor } from "../../lib/issueOrder";
import BallotCard from "./BallotCard";
import type { PrintData } from "./PrintBallot";
import { printRules, officialOrder } from "../../lib/printRules";

export const metadata: Metadata = { title: "Your ballot card", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ zip?: string }> }) {
  const zip = validZip((await searchParams).zip);
  const b = zip ? ballotFor(zip) : null;
  // No ZIP or one we don't cover: send people to the ZIP box on the homepage instead of a 404.
  if (!zip || !b) redirect("/");
  const ids = issuesFor(zip, b.state).map((i) => i.id);
  // Photo (already all-or-none per race), site link: the same row as the Who section (Adam, Oct 29 11:28 PM CT).
  const races = b.races.map((r) => ({ id: r.id, title: r.title, level: r.level, judicial: (r as { judicial?: unknown }).judicial ? true : false, meta: (r as { meta?: unknown }).meta ?? null, candidates: r.candidates.map((c) => ({ name: c.name, party: c.party, photo: c.photo ?? null, campaignSite: (c as { campaignSite?: string | null }).campaignSite ?? null, officialSite: c.officialSite ?? null })) }));
  // Printed ballot: every race (court races too) and measure in data order; candidates in Civic's confirmed official order
  // (bp22 ballot_order_check), else data order with a † (Design addendum, Oct 30). Voter rules verbatim from Civic (print24).
  const st = b.state as PrintData["state"];
  const print: PrintData = {
    state: st,
    verify: (b as { verify?: { label: string; url: string } }).verify ?? null,
    rules: printRules(st),
    races: b.races.map((r) => {
      const o = officialOrder(zip, r.id, r.candidates.map((c) => ({ name: c.name, party: c.party ?? null })));
      return { id: r.id, title: r.title, judicial: !!(r as { judicial?: unknown }).judicial, source: r.source ?? null, orderConfirmed: o.confirmed, candidates: o.candidates };
    }),
    measures: ((b as { measures?: { id: string; title: string; source?: string | null }[] }).measures ?? []).map((m) => ({ id: m.id, title: m.title, source: m.source ?? null })),
  };
  return <div data-print-root><BallotCard zip={zip} place={b.place} ids={ids} races={races} print={print} /></div>;
}
