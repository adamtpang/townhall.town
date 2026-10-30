"use client";
// "Who lines up" race list. Design sign-off (Oct 30, 12:39 AM): under 768px a shadcn Accordion (type "multiple"),
// every race closed by default; each trigger is a full-width row of at least 56px with the race H3 left and a 16px
// chevron right; under it, while closed, one 14/20 weight-450 line per candidate in ballot order:
// "Name · 4 of 7 issues · B" (grade inline, same colour, only where the race is grade-eligible) or
// "Name · No public position found yet". Races are split by a 1px black/15 divider, radius 0, no open-state shading.
// At 768px and up the earlier layout is unchanged (RaceFold, open).
import { useEffect, useState, type ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import RaceFold from "./RaceFold";

export type WhoLine = { name: string; sourced: number; agree: number; n: number; grade: string | null };
export type WhoRace = { id: string; title: string; lines: WhoLine[]; content: ReactNode };

export const NO_POSITION_LINE = "No public position found yet";
export function lineText(l: WhoLine): string {
  if (l.sourced === 0) return `${l.name} · ${NO_POSITION_LINE}`;
  if (l.n === 0) return `${l.name} · No stated position on the issues you answered`;
  return `${l.name} · ${l.agree} of ${l.n} issue${l.n === 1 ? "" : "s"}${l.grade ? ` · ${l.grade}` : ""}`;
}
/** The old fold text, kept for desktop. */
const foldText = (l: WhoLine) => (l.sourced === 0 ? "no public position found yet" : l.n > 0 ? `${l.agree} of ${l.n} issues match` : "no stated position on the issues you answered");

export default function WhoRaces({ races }: { races: WhoRace[] }) {
  // Hydration-safe: the server (and first client render) use the desktop layout; the effect switches to the accordion under 768.
  const [wide, setWide] = useState(true);
  const [open, setOpen] = useState<string[]>([]);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  if (wide) {
    return (
      <div className="space-y-8">
        {races.map((r) => (
          <div key={r.id} data-race={r.id}>
            <RaceFold id={r.id} title={r.title} lines={r.lines.map((l) => ({ name: l.name, text: foldText(l) }))}>{r.content}</RaceFold>
          </div>
        ))}
      </div>
    );
  }
  return (
    <Accordion type="multiple" value={open} onValueChange={setOpen} className="border-t border-black/15" data-who-accordion>
      {races.map((r) => {
        const isOpen = open.includes(r.id);
        return (
          <AccordionItem key={r.id} value={r.id} data-race={r.id} className="rounded-none border-b border-black/15 bg-transparent last:border-b">
            <AccordionTrigger className="min-h-14 w-full rounded-none py-3 text-base font-[530] text-black hover:no-underline data-[state=open]:bg-transparent [&>svg]:text-black/60">
              <span className="min-w-0">{r.title}</span>
            </AccordionTrigger>
            {!isOpen ? (
              <ul className="pb-4 text-sm font-[450] leading-5 text-black/80" data-fold-lines>
                {r.lines.map((l) => <li key={l.name} className="truncate" data-fold-line>{lineText(l)}</li>)}
              </ul>
            ) : null}
            <AccordionContent forceMount className="pb-6 data-[state=closed]:hidden">{r.content}</AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
