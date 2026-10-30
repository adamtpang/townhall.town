"use client";
// "Who lines up" race list. Design sign-off (Oct 30, 12:39 AM): under 768px a shadcn Accordion (type "multiple"),
// every race closed by default; each trigger is a full-width row of at least 56px with the race H3 left and a 16px
// chevron right; under it, while closed, one 14/20 weight-450 line per candidate in ballot-data order:
// "Name · 4 of 7 issues · B" (grade inline, same colour, only where the race is grade-eligible) or
// "Name · No public position found yet". Races are split by a 1px black/15 divider, radius 0, no open-state shading.
// Design p12 #3 (2:27 AM): the same Accordion at 768px and up too, with the first 3 races open by default (phones stay all closed) and the rest
// closed (same 56px trigger and chevron). p12 #4: the closed summary lines sit inside the trigger, so tapping one opens
// the race; desktop uses the phone's line format ("Name · 1 of 3 issues · C", no letter when hidden).
// Design p13 #3: closed lines wrap between words, never truncate (390px: "V. Alonzo Echavarria-Garza · No public position
// found yet" stays whole). p13 #5: a race without letters (same gradesHidden rule as RaceFooter) also shows the
// GRADES_ABSENT_LINE in the closed row, one 12/16 black/60 line under the summary lines.
import { useEffect, useState, type ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { gradesAbsentLine } from "../lib/grades.mjs";

export type WhoLine = { name: string; sourced: number; agree: number; n: number; grade: string | null };
export type WhoRace = { id: string; title: string; lines: WhoLine[]; content: ReactNode; gradesHidden?: string | null };

export const NO_POSITION_LINE = "No public position found yet";
export const overlapLine = (agree: number, n: number) => `Issue overlap: ${agree} of ${n}`;
export const OPEN_BY_DEFAULT = 3;
export function lineText(l: WhoLine): string {
  // QA 10:50 AM CT Oct 30: one empty-state wording, and the overlap line only with 2+ shared issues (same rule and
  // wording as the card; Adam: overlap is labeled as overlap, never a match or a recommendation).
  if (l.sourced === 0 || l.n === 0) return `${l.name} · ${NO_POSITION_LINE}`;
  if (l.n < 2) return l.name;
  return `${l.name} · ${overlapLine(l.agree, l.n)}${l.grade ? ` · ${l.grade}` : ""}`;
}

export default function WhoRaces({ races }: { races: WhoRace[] }) {
  // Phones (<768px) start with every race closed (Oct 30 sign-off); 768px and up open the first 3 (design p12 #3).
  const [open, setOpen] = useState<string[]>([]);
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setOpen((cur) => (cur.length ? cur : races.slice(0, OPEN_BY_DEFAULT).map((r) => r.id)));
  }, [races]);
  return (
    <Accordion type="multiple" value={open} onValueChange={setOpen} className="border-t border-black/15" data-who-accordion>
      {races.map((r) => {
        const isOpen = open.includes(r.id);
        return (
          <AccordionItem key={r.id} value={r.id} data-race={r.id} data-open={isOpen ? "1" : "0"} className="rounded-none border-b border-black/15 bg-transparent last:border-b">
            <AccordionTrigger className="min-h-14 w-full items-start rounded-none py-3 text-base font-[530] text-black hover:no-underline data-[state=open]:bg-transparent [&>svg]:mt-1 [&>svg]:text-black/60">
              <span className="flex min-w-0 flex-col">
                <span className="min-w-0">{r.title}</span>
                {!isOpen ? (
                  <span className="mt-1 flex min-w-0 flex-col text-sm font-[450] leading-5 text-black/80" data-fold-lines>
                    {r.lines.map((l) => <span key={l.name} className="block whitespace-normal [overflow-wrap:normal] [word-break:normal] hyphens-none" data-fold-line>{lineText(l)}</span>)}
                    {r.gradesHidden ? <span className="mt-1 block whitespace-normal text-xs font-[450] leading-4 text-black/60" data-fold-grades-absent={r.gradesHidden}>{gradesAbsentLine(r.gradesHidden)}</span> : null}
                  </span>
                ) : null}
              </span>
            </AccordionTrigger>
            <AccordionContent forceMount className="pb-6 data-[state=closed]:hidden">{r.content}</AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
