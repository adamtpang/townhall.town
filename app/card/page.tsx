import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { validZip } from "../../lib/zip.mjs";
import { ballotFor } from "../../lib/tools";
import { issuesFor } from "../../lib/issueOrder";
import BallotCard from "./BallotCard";
import TownyFab from "../../components/towny/TownyFab";

export const metadata: Metadata = { title: "Your ballot card", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ zip?: string }> }) {
  const zip = validZip((await searchParams).zip);
  const b = zip ? ballotFor(zip) : null;
  // No ZIP or one we don't cover: send people to the ZIP box on the homepage instead of a 404.
  if (!zip || !b) redirect("/");
  const ids = issuesFor(zip, b.state).map((i) => i.id);
  // Photo (already all-or-none per race), site link: the same row as the Who section (Adam, Oct 29 11:28 PM CT).
  const races = b.races.map((r) => ({ id: r.id, title: r.title, level: r.level, judicial: (r as { judicial?: unknown }).judicial ? true : false, meta: (r as { meta?: unknown }).meta ?? null, candidates: r.candidates.map((c) => ({ name: c.name, party: c.party, photo: c.photo ?? null, campaignSite: (c as { campaignSite?: string | null }).campaignSite ?? null, officialSite: c.officialSite ?? null })) }));
  // QA pre-pass 6b2ae5c P1-3: /card is the ballot results page people land on (calendar link, where and when), not a
  // print-only view (printing hides the button and panel), so it gets the same Towny button and panel, scoped to its ZIP.
  return (
    <>
      <BallotCard zip={zip} place={b.place} ids={ids} races={races} />
      <TownyFab zip={zip} />
    </>
  );
}
