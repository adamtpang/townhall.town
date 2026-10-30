"use client";
// Design p10 P1 (Who lines up, under 768px): each race folds to its title plus one line per candidate (every candidate
// is named, in ballot-data order); the full rows, grades with their label, sources and the research button open below.
// At 768px and up the fold starts open, so desktop is unchanged.
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type FoldLine = { name: string; text: string };
export default function RaceFold({ id, title, lines, children }: { id: string; title: string; lines: FoldLine[]; children: ReactNode }) {
  const [open, setOpen] = useState(() => typeof window === "undefined" || !window.matchMedia || window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => { if (mq.matches) setOpen(true); };
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return (
    <details open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} data-race-fold={id}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {/* Design p11 #5: same affordance as the phone accordion: the H3 left, a 16px chevron right (no "Details" pill). */}
        <div className="flex min-h-11 items-center justify-between gap-3">
          <h3 className="text-base font-[530]">{title}</h3>
          <ChevronDown aria-hidden data-fold-chevron className={`h-4 w-4 shrink-0 text-black/60 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
        {!open ? (
          <ul className="pb-1 text-sm leading-6 text-black/80" data-fold-lines>
            {lines.map((l) => <li key={l.name} className="truncate"><span className="font-[530] text-black">{l.name}</span>: {l.text}</li>)}
          </ul>
        ) : null}
      </summary>
      {children}
    </details>
  );
}
