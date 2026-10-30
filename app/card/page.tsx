import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { validZip } from "../../lib/zip.mjs";
import { ballotFor } from "../../lib/tools";
import { issuesFor } from "../../lib/issueOrder";
import { inOfficialOrder } from "../../lib/ballotOrder";
import BallotCard from "./BallotCard";
import { orderLineFor } from "../../lib/towny/ballotOrder";
import PolyStrip from "../../components/PolyStrip";
import TownyFab from "../../components/towny/TownyFab";
import type { PrintData } from "./PrintBallot";
import { printRules, officialOrder, orderCite, raceOrder } from "../../lib/printRules";
import { ORDER_UNSURE_LINE, splitGroupsFor, splitIds } from "../../lib/printText";

const SF_PORTAL = { label: "SF Department of Elections Voter Portal", url: "https://sfelections.org/tools/portal/" };

export const metadata: Metadata = { title: "Your ballot card", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ zip?: string }> }) {
  const zip = validZip((await searchParams).zip);
  const b = zip ? ballotFor(zip) : null;
  // No ZIP or one we don't cover: send people to the ZIP box on the homepage instead of a 404.
  // Audit 3:05 PM (Oct 30): an uncovered ZIP lands on home with that ZIP, so home shows the existing notice + city buttons.
  if (!zip || !b) redirect(zip ? `/?zip=${zip}` : "/");
  const ids = issuesFor(zip, b.state).map((i) => i.id);
  // Photo (already all-or-none per race), site link: the same row as the Who section (Adam, Oct 29 11:28 PM CT).
  const bRaces = raceOrder(zip, b.races);
  // Civic print29 P1: split groups come from ballots.json's dependsOnAddress flags (plus the fixed TX-10/37-style groups).
  // Their races are daggered and never sit under a confirmed-order line.
  const splitGroups = splitGroupsFor(zip, bRaces.map((r) => ({ id: r.id, title: r.title, addressDependent: (r as { dependsOnAddress?: boolean }).dependsOnAddress === true })));
  const inSplit = splitIds(splitGroups);
  // Merge of batch1 03c9b97: each card race shows batch1's order line (lib/towny/ballotOrder). Civic print29 P1: a split race
  // never carries the confirmed claim (unsure line instead), and Civic's 10001 relabel (AD71 copy) applies on screen too.
  const nyCite = zip === "10001" ? orderCite(zip) : null;
  const cardOrder = (r: (typeof bRaces)[number]) => {
    const l = orderLineFor(zip, r);
    if (!l) return null;
    const confirmed = l.confirmed && !inSplit.has(r.id);
    const label = confirmed && nyCite ? nyCite.label : l.source?.chip ?? null;
    return { text: confirmed ? l.text : ORDER_UNSURE_LINE, confirmed, url: l.source?.url ?? null, label };
  };
  // Merge of prod 3cf1594 (Civic P1, 2:58 PM CT): on-screen candidates in the confirmed official order (lib/ballotOrder).
  const races = bRaces.map((r) => ({ id: r.id, title: r.title, level: r.level, judicial: (r as { judicial?: unknown }).judicial ? true : false, meta: (r as { meta?: unknown }).meta ?? null, order: cardOrder(r), candidates: inOfficialOrder(zip, r.id, r.candidates).map((c) => ({ name: c.name, party: c.party, photo: c.photo ?? null, campaignSite: (c as { campaignSite?: string | null }).campaignSite ?? null, officialSite: c.officialSite ?? null })) }));
  // Printed ballot: every race (court races too) and measure in data order; candidates in Civic's confirmed official order
  // (bp22 ballot_order_check), else data order with a † (Design addendum, Oct 30). Voter rules verbatim from Civic (print24).
  const st = b.state as PrintData["state"];
  const print: PrintData = {
    state: st,
    // QA P1 #3: SF voters' sample ballot comes from the SF Department of Elections Voter Portal (polling_locations.json
    // lookupUrlNote), not the CA SOS; it also goes in the printed Where block.
    verify: zip === "94103" ? SF_PORTAL : (b as { verify?: { label: string; url: string } }).verify ?? null,
    whereExtra: zip === "94103" ? SF_PORTAL : null,
    rules: printRules(st),
    orderCite: orderCite(zip),
    races: bRaces.map((r) => {
      const o = officialOrder(zip, r.id, r.candidates.map((c) => ({ name: c.name, party: c.party ?? null })));
      return { id: r.id, title: r.title, judicial: !!(r as { judicial?: unknown }).judicial, orderConfirmed: o.confirmed && !inSplit.has(r.id), candidates: o.candidates };
    }),
    splitGroups,
    measures: ((b as { measures?: { id: string; title: string; source?: string | null }[] }).measures ?? []).map((m) => ({ id: m.id, title: m.title })),
  };
  // Merge of prod 3cf1594 (QA 6b2ae5c P1-3): /card gets the same Towny button and panel, scoped to its ZIP.
  // Merge of batch1 03c9b97: the Polymarket ticker strip sits above the card (screen only).
  return (
    <>
      <PolyStrip ballot={b} />
      <div data-print-root><BallotCard zip={zip} place={b.place} county={(b as { county?: string }).county ? `${(b as { county?: string }).county}, ${b.state}` : null} ids={ids} races={races} print={print} /></div>
      <TownyFab zip={zip} />
    </>
  );
}
