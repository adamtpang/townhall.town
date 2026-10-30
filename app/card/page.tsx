import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { validZip } from "../../lib/zip.mjs";
import { ballotFor } from "../../lib/tools";
import { issuesFor } from "../../lib/issueOrder";
import BallotCard from "./BallotCard";

export const metadata: Metadata = { title: "Your ballot card · townhall.town", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ zip?: string }> }) {
  const zip = validZip((await searchParams).zip);
  const b = zip ? ballotFor(zip) : null;
  if (!zip || !b) notFound();
  const ids = issuesFor(zip, b.state).map((i) => i.id);
  const races = b.races.map((r) => ({ id: r.id, title: r.title, judicial: (r as { judicial?: unknown }).judicial ? true : false, candidates: r.candidates.map((c) => ({ name: c.name })) }));
  return <BallotCard zip={zip} place={b.place} ids={ids} races={races} />;
}
