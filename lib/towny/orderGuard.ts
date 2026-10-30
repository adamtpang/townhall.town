// Civic towny_order_check NO-GO (Adam, Oct 30 3:24 PM CT): the model path (/api/towny-test) presented the race list as ballot
// order, cited a non-sample-ballot page as "the official sample ballot", and listed split districts as if the voter had both.
// lib/townyPrompt.ts is hash-locked, so this post-check runs on every model reply instead:
//  1. any sentence claiming an order is removed and replaced by the per-race order line from data/ballot_order.json
//     (ORDER_CONFIRMED with the official source, else ORDER_UNSURE); Ballotpedia is never cited for order;
//  2. districts a ZIP spans that the reply names together get "Depending on your address, you'll have one of these" + the lookup.
import { ballotFor } from "../tools";
import { ORDER_CONFIRMED, ORDER_UNSURE, isRetention, officialOrder, orderSourceLinks, splitGroups, SPLIT_LINE } from "../ballotOrder";

export const ORDER_CLAIM =
  /\bballot order\b|\b(?:in|by) (?:the )?order (?:they|it|that|as|in which|shown|listed)\b|\border (?:they|it|that) (?:will )?appears?\b|\bas (?:they )?(?:appear|are listed) on (?:the|your) (?:\w+ )?ballot\b|\bofficial sample ballot\b|\bsample ballot order\b|\b(?:listed|appears?|shown) (?:first|last|at the top)\b|\btop of (?:the|your) ballot\b|\b(?:first|next|last) on (?:the|your) ballot\b|\border on (?:the|your) (?:\w+ )?ballot\b/i;

type Race = { id: string; title: string; level?: string; candidates?: { name: string }[] };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text: string, s: string) => s.length > 3 && new RegExp(`\\b${esc(s)}\\b`, "i").test(text);

export type Guarded = { reply: string; changed: string[] };

export function guardReply(zip: string | undefined, reply: string): Guarded {
  const changed: string[] = [];
  if (!zip) return { reply, changed };
  const b = ballotFor(zip);
  if (!b) return { reply, changed };
  const races = (b.races as Race[]).filter((r) => r.level !== "measure");
  let out = reply;
  const namedIn = (text: string) => races.filter((r) => mentions(text, r.title) || (r.candidates ?? []).some((c) => mentions(text, c.name)));

  // 0. Civic GO 73ddcbf P2 (Oct 30, 3:37 PM CT): a reply about retention races only (one judge, Yes or No) gets no order line.
  { const n = namedIn(reply);
    if (n.length && n.every(isRetention)) {
      for (const line of [ORDER_UNSURE, ORDER_CONFIRMED]) if (out.includes(line)) { out = out.split(line).join("").replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n").trim(); changed.push(`removed order line for retention races: ${line}`); }
      if (!ORDER_CLAIM.test(out)) return { reply: out, changed };
    } }

  // 1. order claims
  if (ORDER_CLAIM.test(out)) {
    const lines = out.split("\n").map((line) => {
      const parts = line.split(/(?<=[.!?])\s+/);
      const keep = parts.filter((p) => !ORDER_CLAIM.test(p) || p.trim() === ORDER_UNSURE);
      if (keep.length !== parts.length) changed.push(...parts.filter((p) => !keep.includes(p)).map((p) => `removed order claim: ${p.trim()}`));
      return keep.length ? keep.join(" ") : null;
    });
    out = lines.filter((l): l is string => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const named = namedIn(reply).filter((r) => !isRetention(r));
    const conf = named.filter((r) => officialOrder(zip, r.id));
    const unsure = named.filter((r) => !officialOrder(zip, r.id));
    const add: string[] = ["The races here are not listed in the order they appear on the ballot."];
    if (conf.length) {
      const src = orderSourceLinks(conf.map((r) => officialOrder(zip, r.id)!.source));
      add.push(`${ORDER_CONFIRMED} (Candidate order within: ${conf.map((r) => r.title).join("; ")}.) Source: ${src.map((s) => `${s.label}: ${s.url}`).join("; ")}`);
    }
    if (unsure.length || (!conf.length && named.length)) add.push(unsure.length ? `${ORDER_UNSURE} (${unsure.map((r) => r.title).join("; ")}.)` : ORDER_UNSURE);
    out = `${out}\n\n${add.join("\n")}`;
    changed.push("appended per-race order lines");
  }

  // 2. split districts named together
  for (const g of splitGroups(zip)) {
    const here = g.raceIds.map((id) => races.find((r) => r.id === id)).filter((r): r is Race => !!r && (mentions(out, r.title) || (r.candidates ?? []).some((c) => mentions(out, c.name))));
    if (here.length < 2) continue;
    const need: string[] = [];
    if (!out.includes(SPLIT_LINE)) need.push(`${SPLIT_LINE}: ${here.map((r) => r.title).join(" or ")}.`);
    if (!out.includes(g.lookup.url)) need.push(`Look up yours by address: ${g.lookup.label}: ${g.lookup.url}`);
    if (need.length) { out = `${out}\n\n${need.join(" ")}`; changed.push(`split districts: ${g.raceIds.join("/")}`); }
  }
  return { reply: out, changed };
}
