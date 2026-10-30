"use client";
// Design part 1 C + motion §2.2 (Oct 30 2026): one folder style for races, measures and their details. Native <details>
// so every word stays in the page (find-in-page, print, no-JS, server markup) and closed by default; when JS runs the
// body animates height to auto (220ms, ease.out). Reduced motion: the height is instant and only opacity fades.
import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { m, useReducedMotion } from "framer-motion";
import { accordion } from "../lib/motion";

export function Chev() {
  return <svg aria-hidden data-chev viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-black/60"><path d="m6 9 6 6 6-6" /></svg>;
}

type Data = Record<`data-${string}`, string | boolean | undefined>;
type FoldProps = { summary: ReactNode; children: ReactNode; open?: boolean; className?: string; summaryClassName?: string; bodyClassName?: string; id?: string } & Data;

/** The disclosure: summary always visible, body folds. `data-expanded` drives the chevron so it turns at click time. */
export function Fold({ summary, children, open = false, className = "", summaryClassName = "", bodyClassName = "", id, ...data }: FoldProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [shown, setShown] = useState(open); // the details open attribute
  const [expanded, setExpanded] = useState(open); // where the animation is heading
  const reduce = useReducedMotion();
  const want = useRef(open);
  useEffect(() => { // deep links, find-in-page and scripts open the native element; follow it.
    const d = ref.current; if (!d) return;
    const on = () => { if (d.open) { want.current = true; setShown(true); setExpanded(true); } };
    d.addEventListener("toggle", on);
    return () => d.removeEventListener("toggle", on);
  }, []);
  const click = (e: MouseEvent) => {
    e.preventDefault();
    if (expanded) { // fold, then drop the open attribute once the height reaches 0 (timer = backstop if features lag)
      want.current = false; setExpanded(false);
      setTimeout(() => { if (!want.current) setShown(false); }, reduce ? 0 : 260);
    } else { want.current = true; setShown(true); setExpanded(true); }
  };
  const a = accordion(expanded, reduce);
  return (
    <details ref={ref} id={id} open={shown} data-expanded={expanded ? "true" : "false"} className={className} {...data}>
      <summary onClick={click} aria-expanded={expanded} className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${summaryClassName}`}>{summary}</summary>
      <m.div initial={false} animate={a.animate} transition={a.transition} style={{ overflow: "hidden" }}
        data-fold-body>
        <div className={bodyClassName}>{children}</div>
      </m.div>
    </details>
  );
}

/** A nested item inside a race or measure: hairline rows (the parent gives divide-y), no card. Trigger text-base, min-h-11. */
export function FoldItem({ label, children, open, className = "", ...data }: { label: ReactNode; children: ReactNode; open?: boolean; className?: string } & Data) {
  return (
    <Fold open={open} className={className} bodyClassName="pb-4" {...data}
      summaryClassName="flex min-h-11 items-center justify-between gap-4 text-base text-black"
      summary={<><span className="min-w-0">{label}</span><Chev /></>}>
      {children}
    </Fold>
  );
}
