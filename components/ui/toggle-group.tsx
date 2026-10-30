"use client";
// shadcn-style ToggleGroup (type="single") with radiogroup semantics and roving focus. Written locally because
// @radix-ui/react-toggle-group is not in package.json and this build must not change dependencies.
// Arrow keys (and Home/End) move focus between items; Space or Enter selects (native button click).
import * as React from "react";
import { cn } from "../../lib/utils";

type Item = { value: string; label: React.ReactNode; ariaLabel: string; [data: `data-${string}`]: string | number | undefined };
export function ToggleGroup({ value, onValueChange, items, className, itemClassName, ...rest }: {
  value: string | null; onValueChange: (v: string) => void; items: Item[]; className?: string; itemClassName?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const sel = items.findIndex((i) => i.value === value);
  const [focusIdx, setFocusIdx] = React.useState(sel >= 0 ? sel : 0);
  React.useEffect(() => { if (sel >= 0) setFocusIdx(sel); }, [sel]);
  const move = (to: number) => { const n = items.length; const k = (to + n) % n; setFocusIdx(k); refs.current[k]?.focus(); };
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i + 1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); move(0); }
    else if (e.key === "End") { e.preventDefault(); move(items.length - 1); }
  };
  return (
    <div role="radiogroup" className={className} data-toggle-group {...rest}>
      {items.map((it, i) => {
        const { value: v, label, ariaLabel, ...data } = it;
        const on = v === value;
        return (
          <button key={v} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} aria-label={ariaLabel}
            tabIndex={i === focusIdx ? 0 : -1} data-state={on ? "on" : "off"} onFocus={() => setFocusIdx(i)}
            onKeyDown={(e) => onKeyDown(e, i)} onClick={() => onValueChange(v)} className={cn(itemClassName)} {...data}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
